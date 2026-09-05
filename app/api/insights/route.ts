import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getFinanceAnalytics } from "@/lib/finance/analytics";
import { detectFinancialAnomalies } from "@/lib/finance/anomaly-engine";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const companyId = user.companyId;

    // 1. Calculate deterministic financial analytics
    const analytics = await getFinanceAnalytics({
      companyId,
      period: "last_30_days",
    });

    // 2. Detect anomalies
    const anomalyResult = await detectFinancialAnomalies(companyId, analytics);

    // 3. Map to UI Insight items
    const insights: any[] = [];

    // Map anomalies
    for (const anomaly of anomalyResult.anomalies) {
      insights.push({
        id: anomaly.id,
        type: anomaly.severity === "CRITICAL" ? "alert" : anomaly.severity === "WARNING" ? "warning" : "info",
        title: anomaly.title,
        description: anomaly.explanation,
        metric: `Score: ${anomaly.score}/100`,
        actionable: true,
        actionLabel: anomaly.recommendedAction,
        actionLink: anomaly.actionLink || "/dashboard",
        timestamp: "Live",
      });
    }

    // Map department budget utilization
    for (const dept of analytics.departments) {
      if (dept.monthlyBudget > 0 && dept.utilization >= 75) {
        insights.push({
          id: `dept-util-${dept.id}`,
          type: dept.utilization >= 90 ? "alert" : "warning",
          title: `${dept.name} Budget Utilization`,
          description: `${dept.name} has consumed ${dept.utilization}% of its monthly budget (₹${dept.spent.toLocaleString("en-IN")} / ₹${dept.monthlyBudget.toLocaleString("en-IN")}).`,
          metric: `${dept.utilization}% Used`,
          actionable: true,
          actionLabel: "View Department",
          actionLink: "/dashboard/departments",
          timestamp: "This month",
        });
      }
    }

    // SpendGuard Policy Impact
    if (analytics.impact.spendBlocked > 0) {
      insights.push({
        id: "policy-savings-insight",
        type: "success",
        title: "Policy Engine Governance Active",
        description: `SpendGuard AI prevented ₹${analytics.impact.spendBlocked.toLocaleString("en-IN")} of non-compliant spending via hard spending policies.`,
        metric: `₹${analytics.impact.spendBlocked.toLocaleString("en-IN")} Protected`,
        actionable: true,
        actionLabel: "View Policies",
        actionLink: "/dashboard/policies",
        timestamp: "This period",
      });
    }

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Insights API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI insights." },
      { status: 500 }
    );
  }
}
