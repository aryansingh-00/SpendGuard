import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const expenseId = searchParams.get("expenseId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const whereClause: any = {
      companyId: user.companyId,
    };

    if (status && status !== "all") {
      whereClause.status = status;
    }

    if (expenseId) {
      whereClause.expenseId = expenseId;
    }

    // Role-based scoping: Employees only see payments for their own expenses
    if (user.role === "EMPLOYEE") {
      whereClause.expense = {
        employeeProfile: {
          userId: user.id,
        },
      };
    }

    const paymentTransactions = await prisma.paymentTransaction.findMany({
      where: whereClause,
      include: {
        expense: {
          include: {
            employeeProfile: {
              include: { user: true },
            },
            department: true,
            aiAnalysis: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });

    return NextResponse.json({
      success: true,
      count: paymentTransactions.length,
      paymentTransactions,
    });
  } catch (error: any) {
    console.error("List Payments API Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve payment transactions." },
      { status: 500 }
    );
  }
}
