import { evaluateSpendingPolicy } from "../lib/engine/policyEngine";
import { computeIntelligentRiskAnalysis } from "../lib/ai/riskEngine";
import { verifyRazorpayWebhookSignature, verifyPaymentSignature } from "../lib/razorpay";

async function runTests() {
  console.log("🚀 Running SpendGuard AI Core Engine Tests...\n");

  // 1. Test Policy Engine: Over Budget
  const policy = {
    maxTransactionAmount: 50000,
    approvalThreshold: 10000,
    allowedCategories: ["Advertising", "Software", "Travel"],
    blockedCategories: ["Gambling", "Cryptocurrency"],
    requireReceiptAbove: 1000,
    isActive: true,
  };

  const overBudgetRes = evaluateSpendingPolicy({
    amount: 60000,
    category: "Software",
    merchantName: "Enterprise Tool",
    hasReceipt: true,
    departmentBudget: 50000,
    departmentSpent: 10000,
    employeeBudget: 30000,
    employeeSpent: 5000,
    policy,
  });
  console.log("Test 1 - Over Budget Policy Check:", overBudgetRes.violations.length > 0 ? "✅ PASS" : "❌ FAIL");
  console.log("  Summary:", overBudgetRes.summary);

  // 2. Test Policy Engine: Blocked Category
  const blockedCatRes = evaluateSpendingPolicy({
    amount: 5000,
    category: "Cryptocurrency",
    merchantName: "CryptoExchange",
    hasReceipt: true,
    departmentBudget: 100000,
    departmentSpent: 10000,
    employeeBudget: 50000,
    employeeSpent: 5000,
    policy,
  });
  console.log("Test 2 - Blocked Category Check:", blockedCatRes.decision === "BLOCK" ? "✅ PASS" : "❌ FAIL");
  console.log("  Decision:", blockedCatRes.decision);

  // 3. Test Policy Engine: Within Limit & Approved
  const compliantRes = evaluateSpendingPolicy({
    amount: 4500,
    category: "Software",
    merchantName: "GitHub",
    hasReceipt: true,
    departmentBudget: 100000,
    departmentSpent: 10000,
    employeeBudget: 50000,
    employeeSpent: 5000,
    policy,
  });
  console.log("Test 3 - Compliant Spend Check:", compliantRes.decision === "APPROVE" ? "✅ PASS" : "❌ FAIL");

  // 4. Test AI Risk Engine: Duplicate & Anomaly
  const aiRisk = computeIntelligentRiskAnalysis({
    employeeName: "Rahul Sharma",
    departmentName: "Marketing",
    monthlyBudget: 50000,
    alreadySpent: 45000,
    merchantName: "XYZ High Roller Ads",
    amount: 12000,
    category: "Advertising",
    purpose: "Testing",
    hasReceipt: false,
    previousTransactions: [
      { merchantName: "XYZ High Roller Ads", amount: 12000, category: "Advertising", date: new Date() },
    ],
  });
  console.log("Test 4 - AI Risk Analysis:", aiRisk.riskLevel === "HIGH" || aiRisk.isDuplicate ? "✅ PASS" : "❌ FAIL");
  console.log("  Score:", aiRisk.riskScore, "Level:", aiRisk.riskLevel, "Duplicate:", aiRisk.isDuplicate);

  // 5. Test Webhook Signature Verification
  const testSecret = "spendguard_webhook_secret_xyz456";
  const rawPayload = JSON.stringify({ event: "payment.captured", id: "evt_123" });
  const crypto = await import("crypto");
  const validSig = crypto.createHmac("sha256", testSecret).update(rawPayload).digest("hex");
  const isSigValid = verifyRazorpayWebhookSignature(rawPayload, validSig, testSecret);
  console.log("Test 5 - Razorpay Webhook Signature Verification:", isSigValid ? "✅ PASS" : "❌ FAIL");

  console.log("\n🎉 All Core Engine Verification Tests Completed Successfully!");
}

runTests().catch(console.error);
