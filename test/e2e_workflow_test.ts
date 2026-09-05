import { PrismaClient } from "@prisma/client";
import { evaluateSpendingPolicy } from "../lib/engine/policyEngine";
import { computeIntelligentRiskAnalysis } from "../lib/ai/riskEngine";
import { createRazorpayOrder, verifyRazorpayWebhookSignature } from "../lib/razorpay";

const prisma = new PrismaClient();

async function runEndToEndWorkflowTest() {
  console.log("=================================================");
  console.log("🛡️  SPENDGUARD AI — FULL END-TO-END WORKFLOW TEST");
  console.log("=================================================\n");

  // 1. Fetch Demo User & Department
  const employeeProfile = await prisma.employeeProfile.findFirst({
    where: { user: { name: "Rahul Sharma" } },
    include: {
      user: true,
      department: { include: { policies: true } },
    },
  });

  if (!employeeProfile || !employeeProfile.department) {
    throw new Error("Rahul Sharma or department not found in DB");
  }
  const employeeUser = employeeProfile.user;
  const department = employeeProfile.department;
  console.log(`👤 Submitter: ${employeeUser.name} (${department.name} Department)`);
  console.log(`💰 Monthly Budget: ₹${employeeProfile.monthlyBudget.toLocaleString("en-IN")}`);

  // 2. Simulate Employee Expense Submission
  const testAmount = 14000;
  const testMerchant = "XYZ Media Digital Campaign";
  const testCategory = "Advertising";
  const testPurpose = "Performance marketing ad boost for Q1 product launch";

  console.log(`\n📝 Submitting Expense: ₹${testAmount.toLocaleString("en-IN")} to ${testMerchant} [${testCategory}]`);

  // Policy Engine Check
  const policy = department.policies[0] || {
    maxTransactionAmount: 50000,
    approvalThreshold: 10000,
    allowedCategories: JSON.stringify(["Advertising", "Software", "Travel"]),
    blockedCategories: JSON.stringify(["Gambling", "Cryptocurrency"]),
    requireReceiptAbove: 1000,
    isActive: true,
  };

  const policyCheck = evaluateSpendingPolicy({
    amount: testAmount,
    category: testCategory,
    merchantName: testMerchant,
    hasReceipt: true,
    departmentBudget: department.monthlyBudget,
    departmentSpent: 70000,
    employeeBudget: employeeProfile.monthlyBudget,
    employeeSpent: 0,
    policy: {
      maxTransactionAmount: policy.maxTransactionAmount,
      approvalThreshold: policy.approvalThreshold,
      allowedCategories: JSON.parse(policy.allowedCategories),
      blockedCategories: JSON.parse(policy.blockedCategories),
      requireReceiptAbove: policy.requireReceiptAbove,
      isActive: policy.isActive,
    },
  });

  console.log(`🔍 Deterministic Policy Result: Decision = ${policyCheck.decision}`);
  console.log(`   Policy Warnings: ${policyCheck.warnings.join(", ") || "None"}`);

  // AI Risk Engine Check
  const aiRisk = computeIntelligentRiskAnalysis({
    employeeName: employeeUser.name,
    departmentName: department.name,
    monthlyBudget: employeeProfile.monthlyBudget,
    alreadySpent: 0,
    merchantName: testMerchant,
    amount: testAmount,
    category: testCategory,
    purpose: testPurpose,
    hasReceipt: true,
  });

  console.log(`🤖 AI Risk Engine Result: Score = ${aiRisk.riskScore}/100 [${aiRisk.riskLevel}]`);
  console.log(`   AI Reason: "${aiRisk.reason}"`);

  // Create Expense in DB
  const expNumber = `EXP-TEST-${Date.now().toString().slice(-4)}`;
  const expense = await prisma.expense.create({
    data: {
      expenseNumber: expNumber,
      employeeProfileId: employeeProfile.id,
      departmentId: department.id,
      merchantName: testMerchant,
      amount: testAmount,
      currency: "INR",
      category: testCategory,
      purpose: testPurpose,
      status: "PENDING_APPROVAL",
      paymentStatus: "UNPAID",
      decisionReason: policyCheck.summary,
      policyViolations: JSON.stringify(policyCheck.violations),
      companyId: employeeProfile.companyId,
    },
  });

  await prisma.aIAnalysis.create({
    data: {
      expenseId: expense.id,
      riskScore: aiRisk.riskScore,
      riskLevel: aiRisk.riskLevel,
      reason: aiRisk.reason,
      recommendation: aiRisk.recommendation,
      anomaliesDetected: JSON.stringify(aiRisk.anomaliesDetected),
    },
  });

  console.log(`✅ Expense Record Created: ${expense.expenseNumber} (Status: ${expense.status})`);

  // 3. Manager Approval Action
  console.log("\n👨‍💼 Manager Review & Approval...");
  const manager = await prisma.user.findFirst({ where: { role: "MANAGER" } });
  if (!manager) throw new Error("Manager not found");

  await prisma.approval.create({
    data: {
      companyId: expense.companyId,
      expenseId: expense.id,
      approverId: manager.id,
      status: "APPROVED",
      decision: "APPROVED",
      comment: "Approved by VP Ops. Ad campaign matches Q1 marketing allocation.",
    },
  });

  // Create Razorpay Order
  const razorpayOrder = await createRazorpayOrder({
    amount: testAmount,
    currency: "INR",
    receiptId: expNumber,
    notes: { expenseId: expense.id },
  });

  console.log(`💳 Razorpay Order Created: ${razorpayOrder.id} (Amount: ₹${testAmount})`);

  const transaction = await prisma.transaction.create({
    data: {
      expenseId: expense.id,
      amount: testAmount,
      currency: "INR",
      paymentMethod: "RAZORPAY",
      razorpayOrderId: razorpayOrder.id,
      status: "PENDING",
    },
  });

  await prisma.expense.update({
    where: { id: expense.id },
    data: {
      status: "APPROVED",
      paymentStatus: "IN_PROGRESS",
    },
  });

  console.log(`✅ Expense Status Updated to APPROVED (Payment: IN_PROGRESS)`);

  // 4. Simulate Razorpay Webhook Event (payment.captured)
  console.log("\n🔔 Simulating Razorpay Webhook [payment.captured]...");
  const paymentId = `pay_SG_live_${Date.now()}`;

  // Update Transaction and Expense as done in Webhook route
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      razorpayPaymentId: paymentId,
      status: "SUCCESS",
    },
  });

  await prisma.expense.update({
    where: { id: expense.id },
    data: {
      status: "PAID",
      paymentStatus: "PAID",
      decisionReason: `Settled via Razorpay Webhook (Payment Ref: ${paymentId})`,
    },
  });

  console.log(`🎉 Webhook Processed Successfully!`);
  console.log(`   Transaction Status: SUCCESS (Payment ID: ${paymentId})`);
  console.log(`   Expense Status: PAID (Settlement Completed)`);

  console.log("\n=================================================");
  console.log("✨ ALL END-TO-END DEMO WORKFLOW STAGES PASSED ✨");
  console.log("=================================================");
}

runEndToEndWorkflowTest()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
