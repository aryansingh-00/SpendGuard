import { PrismaClient } from "@prisma/client";
import { evaluateRulesDeterministically, evaluateSpendingPolicyFromDB } from "../lib/policy-engine";

const prisma = new PrismaClient();

async function runMilestone3Tests() {
  console.log("=================================================");
  console.log("🛡️  SPENDGUARD AI — MILESTONE 3 AUTOMATED TESTS");
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

  // Base test policy fixtures
  const defaultPolicy = {
    id: "pol_mkt_test",
    name: "Marketing Spending Policy",
    scopeType: "DEPARTMENT",
    maxTransactionAmount: 25000,
    approvalThreshold: 10000,
    allowedCategories: ["Advertising", "Software", "Subscriptions"],
    blockedCategories: ["Gambling", "Cryptocurrency", "Personal Expenses", "Gaming"],
    allowedMerchants: ["Google Ads", "Meta", "LinkedIn Ads"],
    blockedMerchants: ["Casino Royale", "Steam", "Bet365"],
    isActive: true,
  };

  console.log("--- 1. Deterministic Rule Unit Tests ---");

  // Test 1: Within budget, allowed category, allowed merchant, under threshold -> APPROVED
  const res1 = evaluateRulesDeterministically({
    amount: 5000,
    category: "Advertising",
    merchantName: "Google Ads",
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 50000,
    employeeSpent: 32000,
    policies: [defaultPolicy],
  });
  assert("Test 1 - Within budget & pre-approved: Decision = APPROVED", res1.decision === "APPROVED", `Got ${res1.decision}`);
  assert("Test 1 - Check flags all PASS", res1.checks.employeeBudget === "PASS" && res1.checks.category === "PASS");

  // Test 2: Employee Budget Exceeded -> BLOCKED
  const res2 = evaluateRulesDeterministically({
    amount: 25000, // available remaining: 50,000 - 32,000 = 18,000
    category: "Advertising",
    merchantName: "Google Ads",
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 50000,
    employeeSpent: 32000,
    policies: [defaultPolicy],
  });
  assert("Test 2 - Employee budget overrun: Decision = BLOCKED", res2.decision === "BLOCKED", `Got ${res2.decision}`);
  assert("Test 2 - Check flag: employeeBudget = BLOCKED", res2.checks.employeeBudget === "BLOCKED");

  // Test 3: Department Budget Exceeded -> BLOCKED
  const res3 = evaluateRulesDeterministically({
    amount: 190000, // department remaining: 500,000 - 320,000 = 180,000
    category: "Advertising",
    merchantName: "Google Ads",
    companyBudget: 10000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 250000,
    employeeSpent: 32000,
    policies: [{ ...defaultPolicy, maxTransactionAmount: 500000 }],
  });
  assert("Test 3 - Department budget overrun: Decision = BLOCKED", res3.decision === "BLOCKED", `Got ${res3.decision}`);
  assert("Test 3 - Check flag: departmentBudget = BLOCKED", res3.checks.departmentBudget === "BLOCKED");

  // Test 4: Company Budget Exceeded -> BLOCKED
  const res4 = evaluateRulesDeterministically({
    amount: 450000, // company remaining: 1,000,000 - 600,000 = 400,000
    category: "Advertising",
    merchantName: "Google Ads",
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 5000000,
    departmentSpent: 320000,
    employeeBudget: 1000000,
    employeeSpent: 32000,
    policies: [{ ...defaultPolicy, maxTransactionAmount: 500000 }],
  });
  assert("Test 4 - Company budget overrun: Decision = BLOCKED", res4.decision === "BLOCKED", `Got ${res4.decision}`);
  assert("Test 4 - Check flag: companyBudget = BLOCKED", res4.checks.companyBudget === "BLOCKED");

  // Test 5: Transaction Above Approval Threshold -> APPROVAL_REQUIRED
  const res5 = evaluateRulesDeterministically({
    amount: 14000, // threshold is 10,000, max is 25,000
    category: "Advertising",
    merchantName: "Google Ads",
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 50000,
    employeeSpent: 32000,
    policies: [defaultPolicy],
  });
  assert("Test 5 - Above approval threshold: Decision = APPROVAL_REQUIRED", res5.decision === "APPROVAL_REQUIRED", `Got ${res5.decision}`);
  assert("Test 5 - Check flag: approvalThreshold = TRIGGERED", res5.checks.approvalThreshold === "TRIGGERED");

  // Test 6: Transaction Above Maximum Single Transaction Limit -> APPROVAL_REQUIRED
  const res6 = evaluateRulesDeterministically({
    amount: 28000, // max is 25,000 (with ample employee budget)
    category: "Advertising",
    merchantName: "Google Ads",
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 100000,
    employeeSpent: 32000,
    policies: [defaultPolicy],
  });
  assert("Test 6 - Above max single transaction limit: Decision = APPROVAL_REQUIRED", res6.decision === "APPROVAL_REQUIRED", `Got ${res6.decision}`);
  assert("Test 6 - Check flag: transactionLimit = TRIGGERED", res6.checks.transactionLimit === "TRIGGERED");

  // Test 7: Blocked Category -> BLOCKED
  const res7 = evaluateRulesDeterministically({
    amount: 3000,
    category: "Gaming", // In blockedCategories list
    merchantName: "Google Ads",
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 50000,
    employeeSpent: 32000,
    policies: [defaultPolicy],
  });
  assert("Test 7 - Blocked category: Decision = BLOCKED", res7.decision === "BLOCKED", `Got ${res7.decision}`);
  assert("Test 7 - Check flag: category = BLOCKED", res7.checks.category === "BLOCKED");

  // Test 8: Unlisted Category with Allow-List -> APPROVAL_REQUIRED
  const res8 = evaluateRulesDeterministically({
    amount: 4000,
    category: "Office Decor", // Not blocked, but not in pre-approved allow-list
    merchantName: "Google Ads",
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 50000,
    employeeSpent: 32000,
    policies: [defaultPolicy],
  });
  assert("Test 8 - Unlisted category on allow-list: Decision = APPROVAL_REQUIRED", res8.decision === "APPROVAL_REQUIRED", `Got ${res8.decision}`);
  assert("Test 8 - Check flag: category = TRIGGERED", res8.checks.category === "TRIGGERED");

  // Test 9: Blocked Merchant -> BLOCKED
  const res9 = evaluateRulesDeterministically({
    amount: 2000,
    category: "Advertising",
    merchantName: "Casino Royale", // In blockedMerchants
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 50000,
    employeeSpent: 32000,
    policies: [defaultPolicy],
  });
  assert("Test 9 - Blocked merchant: Decision = BLOCKED", res9.decision === "BLOCKED", `Got ${res9.decision}`);
  assert("Test 9 - Check flag: merchant = BLOCKED", res9.checks.merchant === "BLOCKED");

  // Test 10: Unlisted Merchant with Allow-List -> APPROVAL_REQUIRED
  const res10 = evaluateRulesDeterministically({
    amount: 3000,
    category: "Advertising",
    merchantName: "NewAdPartnerX", // Not in allowedMerchants
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 50000,
    employeeSpent: 32000,
    policies: [defaultPolicy],
  });
  assert("Test 10 - Unlisted merchant with allow-list: Decision = APPROVAL_REQUIRED", res10.decision === "APPROVAL_REQUIRED", `Got ${res10.decision}`);
  assert("Test 10 - Check flag: merchant = TRIGGERED", res10.checks.merchant === "TRIGGERED");

  // Test 11: Disabled Policy Ignored
  const res11 = evaluateRulesDeterministically({
    amount: 50000,
    category: "Gaming", // would be blocked if policy active
    merchantName: "Steam",
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 100000,
    employeeSpent: 32000,
    policies: [{ ...defaultPolicy, isActive: false }],
  });
  assert("Test 11 - Disabled policy is bypassed: Decision = APPROVED", res11.decision === "APPROVED", `Got ${res11.decision}`);

  // Test 12: Decision Priority: Hard Block Overrides Approval Triggers
  const res12 = evaluateRulesDeterministically({
    amount: 30000, // Above max Tx AND above employee budget AND blocked category
    category: "Cryptocurrency",
    merchantName: "CryptoExchange",
    companyBudget: 1000000,
    companySpent: 600000,
    departmentBudget: 500000,
    departmentSpent: 320000,
    employeeBudget: 50000,
    employeeSpent: 32000,
    policies: [defaultPolicy],
  });
  assert("Test 12 - Decision priority (BLOCKED > APPROVAL): Decision = BLOCKED", res12.decision === "BLOCKED", `Got ${res12.decision}`);

  console.log("\n--- 2. Database Integration & Multi-Tenancy Tests ---");

  const testCompany = await prisma.company.create({
    data: {
      name: `M3 Test Acme ${Date.now()}`,
      currency: "INR",
      monthlyBudget: 500000,
    },
  });

  const testUser = await prisma.user.create({
    data: {
      email: `m3.rahul.${Date.now()}@acme.test`,
      name: "Rahul M3",
      role: "EMPLOYEE",
      companyId: testCompany.id,
    },
  });

  const testDept = await prisma.department.create({
    data: {
      name: "Marketing",
      monthlyBudget: 200000,
      companyId: testCompany.id,
    },
  });

  const testProfile = await prisma.employeeProfile.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      departmentId: testDept.id,
      monthlyBudget: 20000,
    },
  });

  // Create an already-spent expense of ₹2,000 for Rahul
  await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M3-SEED-${Date.now()}`,
      amount: 2000,
      currency: "INR",
      merchantName: "Google Ads",
      category: "Advertising",
      purpose: "Initial marketing campaign",
      status: "PAID",
      paymentStatus: "PAID",
      companyId: testCompany.id,
      departmentId: testDept.id,
      employeeProfileId: testProfile.id,
    },
  });

  const testPolicy = await prisma.policy.create({
    data: {
      name: "Marketing Standard Policy",
      companyId: testCompany.id,
      scopeType: "COMPANY",
      maxTransactionAmount: 25000,
      approvalThreshold: 10000,
      allowedCategories: JSON.stringify(["Advertising", "Software"]),
      allowedMerchants: JSON.stringify(["Google Ads", "Meta Ads"]),
      blockedCategories: JSON.stringify(["Gambling"]),
      isActive: true,
    },
  });

  // Test 13: DB Evaluation for Rahul (Normal within remaining budget ₹18,000)
  const dbEval1 = await evaluateSpendingPolicyFromDB({
    companyId: testCompany.id,
    employeeProfileId: testProfile.id,
    departmentId: testDept.id,
    merchantName: "Google Ads",
    amount: 5000,
    category: "Advertising",
    purpose: "Search Ads",
  });
  assert("Test 13 - DB Evaluation for Rahul (₹5,000): Decision = APPROVED", dbEval1.decision === "APPROVED", `Got ${dbEval1.decision}`);
  assert("Test 13 - Live Rahul remaining budget = ₹18,000", dbEval1.budgets.employee.remaining === 18000, `Got ${dbEval1.budgets.employee.remaining}`);
  assert("Test 13 - Live Marketing remaining budget = ₹1,98,000", dbEval1.budgets.department.remaining === 198000, `Got ${dbEval1.budgets.department.remaining}`);
  assert("Test 13 - Live Company remaining budget = ₹4,98,000", dbEval1.budgets.company.remaining === 498000, `Got ${dbEval1.budgets.company.remaining}`);

  // Test 14: DB Evaluation for Rahul (Over approval threshold of ₹10,000)
  const dbEval2 = await evaluateSpendingPolicyFromDB({
    companyId: testCompany.id,
    employeeProfileId: testProfile.id,
    departmentId: testDept.id,
    merchantName: "Google Ads",
    amount: 14000,
    category: "Advertising",
  });
  assert("Test 14 - DB Evaluation for Rahul (₹14,000): Decision = APPROVAL_REQUIRED", dbEval2.decision === "APPROVAL_REQUIRED", `Got ${dbEval2.decision}`);

  // Test 15: DB Evaluation for Rahul (Over remaining personal budget ₹18,000)
  const dbEval3 = await evaluateSpendingPolicyFromDB({
    companyId: testCompany.id,
    employeeProfileId: testProfile.id,
    departmentId: testDept.id,
    merchantName: "Google Ads",
    amount: 20000,
    category: "Advertising",
  });
  assert("Test 15 - DB Evaluation for Rahul (₹20,000 > ₹18,000): Decision = BLOCKED", dbEval3.decision === "BLOCKED", `Got ${dbEval3.decision}`);

  // Test 16: Multi-Tenant Policy Scoping Test
  const tenantB = await prisma.company.create({
    data: {
      name: "Tenant Beta Corp",
      industry: "Healthcare",
      size: "11-50",
      currency: "INR",
      monthlyBudget: 300000,
    },
  });

  const tenantBPolicy = await prisma.policy.create({
    data: {
      name: "Beta Healthcare Strict Policy",
      scopeType: "COMPANY",
      maxTransactionAmount: 5000,
      approvalThreshold: 2000,
      allowedCategories: JSON.stringify(["Medical Supplies", "Software"]),
      blockedCategories: JSON.stringify(["Advertising"]),
      companyId: tenantB.id,
      isActive: true,
    },
  });

  // Evaluate under Tenant B: Advertising should be BLOCKED
  const betaEval = await evaluateSpendingPolicyFromDB({
    companyId: tenantB.id,
    amount: 3000,
    category: "Advertising",
    merchantName: "Generic Merchant",
  });
  assert("Test 16 - Tenant B isolates policy rules: Advertising = BLOCKED", betaEval.decision === "BLOCKED");

  // Clean up
  await prisma.policy.deleteMany({ where: { companyId: { in: [testCompany.id, tenantB.id] } } });
  await prisma.expense.deleteMany({ where: { companyId: testCompany.id } });
  await prisma.employeeProfile.deleteMany({ where: { companyId: testCompany.id } });
  await prisma.department.deleteMany({ where: { companyId: testCompany.id } });
  await prisma.user.deleteMany({ where: { companyId: testCompany.id } });
  await prisma.company.deleteMany({ where: { id: { in: [testCompany.id, tenantB.id] } } });

  console.log("\n=================================================");
  console.log(`✨ ALL MILESTONE 3 AUTOMATED TESTS PASSED: ${passedTests}/${totalTests} ✨`);
  console.log("=================================================");
}

runMilestone3Tests()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
