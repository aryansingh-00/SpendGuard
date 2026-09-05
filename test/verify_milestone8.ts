import prisma from "../lib/prisma";
import {
  calculateDateRange,
  getBudgetHealth,
  getFinanceAnalytics,
  BUDGET_THRESHOLDS,
} from "../lib/finance/analytics";
import {
  detectFinancialAnomalies,
  ANOMALY_WEIGHTS,
} from "../lib/finance/anomaly-engine";
import {
  generateFinanceInsights,
  generateDeterministicInsights,
} from "../lib/ai/finance-insights";
import {
  FinanceInsightItemSchema,
  FinanceInsightsOutputSchema,
} from "../lib/ai/schemas";

let totalTests = 0;
let passedTests = 0;

function assert(description: string, condition: boolean, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    if (details) console.error("     Details:", details);
  }
}

async function runMilestone8Tests() {
  console.log("=================================================");
  console.log("📊  SPENDGUARD AI — MILESTONE 8 AUTOMATED TESTS");
  console.log("    AI Finance Controller & Financial Insights");
  console.log("=================================================\n");

  // ==========================================
  // SETUP TEST DATA
  // ==========================================
  console.log("--- Setup: Creating Test Entities ---");
  const testCompanyA = await prisma.company.create({
    data: {
      name: "Acme Corp FinController Test A",
      currency: "INR",
      monthlyBudget: 500000.0,
    },
  });

  const testCompanyB = await prisma.company.create({
    data: {
      name: "Beta Global Test B",
      currency: "INR",
      monthlyBudget: 200000.0,
    },
  });

  const testAdminA = await prisma.user.create({
    data: {
      email: `finance.admin.${Date.now()}@acme.test`,
      name: "Priya Sharma",
      role: "FINANCE_ADMIN",
      companyId: testCompanyA.id,
    },
  });

  const testManagerA = await prisma.user.create({
    data: {
      email: `manager.eng.${Date.now()}@acme.test`,
      name: "Ananya Iyer",
      role: "MANAGER",
      companyId: testCompanyA.id,
    },
  });

  const testEmployeeA1 = await prisma.user.create({
    data: {
      email: `emp.rahul.${Date.now()}@acme.test`,
      name: "Rahul Verma",
      role: "EMPLOYEE",
      companyId: testCompanyA.id,
    },
  });

  const deptEngA = await prisma.department.create({
    data: {
      name: "Engineering",
      code: "ENG",
      monthlyBudget: 300000.0,
      companyId: testCompanyA.id,
      managerId: testManagerA.id,
    },
  });

  const deptMktA = await prisma.department.create({
    data: {
      name: "Marketing",
      code: "MKT",
      monthlyBudget: 150000.0,
      companyId: testCompanyA.id,
    },
  });

  const empProfileA1 = await prisma.employeeProfile.create({
    data: {
      userId: testEmployeeA1.id,
      companyId: testCompanyA.id,
      departmentId: deptEngA.id,
      monthlyBudget: 50000.0,
      jobTitle: "Senior Software Engineer",
    },
  });

  // Seed expenses for Company A
  // 1. Paid routine AWS expense (₹25,000)
  const exp1 = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M8-001-${Date.now()}`,
      employeeProfileId: empProfileA1.id,
      departmentId: deptEngA.id,
      companyId: testCompanyA.id,
      merchantName: "Amazon Web Services",
      amount: 25000.0,
      currency: "INR",
      category: "Software",
      purpose: "Production EC2 instances",
      status: "PAID",
      paymentStatus: "PAID",
      createdAt: new Date(),
    },
  });

  // 2. Paid Google Cloud expense (₹45,000)
  const exp2 = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M8-002-${Date.now()}`,
      employeeProfileId: empProfileA1.id,
      departmentId: deptEngA.id,
      companyId: testCompanyA.id,
      merchantName: "Google Cloud",
      amount: 45000.0,
      currency: "INR",
      category: "Software",
      purpose: "BigQuery data analytics",
      status: "PAID",
      paymentStatus: "PAID",
      createdAt: new Date(),
    },
  });

  // 3. Pending approval expense (₹30,000)
  const exp3 = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M8-003-${Date.now()}`,
      employeeProfileId: empProfileA1.id,
      departmentId: deptEngA.id,
      companyId: testCompanyA.id,
      merchantName: "MacBook Pro Upgrade",
      amount: 30000.0,
      currency: "INR",
      category: "Hardware",
      purpose: "Development laptop memory upgrade",
      status: "PENDING_APPROVAL",
      policyDecision: "APPROVAL_REQUIRED",
      createdAt: new Date(),
    },
  });

  // 4. Blocked expense (₹60,000 Casino)
  const exp4 = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M8-004-${Date.now()}`,
      employeeProfileId: empProfileA1.id,
      departmentId: deptEngA.id,
      companyId: testCompanyA.id,
      merchantName: "Casino Grand",
      amount: 60000.0,
      currency: "INR",
      category: "Gambling",
      purpose: "Team celebration",
      status: "BLOCKED",
      policyDecision: "BLOCKED",
      createdAt: new Date(),
    },
  });

  // 5. Payment failed transaction (₹15,000)
  const exp5 = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M8-005-${Date.now()}`,
      employeeProfileId: empProfileA1.id,
      departmentId: deptEngA.id,
      companyId: testCompanyA.id,
      merchantName: "Slack Technologies",
      amount: 15000.0,
      currency: "INR",
      category: "Software",
      purpose: "Enterprise Slack upgrade",
      status: "PAYMENT_FAILED",
      paymentStatus: "FAILED",
      createdAt: new Date(),
    },
  });

  // Create associated payment transaction
  await prisma.paymentTransaction.create({
    data: {
      companyId: testCompanyA.id,
      expenseId: exp1.id,
      amount: 25000.0,
      status: "SUCCESS",
      type: "PAYMENT",
    },
  });

  // Create associated verification with mismatch
  await prisma.expenseReceipt.create({
    data: {
      companyId: testCompanyA.id,
      expenseId: exp5.id,
      fileName: "slack_invoice.pdf",
      fileType: "application/pdf",
      fileSize: 10240,
      storageKey: `companies/${testCompanyA.id}/slack_invoice.pdf`,
      status: "PROCESSED",
      receiptAnalyses: {
        create: {
          companyId: testCompanyA.id,
          merchantName: "Slack Technologies Inc",
          totalAmount: 12000.0, // ₹3,000 mismatch
          status: "PROCESSED",
          expenseVerifications: {
            create: {
              companyId: testCompanyA.id,
              expenseId: exp5.id,
              status: "MISMATCH",
              overallScore: 65,
              amountScore: 0,
              amountMatch: false,
              merchantScore: 25,
              merchantMatch: true,
              dateScore: 15,
              dateMatch: true,
              currencyScore: 10,
              currencyMatch: true,
              categoryScore: 10,
              categoryMatch: true,
              mismatchReasons: JSON.stringify(["Amount discrepancy of ₹3,000 between claim and document"]),
              matchBreakdown: JSON.stringify({}),
              recommendation: "REVIEW",
            },
          },
        },
      },
    },
  });

  // Seed previous period expense for comparison (₹50,000)
  const thirtyFiveDaysAgo = new Date();
  thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);
  await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M8-PREV-${Date.now()}`,
      employeeProfileId: empProfileA1.id,
      departmentId: deptEngA.id,
      companyId: testCompanyA.id,
      merchantName: "GitHub Enterprise",
      amount: 50000.0,
      currency: "INR",
      category: "Software",
      purpose: "Annual organization licenses",
      status: "PAID",
      paymentStatus: "PAID",
      createdAt: thirtyFiveDaysAgo,
    },
  });

  // ==========================================
  // 1. DATE RANGE & BUDGET HEALTH THRESHOLD TESTS
  // ==========================================
  console.log("\n--- 1. Date Range & Budget Health Threshold Tests ---");
  const d30 = calculateDateRange("last_30_days");
  assert("Date range calculates valid start and end bounds", d30.start < d30.end);
  assert("Date range calculates valid previous comparison window", d30.prevStart < d30.prevEnd);
  assert("Default label is 'Last 30 days'", d30.label === "Last 30 days");

  const healthHealthy = getBudgetHealth(50);
  assert("Budget Health: 50% utilization is HEALTHY (< 70%)", healthHealthy.status === "HEALTHY");

  const healthWatch = getBudgetHealth(82);
  assert("Budget Health: 82% utilization is WATCH (70-90%)", healthWatch.status === "WATCH");

  const healthCritical = getBudgetHealth(94);
  assert("Budget Health: 94% utilization is CRITICAL (> 90%)", healthCritical.status === "CRITICAL");

  // ==========================================
  // 2. FINANCE ANALYTICS SERVICE TESTS
  // ==========================================
  console.log("\n--- 2. Finance Analytics Service Tests ---");
  const analyticsA = await getFinanceAnalytics({
    companyId: testCompanyA.id,
    period: "last_30_days",
  });

  assert("Total Realized Spend is exactly ₹70,000 (₹25k + ₹45k)", analyticsA.metrics.totalSpend === 70000);
  assert("Pending Approval Spend is exactly ₹30,000", analyticsA.metrics.pendingApprovalSpend === 30000);
  assert("Pending Approval Count is 1", analyticsA.metrics.pendingApprovalCount === 1);
  assert("Blocked Spend is exactly ₹60,000", analyticsA.metrics.blockedSpend === 60000);
  assert("Blocked Count is 1", analyticsA.metrics.blockedCount === 1);
  assert("Failed Payment Spend is ₹15,000", analyticsA.metrics.failedPaymentSpend === 15000);

  // Period comparison: current ₹70,000 vs previous ₹50,000 -> +40.0%
  assert("Period comparison computes previous period spend (₹50,000)", analyticsA.comparison.previousPeriodSpend === 50000);
  assert("Period comparison computes +40.0% increase", analyticsA.comparison.changePercent === 40);
  assert("Period comparison detects isIncrease = true", analyticsA.comparison.isIncrease === true);
  assert("Formatted comparison text includes percentage", analyticsA.comparison.formattedChange.includes("40%"));

  // Remaining budget & health
  assert("Company Budget remaining is ₹430,000 (₹500k - ₹70k)", analyticsA.metrics.remainingBudget === 430000);
  assert("Company Budget utilization rate is 14.0%", analyticsA.metrics.utilizationRate === 14);

  // Department breakdown
  const engDeptAnalytics = analyticsA.departments.find((d) => d.id === deptEngA.id);
  assert("Department Engineering spend is ₹70,000", engDeptAnalytics?.spent === 70000);
  assert("Department Engineering remaining is ₹230,000", engDeptAnalytics?.remaining === 230000);
  assert("Department Engineering pendingCount is 1", engDeptAnalytics?.pendingCount === 1);

  // Category breakdown
  const softCategory = analyticsA.categories.find((c) => c.category === "Software");
  assert("Software Category spend is ₹70,000", softCategory?.amount === 70000);
  assert("Software Category is 100% of realized spend", softCategory?.percentage === 100);

  // Top Merchants
  assert("Top merchants includes Amazon Web Services", analyticsA.topMerchants.some((m) => m.merchantName === "Amazon Web Services"));
  assert("Top merchants includes Google Cloud", analyticsA.topMerchants.some((m) => m.merchantName === "Google Cloud"));

  // SpendGuard Impact Metrics
  assert("Impact Spend Reviewed includes all evaluated transactions", analyticsA.impact.spendReviewed === 175000); // 25+45+30+60+15
  assert("Impact Spend Blocked captures ₹60,000 policy violation", analyticsA.impact.spendBlocked === 60000);
  assert("Impact Receipt Issues Count is 1", analyticsA.impact.receiptIssuesCount === 1);
  assert("Impact Successful Disbursements is ₹25,000", analyticsA.impact.successfulDisbursements === 25000);

  // ==========================================
  // 3. STATISTICAL BUDGET FORECASTING TESTS
  // ==========================================
  console.log("\n--- 3. Statistical Budget Forecasting Tests ---");
  assert("Budget forecast object is present", analyticsA.budgetForecast !== undefined);
  assert("Budget forecast correctly tracks daysInMonth", analyticsA.budgetForecast.daysInMonth >= 28);
  assert("Budget forecast has message string", analyticsA.budgetForecast.message.length > 0);

  // ==========================================
  // 4. FINANCIAL ANOMALY ENGINE TESTS
  // ==========================================
  console.log("\n--- 4. Financial Anomaly Engine Tests ---");
  const anomalyResult = await detectFinancialAnomalies(testCompanyA.id, analyticsA);

  assert("Anomaly Engine runs without error", Array.isArray(anomalyResult.anomalies));
  assert("Anomaly Engine detected at least 1 anomaly", anomalyResult.anomalies.length > 0);

  const receiptAnomaly = anomalyResult.anomalies.find((a) => a.type === "RECEIPT_MISMATCH_CONCENTRATION");
  assert("Receipt mismatch anomaly flagged correctly", receiptAnomaly !== undefined);
  assert("Receipt mismatch anomaly has evidence array", (receiptAnomaly?.evidence.length || 0) > 0);
  assert("Receipt mismatch recommended action is actionable", receiptAnomaly?.recommendedAction.includes("Approvals") === true);

  const paymentFailureAnomaly = anomalyResult.anomalies.find((a) => a.type === "PAYMENT_FAILURES");
  assert("Payment gateway failure anomaly flagged", paymentFailureAnomaly !== undefined);
  assert("Payment gateway failure anomaly is CRITICAL severity", paymentFailureAnomaly?.severity === "CRITICAL");

  // ==========================================
  // 5. AI FINANCE INSIGHT ENGINE & SCHEMA TESTS
  // ==========================================
  console.log("\n--- 5. AI Finance Insight Engine & Schema Tests ---");
  const insightResult = await generateFinanceInsights({
    companyName: testCompanyA.name,
    analytics: analyticsA,
    anomalies: anomalyResult.anomalies,
  });

  assert("AI Insight output conforms to Zod schema", FinanceInsightsOutputSchema.safeParse(insightResult).success);
  assert("Executive summary is present and non-empty", insightResult.summary.length > 10);
  assert("Executive summary cites deterministic spend", insightResult.summary.includes("70,000"));
  assert("Generated between 1 and 5 prioritized insights", insightResult.insights.length >= 1 && insightResult.insights.length <= 5);

  const firstInsight = insightResult.insights[0];
  assert("First insight has valid severity", ["CRITICAL", "WARNING", "INFO"].includes(firstInsight.severity));
  assert("First insight has evidence array", firstInsight.evidence.length >= 1);
  assert("First insight has actionable recommendation", firstInsight.recommendedAction.length > 5);
  assert("First insight has functional actionLink", (firstInsight.actionLink || "").startsWith("/dashboard"));

  // Verify schema rejection on invalid input
  const invalidInsight = {
    title: "Bad Insight",
    severity: "INVALID_SEVERITY", // Not INFO/WARNING/CRITICAL
    explanation: "test",
    evidence: [],
    recommendedAction: "test",
  };
  assert("Schema rejects invalid severity enum", !FinanceInsightItemSchema.safeParse(invalidInsight).success);

  // ==========================================
  // 6. STORED AI INSIGHTS LIFECYCLE & AUDIT TESTS
  // ==========================================
  console.log("\n--- 6. Stored AI Insights Lifecycle & Audit Tests ---");
  const storedInsight = await prisma.aIInsight.create({
    data: {
      companyId: testCompanyA.id,
      periodStart: analyticsA.period.start,
      periodEnd: analyticsA.period.end,
      type: "BUDGET_PRESSURE",
      severity: "WARNING",
      title: "Engineering Approaching Budget",
      explanation: "Engineering spend has reached 70% of budget.",
      recommendedAction: "Review pending purchase orders.",
      actionLink: "/dashboard/departments",
      evidence: JSON.stringify(["Spent: ₹70,000", "Budget: ₹300,000"]),
      status: "ACTIVE",
    },
  });

  assert("AI Insight persisted to database with status ACTIVE", storedInsight.status === "ACTIVE");

  // Test dismiss
  const dismissed = await prisma.aIInsight.update({
    where: { id: storedInsight.id },
    data: { status: "DISMISSED" },
  });
  assert("Insight can be transitioned to DISMISSED", dismissed.status === "DISMISSED");

  // Test resolve
  const resolved = await prisma.aIInsight.update({
    where: { id: storedInsight.id },
    data: { status: "RESOLVED" },
  });
  assert("Insight can be transitioned to RESOLVED", resolved.status === "RESOLVED");

  // ==========================================
  // 7. MULTI-TENANCY & ROLE-BASED SCOPING TESTS
  // ==========================================
  console.log("\n--- 7. Multi-Tenancy & Role-Based Scoping Tests ---");
  const analyticsB = await getFinanceAnalytics({
    companyId: testCompanyB.id,
    period: "last_30_days",
  });

  assert("Company Isolation: Company B total spend is ₹0 (isolates Company A's ₹70k)", analyticsB.metrics.totalSpend === 0);
  assert("Company Isolation: Company B has 0 blocked transactions", analyticsB.metrics.blockedCount === 0);

  // Scoped Department Query
  const deptScopedAnalytics = await getFinanceAnalytics({
    companyId: testCompanyA.id,
    departmentId: deptEngA.id,
    period: "last_30_days",
  });
  assert("Manager Scope: Department filtered spend matches Engineering (₹70,000)", deptScopedAnalytics.metrics.totalSpend === 70000);
  assert("Manager Scope: Department budget is Engineering budget (₹300,000)", deptScopedAnalytics.metrics.totalBudget === 300000);

  // Scoped Employee Query
  const empScopedAnalytics = await getFinanceAnalytics({
    companyId: testCompanyA.id,
    employeeProfileId: empProfileA1.id,
    period: "last_30_days",
  });
  assert("Employee Scope: Employee filtered spend matches Rahul's expenses", empScopedAnalytics.metrics.totalSpend === 70000);

  // ==========================================
  // CLEANUP TEST RECORDS
  // ==========================================
  await prisma.aIInsight.deleteMany({ where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } } });
  await prisma.auditLog.deleteMany({ where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } } });
  await prisma.paymentTransaction.deleteMany({ where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } } });
  await prisma.expenseVerification.deleteMany({ where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } } });
  await prisma.receiptAnalysis.deleteMany({ where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } } });
  await prisma.expenseReceipt.deleteMany({ where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } } });
  await prisma.expense.deleteMany({ where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } } });
  await prisma.employeeProfile.deleteMany({ where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } } });
  await prisma.department.deleteMany({ where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } } });
  await prisma.user.deleteMany({ where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } } });
  await prisma.company.deleteMany({ where: { id: { in: [testCompanyA.id, testCompanyB.id] } } });

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log("\n=================================================");
  console.log(`MILESTONE 8 TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log("🎉 ALL MILESTONE 8 TESTS PASSED SUCCESSFULLY!");
  } else {
    console.error(`⚠️  ${totalTests - passedTests} TESTS FAILED.`);
  }
  console.log("=================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runMilestone8Tests()
  .catch((e) => {
    console.error("Test execution error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
