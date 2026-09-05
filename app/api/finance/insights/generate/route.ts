import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFinanceAnalytics, TimePeriodKey } from "@/lib/finance/analytics";
import { detectFinancialAnomalies } from "@/lib/finance/anomaly-engine";
import { generateFinanceInsights } from "@/lib/ai/finance-insights";

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    if (user.role === "EMPLOYEE") {
      return NextResponse.json(
        { error: "Forbidden. Employees cannot generate company finance insights." },
        { status: 403 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const period = (body.period as TimePeriodKey) || "last_30_days";
    const departmentId = body.departmentId || undefined;

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    // 1. Calculate deterministic financial analytics
    const analytics = await getFinanceAnalytics({
      companyId: user.companyId,
      departmentId,
      period,
    });

    // 2. Run deterministic anomaly detection
    const anomalyResult = await detectFinancialAnomalies(user.companyId, analytics);

    // 3. Synthesize AI Insights
    const insightResult = await generateFinanceInsights({
      companyName: company.name,
      analytics,
      anomalies: anomalyResult.anomalies,
    });

    // 4. Persist newly generated insights in database
    const createdInsights = await Promise.all(
      insightResult.insights.map(async (item) => {
        return prisma.aIInsight.create({
          data: {
            companyId: user.companyId!,
            periodStart: analytics.period.start,
            periodEnd: analytics.period.end,
            type: item.type,
            severity: item.severity,
            title: item.title,
            explanation: item.explanation,
            recommendedAction: item.recommendedAction,
            actionLink: item.actionLink,
            evidence: JSON.stringify(item.evidence || []),
            status: "ACTIVE",
            departmentId: item.departmentId || departmentId || null,
            modelName: insightResult.modelName,
          },
        });
      })
    );

    // 5. Create Audit Log Entry
    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        actorId: user.id,
        action: "AI_INSIGHT_GENERATED",
        entityType: "INSIGHT",
        entityId: createdInsights[0]?.id || "ai-insights-batch",
        metadata: JSON.stringify({
          period,
          insightsCount: createdInsights.length,
          modelName: insightResult.modelName,
          isDemo: insightResult.isDemo,
          topSeverity: createdInsights[0]?.severity || "INFO",
        }),
      },
    });

    return NextResponse.json({
      summary: insightResult.summary,
      insights: createdInsights.map((ci) => ({
        ...ci,
        evidence: JSON.parse(ci.evidence || "[]"),
      })),
      modelName: insightResult.modelName,
      isDemo: insightResult.isDemo,
    });
  } catch (error) {
    console.error("Generate Insights API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate financial insights." },
      { status: 500 }
    );
  }
}
