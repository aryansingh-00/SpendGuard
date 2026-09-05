import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { evaluateSpendingPolicyFromDB } from "@/lib/policy-engine";
import { createPendingApproval } from "@/lib/approval/approval-service";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {
      companyId: user.companyId,
    };

    if (departmentId && departmentId !== "all") where.departmentId = departmentId;
    if (employeeId && employeeId !== "all") where.employeeProfileId = employeeId;
    if (status && status !== "all") where.status = status;
    if (category && category !== "all") where.category = category;

    // If user is EMPLOYEE, only show their own expenses
    if (user.role === "EMPLOYEE") {
      const empProfile = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
      });
      if (empProfile) {
        where.employeeProfileId = empProfile.id;
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        employeeProfile: {
          include: { user: true },
        },
        department: true,
        receipt: true,
        aiAnalysis: true,
        approvals: {
          include: { approver: true },
        },
        transactions: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const parsed = expenses.map((e) => {
      let policyReasons: string[] = [];
      try {
        policyReasons = JSON.parse(e.policyReasons || "[]");
      } catch {
        policyReasons = [];
      }

      return {
        ...e,
        employee: {
          id: e.employeeProfile.id,
          name: e.employeeProfile.user.name,
          email: e.employeeProfile.user.email,
          role: e.employeeProfile.user.role,
          monthlyBudget: e.employeeProfile.monthlyBudget,
          spentThisMonth: 0,
          userId: e.employeeProfile.userId,
        },
        policyReasons,
        policyViolations: e.policyViolations ? JSON.parse(e.policyViolations) : [],
        aiAnalysis: e.aiAnalysis
          ? {
              ...e.aiAnalysis,
              anomaliesDetected: e.aiAnalysis.anomaliesDetected
                ? JSON.parse(e.aiAnalysis.anomaliesDetected)
                : [],
            }
          : null,
      };
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("GET Expenses Error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const body = await request.json();
    const {
      employeeId,
      employeeProfileId,
      merchantName,
      amount,
      category,
      purpose,
      expenseDate,
      departmentId,
    } = body;

    const parsedAmount = parseFloat(amount);

    if (!merchantName || !merchantName.trim() || isNaN(parsedAmount) || parsedAmount <= 0 || !category) {
      return NextResponse.json(
        { error: "Valid merchant name, positive amount, and category are required." },
        { status: 400 }
      );
    }

    // Resolve employee profile ID with strict role enforcement
    let targetEmpProfileId: string | undefined = undefined;
    if (user.role === "EMPLOYEE") {
      const selfEmp = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
      });
      if (!selfEmp) {
        return NextResponse.json({ error: "Employee profile not found for user." }, { status: 404 });
      }
      targetEmpProfileId = selfEmp.id;
    } else {
      targetEmpProfileId = employeeProfileId || employeeId;
      if (!targetEmpProfileId) {
        const anyEmp = await prisma.employeeProfile.findFirst({
          where: { companyId: user.companyId },
        });
        if (anyEmp) {
          targetEmpProfileId = anyEmp.id;
        } else {
          return NextResponse.json({ error: "No employee profile found for company." }, { status: 400 });
        }
      }
    }

    // Verify employee belongs to company
    const employeeProfile = await prisma.employeeProfile.findUnique({
      where: { id: targetEmpProfileId },
      include: {
        user: true,
        department: true,
      },
    });

    if (!employeeProfile || employeeProfile.companyId !== user.companyId) {
      return NextResponse.json({ error: "Target employee profile not found." }, { status: 404 });
    }

    const targetDeptId = departmentId || employeeProfile.departmentId;
    if (!targetDeptId) {
      return NextResponse.json({ error: "Employee must belong to a department or departmentId must be provided." }, { status: 400 });
    }

    // 1. Run Deterministic Spending Policy Engine
    const policyResult = await evaluateSpendingPolicyFromDB({
      companyId: user.companyId,
      employeeProfileId: employeeProfile.id,
      departmentId: targetDeptId,
      merchantName: merchantName.trim(),
      amount: parsedAmount,
      category: category.trim(),
      purpose: purpose?.trim() || "Operational expense",
    });

    // 2. Set status according to deterministic decision
    let finalStatus: string = "PENDING_APPROVAL";
    if (policyResult.decision === "BLOCKED") {
      finalStatus = "BLOCKED";
    } else if (policyResult.decision === "APPROVED") {
      finalStatus = "APPROVED";
    } else {
      finalStatus = "PENDING_APPROVAL";
    }

    const expenseCount = await prisma.expense.count({
      where: { companyId: user.companyId },
    });
    const expenseNumber = `EXP-2026-${String(expenseCount + 1).padStart(3, "0")}`;

    // 3. Create Expense Record in Database
    const newExpense = await prisma.expense.create({
      data: {
        expenseNumber,
        employeeProfileId: employeeProfile.id,
        departmentId: targetDeptId,
        merchantName: merchantName.trim(),
        amount: parsedAmount,
        currency: "INR",
        category: category.trim(),
        purpose: purpose?.trim() || "Operational expense",
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        policyDecision: policyResult.decision,
        policyReasons: JSON.stringify(policyResult.reasons),
        status: finalStatus,
        paymentStatus: "UNPAID",
        decisionReason: policyResult.summary,
        policyViolations: JSON.stringify(
          policyResult.reasons.filter((r) => r.startsWith("✖") || r.startsWith("⚠"))
        ),
        companyId: user.companyId,
      },
      include: {
        employeeProfile: { include: { user: true } },
        department: true,
      },
    });

    // 4. Create pending approval if deterministic policy requires approval
    let approval = null;
    if (finalStatus === "PENDING_APPROVAL") {
      approval = await createPendingApproval(newExpense.id, user.companyId);
    }

    return NextResponse.json(
      {
        ...newExpense,
        policyEvaluation: policyResult,
        approval,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST Expense Error:", error);
    return NextResponse.json(
      { error: "Unable to evaluate and record expense. Please try again." },
      { status: 500 }
    );
  }
}
