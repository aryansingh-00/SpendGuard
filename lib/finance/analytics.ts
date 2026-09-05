import prisma from "@/lib/prisma";

export type TimePeriodKey =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_month"
  | "previous_month";

export interface DateRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  periodKey: TimePeriodKey;
  label: string;
}

export interface BudgetHealthStatus {
  status: "HEALTHY" | "WATCH" | "CRITICAL";
  color: string;
  badgeClass: string;
}

export const BUDGET_THRESHOLDS = {
  HEALTHY_MAX: 70, // < 70%
  WATCH_MAX: 90,   // 70% - 90%
  CRITICAL_MIN: 90 // > 90%
};

export function getBudgetHealth(utilization: number): BudgetHealthStatus {
  if (utilization < BUDGET_THRESHOLDS.HEALTHY_MAX) {
    return {
      status: "HEALTHY",
      color: "#10b981",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
  } else if (utilization <= BUDGET_THRESHOLDS.WATCH_MAX) {
    return {
      status: "WATCH",
      color: "#f59e0b",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };
  } else {
    return {
      status: "CRITICAL",
      color: "#ef4444",
      badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    };
  }
}

/**
 * Calculates deterministic date ranges and comparison baseline periods.
 */
export function calculateDateRange(periodKey: TimePeriodKey = "last_30_days"): DateRange {
  const now = new Date();
  let start: Date;
  let end: Date = new Date(now);
  let prevStart: Date;
  let prevEnd: Date;
  let label: string;

  switch (periodKey) {
    case "today": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 1);
      label = "Today";
      break;
    }
    case "last_7_days": {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      label = "Last 7 days";
      break;
    }
    case "last_90_days": {
      start = new Date(now);
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 90);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      label = "Last 90 days";
      break;
    }
    case "this_month": {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now);
      
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 23, 59, 59, 999);
      label = "This month";
      break;
    }
    case "previous_month": {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
      label = "Previous month";
      break;
    }
    case "last_30_days":
    default: {
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 30);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      label = "Last 30 days";
      break;
    }
  }

  return { start, end, prevStart, prevEnd, periodKey, label };
}

export interface AnalyticsFilter {
  companyId: string;
  departmentId?: string;
  employeeProfileId?: string;
  period?: TimePeriodKey;
  startDate?: Date;
  endDate?: Date;
}

export interface DepartmentSpendItem {
  id: string;
  name: string;
  code: string | null;
  monthlyBudget: number;
  spent: number;
  remaining: number;
  utilization: number;
  health: BudgetHealthStatus;
  pendingCount: number;
  employeeCount: number;
}

export interface EmployeeSpendItem {
  id: string;
  name: string;
  email: string;
  departmentName: string;
  monthlyBudget: number;
  spent: number;
  transactionCount: number;
  avgTransaction: number;
  highRiskCount: number;
  policyBlocks: number;
  approvalRequests: number;
  utilization: number;
}

export interface CategorySpendItem {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface TopMerchantItem {
  merchantName: string;
  totalSpend: number;
  transactionCount: number;
  avgTransaction: number;
  riskFlags: string[];
}

export interface SpendingTrendPoint {
  date: string;
  label: string;
  spend: number;
  transactionCount: number;
}

export interface BudgetForecast {
  hasSufficientData: boolean;
  daysElapsed: number;
  daysInMonth: number;
  currentMonthlySpend: number;
  averageDailySpend: number;
  projectedMonthlySpend: number;
  monthlyBudget: number;
  projectedVariance: number;
  isOverBudget: boolean;
  message: string;
}

export interface SpendGuardImpactMetrics {
  spendReviewed: number;
  spendBlocked: number;
  spendSentForReview: number;
  receiptIssuesCount: number;
  receiptIssuesAmount: number;
  successfulDisbursements: number;
}

export interface FinanceAnalyticsResult {
  period: DateRange;
  currency: string;
  metrics: {
    totalSpend: number;               // Realized Paid Spend in period
    approvedSpend: number;            // Approved / Ready for Payment
    pendingApprovalSpend: number;     // Waiting in approval queue
    pendingApprovalCount: number;
    paidSpend: number;
    paidCount: number;
    failedPaymentSpend: number;
    failedPaymentCount: number;
    blockedSpend: number;             // Prevented by policy
    blockedCount: number;
    rejectedSpend: number;            // Rejected by managers
    rejectedCount: number;
    riskySpend: number;               // High risk expenses
    riskyCount: number;
    totalBudget: number;
    remainingBudget: number;
    utilizationRate: number;
    budgetHealth: BudgetHealthStatus;
  };
  comparison: {
    previousPeriodSpend: number;
    changeAmount: number;
    changePercent: number;
    isIncrease: boolean;
    formattedChange: string;
  };
  budgetForecast: BudgetForecast;
  departments: DepartmentSpendItem[];
  employees: EmployeeSpendItem[];
  categories: CategorySpendItem[];
  topMerchants: TopMerchantItem[];
  trends: SpendingTrendPoint[];
  impact: SpendGuardImpactMetrics;
  riskDistribution: {
    lowRiskCount: number;
    mediumRiskCount: number;
    highRiskCount: number;
  };
  receiptMetrics: {
    verifiedCount: number;
    reviewRequiredCount: number;
    mismatchCount: number;
    duplicateCount: number;
  };
}

/**
 * Calculates comprehensive, deterministic financial analytics scoped to a company and optional filters.
 */
export async function getFinanceAnalytics(filter: AnalyticsFilter): Promise<FinanceAnalyticsResult> {
  const { companyId, departmentId, employeeProfileId, period = "last_30_days" } = filter;
  const dateRange = calculateDateRange(period);

  // 1. Fetch Company details
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      departments: {
        where: departmentId ? { id: departmentId } : undefined,
        include: {
          employeeProfiles: {
            include: { user: true },
          },
        },
      },
    },
  });

  if (!company) {
    throw new Error(`Company not found for id: ${companyId}`);
  }

  // 2. Query all expenses for current period with tenant and optional department/employee scoping
  const whereCurrent: any = {
    companyId,
    createdAt: {
      gte: dateRange.start,
      lte: dateRange.end,
    },
  };

  if (departmentId) {
    whereCurrent.departmentId = departmentId;
  }
  if (employeeProfileId) {
    whereCurrent.employeeProfileId = employeeProfileId;
  }

  // Query previous period expenses for deterministic period comparison
  const wherePrevious: any = {
    companyId,
    createdAt: {
      gte: dateRange.prevStart,
      lte: dateRange.prevEnd,
    },
  };
  if (departmentId) wherePrevious.departmentId = departmentId;
  if (employeeProfileId) wherePrevious.employeeProfileId = employeeProfileId;

  // 3. Parallel fetch current expenses, previous expenses, all employee profiles, and verifications
  const [
    currentExpenses,
    previousExpenses,
    allEmployeeProfiles,
    verifications,
    paymentTransactions,
  ] = await Promise.all([
    prisma.expense.findMany({
      where: whereCurrent,
      include: {
        department: true,
        employeeProfile: { include: { user: true } },
        aiAnalysis: true,
        verifications: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expense.findMany({
      where: wherePrevious,
      select: { amount: true, status: true },
    }),
    prisma.employeeProfile.findMany({
      where: {
        companyId,
        ...(departmentId ? { departmentId } : {}),
        ...(employeeProfileId ? { id: employeeProfileId } : {}),
      },
      include: {
        user: true,
        department: true,
        expenses: {
          where: {
            createdAt: { gte: dateRange.start, lte: dateRange.end },
          },
          include: { aiAnalysis: true },
        },
      },
    }),
    prisma.expenseVerification.findMany({
      where: {
        companyId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
    }),
    prisma.paymentTransaction.findMany({
      where: {
        companyId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
    }),
  ]);

  // 4. Calculate Core Spend Figures (Decimal safe)
  let totalSpend = 0;              // PAID
  let approvedSpend = 0;           // APPROVED / READY_FOR_PAYMENT
  let pendingApprovalSpend = 0;    // PENDING_APPROVAL
  let pendingApprovalCount = 0;
  let paidSpend = 0;
  let paidCount = 0;
  let failedPaymentSpend = 0;
  let failedPaymentCount = 0;
  let blockedSpend = 0;
  let blockedCount = 0;
  let rejectedSpend = 0;
  let rejectedCount = 0;
  let riskySpend = 0;
  let riskyCount = 0;
  let lowRiskCount = 0;
  let mediumRiskCount = 0;
  let highRiskCount = 0;

  for (const exp of currentExpenses) {
    const amt = Number(exp.amount) || 0;
    const isPaid = exp.status === "PAID" || exp.paymentStatus === "PAID";
    const isApproved = exp.status === "APPROVED" || exp.status === "READY_FOR_PAYMENT";
    const isPending = exp.status === "PENDING_APPROVAL";
    const isBlocked = exp.status === "BLOCKED";
    const isRejected = exp.status === "REJECTED";
    const isFailed = exp.status === "PAYMENT_FAILED" || exp.paymentStatus === "FAILED";
    const isHighRisk = exp.aiAnalysis?.riskLevel === "HIGH";

    if (isPaid) {
      totalSpend += amt;
      paidSpend += amt;
      paidCount++;
    } else if (isApproved) {
      approvedSpend += amt;
    } else if (isPending) {
      pendingApprovalSpend += amt;
      pendingApprovalCount++;
    } else if (isBlocked) {
      blockedSpend += amt;
      blockedCount++;
    } else if (isRejected) {
      rejectedSpend += amt;
      rejectedCount++;
    }

    if (isFailed) {
      failedPaymentSpend += amt;
      failedPaymentCount++;
    }

    if (isHighRisk) {
      riskySpend += amt;
      riskyCount++;
      highRiskCount++;
    } else if (exp.aiAnalysis?.riskLevel === "MEDIUM") {
      mediumRiskCount++;
    } else {
      lowRiskCount++;
    }
  }

  // 5. Total Budget & Remaining calculations
  const totalBudget = departmentId
    ? (company.departments.find(d => d.id === departmentId)?.monthlyBudget || 0)
    : (company.monthlyBudget > 0
        ? company.monthlyBudget
        : company.departments.reduce((acc, d) => acc + (d.monthlyBudget || 0), 0));

  const totalCommitted = totalSpend + approvedSpend;
  const remainingBudget = Math.max(0, totalBudget - totalCommitted);
  const utilizationRate = totalBudget > 0 ? (totalCommitted / totalBudget) * 100 : 0;
  const budgetHealth = getBudgetHealth(utilizationRate);

  // 6. Period Comparison (Deterministic)
  const prevPeriodPaidExpenses = previousExpenses.filter(e => e.status === "PAID");
  const previousPeriodSpend = prevPeriodPaidExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const changeAmount = totalSpend - previousPeriodSpend;

  let changePercent = 0;
  if (previousPeriodSpend > 0) {
    changePercent = Number(((changeAmount / previousPeriodSpend) * 100).toFixed(1));
  } else if (totalSpend > 0) {
    changePercent = 100.0;
  }

  const isIncrease = changeAmount >= 0;
  const formattedChange = changePercent === 0
    ? "Spending unchanged compared to previous period"
    : isIncrease
    ? `Spending increased ${Math.abs(changePercent)}% vs previous period`
    : `Spending decreased ${Math.abs(changePercent)}% vs previous period`;

  // 7. Department Spending Breakdown
  const departmentSpendItems: DepartmentSpendItem[] = company.departments.map((dept) => {
    const deptExpenses = currentExpenses.filter(
      (e) => e.departmentId === dept.id && (e.status === "PAID" || e.status === "APPROVED" || e.status === "READY_FOR_PAYMENT")
    );
    const spent = deptExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const pendingCount = currentExpenses.filter(
      (e) => e.departmentId === dept.id && e.status === "PENDING_APPROVAL"
    ).length;
    const monthlyBudget = dept.monthlyBudget || 0;
    const remaining = Math.max(0, monthlyBudget - spent);
    const utilization = monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0;

    return {
      id: dept.id,
      name: dept.name,
      code: dept.code,
      monthlyBudget,
      spent,
      remaining,
      utilization: Number(utilization.toFixed(1)),
      health: getBudgetHealth(utilization),
      pendingCount,
      employeeCount: dept.employeeProfiles.length,
    };
  });

  // 8. Employee Spending Breakdown (Finance Admin & Manager views)
  const employeeSpendItems: EmployeeSpendItem[] = allEmployeeProfiles.map((emp) => {
    const activeExpenses = emp.expenses.filter(
      (e) => e.status === "PAID" || e.status === "APPROVED" || e.status === "READY_FOR_PAYMENT"
    );
    const spent = activeExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const transactionCount = emp.expenses.length;
    const avgTransaction = transactionCount > 0 ? spent / (activeExpenses.length || 1) : 0;
    const highRiskCount = emp.expenses.filter((e) => e.aiAnalysis?.riskLevel === "HIGH").length;
    const policyBlocks = emp.expenses.filter((e) => e.status === "BLOCKED").length;
    const approvalRequests = emp.expenses.filter((e) => e.status === "PENDING_APPROVAL").length;
    const monthlyBudget = emp.monthlyBudget || 0;
    const utilization = monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0;

    return {
      id: emp.id,
      name: emp.user?.name || "Unknown Employee",
      email: emp.user?.email || "",
      departmentName: emp.department?.name || "Unassigned",
      monthlyBudget,
      spent,
      transactionCount,
      avgTransaction: Math.round(avgTransaction),
      highRiskCount,
      policyBlocks,
      approvalRequests,
      utilization: Number(utilization.toFixed(1)),
    };
  }).sort((a, b) => b.spent - a.spent);

  // 9. Category Spending Breakdown
  const categoryMap: Record<string, { amount: number; count: number }> = {};
  const activeSpendExpenses = currentExpenses.filter(
    (e) => e.status === "PAID" || e.status === "APPROVED" || e.status === "READY_FOR_PAYMENT"
  );
  const activeSpendTotal = activeSpendExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 1;

  for (const exp of activeSpendExpenses) {
    const cat = exp.category || "General";
    if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 };
    categoryMap[cat].amount += Number(exp.amount) || 0;
    categoryMap[cat].count++;
  }

  const categorySpendItems: CategorySpendItem[] = Object.entries(categoryMap)
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: Number(((data.amount / activeSpendTotal) * 100).toFixed(1)),
      transactionCount: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // 10. Top Merchants Breakdown
  const merchantMap: Record<string, { totalSpend: number; count: number; riskFlags: Set<string> }> = {};
  for (const exp of currentExpenses) {
    const mName = exp.merchantName || "Unknown Merchant";
    if (!merchantMap[mName]) {
      merchantMap[mName] = { totalSpend: 0, count: 0, riskFlags: new Set() };
    }
    if (exp.status === "PAID" || exp.status === "APPROVED" || exp.status === "READY_FOR_PAYMENT") {
      merchantMap[mName].totalSpend += Number(exp.amount) || 0;
    }
    merchantMap[mName].count++;

    if (exp.aiAnalysis?.riskLevel === "HIGH") merchantMap[mName].riskFlags.add("HIGH_RISK");
    if (exp.status === "BLOCKED") merchantMap[mName].riskFlags.add("BLOCKED");
    if (exp.verifications?.[0]?.status === "MISMATCH") merchantMap[mName].riskFlags.add("RECEIPT_MISMATCH");
  }

  const topMerchants: TopMerchantItem[] = Object.entries(merchantMap)
    .map(([merchantName, data]) => ({
      merchantName,
      totalSpend: data.totalSpend,
      transactionCount: data.count,
      avgTransaction: data.count > 0 ? Math.round(data.totalSpend / data.count) : 0,
      riskFlags: Array.from(data.riskFlags),
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 10);

  // 11. Spending Trends Timeline (Daily or Weekly aggregation)
  const trends: SpendingTrendPoint[] = [];
  const msDiff = dateRange.end.getTime() - dateRange.start.getTime();
  const dayCount = Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));

  if (dayCount <= 31) {
    // Daily breakdown
    const dayMap: Record<string, { spend: number; count: number; dateObj: Date }> = {};
    const curr = new Date(dateRange.start);
    while (curr <= dateRange.end) {
      const key = curr.toISOString().split("T")[0];
      dayMap[key] = { spend: 0, count: 0, dateObj: new Date(curr) };
      curr.setDate(curr.getDate() + 1);
    }

    for (const exp of activeSpendExpenses) {
      const dKey = exp.createdAt.toISOString().split("T")[0];
      if (dayMap[dKey]) {
        dayMap[dKey].spend += Number(exp.amount) || 0;
        dayMap[dKey].count++;
      }
    }

    for (const [key, data] of Object.entries(dayMap)) {
      trends.push({
        date: key,
        label: data.dateObj.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        spend: data.spend,
        transactionCount: data.count,
      });
    }
  } else {
    // Weekly breakdown for 90 days
    const weekMap: Record<string, { spend: number; count: number; label: string }> = {};
    for (const exp of activeSpendExpenses) {
      const d = new Date(exp.createdAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const wKey = weekStart.toISOString().split("T")[0];
      const wLabel = `Wk of ${weekStart.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;

      if (!weekMap[wKey]) weekMap[wKey] = { spend: 0, count: 0, label: wLabel };
      weekMap[wKey].spend += Number(exp.amount) || 0;
      weekMap[wKey].count++;
    }

    for (const [wKey, data] of Object.entries(weekMap).sort()) {
      trends.push({
        date: wKey,
        label: data.label,
        spend: data.spend,
        transactionCount: data.count,
      });
    }
  }

  // 12. Deterministic Budget Forecasting
  const now = new Date();
  const currentMonthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, now.getDate());
  
  // Calculate current monthly run-rate
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const currentMonthExpenses = currentExpenses.filter(
    (e) => e.createdAt >= currentMonthStart && (e.status === "PAID" || e.status === "APPROVED" || e.status === "READY_FOR_PAYMENT")
  );
  const currentMonthlySpend = currentMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  let budgetForecast: BudgetForecast;
  const hasSufficientData = daysElapsed >= 7 && (currentExpenses.length >= 3 || currentMonthlySpend > 0);

  if (hasSufficientData) {
    const averageDailySpend = currentMonthlySpend / daysElapsed;
    const projectedMonthlySpend = Math.round(averageDailySpend * currentMonthDays);
    const projectedVariance = projectedMonthlySpend - totalBudget;
    const isOverBudget = totalBudget > 0 && projectedMonthlySpend > totalBudget;

    const message = isOverBudget
      ? `Budget projected to be exceeded by ₹${projectedVariance.toLocaleString("en-IN")} at current daily run-rate (₹${Math.round(averageDailySpend).toLocaleString("en-IN")}/day).`
      : totalBudget > 0
      ? `On track to stay within budget with ₹${Math.abs(projectedVariance).toLocaleString("en-IN")} remaining surplus.`
      : `Projected monthly spend is ₹${projectedMonthlySpend.toLocaleString("en-IN")}.`;

    budgetForecast = {
      hasSufficientData: true,
      daysElapsed,
      daysInMonth: currentMonthDays,
      currentMonthlySpend,
      averageDailySpend: Math.round(averageDailySpend),
      projectedMonthlySpend,
      monthlyBudget: totalBudget,
      projectedVariance,
      isOverBudget,
      message,
    };
  } else {
    budgetForecast = {
      hasSufficientData: false,
      daysElapsed,
      daysInMonth: currentMonthDays,
      currentMonthlySpend,
      averageDailySpend: 0,
      projectedMonthlySpend: currentMonthlySpend,
      monthlyBudget: totalBudget,
      projectedVariance: 0,
      isOverBudget: false,
      message: "Not enough historical data for reliable forecast (requires ≥ 7 days in the current cycle).",
    };
  }

  // 13. SpendGuard Impact & Control Effectiveness Metrics
  const spendReviewed = currentExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const spendSentForReview = currentExpenses
    .filter((e) => e.policyDecision === "APPROVAL_REQUIRED" || e.status === "PENDING_APPROVAL")
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const mismatchVerifications = verifications.filter((v) => v.status === "MISMATCH" || (v.duplicateIndicator && v.duplicateIndicator !== "NONE"));
  const mismatchExpenseIds = new Set(mismatchVerifications.map((v) => v.expenseId));
  const receiptIssuesAmount = currentExpenses
    .filter((e) => mismatchExpenseIds.has(e.id))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const successfulDisbursements = paymentTransactions
    .filter((pt) => pt.status === "SUCCESS")
    .reduce((sum, pt) => sum + (Number(pt.amount) || 0), 0);

  const impact: SpendGuardImpactMetrics = {
    spendReviewed,
    spendBlocked: blockedSpend,
    spendSentForReview,
    receiptIssuesCount: mismatchVerifications.length,
    receiptIssuesAmount,
    successfulDisbursements,
  };

  // 14. Receipt Intelligence KPIs
  const receiptMetrics = {
    verifiedCount: verifications.filter((v) => v.status === "VERIFIED").length,
    reviewRequiredCount: verifications.filter((v) => v.status === "REVIEW_REQUIRED").length,
    mismatchCount: verifications.filter((v) => v.status === "MISMATCH").length,
    duplicateCount: verifications.filter((v) => v.duplicateIndicator && v.duplicateIndicator !== "NONE").length,
  };

  return {
    period: dateRange,
    currency: company.currency || "INR",
    metrics: {
      totalSpend,
      approvedSpend,
      pendingApprovalSpend,
      pendingApprovalCount,
      paidSpend,
      paidCount,
      failedPaymentSpend,
      failedPaymentCount,
      blockedSpend,
      blockedCount,
      rejectedSpend,
      rejectedCount,
      riskySpend,
      riskyCount,
      totalBudget,
      remainingBudget,
      utilizationRate: Number(utilizationRate.toFixed(1)),
      budgetHealth,
    },
    comparison: {
      previousPeriodSpend,
      changeAmount,
      changePercent,
      isIncrease,
      formattedChange,
    },
    budgetForecast,
    departments: departmentSpendItems,
    employees: employeeSpendItems,
    categories: categorySpendItems,
    topMerchants,
    trends,
    impact,
    riskDistribution: {
      lowRiskCount,
      mediumRiskCount,
      highRiskCount,
    },
    receiptMetrics,
  };
}
