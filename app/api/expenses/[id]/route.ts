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

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        employeeProfile: { include: { user: true } },
        department: true,
        receipt: true,
        aiAnalysis: true,
        approvals: {
          include: { approver: true },
          orderBy: { decidedAt: "desc" },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
        },
        paymentTransactions: {
          orderBy: { createdAt: "desc" },
        },
        expenseReceipts: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        verifications: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    // Tenant isolation check
    if (expense.companyId !== user.companyId) {
      return NextResponse.json({ error: "Unauthorized access to expense." }, { status: 403 });
    }

    // Employee isolation: Employee can only view their own expenses
    if (user.role === "EMPLOYEE" && expense.employeeProfile.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden. You can only view your own expenses." }, { status: 403 });
    }

    const formatted = {
      ...expense,
      employee: {
        id: expense.employeeProfile.id,
        name: expense.employeeProfile.user.name,
        email: expense.employeeProfile.user.email,
        role: expense.employeeProfile.user.role,
        monthlyBudget: expense.employeeProfile.monthlyBudget,
      },
      policyViolations: expense.policyViolations ? JSON.parse(expense.policyViolations) : [],
      aiAnalysis: expense.aiAnalysis
        ? {
            ...expense.aiAnalysis,
            anomaliesDetected: expense.aiAnalysis.anomaliesDetected
              ? JSON.parse(expense.aiAnalysis.anomaliesDetected)
              : [],
            signals: expense.aiAnalysis.signals
              ? JSON.parse(expense.aiAnalysis.signals)
              : [],
          }
        : null,
    };

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET Single Expense Error:", error);
    return NextResponse.json({ error: "Failed to fetch expense details." }, { status: 500 });
  }
}
