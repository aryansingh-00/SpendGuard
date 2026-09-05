import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { createPaymentOrder, verifyPaymentSignature } from "../lib/razorpay/payment-service";
import { verifyWebhookSignature, handleRazorpayWebhook } from "../lib/razorpay/webhook-handler";
import { createVendorPayout } from "../lib/razorpay/payout-service";

const prisma = new PrismaClient();

async function runMilestone6Tests() {
  console.log("=================================================");
  console.log("💳  SPENDGUARD AI — MILESTONE 6 AUTOMATED TESTS");
  console.log("    Razorpay Payments, Payouts & Webhooks");
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

  // Load Seeded Acme Company & Users
  const company = await prisma.company.findFirst({
    where: { name: "Acme Technologies" },
    include: {
      users: true,
      departments: { include: { manager: true } },
      employeeProfiles: { include: { user: true } },
    },
  });

  if (!company) throw new Error("Acme Technologies missing from DB");

  const adminUser = company.users.find((u) => u.role === "FINANCE_ADMIN")!;
  const managerUser = company.users.find((u) => u.role === "MANAGER")!;
  const rahulUser = company.users.find((u) => u.name === "Rahul Sharma")!;
  const priyaUser = company.users.find((u) => u.name === "Priya Nair")!;
  const engineeringDept = company.departments.find((d) => d.name === "Engineering")!;
  const rahulProfile = company.employeeProfiles.find((e) => e.userId === rahulUser.id)!;

  // Setup test webhook secret for testing
  const testWebhookSecret = "test_webhook_secret_key_123456";

  // ==========================================
  // 1. PAYMENT ORDER CREATION & AMOUNT INTEGRITY
  // ==========================================
  console.log("--- 1. Razorpay Payment Order Creation & Amount Invariants ---");

  // Test 1: Amount conversion to paise (₹18,500 -> 1850000 paise)
  const order1 = await createPaymentOrder({
    expenseId: "exp_test_m6_1",
    expenseNumber: "EXP-2026-M6-001",
    amount: 18500.5,
    currency: "INR",
    companyId: company.id,
    notes: { category: "Cloud Infrastructure" },
  });

  assert("Order created with deterministic ID format", order1.orderId.length > 5);
  assert("Amount in paise is mathematically exact", order1.amount === 1850050);
  assert("Amount in rupees preserved", order1.amountRupees === 18500.5);
  assert("Currency defaults to INR", order1.currency === "INR");
  assert("Receipt maps to expenseNumber", order1.receipt === "EXP-2026-M6-001");

  // Test 2: Payout adapter creates valid payout response
  const payout1 = await createVendorPayout({
    expenseId: "exp_test_m6_pout",
    expenseNumber: "EXP-2026-M6-POUT",
    amount: 45000,
    vendorName: "AWS Cloud Services",
    idempotencyKey: "pout_idemp_001",
  });
  assert("Vendor payout adapter generates valid payout reference", payout1.payoutId.startsWith("pout_SG_"));
  assert("Vendor payout adapter status is PROCESSING", payout1.status === "PROCESSING");

  // ==========================================
  // 2. CRYPTOGRAPHIC HMAC-SHA256 SIGNATURE VERIFICATION
  // ==========================================
  console.log("\n--- 2. Cryptographic HMAC-SHA256 Signature Verification ---");

  const samplePayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test_123456",
          amount: 1850050,
          currency: "INR",
          status: "captured",
          order_id: order1.orderId,
        },
      },
    },
  });

  const validHmac = crypto
    .createHmac("sha256", testWebhookSecret)
    .update(samplePayload)
    .digest("hex");

  // Test 3: Valid HMAC signature verification passes
  const isValidSignature = verifyWebhookSignature(samplePayload, validHmac, testWebhookSecret);
  assert("Valid HMAC-SHA256 signature returns true", isValidSignature === true);

  // Test 4: Invalid / tampered signature fails
  const isTamperedSignature = verifyWebhookSignature(samplePayload, "tampered_fake_signature_abc", testWebhookSecret);
  assert("Tampered signature returns false", isTamperedSignature === false);

  // Test 5: Tampered payload body fails with original signature
  const tamperedPayload = samplePayload.replace("1850050", "9999999");
  const isTamperedBody = verifyWebhookSignature(tamperedPayload, validHmac, testWebhookSecret);
  assert("Tampered payload body returns false against original signature", isTamperedBody === false);

  // Test 6: Client Checkout Signature Verification (orderId|paymentId)
  process.env.RAZORPAY_KEY_SECRET = "spendguard_test_secret_789";
  const validClientSig = crypto
    .createHmac("sha256", "spendguard_test_secret_789")
    .update(`order_123|pay_456`)
    .digest("hex");
  const isClientValid = verifyPaymentSignature("order_123", "pay_456", validClientSig);
  assert("Client payment signature (orderId|paymentId) verifies correctly", isClientValid === true);

  const isClientInvalid = verifyPaymentSignature("order_123", "pay_456", "invalid_sig_xyz");
  assert("Invalid client payment signature returns false", isClientInvalid === false);

  // ==========================================
  // 3. EXPENSE PAYMENT LIFECYCLE & WEBHOOK PROCESSING
  // ==========================================
  console.log("\n--- 3. Expense Payment Lifecycle & Webhook Processing ---");

  // Create an expense ready for payment
  const eligibleExpense = await prisma.expense.create({
    data: {
      companyId: company.id,
      employeeProfileId: rahulProfile.id,
      departmentId: engineeringDept.id,
      expenseNumber: `EXP-M6-${Date.now()}-1`,
      merchantName: "Datadog Observability",
      amount: 28000,
      currency: "INR",
      category: "Software",
      purpose: "Production APM Monitoring",
      status: "READY_FOR_PAYMENT",
      paymentStatus: "UNPAID",
      policyDecision: "APPROVED",
    },
  });

  // Create PaymentTransaction in PROCESSING
  const idempotencyKey1 = `idemp_test_${eligibleExpense.id}_1`;
  const paymentTx1 = await prisma.paymentTransaction.create({
    data: {
      companyId: company.id,
      expenseId: eligibleExpense.id,
      razorpayOrderId: `order_m6_${Date.now()}`,
      type: "PAYMENT",
      status: "PROCESSING",
      amount: eligibleExpense.amount,
      currency: "INR",
      idempotencyKey: idempotencyKey1,
    },
  });

  assert("PaymentTransaction created with status PROCESSING", paymentTx1.status === "PROCESSING");
  assert("PaymentTransaction amount matches expense amount", paymentTx1.amount === 28000);

  // Trigger Webhook Event: payment.captured
  const webhookBody1 = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_captured_${Date.now()}`,
          order_id: paymentTx1.razorpayOrderId,
          amount: 2800000,
          currency: "INR",
          status: "captured",
          notes: {
            expenseId: eligibleExpense.id,
            companyId: company.id,
          },
        },
      },
    },
  });

  const webhookResult1 = await handleRazorpayWebhook(webhookBody1, "spendguard_test_signature", true);
  assert("Webhook processed payment.captured successfully", webhookResult1.success === true);
  assert("Webhook returned matching transactionId", webhookResult1.transactionId === paymentTx1.id);

  // Verify Expense & PaymentTransaction DB states
  const updatedExpense1 = await prisma.expense.findUnique({
    where: { id: eligibleExpense.id },
  });
  const updatedTx1 = await prisma.paymentTransaction.findUnique({
    where: { id: paymentTx1.id },
  });

  assert("Expense status transitioned to PAID", updatedExpense1?.status === "PAID");
  assert("Expense paymentStatus transitioned to PAID", updatedExpense1?.paymentStatus === "PAID");
  assert("PaymentTransaction status transitioned to SUCCESS", updatedTx1?.status === "SUCCESS");
  assert("PaymentTransaction completedAt is populated", updatedTx1?.completedAt !== null);
  assert("PaymentTransaction razorpayPaymentId is populated", Boolean(updatedTx1?.razorpayPaymentId));

  // ==========================================
  // 4. IDEMPOTENCY & REPLAY PROTECTION
  // ==========================================
  console.log("\n--- 4. Webhook Idempotency & Duplicate Replay Protection ---");

  // Re-send the exact same webhook event
  const replayResult = await handleRazorpayWebhook(webhookBody1, "spendguard_test_signature", true);
  assert("Replay webhook succeeds without error", replayResult.success === true);
  assert("Replay webhook detected as alreadyProcessed", replayResult.alreadyProcessed === true);

  // Verify DB state remains unchanged (not double-updated or corrupted)
  const afterReplayExpense = await prisma.expense.findUnique({
    where: { id: eligibleExpense.id },
  });
  assert("Expense status remains PAID after duplicate replay", afterReplayExpense?.status === "PAID");

  // ==========================================
  // 5. PAYMENT FAILURE HANDLING
  // ==========================================
  console.log("\n--- 5. Payment Failure Gateway Handling ---");

  // Create an expense for payment failure test
  const failingExpense = await prisma.expense.create({
    data: {
      companyId: company.id,
      employeeProfileId: rahulProfile.id,
      departmentId: engineeringDept.id,
      expenseNumber: `EXP-M6-${Date.now()}-FAIL`,
      merchantName: "International Server Hosting",
      amount: 65000,
      currency: "INR",
      category: "Infrastructure",
      purpose: "Offshore Backup Server",
      status: "READY_FOR_PAYMENT",
      paymentStatus: "UNPAID",
      policyDecision: "APPROVED",
    },
  });

  const failOrderId = `order_fail_${Date.now()}`;
  const failTx = await prisma.paymentTransaction.create({
    data: {
      companyId: company.id,
      expenseId: failingExpense.id,
      razorpayOrderId: failOrderId,
      type: "PAYMENT",
      status: "PROCESSING",
      amount: failingExpense.amount,
      currency: "INR",
      idempotencyKey: `idemp_fail_${failingExpense.id}`,
    },
  });

  // Trigger payment.failed webhook
  const failWebhookBody = JSON.stringify({
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: `pay_failed_${Date.now()}`,
          order_id: failOrderId,
          error_code: "BAD_REQUEST_ERROR",
          error_description: "Card declined by issuing bank (insufficient corporate limit)",
          notes: {
            expenseId: failingExpense.id,
          },
        },
      },
    },
  });

  const failResult = await handleRazorpayWebhook(failWebhookBody, "spendguard_test_signature", true);
  assert("Webhook processed payment.failed successfully", failResult.success === true);

  const updatedFailExpense = await prisma.expense.findUnique({
    where: { id: failingExpense.id },
  });
  const updatedFailTx = await prisma.paymentTransaction.findUnique({
    where: { id: failTx.id },
  });

  assert("Expense status is PAYMENT_FAILED (distinct from REJECTED)", updatedFailExpense?.status === "PAYMENT_FAILED");
  assert("Expense paymentStatus is FAILED", updatedFailExpense?.paymentStatus === "FAILED");
  assert("PaymentTransaction status is FAILED", updatedFailTx?.status === "FAILED");
  assert("PaymentTransaction failureReason captured error message", updatedFailTx?.failureReason?.includes("Card declined") === true);

  // Clean up test records
  await prisma.paymentTransaction.deleteMany({
    where: {
      expenseId: { in: [eligibleExpense.id, failingExpense.id] },
    },
  });
  await prisma.expense.deleteMany({
    where: {
      id: { in: [eligibleExpense.id, failingExpense.id] },
    },
  });

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log("\n=================================================");
  console.log(`MILESTONE 6 TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log("🎉 ALL MILESTONE 6 TESTS PASSED SUCCESSFULLY!");
  } else {
    console.error(`⚠️  ${totalTests - passedTests} TESTS FAILED.`);
  }
  console.log("=================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runMilestone6Tests()
  .catch((e) => {
    console.error("Test execution error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
