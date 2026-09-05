import prisma from "@/lib/prisma";
import { FinanceAnalyticsResult } from "./analytics";

export type AnomalyType =
  | "SPENDING_SPIKE"
  | "MERCHANT_ANOMALY"
  | "CATEGORY_ANOMALY"
  | "BUDGET_PRESSURE"
  | "REPEATED_TRANSACTIONS"
  | "APPROVAL_BACKLOG"
  | "RECEIPT_MISMATCH_CONCENTRATION"
  | "PAYMENT_FAILURES"
  | "GENERAL_RISK";

export type AnomalySeverity = "INFO" | "WARNING" | "CRITICAL";

export interface DetectedAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  score: number; // 0-100 explainable score
  title: string;
  explanation: string;
  evidence: string[];
  recommendedAction: string;
  actionLink?: string;
  departmentId?: string;
  employeeId?: string;
  expenseId?: string;
}

export interface AnomalyEngineResult {
  anomalies: DetectedAnomaly[];
  overallAnomalyScore: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export const ANOMALY_WEIGHTS = {
  SPENDING_SPIKE: 30,
  MERCHANT_ANOMALY: 20,
  CATEGORY_ANOMALY: 15,
  BUDGET_PRESSURE_HIGH: 30, // > 90%
  BUDGET_PRESSURE_MODERATE: 20, // > 80%
  REPEATED_TRANSACTIONS: 25,
  APPROVAL_BACKLOG: 15,
  RECEIPT_MISMATCH: 30,
  PAYMENT_FAILURES: 25,
};

/**
 * Runs deterministic anomaly detection across recent transactions, budgets, approvals, and receipts.
 */
export async function detectFinancialAnomalies(
  companyId: string,
  analytics: FinanceAnalyticsResult
): Promise<AnomalyEngineResult> {
  const anomalies: DetectedAnomaly[] = [];

  // 1. Fetch recent expenses for the company with associated AI analysis and verifications
  const recentExpenses = await prisma.expense.findMany({
    where: {
      companyId,
      createdAt: { gte: analytics.period.start, lte: analytics.period.end },
    },
    include: {
      employeeProfile: { include: { user: true } },
      department: true,
      aiAnalysis: true,
      verifications: { orderBy: { createdAt: "desc" }, take: 1 },
      paymentTransactions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // =========================================================================
  // SIGNAL 1: Department Budget Pressure
  // =========================================================================
  for (const dept of analytics.departments) {
    if (dept.monthlyBudget > 0) {
      if (dept.utilization >= 90) {
        anomalies.push({
          id: `anomaly-budget-crit-${dept.id}`,
          type: "BUDGET_PRESSURE",
          severity: "CRITICAL",
          score: Math.min(100, ANOMALY_WEIGHTS.BUDGET_PRESSURE_HIGH + (dept.utilization > 100 ? 20 : 10)),
          title: `Critical Budget Pressure: ${dept.name}`,
          explanation: `${dept.name} has consumed ${dept.utilization.toFixed(0)}% of its monthly budget with ₹${dept.remaining.toLocaleString("en-IN")} remaining.`,
          evidence: [
            `Department: ${dept.name}`,
            `Monthly Budget: ₹${dept.monthlyBudget.toLocaleString("en-IN")}`,
            `Current Spend: ₹${dept.spent.toLocaleString("en-IN")}`,
            `Utilization: ${dept.utilization.toFixed(1)}%`,
            `Pending Requests: ${dept.pendingCount}`,
          ],
          recommendedAction: `Review and freeze discretionary non-essential spend for ${dept.name}.`,
          actionLink: `/dashboard/departments`,
          departmentId: dept.id,
        });
      } else if (dept.utilization >= 75) {
        anomalies.push({
          id: `anomaly-budget-warn-${dept.id}`,
          type: "BUDGET_PRESSURE",
          severity: "WARNING",
          score: ANOMALY_WEIGHTS.BUDGET_PRESSURE_MODERATE,
          title: `Elevated Budget Utilization: ${dept.name}`,
          explanation: `${dept.name} has reached ${dept.utilization.toFixed(0)}% budget utilization. At current velocity, limits may be exceeded before month-end.`,
          evidence: [
            `Department: ${dept.name}`,
            `Allocated Budget: ₹${dept.monthlyBudget.toLocaleString("en-IN")}`,
            `Current Spend: ₹${dept.spent.toLocaleString("en-IN")}`,
            `Utilization: ${dept.utilization.toFixed(1)}%`,
          ],
          recommendedAction: `Inspect upcoming department commitments and approvals.`,
          actionLink: `/dashboard/departments`,
          departmentId: dept.id,
        });
      }
    }
  }

  // =========================================================================
  // SIGNAL 2: Spending Spike vs Employee Historical Baseline
  // =========================================================================
  const employeeSpendMap: Record<string, { total: number; count: number; name: string }> = {};
  for (const exp of recentExpenses) {
    const eId = exp.employeeProfileId;
    if (!employeeSpendMap[eId]) {
      employeeSpendMap[eId] = { total: 0, count: 0, name: exp.employeeProfile.user?.name || "Employee" };
    }
    employeeSpendMap[eId].total += exp.amount;
    employeeSpendMap[eId].count++;
  }

  for (const exp of recentExpenses) {
    const stats = employeeSpendMap[exp.employeeProfileId];
    if (stats && stats.count >= 2) {
      const avg = stats.total / stats.count;
      // If single transaction is > 2x employee average and >= ₹10,000
      if (exp.amount > avg * 2 && exp.amount >= 10000) {
        anomalies.push({
          id: `anomaly-spike-${exp.id}`,
          type: "SPENDING_SPIKE",
          severity: exp.amount > 50000 ? "CRITICAL" : "WARNING",
          score: Math.min(100, ANOMALY_WEIGHTS.SPENDING_SPIKE + Math.round((exp.amount / avg) * 5)),
          title: `Unusual Spending Spike: ${exp.merchantName}`,
          explanation: `${stats.name} submitted an expense of ₹${exp.amount.toLocaleString("en-IN")}, which is ${(exp.amount / avg).toFixed(1)}× higher than their average transaction (₹${Math.round(avg).toLocaleString("en-IN")}).`,
          evidence: [
            `Employee: ${stats.name}`,
            `Expense: ${exp.expenseNumber} (₹${exp.amount.toLocaleString("en-IN")})`,
            `Merchant: ${exp.merchantName}`,
            `Category: ${exp.category}`,
            `Employee Avg Transaction: ₹${Math.round(avg).toLocaleString("en-IN")}`,
          ],
          recommendedAction: `Review transaction details, business justification, and attached receipt.`,
          actionLink: `/dashboard/expenses/${exp.id}`,
          employeeId: exp.employeeProfileId,
          expenseId: exp.id,
        });
        break; // Limit to 1 major employee spike per run
      }
    }
  }

  // =========================================================================
  // SIGNAL 3: Repeated / Rapid-Fire Similar Transactions
  // =========================================================================
  for (let i = 0; i < recentExpenses.length; i++) {
    for (let j = i + 1; j < recentExpenses.length; j++) {
      const e1 = recentExpenses[i];
      const e2 = recentExpenses[j];

      const sameMerchant = e1.merchantName.toLowerCase() === e2.merchantName.toLowerCase();
      const sameEmployee = e1.employeeProfileId === e2.employeeProfileId;
      const sameAmount = Math.abs(e1.amount - e2.amount) <= 1; // within ₹1
      const timeDiffHours = Math.abs(e1.createdAt.getTime() - e2.createdAt.getTime()) / (1000 * 60 * 60);

      if (sameMerchant && sameEmployee && sameAmount && timeDiffHours <= 48) {
        anomalies.push({
          id: `anomaly-dup-${e1.id}-${e2.id}`,
          type: "REPEATED_TRANSACTIONS",
          severity: "WARNING",
          score: ANOMALY_WEIGHTS.REPEATED_TRANSACTIONS,
          title: `Repeated Identical Transactions: ${e1.merchantName}`,
          explanation: `Two identical expenses of ₹${e1.amount.toLocaleString("en-IN")} to ${e1.merchantName} were created within ${Math.round(timeDiffHours)} hours by ${e1.employeeProfile.user?.name}.`,
          evidence: [
            `Transaction 1: ${e1.expenseNumber} (₹${e1.amount.toLocaleString("en-IN")})`,
            `Transaction 2: ${e2.expenseNumber} (₹${e2.amount.toLocaleString("en-IN")})`,
            `Merchant: ${e1.merchantName}`,
            `Time Interval: ${Math.round(timeDiffHours)} hours apart`,
          ],
          recommendedAction: `Verify whether this is a legitimate recurring charge or an accidental duplicate submission.`,
          actionLink: `/dashboard/expenses/${e1.id}`,
          expenseId: e1.id,
        });
        break;
      }
    }
    if (anomalies.some((a) => a.type === "REPEATED_TRANSACTIONS")) break;
  }

  // =========================================================================
  // SIGNAL 4: Receipt Mismatch Concentration
  // =========================================================================
  const mismatchExpenses = recentExpenses.filter(
    (e) => e.verifications?.[0]?.status === "MISMATCH" || (e.verifications?.[0]?.duplicateIndicator && e.verifications?.[0]?.duplicateIndicator !== "NONE")
  );

  if (mismatchExpenses.length >= 1) {
    const totalMismatchAmt = mismatchExpenses.reduce((sum, e) => sum + e.amount, 0);
    anomalies.push({
      id: `anomaly-receipt-mismatches`,
      type: "RECEIPT_MISMATCH_CONCENTRATION",
      severity: mismatchExpenses.length >= 3 ? "CRITICAL" : "WARNING",
      score: Math.min(100, ANOMALY_WEIGHTS.RECEIPT_MISMATCH + mismatchExpenses.length * 10),
      title: `${mismatchExpenses.length} Receipt Verification Mismatch${mismatchExpenses.length > 1 ? "es" : ""} Detected`,
      explanation: `${mismatchExpenses.length} expense claim(s) totaling ₹${totalMismatchAmt.toLocaleString("en-IN")} failed automated document verification due to amount variances, merchant discrepancies, or duplicate file hashes.`,
      evidence: [
        `Flagged Claims: ${mismatchExpenses.length}`,
        `Total Impact: ₹${totalMismatchAmt.toLocaleString("en-IN")}`,
        `Primary Reason: ${mismatchExpenses[0].verifications?.[0]?.mismatchReasons || "Amount or merchant variance between claim and document"}`,
      ],
      recommendedAction: `Inspect flagged expenses in the Approvals Center before releasing payment.`,
      actionLink: `/dashboard/approvals`,
    });
  }

  // =========================================================================
  // SIGNAL 5: Approval Queue Backlog
  // =========================================================================
  if (analytics.metrics.pendingApprovalCount >= 5 || analytics.metrics.pendingApprovalSpend >= 50000) {
    anomalies.push({
      id: `anomaly-approval-backlog`,
      type: "APPROVAL_BACKLOG",
      severity: analytics.metrics.pendingApprovalSpend >= 100000 ? "CRITICAL" : "WARNING",
      score: ANOMALY_WEIGHTS.APPROVAL_BACKLOG,
      title: `Approval Bottleneck: ${analytics.metrics.pendingApprovalCount} Requests Pending`,
      explanation: `There is ₹${analytics.metrics.pendingApprovalSpend.toLocaleString("en-IN")} across ${analytics.metrics.pendingApprovalCount} pending expense requests awaiting manager approval.`,
      evidence: [
        `Pending Requests: ${analytics.metrics.pendingApprovalCount}`,
        `Pending Volume: ₹${analytics.metrics.pendingApprovalSpend.toLocaleString("en-IN")}`,
      ],
      recommendedAction: `Notify department managers to review pending requests to avoid operational payment delays.`,
      actionLink: `/dashboard/approvals`,
    });
  }

  // =========================================================================
  // SIGNAL 6: Payment Gateway Failures
  // =========================================================================
  if (analytics.metrics.failedPaymentCount >= 1) {
    anomalies.push({
      id: `anomaly-payment-failures`,
      type: "PAYMENT_FAILURES",
      severity: "CRITICAL",
      score: ANOMALY_WEIGHTS.PAYMENT_FAILURES,
      title: `${analytics.metrics.failedPaymentCount} Payment Gateway Failure${analytics.metrics.failedPaymentCount > 1 ? "s" : ""}`,
      explanation: `${analytics.metrics.failedPaymentCount} approved disbursement(s) totaling ₹${analytics.metrics.failedPaymentSpend.toLocaleString("en-IN")} failed during Razorpay execution.`,
      evidence: [
        `Failed Disbursements: ${analytics.metrics.failedPaymentCount}`,
        `Failed Amount: ₹${analytics.metrics.failedPaymentSpend.toLocaleString("en-IN")}`,
      ],
      recommendedAction: `Inspect failure reason in Transactions log and retry payment with updated account details.`,
      actionLink: `/dashboard/transactions`,
    });
  }

  // Calculate overall anomaly score
  const maxScore = anomalies.length > 0 ? Math.max(...anomalies.map((a) => a.score)) : 0;
  const criticalCount = anomalies.filter((a) => a.severity === "CRITICAL").length;
  const warningCount = anomalies.filter((a) => a.severity === "WARNING").length;
  const infoCount = anomalies.filter((a) => a.severity === "INFO").length;

  return {
    anomalies: anomalies.sort((a, b) => b.score - a.score),
    overallAnomalyScore: maxScore,
    criticalCount,
    warningCount,
    infoCount,
  };
}
