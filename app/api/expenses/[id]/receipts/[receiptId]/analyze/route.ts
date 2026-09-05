import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { fileStorage } from "@/lib/storage/file-storage";
import { extractReceiptData } from "@/lib/ai/receipt-engine";
import { runExpenseVerification } from "@/lib/verification/expense-verification";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; receiptId: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const { id, receiptId } = await params;

    // 1. Fetch Expense and Receipt with Tenancy Protection
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        employeeProfile: { include: { user: true } },
        department: true,
      },
    });

    if (!expense || expense.companyId !== user.companyId) {
      return NextResponse.json({ error: "Expense record not found." }, { status: 404 });
    }

    const receipt = await prisma.expenseReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt || receipt.companyId !== user.companyId || receipt.expenseId !== expense.id) {
      return NextResponse.json({ error: "Receipt document not found." }, { status: 404 });
    }

    // 2. Audit: Analysis Started
    await logAuditEvent({
      companyId: user.companyId,
      actorId: user.id,
      action: "RECEIPT_ANALYSIS_STARTED",
      entityType: "EXPENSE",
      entityId: expense.id,
      metadata: {
        receiptId: receipt.id,
        fileName: receipt.fileName,
      },
    });

    // 3. Retrieve File Buffer from Storage
    const retrieved = await fileStorage.retrieveFile(receipt.storageKey, user.companyId);
    if (!retrieved) {
      return NextResponse.json({ error: "Receipt file could not be read from storage." }, { status: 404 });
    }

    // 4. Run AI Receipt Extraction Engine
    const extraction = await extractReceiptData(
      retrieved.buffer,
      receipt.fileName,
      receipt.fileType,
      {
        claimHint: {
          merchantName: expense.merchantName,
          amount: expense.amount,
          category: expense.category,
        },
      }
    );

    // 5. Persist ReceiptAnalysis Record
    const receiptAnalysis = await prisma.receiptAnalysis.create({
      data: {
        companyId: user.companyId,
        receiptId: receipt.id,
        merchantName: extraction.merchantName,
        invoiceNumber: extraction.invoiceNumber,
        transactionDate: extraction.transactionDate,
        subtotal: extraction.subtotal,
        tax: extraction.tax,
        totalAmount: extraction.totalAmount,
        currency: extraction.currency || "INR",
        category: extraction.category,
        lineItems: JSON.stringify(extraction.lineItems || []),
        confidence: extraction.confidence,
        missingFields: JSON.stringify(extraction.missingFields || []),
        rawStructuredData: JSON.stringify(extraction),
        modelName: extraction.modelName,
        status: "PROCESSED",
      },
    });

    // Update receipt status
    await prisma.expenseReceipt.update({
      where: { id: receipt.id },
      data: { status: "PROCESSED" },
    });

    // 6. Run Expense Claim vs Receipt Verification
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
        id: receiptAnalysis.id,
        receiptId: receipt.id,
        totalAmount: receiptAnalysis.totalAmount,
        merchantName: receiptAnalysis.merchantName,
        currency: receiptAnalysis.currency,
        category: receiptAnalysis.category,
        transactionDate: receiptAnalysis.transactionDate,
        invoiceNumber: receiptAnalysis.invoiceNumber,
        confidence: receiptAnalysis.confidence,
      },
      fileHash: receipt.fileHash,
      actorId: user.id,
    });

    // 7. Audit: Analysis Completed
    await logAuditEvent({
      companyId: user.companyId,
      actorId: user.id,
      action: "RECEIPT_ANALYSIS_COMPLETED",
      entityType: "EXPENSE",
      entityId: expense.id,
      metadata: {
        analysisId: receiptAnalysis.id,
        confidence: extraction.confidence,
        modelName: extraction.modelName,
        verificationStatus: verification.result.status,
        overallScore: verification.result.overallScore,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Receipt extracted and verified successfully.",
      analysis: receiptAnalysis,
      verification: verification.result,
      verificationRecordId: verification.verificationRecordId,
    });
  } catch (error: any) {
    console.error("Receipt Analysis Error:", error);

    // Audit: Analysis Failed
    await logAuditEvent({
      companyId: "system",
      actorId: null,
      action: "RECEIPT_ANALYSIS_FAILED",
      entityType: "EXPENSE",
      entityId: "unknown",
      metadata: { error: error?.message || "Unknown analysis failure" },
    }).catch(() => {});

    return NextResponse.json(
      { error: error?.message || "Receipt extraction failed." },
      { status: 500 }
    );
  }
}
