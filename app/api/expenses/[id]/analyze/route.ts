import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { evaluateSpendingPolicyFromDB } from "@/lib/policy-engine";
import { analyzeTransactionRisk } from "@/lib/ai/risk-engine";
import { synthesizeDecision } from "@/lib/decision-engine";
import { AIContext } from "@/lib/ai/schemas";
import { createPendingApproval } from "@/lib/approval/approval-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const { id } = await params;

    // 1. Fetch Expense with relations
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        employeeProfile: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            department: true,
          },
        },
        department: true,
        aiAnalysis: true,
      },
    });

    if (!expense || expense.companyId !== user.companyId) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    // Role check: Employee can only trigger analysis on their own expense
    if (user.role === "EMPLOYEE" && expense.employeeProfile.userId !== user.id) {
      return NextResponse.json(
        { error: "You are not authorized to analyze this expense." },
        { status: 403 }
      );
    }

    const employeeProfile = expense.employeeProfile;
    const department = expense.department;

    // 2. Fetch Employee Budget & Spending History
    const [empSpentAgg, pastExpenses] = await Promise.all([
      prisma.expense.aggregate({
        where: {
          employeeProfileId: employeeProfile.id,
          companyId: user.companyId,
          status: { in: ["APPROVED", "PAID"] },
          id: { not: expense.id }, // exclude current
        },
        _sum: { amount: true },
      }),
      prisma.expense.findMany({
        where: {
          employeeProfileId: employeeProfile.id,
          companyId: user.companyId,
          id: { not: expense.id },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          merchantName: true,
          amount: true,
          category: true,
          createdAt: true,
        },
      }),
    ]);

    const spentSoFar = empSpentAgg._sum.amount || 0;
    const monthlyLimit = employeeProfile.monthlyBudget || 0;
    const remainingBudget = Math.max(0, monthlyLimit - spentSoFar);

    const pastAmounts = pastExpenses.map((e) => e.amount);
    const avgPastAmount =
      pastAmounts.length > 0
        ? pastAmounts.reduce((a, b) => a + b, 0) / pastAmounts.length
        : expense.amount; // fallback if first expense

    // 3. Run Deterministic Policy Engine
    const policyResult = await evaluateSpendingPolicyFromDB({
      companyId: user.companyId,
      employeeProfileId: employeeProfile.id,
      departmentId: expense.departmentId,
      merchantName: expense.merchantName,
      amount: expense.amount,
      category: expense.category,
      purpose: expense.purpose,
    });

    // 4. Build Structured AI Context
    const aiContext: AIContext = {
      employee: {
        name: employeeProfile.user.name,
        role: employeeProfile.user.role,
        department: department.name,
      },
      transaction: {
        merchant: expense.merchantName,
        amount: expense.amount,
        category: expense.category,
        purpose: expense.purpose,
        date: expense.expenseDate.toISOString(),
      },
      budget: {
        monthlyLimit,
        spent: spentSoFar,
        remaining: remainingBudget,
      },
      history: {
        averageTransaction: Math.round(avgPastAmount),
        transactionCount: pastExpenses.length,
        recentTransactions: pastExpenses.map((p) => ({
          merchant: p.merchantName,
          amount: p.amount,
          category: p.category,
          date: p.createdAt.toISOString(),
        })),
      },
      policy: {
        decision: policyResult.decision,
        reasons: policyResult.reasons,
      },
    };

    // 5. Run AI Risk Engine
    const aiRiskResult = await analyzeTransactionRisk(aiContext);

    // 6. Synthesize Dual-Engine Decision (Policy + AI)
    const synthesis = synthesizeDecision(policyResult, aiRiskResult);

    // 7. Persist or Update AIAnalysis in Database
    const aiAnalysisRecord = await prisma.aIAnalysis.upsert({
      where: { expenseId: expense.id },
      create: {
        expenseId: expense.id,
        riskScore: aiRiskResult.riskScore,
        riskLevel: aiRiskResult.riskLevel,
        summary: aiRiskResult.summary,
        reason: aiRiskResult.summary,
        recommendation: aiRiskResult.recommendation,
        signals: JSON.stringify(aiRiskResult.signals),
        anomaliesDetected: JSON.stringify(aiRiskResult.signals.map((s) => s.message)),
        suggestedCategory: expense.category,
        isDuplicate: aiRiskResult.isDuplicate || false,
        duplicateRiskScore: aiRiskResult.isDuplicate ? 85 : 0,
        model: aiRiskResult.model || "spendguard-heuristic-v1",
        rawAnalysis: JSON.stringify({ aiContext, aiRiskResult, synthesis }),
        analyzedAt: new Date(),
      },
      update: {
        riskScore: aiRiskResult.riskScore,
        riskLevel: aiRiskResult.riskLevel,
        summary: aiRiskResult.summary,
        reason: aiRiskResult.summary,
        recommendation: aiRiskResult.recommendation,
        signals: JSON.stringify(aiRiskResult.signals),
        anomaliesDetected: JSON.stringify(aiRiskResult.signals.map((s) => s.message)),
        isDuplicate: aiRiskResult.isDuplicate || false,
        duplicateRiskScore: aiRiskResult.isDuplicate ? 85 : 0,
        model: aiRiskResult.model || "spendguard-heuristic-v1",
        rawAnalysis: JSON.stringify({ aiContext, aiRiskResult, synthesis }),
        analyzedAt: new Date(),
      },
    });

    // 8. Update Expense Status and Decision Reason
    let updatedStatus = expense.status;
    let pendingApproval = null;

    if (synthesis.finalDecision === "BLOCKED") {
      updatedStatus = "BLOCKED";
    } else if (synthesis.finalDecision === "APPROVAL_REQUIRED") {
      if (expense.status !== "PAID" && expense.status !== "READY_FOR_PAYMENT" && expense.status !== "APPROVED") {
        updatedStatus = "PENDING_APPROVAL";
      }
      // Create or ensure idempotent PENDING approval record
      pendingApproval = await createPendingApproval(expense.id, user.companyId);
    } else if (synthesis.finalDecision === "APPROVED") {
      if (expense.status === "PENDING_APPROVAL" || expense.status === "DRAFT") {
        updatedStatus = "APPROVED";
      }
    }

    const updatedExpense = await prisma.expense.update({
      where: { id: expense.id },
      data: {
        status: updatedStatus,
        policyDecision: policyResult.decision,
        policyReasons: JSON.stringify(policyResult.reasons),
        decisionReason: synthesis.summary,
      },
      include: {
        employeeProfile: { include: { user: true } },
        department: true,
        aiAnalysis: true,
        approvals: { include: { approver: true } },
      },
    });

    return NextResponse.json({
      expense: {
        id: updatedExpense.id,
        expenseNumber: updatedExpense.expenseNumber,
        merchantName: updatedExpense.merchantName,
        amount: updatedExpense.amount,
        category: updatedExpense.category,
        purpose: updatedExpense.purpose,
        status: updatedExpense.status,
      },
      policyEvaluation: policyResult,
      aiRiskAnalysis: {
        ...aiRiskResult,
        id: aiAnalysisRecord.id,
      },
      decisionSynthesis: synthesis,
      approval: pendingApproval,
    });
  } catch (error) {
    console.error("POST analyze expense error:", error);
    return NextResponse.json(
      { error: "Failed to perform AI risk analysis on expense." },
      { status: 500 }
    );
  }
}
