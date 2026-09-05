import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
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

    // Fetch approval with relations
    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        expense: {
          include: {
            employeeProfile: {
              include: {
                user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
              },
            },
            department: true,
            aiAnalysis: true,
            expenseReceipts: {
              orderBy: { createdAt: "desc" },
              include: {
                receiptAnalyses: {
                  orderBy: { createdAt: "desc" },
                  include: { expenseVerifications: true },
                },
              },
            },
            verifications: {
              orderBy: { createdAt: "desc" },
              include: {
                receiptAnalysis: { include: { receipt: true } },
              },
            },
          },
        },
        approver: {
          select: { id: true, name: true, email: true, role: true, avatarUrl: true },
        },
      },
    });

    if (!approval || approval.companyId !== user.companyId) {
      return NextResponse.json({ error: "Approval request not found." }, { status: 404 });
    }

    if (user.role === "EMPLOYEE" && approval.expense.employeeProfile.userId !== user.id) {
      return NextResponse.json(
        { error: "You are not authorized to view this approval request." },
        { status: 403 }
      );
    }

    const expense = approval.expense;
    const employeeProfile = expense.employeeProfile;
    const department = expense.department;

    // Compute live budget impact
    const [empSpentAgg, deptSpentAgg, compSpentAgg, auditLogs] = await Promise.all([
      prisma.expense.aggregate({
        where: {
          employeeProfileId: employeeProfile.id,
          companyId: user.companyId,
          status: { in: ["APPROVED", "READY_FOR_PAYMENT", "PAID"] },
          id: { not: expense.id },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          departmentId: department.id,
          companyId: user.companyId,
          status: { in: ["APPROVED", "READY_FOR_PAYMENT", "PAID"] },
          id: { not: expense.id },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          companyId: user.companyId,
          status: { in: ["APPROVED", "READY_FOR_PAYMENT", "PAID"] },
          id: { not: expense.id },
        },
        _sum: { amount: true },
      }),
      prisma.auditLog.findMany({
        where: {
          companyId: user.companyId,
          OR: [
            { entityId: approval.id },
            { entityId: expense.id },
          ],
        },
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { monthlyBudget: true, currency: true },
    });

    const empBudget = employeeProfile.monthlyBudget || 0;
    const empSpent = empSpentAgg._sum.amount || 0;
    const empRemainingBefore = Math.max(0, empBudget - empSpent);
    const empRemainingAfter = Math.max(0, empRemainingBefore - expense.amount);

    const deptBudget = department.monthlyBudget || 0;
    const deptSpent = deptSpentAgg._sum.amount || 0;
    const deptRemainingBefore = Math.max(0, deptBudget - deptSpent);
    const deptRemainingAfter = Math.max(0, deptRemainingBefore - expense.amount);

    const compBudget = company?.monthlyBudget || 0;
    const compSpent = compSpentAgg._sum.amount || 0;
    const compRemainingBefore = Math.max(0, compBudget - compSpent);
    const compRemainingAfter = Math.max(0, compRemainingBefore - expense.amount);

    let policyReasons: string[] = [];
    try {
      policyReasons = JSON.parse(expense.policyReasons || "[]");
    } catch {
      policyReasons = [];
    }

    let signals: any[] = [];
    try {
      if (expense.aiAnalysis?.signals) {
        signals =
          typeof expense.aiAnalysis.signals === "string"
            ? JSON.parse(expense.aiAnalysis.signals)
            : expense.aiAnalysis.signals;
      }
    } catch {
      signals = [];
    }

    const primaryReceipt = expense.expenseReceipts?.[0] || null;
    const primaryAnalysis = primaryReceipt?.receiptAnalyses?.[0] || null;
    const primaryVerification = expense.verifications?.[0] || null;

    return NextResponse.json({
      approval: {
        id: approval.id,
        status: approval.status,
        decision: approval.decision,
        comment: approval.comment,
        createdAt: approval.createdAt,
        updatedAt: approval.updatedAt,
        decidedAt: approval.decidedAt,
        approver: approval.approver,
      },
      expense: {
        id: expense.id,
        expenseNumber: expense.expenseNumber,
        merchantName: expense.merchantName,
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category,
        purpose: expense.purpose,
        expenseDate: expense.expenseDate,
        status: expense.status,
        paymentStatus: expense.paymentStatus,
        policyDecision: expense.policyDecision,
        policyReasons,
        decisionReason: expense.decisionReason,
        receipt: primaryReceipt,
        receiptAnalysis: primaryAnalysis,
        verification: primaryVerification,
        employee: {
          id: employeeProfile.id,
          name: employeeProfile.user.name,
          email: employeeProfile.user.email,
          role: employeeProfile.user.role,
          monthlyBudget: employeeProfile.monthlyBudget,
          userId: employeeProfile.userId,
        },
        department: {
          id: department.id,
          name: department.name,
          code: department.code,
          monthlyBudget: department.monthlyBudget,
        },
        aiAnalysis: expense.aiAnalysis
          ? {
              ...expense.aiAnalysis,
              signals,
            }
          : null,
      },
      budgetImpact: {
        employee: {
          budget: empBudget,
          spent: empSpent,
          remainingBefore: empRemainingBefore,
          remainingAfter: empRemainingAfter,
          isOverBudget: empRemainingBefore < expense.amount,
        },
        department: {
          budget: deptBudget,
          spent: deptSpent,
          remainingBefore: deptRemainingBefore,
          remainingAfter: deptRemainingAfter,
          isOverBudget: deptRemainingBefore < expense.amount,
        },
        company: {
          budget: compBudget,
          spent: compSpent,
          remainingBefore: compRemainingBefore,
          remainingAfter: compRemainingAfter,
          isOverBudget: compRemainingBefore < expense.amount,
        },
      },
      auditLogs,
    });
  } catch (error) {
    console.error("GET Approval by ID Error:", error);
    return NextResponse.json(
      { error: "Failed to load approval details." },
      { status: 500 }
    );
  }
}
