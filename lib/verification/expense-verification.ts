import prisma from "@/lib/prisma";
import {
  matchAmount,
  matchMerchant,
  matchDate,
  matchCurrency,
  matchCategory,
  detectDuplicateReceipts,
} from "./matchers";
import { ExpenseVerificationResult } from "@/lib/ai/schemas";
import { logAuditEvent } from "@/lib/audit";

export interface VerificationInput {
  expense: {
    id: string;
    expenseNumber?: string;
    amount: number;
    merchantName: string;
    currency?: string;
    category: string;
    expenseDate?: Date | string;
    companyId: string;
  };
  receiptAnalysis: {
    id: string;
    receiptId: string;
    totalAmount: number | null;
    merchantName: string | null;
    currency: string | null;
    category: string | null;
    transactionDate: string | null;
    invoiceNumber: string | null;
    confidence?: number | null;
  };
  fileHash?: string | null;
  actorId?: string | null;
}

/**
 * Executes Explainable Expense Claim vs Receipt Document Verification.
 * Computes a 100-point transparent weighted score and generates actionable findings.
 */
export async function runExpenseVerification(input: VerificationInput): Promise<{
  verificationRecordId: string;
  result: ExpenseVerificationResult;
}> {
  const { expense, receiptAnalysis, fileHash, actorId } = input;

  // 1. Run Individual Matchers
  const amountRes = matchAmount(expense.amount, receiptAnalysis.totalAmount);
  const merchantRes = matchMerchant(expense.merchantName, receiptAnalysis.merchantName);
  const dateRes = matchDate(expense.expenseDate || new Date(), receiptAnalysis.transactionDate);
  const currencyRes = matchCurrency(expense.currency || "INR", receiptAnalysis.currency);
  const categoryRes = matchCategory(expense.category, receiptAnalysis.category);

  // 2. Duplicate Detection
  const duplicateRes = await detectDuplicateReceipts({
    companyId: expense.companyId,
    fileHash,
    invoiceNumber: receiptAnalysis.invoiceNumber,
    merchantName: receiptAnalysis.merchantName,
    amount: receiptAnalysis.totalAmount,
    currentExpenseId: expense.id,
    currentReceiptId: receiptAnalysis.receiptId,
  });

  // 3. Compute Transparent Overall Score (0 - 100)
  const overallScore = Math.min(
    100,
    Math.max(
      0,
      amountRes.score +
        merchantRes.score +
        dateRes.score +
        currencyRes.score +
        categoryRes.score
    )
  );

  // 4. Compile Mismatch Explanations
  const mismatchReasons: string[] = [];
  if (amountRes.reason) mismatchReasons.push(amountRes.reason);
  if (merchantRes.reason) mismatchReasons.push(merchantRes.reason);
  if (dateRes.reason) mismatchReasons.push(dateRes.reason);
  if (currencyRes.reason) mismatchReasons.push(currencyRes.reason);
  if (categoryRes.reason) mismatchReasons.push(categoryRes.reason);
  if (duplicateRes.reason) mismatchReasons.push(`Possible Duplicate: ${duplicateRes.reason}`);

  // 5. Determine Verification Status & Recommendation
  let status: "VERIFIED" | "REVIEW_REQUIRED" | "MISMATCH" | "FAILED" = "VERIFIED";
  let recommendation: "PROCEED" | "REVIEW" | "BLOCK" = "PROCEED";

  if (duplicateRes.isDuplicate) {
    status = "REVIEW_REQUIRED";
    recommendation = "REVIEW";
  } else if (overallScore >= 90 && amountRes.isMatch && merchantRes.isMatch) {
    status = "VERIFIED";
    recommendation = "PROCEED";
  } else if (overallScore >= 70) {
    status = "REVIEW_REQUIRED";
    recommendation = "REVIEW";
  } else {
    status = "MISMATCH";
    recommendation = "BLOCK";
  }

  const matchBreakdown = {
    amount: {
      score: amountRes.score,
      maxScore: 40,
      isMatch: amountRes.isMatch,
      claim: expense.amount,
      receipt: receiptAnalysis.totalAmount,
      diff: amountRes.diff,
      percentageDiff: amountRes.percentageDiff,
    },
    merchant: {
      score: merchantRes.score,
      maxScore: 25,
      isMatch: merchantRes.isMatch,
      claim: expense.merchantName,
      receipt: receiptAnalysis.merchantName,
      similarity: merchantRes.similarity,
    },
    date: {
      score: dateRes.score,
      maxScore: 15,
      isMatch: dateRes.isMatch,
      claim: expense.expenseDate ? new Date(expense.expenseDate).toISOString().split("T")[0] : null,
      receipt: receiptAnalysis.transactionDate,
      dayDifference: dateRes.dayDifference,
    },
    currency: {
      score: currencyRes.score,
      maxScore: 10,
      isMatch: currencyRes.isMatch,
      claim: expense.currency || "INR",
      receipt: receiptAnalysis.currency || "INR",
    },
    category: {
      score: categoryRes.score,
      maxScore: 10,
      isMatch: categoryRes.isMatch,
      claim: expense.category,
      receipt: receiptAnalysis.category,
    },
    duplicate: {
      isDuplicate: duplicateRes.isDuplicate,
      indicator: duplicateRes.duplicateIndicator,
      matchedExpenseId: duplicateRes.matchedExpenseId,
    },
  };

  const result: ExpenseVerificationResult = {
    status,
    overallScore,
    recommendation,
    amountScore: amountRes.score,
    amountMatch: amountRes.isMatch,
    merchantScore: merchantRes.score,
    merchantMatch: merchantRes.isMatch,
    dateScore: dateRes.score,
    dateMatch: dateRes.isMatch,
    currencyScore: currencyRes.score,
    currencyMatch: currencyRes.isMatch,
    categoryScore: categoryRes.score,
    categoryMatch: categoryRes.isMatch,
    duplicateIndicator: duplicateRes.duplicateIndicator,
    mismatchReasons,
    matchBreakdown,
  };

  // 6. Persist ExpenseVerification Record in Database
  const verificationRecord = await prisma.expenseVerification.create({
    data: {
      companyId: expense.companyId,
      expenseId: expense.id,
      receiptAnalysisId: receiptAnalysis.id,
      status,
      overallScore,
      amountScore: amountRes.score,
      amountMatch: amountRes.isMatch,
      merchantScore: merchantRes.score,
      merchantMatch: merchantRes.isMatch,
      dateScore: dateRes.score,
      dateMatch: dateRes.isMatch,
      currencyScore: currencyRes.score,
      currencyMatch: currencyRes.isMatch,
      categoryScore: categoryRes.score,
      categoryMatch: categoryRes.isMatch,
      duplicateIndicator: duplicateRes.duplicateIndicator,
      mismatchReasons: JSON.stringify(mismatchReasons),
      matchBreakdown: JSON.stringify(matchBreakdown),
      recommendation,
    },
  });

  // 7. Audit Trail
  await logAuditEvent({
    companyId: expense.companyId,
    actorId: actorId || null,
    action: "EXPENSE_VERIFICATION_COMPLETED",
    entityType: "EXPENSE",
    entityId: expense.id,
    metadata: {
      verificationId: verificationRecord.id,
      receiptAnalysisId: receiptAnalysis.id,
      overallScore,
      status,
      recommendation,
      isDuplicate: duplicateRes.isDuplicate,
      mismatchCount: mismatchReasons.length,
    },
  });

  if (status === "MISMATCH") {
    await logAuditEvent({
      companyId: expense.companyId,
      actorId: actorId || null,
      action: "RECEIPT_MISMATCH_DETECTED",
      entityType: "EXPENSE",
      entityId: expense.id,
      metadata: {
        reasons: mismatchReasons,
        overallScore,
      },
    });
  }

  if (duplicateRes.isDuplicate) {
    await logAuditEvent({
      companyId: expense.companyId,
      actorId: actorId || null,
      action: "POSSIBLE_DUPLICATE_DETECTED",
      entityType: "EXPENSE",
      entityId: expense.id,
      metadata: {
        indicator: duplicateRes.duplicateIndicator,
        matchedExpenseId: duplicateRes.matchedExpenseId,
      },
    });
  }

  return {
    verificationRecordId: verificationRecord.id,
    result,
  };
}
