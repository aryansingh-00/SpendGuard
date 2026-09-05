import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { runExpenseVerification } from "@/lib/verification/expense-verification";

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
    const body = await request.json().catch(() => ({}));
    const { receiptAnalysisId } = body;

    // 1. Fetch Expense with latest receipt & analysis
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        employeeProfile: { include: { user: true } },
        expenseReceipts: {
          orderBy: { createdAt: "desc" },
          include: {
            receiptAnalyses: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });

    if (!expense || expense.companyId !== user.companyId) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    // Find target receipt analysis
    let targetAnalysis: any = null;
    let targetReceipt: any = null;

    if (receiptAnalysisId) {
      targetAnalysis = await prisma.receiptAnalysis.findUnique({
        where: { id: receiptAnalysisId },
        include: { receipt: true },
      });
      targetReceipt = targetAnalysis?.receipt;
    } else if (expense.expenseReceipts.length > 0) {
      targetReceipt = expense.expenseReceipts[0];
      targetAnalysis = targetReceipt.receiptAnalyses?.[0];
    }

    if (!targetAnalysis) {
      return NextResponse.json(
        { error: "No extracted receipt analysis found. Please upload and analyze a receipt first." },
        { status: 400 }
      );
    }

    // 2. Run Verification
    const verification = await runExpenseVerification({
      expense: {
        id: expense.id,
        expenseNumber: expense.expenseNumber,
        amount: expense.amount,
        merchantName: expense.merchantName,
        currency: expense.currency,
        category: expense.category,
        expenseDate: expense.expenseDate,
        companyId: expense.companyId,
      },
      receiptAnalysis: {
        id: targetAnalysis.id,
        receiptId: targetAnalysis.receiptId,
        totalAmount: targetAnalysis.totalAmount,
        merchantName: targetAnalysis.merchantName,
        currency: targetAnalysis.currency,
        category: targetAnalysis.category,
        transactionDate: targetAnalysis.transactionDate,
        invoiceNumber: targetAnalysis.invoiceNumber,
        confidence: targetAnalysis.confidence,
      },
      fileHash: targetReceipt?.fileHash,
      actorId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Expense verification completed successfully.",
      verification: verification.result,
      verificationRecordId: verification.verificationRecordId,
    });
  } catch (error: any) {
    console.error("Expense Verification API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute expense verification." },
      { status: 500 }
    );
  }
}
