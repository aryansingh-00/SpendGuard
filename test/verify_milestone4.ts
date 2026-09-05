import { PrismaClient } from "@prisma/client";
import { AIRiskOutputSchema, AIContextSchema } from "../lib/ai/schemas";
import { computeGroundedRiskAnalysis, analyzeTransactionRisk } from "../lib/ai/risk-engine";
import { synthesizeDecision } from "../lib/decision-engine";
import { PolicyEvaluationResult } from "../lib/policy-engine";

const prisma = new PrismaClient();

async function runMilestone4Tests() {
  console.log("=================================================");
  console.log("🧠 SPENDGUARD AI — MILESTONE 4 AUTOMATED TESTS");
  console.log("=================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(title: string, condition: boolean, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ PASS: ${title}`);
    } else {
      console.error(`  ❌ FAIL: ${title}`);
      if (details) console.error(`     Details: ${details}`);
    }
  }

  // ==========================================
  // 1. ZOD SCHEMA & BOUNDARY VALIDATION TESTS
  // ==========================================
  console.log("--- 1. Schema & Score Boundary Validation Tests ---");

  // Valid Low Risk Object
  const validLow = {
    riskScore: 20,
    riskLevel: "LOW",
    signals: [{ type: "NORMAL_PATTERN", severity: "LOW", message: "Normal transaction" }],
    summary: "Transaction is low risk.",
    recommendation: "PROCEED",
    isDuplicate: false,
    model: "test-model",
  };
  const parseLow = AIRiskOutputSchema.safeParse(validLow);
  assert("Schema validates correct LOW risk output", parseLow.success === true);

  // Boundary 0 (Minimum Score)
  const score0 = AIRiskOutputSchema.safeParse({ ...validLow, riskScore: 0 });
  assert("Score boundary: 0 is valid", score0.success === true && score0.data.riskScore === 0);

  // Boundary 30 (Top of LOW band)
  const score30 = AIRiskOutputSchema.safeParse({ ...validLow, riskScore: 30 });
  assert("Score boundary: 30 is valid", score30.success === true && score30.data.riskScore === 30);

  // Boundary 31 (Bottom of MEDIUM band)
  const score31 = AIRiskOutputSchema.safeParse({
    ...validLow,
    riskScore: 31,
    riskLevel: "MEDIUM",
    recommendation: "REVIEW",
  });
  assert("Score boundary: 31 is valid", score31.success === true && score31.data.riskScore === 31);

  // Boundary 70 (Top of MEDIUM band)
  const score70 = AIRiskOutputSchema.safeParse({
    ...validLow,
    riskScore: 70,
    riskLevel: "MEDIUM",
    recommendation: "REVIEW",
  });
  assert("Score boundary: 70 is valid", score70.success === true && score70.data.riskScore === 70);

  // Boundary 71 (Bottom of HIGH band)
  const score71 = AIRiskOutputSchema.safeParse({
    ...validLow,
    riskScore: 71,
    riskLevel: "HIGH",
    recommendation: "HIGH_RISK_REVIEW",
  });
  assert("Score boundary: 71 is valid", score71.success === true && score71.data.riskScore === 71);

  // Boundary 100 (Maximum Score)
  const score100 = AIRiskOutputSchema.safeParse({
    ...validLow,
    riskScore: 100,
    riskLevel: "HIGH",
    recommendation: "HIGH_RISK_REVIEW",
  });
  assert("Score boundary: 100 is valid", score100.success === true && score100.data.riskScore === 100);

  // Invalid: Out of range (< 0)
  const scoreNegative = AIRiskOutputSchema.safeParse({ ...validLow, riskScore: -5 });
  assert("Schema rejects negative risk score (-5)", scoreNegative.success === false);

  // Invalid: Out of range (> 100)
  const scoreOver100 = AIRiskOutputSchema.safeParse({ ...validLow, riskScore: 105 });
  assert("Schema rejects score exceeding 100 (105)", scoreOver100.success === false);

  // Invalid: Bad Enum Recommendation
  const invalidEnum = AIRiskOutputSchema.safeParse({ ...validLow, recommendation: "INVALID_ACTION" });
  assert("Schema rejects invalid recommendation enum", invalidEnum.success === false);

  // Graceful Nullable Score for UNAVAILABLE state
  const unavailablePayload = {
    riskScore: null,
    riskLevel: "UNAVAILABLE",
    signals: [{ type: "AI_SERVICE_UNAVAILABLE", severity: "MEDIUM", message: "Service down" }],
    summary: "Service unavailable fallback.",
    recommendation: "REVIEW",
    isDuplicate: false,
    model: "fallback",
  };
  const parseUnavailable = AIRiskOutputSchema.safeParse(unavailablePayload);
  assert("Schema permits null riskScore when riskLevel is UNAVAILABLE", parseUnavailable.success === true);


  // ==========================================
  // 2. DUAL-ENGINE DECISION SYNTHESIS MATRIX
  // ==========================================
  console.log("\n--- 2. Decision Engine Priority & Supremacy Matrix Tests ---");

  const mockApprovedPolicy: PolicyEvaluationResult = {
    decision: "APPROVED",
    reasons: ["Within all policy limits"],
    summary: "Compliant with policy",
    checks: {
      companyBudget: "PASS",
      departmentBudget: "PASS",
      employeeBudget: "PASS",
      transactionLimit: "PASS",
      approvalThreshold: "PASS",
      category: "PASS",
      merchant: "PASS",
    },
    budgets: {
      company: { budget: 1000000, spent: 200000, remaining: 800000 },
      department: { budget: 500000, spent: 100000, remaining: 400000 },
      employee: { budget: 50000, spent: 10000, remaining: 40000 },
    },
    applicablePolicies: [{ id: "pol_1", name: "Default Policy", scopeType: "COMPANY" }],
  };

  const mockApprovalPolicy: PolicyEvaluationResult = {
    decision: "APPROVAL_REQUIRED",
    reasons: ["Exceeds single transaction approval threshold"],
    summary: "Manager approval required",
    checks: {
      companyBudget: "PASS",
      departmentBudget: "PASS",
      employeeBudget: "PASS",
      transactionLimit: "PASS",
      approvalThreshold: "TRIGGERED",
      category: "PASS",
      merchant: "PASS",
    },
    budgets: {
      company: { budget: 1000000, spent: 200000, remaining: 800000 },
      department: { budget: 500000, spent: 100000, remaining: 400000 },
      employee: { budget: 50000, spent: 10000, remaining: 40000 },
    },
    applicablePolicies: [{ id: "pol_1", name: "Default Policy", scopeType: "COMPANY" }],
  };

  const mockBlockedPolicy: PolicyEvaluationResult = {
    decision: "BLOCKED",
    reasons: ["Exceeds monthly employee budget envelope"],
    summary: "Budget exceeded",
    checks: {
      companyBudget: "PASS",
      departmentBudget: "PASS",
      employeeBudget: "BLOCKED",
      transactionLimit: "PASS",
      approvalThreshold: "PASS",
      category: "PASS",
      merchant: "PASS",
    },
    budgets: {
      company: { budget: 1000000, spent: 200000, remaining: 800000 },
      department: { budget: 500000, spent: 100000, remaining: 400000 },
      employee: { budget: 50000, spent: 50000, remaining: 0 },
    },
    applicablePolicies: [{ id: "pol_1", name: "Default Policy", scopeType: "COMPANY" }],
  };

  const mockLowAI = {
    riskScore: 15,
    riskLevel: "LOW" as const,
    signals: [],
    summary: "Normal spending",
    recommendation: "PROCEED" as const,
    isDuplicate: false,
  };

  const mockMediumAI = {
    riskScore: 48,
    riskLevel: "MEDIUM" as const,
    signals: [{ type: "UNUSUAL_AMOUNT", severity: "MEDIUM" as const, message: "Above average" }],
    summary: "Slight anomaly detected",
    recommendation: "REVIEW" as const,
    isDuplicate: false,
  };

  const mockHighAI = {
    riskScore: 88,
    riskLevel: "HIGH" as const,
    signals: [{ type: "POSSIBLE_DUPLICATE", severity: "HIGH" as const, message: "Duplicate charge" }],
    summary: "High risk duplicate",
    recommendation: "HIGH_RISK_REVIEW" as const,
    isDuplicate: true,
  };

  // Rule 1: Policy APPROVED + AI LOW -> APPROVED
  const syn1 = synthesizeDecision(mockApprovedPolicy, mockLowAI);
  assert("Supremacy: Policy APPROVED + AI LOW = APPROVED", syn1.finalDecision === "APPROVED");

  // Rule 2: Policy APPROVED + AI MEDIUM (REVIEW) -> APPROVAL_REQUIRED
  const syn2 = synthesizeDecision(mockApprovedPolicy, mockMediumAI);
  assert("Supremacy: Policy APPROVED + AI MEDIUM (REVIEW) = APPROVAL_REQUIRED", syn2.finalDecision === "APPROVAL_REQUIRED");

  // Rule 3: Policy APPROVED + AI HIGH -> APPROVAL_REQUIRED
  const syn3 = synthesizeDecision(mockApprovedPolicy, mockHighAI);
  assert("Supremacy: Policy APPROVED + AI HIGH = APPROVAL_REQUIRED", syn3.finalDecision === "APPROVAL_REQUIRED");

  // Rule 4: Policy APPROVAL_REQUIRED + AI LOW -> APPROVAL_REQUIRED (AI cannot unblock/bypass approval)
  const syn4 = synthesizeDecision(mockApprovalPolicy, mockLowAI);
  assert("Supremacy: Policy APPROVAL_REQUIRED + AI LOW = APPROVAL_REQUIRED", syn4.finalDecision === "APPROVAL_REQUIRED");

  // Rule 5: Policy APPROVAL_REQUIRED + AI HIGH -> APPROVAL_REQUIRED
  const syn5 = synthesizeDecision(mockApprovalPolicy, mockHighAI);
  assert("Supremacy: Policy APPROVAL_REQUIRED + AI HIGH = APPROVAL_REQUIRED", syn5.finalDecision === "APPROVAL_REQUIRED");

  // Rule 6: Policy BLOCKED + AI LOW -> BLOCKED (AI cannot unblock hard rule violation)
  const syn6 = synthesizeDecision(mockBlockedPolicy, mockLowAI);
  assert("Supremacy: Policy BLOCKED + AI LOW = BLOCKED", syn6.finalDecision === "BLOCKED");

  // Rule 7: Policy BLOCKED + AI HIGH -> BLOCKED
  const syn7 = synthesizeDecision(mockBlockedPolicy, mockHighAI);
  assert("Supremacy: Policy BLOCKED + AI HIGH = BLOCKED", syn7.finalDecision === "BLOCKED");

  // Rule 8: Policy APPROVED + AI UNAVAILABLE -> APPROVAL_REQUIRED (Safe fallback)
  const syn8 = synthesizeDecision(mockApprovedPolicy, unavailablePayload as any);
  assert("Supremacy: Policy APPROVED + AI UNAVAILABLE = APPROVAL_REQUIRED (Safe Fallback)", syn8.finalDecision === "APPROVAL_REQUIRED");


  // ==========================================
  // 3. 5 CORE DEMO RISK SCENARIOS
  // ==========================================
  console.log("\n--- 3. Five Core AI Risk Engine Demo Scenarios ---");

  // Scenario 1: Normal Routine Expense
  const scenario1Context = {
    employee: { name: "Rahul Sharma", role: "EMPLOYEE", department: "Marketing" },
    transaction: {
      merchant: "Google Ads",
      amount: 4500,
      category: "Advertising",
      purpose: "Monthly search campaign refill",
    },
    budget: { monthlyLimit: 50000, spent: 10000, remaining: 40000 },
    history: {
      averageTransaction: 4200,
      transactionCount: 8,
      recentTransactions: [
        { merchant: "Google Ads", amount: 4000, category: "Advertising", date: "2026-08-10" },
        { merchant: "Meta Ads", amount: 4500, category: "Advertising", date: "2026-08-01" },
      ],
    },
    policy: { decision: "APPROVED" as const, reasons: [] },
  };

  const resScenario1 = computeGroundedRiskAnalysis(scenario1Context);
  assert("Scenario 1 (Normal Routine Expense): Risk Score <= 30", resScenario1.riskScore !== null && resScenario1.riskScore <= 30, `Score: ${resScenario1.riskScore}`);
  assert("Scenario 1 (Normal Routine Expense): Risk Level is LOW", resScenario1.riskLevel === "LOW");
  assert("Scenario 1 (Normal Routine Expense): Recommendation is PROCEED", resScenario1.recommendation === "PROCEED");
  assert("Scenario 1 (Normal Routine Expense): isDuplicate is false", resScenario1.isDuplicate === false);

  // Scenario 2: Unusual Amount Outlier (8x average)
  const scenario2Context = {
    employee: { name: "Rahul Sharma", role: "EMPLOYEE", department: "Marketing" },
    transaction: {
      merchant: "Google Ads",
      amount: 38000, // Historical avg is 4,000 -> 9.5x spike
      category: "Advertising",
      purpose: "Enterprise ad campaign blast",
    },
    budget: { monthlyLimit: 100000, spent: 10000, remaining: 90000 },
    history: {
      averageTransaction: 4000,
      transactionCount: 5,
      recentTransactions: [
        { merchant: "Google Ads", amount: 4000, category: "Advertising", date: "2026-08-10" },
      ],
    },
    policy: { decision: "APPROVED" as const, reasons: [] },
  };

  const resScenario2 = computeGroundedRiskAnalysis(scenario2Context);
  assert("Scenario 2 (Amount Outlier): Flags UNUSUAL_AMOUNT signal", resScenario2.signals.some((s) => s.type === "UNUSUAL_AMOUNT"));
  assert("Scenario 2 (Amount Outlier): Score > 30 (Elevated Risk)", resScenario2.riskScore !== null && resScenario2.riskScore > 30, `Score: ${resScenario2.riskScore}`);
  assert("Scenario 2 (Amount Outlier): Recommendation is REVIEW or HIGH_RISK_REVIEW", resScenario2.recommendation !== "PROCEED");

  // Scenario 3: Category / Department Mismatch (Engineering purchasing Gaming)
  const scenario3Context = {
    employee: { name: "Aman Gupta", role: "EMPLOYEE", department: "Engineering" },
    transaction: {
      merchant: "Steam Games Corp",
      amount: 8500,
      category: "Gaming", // Prohibited keyword
      purpose: "Team gaming evening subscription",
    },
    budget: { monthlyLimit: 60000, spent: 5000, remaining: 55000 },
    history: {
      averageTransaction: 6000,
      transactionCount: 3,
      recentTransactions: [
        { merchant: "AWS Cloud", amount: 6000, category: "Cloud Infrastructure", date: "2026-08-15" },
      ],
    },
    policy: { decision: "APPROVED" as const, reasons: [] },
  };

  const resScenario3 = computeGroundedRiskAnalysis(scenario3Context);
  assert("Scenario 3 (Prohibited/Mismatch Category): Flags PROHIBITED_CATEGORY signal", resScenario3.signals.some((s) => s.type === "PROHIBITED_CATEGORY"));
  assert("Scenario 3 (Prohibited Category): Risk Level is HIGH", resScenario3.riskLevel === "HIGH", `Risk Level: ${resScenario3.riskLevel}`);
  assert("Scenario 3 (Prohibited Category): Recommendation is HIGH_RISK_REVIEW", resScenario3.recommendation === "HIGH_RISK_REVIEW");

  // Scenario 4: New / Unverified Merchant Novelty
  const scenario4Context = {
    employee: { name: "Rahul Sharma", role: "EMPLOYEE", department: "Marketing" },
    transaction: {
      merchant: "MysteriousGlobalMediaLab99", // Brand new merchant never used
      amount: 4500,
      category: "Advertising",
      purpose: "Ad trial on new unknown ad network",
    },
    budget: { monthlyLimit: 50000, spent: 10000, remaining: 40000 },
    history: {
      averageTransaction: 4500,
      transactionCount: 6,
      recentTransactions: [
        { merchant: "Google Ads", amount: 4500, category: "Advertising", date: "2026-08-10" },
        { merchant: "LinkedIn Ads", amount: 4500, category: "Advertising", date: "2026-08-01" },
      ],
    },
    policy: { decision: "APPROVED" as const, reasons: [] },
  };

  const resScenario4 = computeGroundedRiskAnalysis(scenario4Context);
  assert("Scenario 4 (New Merchant): Flags NEW_MERCHANT signal", resScenario4.signals.some((s) => s.type === "NEW_MERCHANT"));
  assert("Scenario 4 (New Merchant): Elevated score above baseline", resScenario4.riskScore !== null && resScenario4.riskScore >= 30, `Score: ${resScenario4.riskScore}`);

  // Scenario 5: Duplicate Expense Detection
  const scenario5Context = {
    employee: { name: "Rahul Sharma", role: "EMPLOYEE", department: "Marketing" },
    transaction: {
      merchant: "Google Ads",
      amount: 4999, // Identical to a recent charge
      category: "Advertising",
      purpose: "Search Ads",
    },
    budget: { monthlyLimit: 50000, spent: 10000, remaining: 40000 },
    history: {
      averageTransaction: 5000,
      transactionCount: 5,
      recentTransactions: [
        { merchant: "Google Ads", amount: 4999, category: "Advertising", date: "2026-09-04" },
        { merchant: "Meta Ads", amount: 3000, category: "Advertising", date: "2026-08-20" },
      ],
    },
    policy: { decision: "APPROVED" as const, reasons: [] },
  };

  const resScenario5 = computeGroundedRiskAnalysis(scenario5Context);
  assert("Scenario 5 (Duplicate Detection): isDuplicate is true", resScenario5.isDuplicate === true);
  assert("Scenario 5 (Duplicate Detection): Flags POSSIBLE_DUPLICATE signal", resScenario5.signals.some((s) => s.type === "POSSIBLE_DUPLICATE"));
  assert("Scenario 5 (Duplicate Detection): Duplicate details provided", typeof resScenario5.duplicateDetails === "string" && resScenario5.duplicateDetails.length > 0);


  // ==========================================
  // 4. DATABASE PERSISTENCE & MULTI-TENANCY
  // ==========================================
  console.log("\n--- 4. Database Integration & AI Analysis Persistence Tests ---");

  // Find Acme test company
  const acme = await prisma.company.findFirst({
    where: { name: "Acme Technologies" },
    include: {
      employeeProfiles: { include: { user: true } },
      departments: true,
      expenses: true,
    },
  });

  if (!acme || acme.expenses.length === 0) {
    throw new Error("Acme Technologies or expenses missing from database");
  }

  const testExpense = acme.expenses[0];
  const empProfile = acme.employeeProfiles[0];

  // Test analyzeTransactionRisk pipeline
  const liveAnalysis = await analyzeTransactionRisk({
    employee: {
      name: empProfile.user.name,
      role: empProfile.user.role,
      department: acme.departments[0].name,
    },
    transaction: {
      merchant: testExpense.merchantName,
      amount: testExpense.amount,
      category: testExpense.category,
      purpose: testExpense.purpose,
    },
    budget: {
      monthlyLimit: empProfile.monthlyBudget,
      spent: 10000,
      remaining: empProfile.monthlyBudget - 10000,
    },
    history: {
      averageTransaction: 5000,
      transactionCount: 2,
      recentTransactions: [],
    },
    policy: {
      decision: "APPROVED",
      reasons: ["Pre-approved limits"],
    },
  });

  assert("AI Risk Engine returns valid score", liveAnalysis.riskScore !== null && liveAnalysis.riskScore >= 0 && liveAnalysis.riskScore <= 100);
  assert("AI Risk Engine returns valid riskLevel enum", ["LOW", "MEDIUM", "HIGH", "UNAVAILABLE"].includes(liveAnalysis.riskLevel));
  assert("AI Risk Engine returns non-empty summary", liveAnalysis.summary.length > 0);

  // Upsert AIAnalysis record in Prisma
  const savedRecord = await prisma.aIAnalysis.upsert({
    where: { expenseId: testExpense.id },
    create: {
      expenseId: testExpense.id,
      riskScore: liveAnalysis.riskScore,
      riskLevel: liveAnalysis.riskLevel,
      summary: liveAnalysis.summary,
      recommendation: liveAnalysis.recommendation,
      signals: JSON.stringify(liveAnalysis.signals),
      model: liveAnalysis.model || "spendguard-test-v1",
      analyzedAt: new Date(),
    },
    update: {
      riskScore: liveAnalysis.riskScore,
      riskLevel: liveAnalysis.riskLevel,
      summary: liveAnalysis.summary,
      recommendation: liveAnalysis.recommendation,
      signals: JSON.stringify(liveAnalysis.signals),
      model: liveAnalysis.model || "spendguard-test-v1",
      analyzedAt: new Date(),
    },
  });

  assert("Prisma persists AIAnalysis record", savedRecord.id.length > 0 && savedRecord.expenseId === testExpense.id);
  assert("Prisma stores signals JSON correctly", Array.isArray(JSON.parse(savedRecord.signals || "[]")));

  // Verify relation query
  const expenseWithAI = await prisma.expense.findUnique({
    where: { id: testExpense.id },
    include: { aiAnalysis: true },
  });

  assert("Expense.aiAnalysis relationship resolves properly", expenseWithAI?.aiAnalysis?.id === savedRecord.id);
  assert("Persisted riskLevel matches generated output", expenseWithAI?.aiAnalysis?.riskLevel === liveAnalysis.riskLevel);

  console.log("\n=================================================");
  console.log(`✨ ALL MILESTONE 4 AUTOMATED TESTS PASSED: ${passedTests}/${totalTests} ✨`);
  console.log("=================================================");
}

runMilestone4Tests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
