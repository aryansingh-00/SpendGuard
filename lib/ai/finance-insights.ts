import { FinanceAnalyticsResult } from "@/lib/finance/analytics";
import { DetectedAnomaly } from "@/lib/finance/anomaly-engine";
import {
  FinanceInsightItem,
  FinanceInsightsOutput,
  FinanceInsightsOutputSchema,
} from "./schemas";

export interface GenerateInsightsParams {
  companyName: string;
  analytics: FinanceAnalyticsResult;
  anomalies: DetectedAnomaly[];
}

/**
 * AI Finance Controller Insight Engine
 * Synthesizes verified financial analytics and detected anomalies into proactive,
 * actionable, and explainable recommendations.
 * 
 * Strict Principle:
 * - AI explains and prioritizes insights.
 * - AI NEVER invents financial amounts or percentages.
 * - All numbers must cite provided evidence.
 */
export async function generateFinanceInsights(
  params: GenerateInsightsParams
): Promise<FinanceInsightsOutput> {
  const { companyName, analytics, anomalies } = params;
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  // Prepare structured factual payload
  const factualPayload = {
    companyName,
    period: analytics.period.label,
    metrics: {
      totalSpendFormatted: `₹${analytics.metrics.totalSpend.toLocaleString("en-IN")}`,
      previousPeriodSpendFormatted: `₹${analytics.comparison.previousPeriodSpend.toLocaleString("en-IN")}`,
      periodComparison: analytics.comparison.formattedChange,
      changePercent: analytics.comparison.changePercent,
      isIncrease: analytics.comparison.isIncrease,
      budgetRemainingFormatted: `₹${analytics.metrics.remainingBudget.toLocaleString("en-IN")}`,
      totalBudgetFormatted: `₹${analytics.metrics.totalBudget.toLocaleString("en-IN")}`,
      utilizationRate: `${analytics.metrics.utilizationRate.toFixed(1)}%`,
      budgetHealth: analytics.metrics.budgetHealth.status,
      pendingApprovalFormatted: `₹${analytics.metrics.pendingApprovalSpend.toLocaleString("en-IN")} (${analytics.metrics.pendingApprovalCount} requests)`,
      blockedSpendFormatted: `₹${analytics.metrics.blockedSpend.toLocaleString("en-IN")} (${analytics.metrics.blockedCount} blocked)`,
      failedPaymentsFormatted: `₹${analytics.metrics.failedPaymentSpend.toLocaleString("en-IN")} (${analytics.metrics.failedPaymentCount} failed)`,
      riskySpendFormatted: `₹${analytics.metrics.riskySpend.toLocaleString("en-IN")}`,
    },
    forecast: {
      hasSufficientData: analytics.budgetForecast.hasSufficientData,
      message: analytics.budgetForecast.message,
      projectedMonthlySpend: `₹${analytics.budgetForecast.projectedMonthlySpend.toLocaleString("en-IN")}`,
      isOverBudget: analytics.budgetForecast.isOverBudget,
    },
    departments: analytics.departments.map((d) => ({
      name: d.name,
      spent: `₹${d.spent.toLocaleString("en-IN")}`,
      budget: `₹${d.monthlyBudget.toLocaleString("en-IN")}`,
      utilization: `${d.utilization}%`,
      health: d.health.status,
      pendingCount: d.pendingCount,
    })),
    topCategories: analytics.categories.slice(0, 5).map((c) => ({
      category: c.category,
      amount: `₹${c.amount.toLocaleString("en-IN")}`,
      percentage: `${c.percentage}%`,
    })),
    topMerchants: analytics.topMerchants.slice(0, 5).map((m) => ({
      merchant: m.merchantName,
      spend: `₹${m.totalSpend.toLocaleString("en-IN")}`,
      count: m.transactionCount,
      flags: m.riskFlags,
    })),
    impact: {
      spendReviewed: `₹${analytics.impact.spendReviewed.toLocaleString("en-IN")}`,
      spendBlocked: `₹${analytics.impact.spendBlocked.toLocaleString("en-IN")}`,
      receiptIssuesCount: analytics.impact.receiptIssuesCount,
      successfulDisbursements: `₹${analytics.impact.successfulDisbursements.toLocaleString("en-IN")}`,
    },
    anomalies: anomalies.map((a) => ({
      type: a.type,
      severity: a.severity,
      title: a.title,
      explanation: a.explanation,
      evidence: a.evidence,
      recommendedAction: a.recommendedAction,
      actionLink: a.actionLink,
    })),
  };

  // 1. If Gemini API key is present and active, attempt live LLM generation
  if (apiKey && !apiKey.includes("placeholder")) {
    try {
      const prompt = `You are SpendGuard AI's executive AI Finance Controller.
Analyze the following verified financial facts and detected anomalies for ${companyName} (${analytics.period.label}).

CRITICAL FINANCE CONTROLLER RULES:
1. You are an expert financial advisor and controller.
2. Rely EXCLUSIVELY on the provided financial facts. DO NOT invent numbers, percentages, or merchants.
3. Every insight must contain a concise title, severity (CRITICAL, WARNING, or INFO), clear explanation, structured evidence array, and an actionable recommendation.
4. Produce 3 to 5 high-impact, prioritized insights.
5. Provide an executive summary of 2-3 sentences synthesizing spend velocity, budget health, and key action items.
6. Return STRICT JSON conforming to this schema:
{
  "summary": "Executive summary string...",
  "insights": [
    {
      "type": "BUDGET_PRESSURE" | "SPENDING_SPIKE" | "CATEGORY_ANOMALY" | "MERCHANT_ANOMALY" | "APPROVAL_BACKLOG" | "RECEIPT_MISMATCH" | "PAYMENT_FAILURES" | "SAVINGS_OPPORTUNITY" | "GENERAL",
      "severity": "CRITICAL" | "WARNING" | "INFO",
      "title": "Short descriptive title",
      "explanation": "Clear explanation citing supplied data",
      "evidence": ["Fact 1", "Fact 2"],
      "recommendedAction": "Concrete next step for finance admin/manager",
      "actionLink": "/dashboard/approvals" | "/dashboard/departments" | "/dashboard/transactions" | "/dashboard/expenses" | "/dashboard/policies"
    }
  ]
}

VERIFIED FINANCIAL DATA:
${JSON.stringify(factualPayload, null, 2)}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textContent) {
          const parsed = JSON.parse(textContent);
          const validated = FinanceInsightsOutputSchema.parse({
            summary: parsed.summary,
            insights: parsed.insights,
            modelName: "gemini-1.5-flash",
            isDemo: false,
          });
          return validated;
        }
      }
    } catch (llmError) {
      console.warn("Live Gemini Finance Insights failed, falling back to deterministic engine:", llmError);
    }
  }

  // 2. Deterministic AI Controller Synthesis (Demo Mode & High-Fidelity Fallback)
  return generateDeterministicInsights(params);
}

/**
 * Deterministic Financial Controller Synthesis Engine.
 * Converts verified analytics and anomalies into executive controller insights.
 */
export function generateDeterministicInsights(
  params: GenerateInsightsParams
): FinanceInsightsOutput {
  const { companyName, analytics, anomalies } = params;
  const insights: FinanceInsightItem[] = [];

  // Build Executive Summary
  const spendStr = `₹${analytics.metrics.totalSpend.toLocaleString("en-IN")}`;
  const changeText = analytics.comparison.formattedChange.toLowerCase();
  const highestDept = [...analytics.departments].sort((a, b) => b.spent - a.spent)[0];
  const pendingCount = analytics.metrics.pendingApprovalCount;
  const highRiskCount = analytics.riskDistribution.highRiskCount;

  let summary = `Total spend for ${companyName} is ${spendStr} (${changeText}).`;
  if (highestDept && highestDept.spent > 0) {
    summary += ` ${highestDept.name} is the highest-spending department at ₹${highestDept.spent.toLocaleString("en-IN")} (${highestDept.utilization.toFixed(0)}% budget utilization).`;
  }
  if (highRiskCount > 0 || pendingCount > 0) {
    summary += ` ${pendingCount} pending approval request${pendingCount === 1 ? "" : "s"} and ${highRiskCount} high-risk transaction${highRiskCount === 1 ? "" : "s"} require finance review.`;
  } else {
    summary += ` Spending controls and budget health remain within healthy operational parameters.`;
  }

  // 1. Convert detected anomalies directly into top-priority proactive insights
  for (const anomaly of anomalies) {
    let actionLink = anomaly.actionLink || "/dashboard";
    if (anomaly.type === "BUDGET_PRESSURE") actionLink = "/dashboard/departments";
    if (anomaly.type === "APPROVAL_BACKLOG") actionLink = "/dashboard/approvals";
    if (anomaly.type === "RECEIPT_MISMATCH_CONCENTRATION") actionLink = "/dashboard/approvals";
    if (anomaly.type === "PAYMENT_FAILURES") actionLink = "/dashboard/transactions";
    if (anomaly.type === "SPENDING_SPIKE") actionLink = anomaly.actionLink || "/dashboard/expenses";

    insights.push({
      type: anomaly.type,
      severity: anomaly.severity,
      title: anomaly.title,
      explanation: anomaly.explanation,
      evidence: anomaly.evidence,
      recommendedAction: anomaly.recommendedAction,
      actionLink,
      departmentId: anomaly.departmentId,
    });
  }

  // 2. Add Category Growth or Shift Insight if significant
  const topCategory = analytics.categories[0];
  if (topCategory && topCategory.percentage >= 40 && topCategory.amount > 0) {
    insights.push({
      type: "CATEGORY_ANOMALY",
      severity: "INFO",
      title: `High Concentration in ${topCategory.category}`,
      explanation: `${topCategory.category} represents ${topCategory.percentage}% (₹${topCategory.amount.toLocaleString("en-IN")}) of total spending in this period.`,
      evidence: [
        `Category: ${topCategory.category}`,
        `Total Spend: ₹${topCategory.amount.toLocaleString("en-IN")}`,
        `Share of Total: ${topCategory.percentage}%`,
        `Transactions: ${topCategory.transactionCount}`,
      ],
      recommendedAction: `Review vendor contracts and subscription tiers for ${topCategory.category} to optimize volume discounts.`,
      actionLink: `/dashboard/expenses`,
    });
  }

  // 3. Add Budget Forecasting Projection Insight
  if (analytics.budgetForecast.hasSufficientData && analytics.budgetForecast.isOverBudget) {
    insights.push({
      type: "BUDGET_PRESSURE",
      severity: "WARNING",
      title: "Monthly Budget Run-Rate Warning",
      explanation: analytics.budgetForecast.message,
      evidence: [
        `Days Elapsed: ${analytics.budgetForecast.daysElapsed} of ${analytics.budgetForecast.daysInMonth} days`,
        `Daily Run-rate: ₹${analytics.budgetForecast.averageDailySpend.toLocaleString("en-IN")}/day`,
        `Projected Spend: ₹${analytics.budgetForecast.projectedMonthlySpend.toLocaleString("en-IN")}`,
        `Company Budget: ₹${analytics.budgetForecast.monthlyBudget.toLocaleString("en-IN")}`,
      ],
      recommendedAction: "Implement department spending caps to prevent budget overrun before month-end.",
      actionLink: "/dashboard/departments",
    });
  }

  // 4. Add SpendGuard Impact & Policy Governance Insight if policy blocked spend
  if (analytics.impact.spendBlocked > 0) {
    insights.push({
      type: "SAVINGS_OPPORTUNITY",
      severity: "INFO",
      title: "Policy Engine Governance Active",
      explanation: `SpendGuard AI prevented ₹${analytics.impact.spendBlocked.toLocaleString("en-IN")} of non-compliant spending via automated deterministic spending policies.`,
      evidence: [
        `Blocked Amount: ₹${analytics.impact.spendBlocked.toLocaleString("en-IN")}`,
        `Policy Violations: ${analytics.metrics.blockedCount}`,
        `Total Reviewed: ₹${analytics.impact.spendReviewed.toLocaleString("en-IN")}`,
      ],
      recommendedAction: "Review blocked transaction logs to ensure policy rules accurately reflect company purchasing needs.",
      actionLink: "/dashboard/policies",
    });
  }

  // 5. If no insights exist, provide general healthy baseline insight
  if (insights.length === 0) {
    insights.push({
      type: "GENERAL",
      severity: "INFO",
      title: "Financial Governance On Track",
      explanation: "All departmental spending, transaction velocities, and budget utilizations are operating within established policy thresholds.",
      evidence: [
        `Total Realized Spend: ${spendStr}`,
        `Budget Health: ${analytics.metrics.budgetHealth.status}`,
        `Pending Requests: ${pendingCount}`,
      ],
      recommendedAction: "Continue monitoring weekly spend reports.",
      actionLink: "/dashboard",
    });
  }

  // Prioritize insights: CRITICAL -> WARNING -> INFO
  const severityOrder: Record<string, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };
  const sortedInsights = insights
    .sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0))
    .slice(0, 5); // Limit to top 5 most actionable insights

  return FinanceInsightsOutputSchema.parse({
    summary,
    insights: sortedInsights,
    modelName: "demo-finance-controller-v1",
    isDemo: true,
  });
}
