import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getFinanceAnalytics, TimePeriodKey } from "@/lib/finance/analytics";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const companyId = user.companyId;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") as TimePeriodKey) || "last_30_days";
    let departmentId = searchParams.get("departmentId") || undefined;
    let employeeProfileId = searchParams.get("employeeProfileId") || undefined;

    // Role-based scoping
    if (user.role === "EMPLOYEE") {
      const empProfile = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
      });
      if (empProfile) {
        employeeProfileId = empProfile.id;
        departmentId = empProfile.departmentId || undefined;
      }
    } else if (user.role === "MANAGER") {
      const managedDepts = await prisma.department.findMany({
        where: { companyId, managerId: user.id },
      });
      const managedDeptIds = managedDepts.map((d) => d.id);
      if (departmentId && !managedDeptIds.includes(departmentId)) {
        departmentId = managedDeptIds[0] || undefined;
      } else if (!departmentId && managedDeptIds.length > 0) {
        departmentId = managedDeptIds[0];
      }
    }

    // 1. Calculate deterministic financial analytics
    const analytics = await getFinanceAnalytics({
      companyId,
      departmentId,
      employeeProfileId,
      period,
    });

    // 2. Fetch stored AI insights
    const storedInsights = user.role !== "EMPLOYEE"
      ? await prisma.aIInsight.findMany({
          where: {
            companyId,
            status: "ACTIVE",
            ...(departmentId ? { OR: [{ departmentId }, { departmentId: null }] } : {}),
          },
          orderBy: [{ severity: "asc" }, { generatedAt: "desc" }],
          take: 5,
        })
      : [];

    const parsedInsights = storedInsights.map((si) => ({
      ...si,
      evidence: JSON.parse(si.evidence || "[]"),
    }));

    // 3. Fetch recent expenses and transactions for activity timeline
    const [recentExpenses, recentPaymentTransactions, policies] = await Promise.all([
      prisma.expense.findMany({
        where: {
          companyId,
          ...(departmentId ? { departmentId } : {}),
          ...(employeeProfileId ? { employeeProfileId } : {}),
        },
        include: {
          employeeProfile: { include: { user: true } },
          department: true,
          aiAnalysis: true,
          verifications: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.paymentTransaction.findMany({
        where: { companyId },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          expense: {
            include: {
              employeeProfile: { include: { user: true } },
              department: true,
            },
          },
        },
      }),
      prisma.policy.findMany({
        where: { companyId, isActive: true },
      }),
    ]);

    return NextResponse.json({
      analytics,
      metrics: {
        totalBudget: analytics.metrics.totalBudget,
        totalSpent: analytics.metrics.totalSpend + analytics.metrics.approvedSpend,
        paidSpend: analytics.metrics.paidSpend,
        remainingBudget: analytics.metrics.remainingBudget,
        utilizationRate: analytics.metrics.utilizationRate,
        pendingApprovalsCount: analytics.metrics.pendingApprovalCount,
        readyForPaymentCount: analytics.metrics.approvedSpend,
        failedPaymentsCount: analytics.metrics.failedPaymentCount,
        highRiskCount: analytics.riskDistribution.highRiskCount,
        blockedCount: analytics.metrics.blockedCount,
        verifiedExpensesCount: analytics.receiptMetrics.verifiedCount,
        reviewRequiredReceiptsCount: analytics.receiptMetrics.reviewRequiredCount,
        receiptMismatchesCount: analytics.receiptMetrics.mismatchCount,
        possibleDuplicatesCount: analytics.receiptMetrics.duplicateCount,
      },
      comparison: analytics.comparison,
      budgetForecast: analytics.budgetForecast,
      impact: analytics.impact,
      departmentSpending: analytics.departments,
      categorySpending: analytics.categories,
      topMerchants: analytics.topMerchants,
      spendingTrends: analytics.trends,
      riskDistribution: [
        { level: "Low Risk", count: analytics.riskDistribution.lowRiskCount, color: "#10b981" },
        { level: "Medium Risk", count: analytics.riskDistribution.mediumRiskCount, color: "#f59e0b" },
        { level: "High Risk", count: analytics.riskDistribution.highRiskCount, color: "#ef4444" },
      ],
      insights: parsedInsights,
      recentExpenses,
      recentPaymentTransactions,
      policiesCount: policies.length,
      employeesCount: analytics.employees.length,
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard metrics. Please refresh." },
      { status: 500 }
    );
  }
}
