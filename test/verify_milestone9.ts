import crypto from "crypto";
import prisma from "../lib/prisma";
import { evaluateSpendingPolicyFromDB } from "../lib/policy-engine";
import { analyzeTransactionRisk } from "../lib/ai/risk-engine";
import { runExpenseVerification } from "../lib/verification/expense-verification";
import { createPendingApproval, processApprovalDecision } from "../lib/approval/approval-service";
import { createPaymentOrder } from "../lib/razorpay/payment-service";
import { handleRazorpayWebhook, verifyWebhookSignature } from "../lib/razorpay/webhook-handler";
import { getFinanceAnalytics } from "../lib/finance/analytics";
import { getWebhookSecret } from "../lib/razorpay/client";

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

async function runMilestone9Tests() {
  console.log("=================================================");
  console.log("🛡️  SPENDGUARD AI — MILESTONE 9 E2E HARDENING SUITE");
  console.log("    Full Life-Cycle, Security, & Invariant Tests");
  console.log("=================================================\n");

  const timestamp = Date.now();

  // ==========================================
  // SETUP TEST DATA: ACME CORP & BETA CORP
  // ==========================================
  console.log("--- Setup: Creating Multi-Tenant Test Isolation Fixtures ---");
  const companyA = await prisma.company.create({
    data: {
      name: `Acme M9 Corp ${timestamp}`,
      currency: "INR",
      monthlyBudget: 1000000.0,
    },
  });

  const companyB = await prisma.company.create({
    data: {
      name: `Beta M9 Corp ${timestamp}`,
      currency: "INR",
      monthlyBudget: 500000.0,
    },
  });

  const adminA = await prisma.user.create({
    data: {
      email: `admin.m9.${timestamp}@acme.test`,
      name: "Acme Admin",
      role: "FINANCE_ADMIN",
      companyId: companyA.id,
    },
  });

  const managerA = await prisma.user.create({
    data: {
      email: `manager.m9.${timestamp}@acme.test`,
      name: "Acme Engineering Manager",
      role: "MANAGER",
      companyId: companyA.id,
    },
  });

  const employeeA = await prisma.user.create({
    data: {
      email: `employee.m9.${timestamp}@acme.test`,
      name: "Rahul Verma",
      role: "EMPLOYEE",
      companyId: companyA.id,
    },
  });

  const managerB = await prisma.user.create({
    data: {
      email: `manager.m9.${timestamp}@beta.test`,
      name: "Beta Manager",
      role: "MANAGER",
      companyId: companyB.id,
    },
  });

  const deptEngA = await prisma.department.create({
    data: {
      name: "Engineering",
      code: `ENG_${timestamp}`,
      monthlyBudget: 500000.0,
      companyId: companyA.id,
      managerId: managerA.id,
    },
  });

  const profileEmpA = await prisma.employeeProfile.create({
    data: {
      userId: employeeA.id,
      companyId: companyA.id,
      departmentId: deptEngA.id,
      monthlyBudget: 50000.0,
      jobTitle: "Senior Software Engineer",
    },
  });

  const profileMgrA = await prisma.employeeProfile.create({
    data: {
      userId: managerA.id,
      companyId: companyA.id,
      departmentId: deptEngA.id,
      monthlyBudget: 200000.0,
      jobTitle: "VP of Engineering",
    },
  });

  const vendorAWS = await prisma.vendor.create({
    data: {
      name: `Amazon Web Services ${timestamp}`,
      category: "Software",
      isApproved: true,
      companyId: companyA.id,
    },
  });

  // Policy 1: Software expenses over ₹10k require approval
  const policyApproval = await prisma.policy.create({
    data: {
      name: "Software Approval Threshold",
      approvalThreshold: 10000.0,
      maxTransactionAmount: 50000.0,
      allowedCategories: JSON.stringify(["Software"]),
      companyId: companyA.id,
      description: "Software expenses > ₹10,000 require manager review",
    },
  });

  // Policy 2: Gambling & Casino transactions are hard blocked
  const policyBlock = await prisma.policy.create({
    data: {
      name: "Prohibited Gambling Category",
      blockedCategories: JSON.stringify(["Gambling"]),
      companyId: companyA.id,
      description: "Gambling, betting, and casinos are strictly prohibited",
    },
  });

  // ==========================================
  // 1. HAPPY PATH: FULL E2E LIFECYCLE
  // ==========================================
  console.log("\n--- 1. Full E2E Life-Cycle: Submission -> AI Risk -> OCR Match -> Manager Approval -> Razorpay -> Webhook -> PAID ---");

  // Step 1: Employee creates expense
  const expNumber = `EXP-M9-${Math.floor(1000 + Math.random() * 9000)}`;
  const expense1 = await prisma.expense.create({
    data: {
      expenseNumber: expNumber,
      amount: 18500.0,
      currency: "INR",
      merchantName: "Amazon Web Services",
      category: "Software",
      purpose: "Monthly production cloud database and compute infrastructure",
      status: "DRAFT",
      paymentStatus: "UNPAID",
      companyId: companyA.id,
      employeeProfileId: profileEmpA.id,
      departmentId: deptEngA.id,
    },
  });
  assert("Step 1: Expense created in DRAFT status", expense1.status === "DRAFT");

  // Step 2: Deterministic Policy Evaluation
  const policyResult = await evaluateSpendingPolicyFromDB({
    amount: expense1.amount,
    category: expense1.category,
    merchantName: expense1.merchantName,
    companyId: companyA.id,
    departmentId: deptEngA.id,
    employeeProfileId: profileEmpA.id,
  });
  assert("Step 2: Deterministic Policy correctly triggers APPROVAL_REQUIRED", policyResult.decision === "APPROVAL_REQUIRED");

  // Step 3: AI Risk Analysis
  const aiRisk = await analyzeTransactionRisk({
    employee: {
      name: employeeA.name,
      role: employeeA.role,
      department: deptEngA.name,
    },
    transaction: {
      merchant: expense1.merchantName,
      amount: expense1.amount,
      category: expense1.category,
      purpose: expense1.purpose,
    },
    budget: {
      monthlyLimit: profileEmpA.monthlyBudget,
      spent: 0,
      remaining: profileEmpA.monthlyBudget,
    },
    history: {
      recentTransactions: [],
      averageTransaction: 15000,
      transactionCount: 5,
    },
    policy: {
      decision: policyResult.decision,
      reasons: policyResult.reasons,
    },
  });
  assert("Step 3: AI Risk Engine evaluates score & level", typeof aiRisk.riskScore === "number" && (aiRisk.riskLevel === "LOW" || aiRisk.riskLevel === "MEDIUM"));

  // Step 4: AI Receipt Verification
  const receiptDoc = await prisma.expenseReceipt.create({
    data: {
      expenseId: expense1.id,
      companyId: companyA.id,
      fileName: "aws_invoice_inv_9982.pdf",
      fileType: "application/pdf",
      fileSize: 104200,
      storageKey: "receipts/aws_invoice_inv_9982.pdf",
      status: "PROCESSED",
    },
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const receiptAnalysis = await prisma.receiptAnalysis.create({
    data: {
      companyId: companyA.id,
      receiptId: receiptDoc.id,
      merchantName: "Amazon Web Services",
      totalAmount: 18500.0,
      currency: "INR",
      transactionDate: todayStr,
      category: "Software",
      invoiceNumber: "INV-AWS-9982",
      confidence: 0.98,
      rawStructuredData: "Amazon Web Services India Invoice Total INR 18,500.00",
    },
  });

  const verif = await runExpenseVerification({
    expense: {
      id: expense1.id,
      amount: expense1.amount,
      merchantName: expense1.merchantName,
      category: expense1.category,
      currency: expense1.currency,
      expenseDate: new Date(),
      companyId: companyA.id,
    },
    receiptAnalysis: {
      id: receiptAnalysis.id,
      receiptId: receiptDoc.id,
      totalAmount: receiptAnalysis.totalAmount,
      merchantName: receiptAnalysis.merchantName,
      currency: receiptAnalysis.currency,
      category: receiptAnalysis.category,
      transactionDate: receiptAnalysis.transactionDate,
      invoiceNumber: receiptAnalysis.invoiceNumber,
    },
  });
  assert("Step 4: AI Receipt Verification matches 100% and recommends PROCEED", verif.result.status === "VERIFIED" && verif.result.overallScore === 100);

  // Update expense to PENDING_APPROVAL
  await prisma.expense.update({
    where: { id: expense1.id },
    data: {
      status: "PENDING_APPROVAL",
      policyDecision: policyResult.decision,
    },
  });

  // Step 5: Pending Approval Workflow Creation
  const pendingApproval = await createPendingApproval(expense1.id, companyA.id);
  assert("Step 5: Pending approval created for Engineering Manager", pendingApproval !== null && pendingApproval.approverId === managerA.id);

  // Step 6: Manager Approval -> READY_FOR_PAYMENT
  const approvedResult = await processApprovalDecision({
    approvalId: pendingApproval!.id,
    approverUser: {
      id: managerA.id,
      name: managerA.name,
      email: managerA.email,
      role: managerA.role,
      companyId: companyA.id,
    },
    decision: "APPROVED",
    comment: "Verified monthly AWS bill. Authorized for payment.",
  });
  assert("Step 6: Manager approval transitions status to READY_FOR_PAYMENT", approvedResult.expense.status === "READY_FOR_PAYMENT");
  assert("Step 6: Approval record marked APPROVED", approvedResult.approval.status === "APPROVED");

  // Step 7: Razorpay Order Creation
  const orderRes = await createPaymentOrder({
    expenseId: expense1.id,
    expenseNumber: expense1.expenseNumber,
    amount: expense1.amount,
    currency: "INR",
    companyId: companyA.id,
  });
  assert("Step 7: Razorpay order generated with exact paise amount", orderRes.amount === 1850000 && orderRes.amountRupees === 18500);

  // Record PaymentTransaction
  const paymentTx = await prisma.paymentTransaction.create({
    data: {
      companyId: companyA.id,
      expenseId: expense1.id,
      amount: expense1.amount,
      currency: "INR",
      paymentMethod: "RAZORPAY_DEMO",
      status: "PENDING",
      razorpayOrderId: orderRes.orderId,
    },
  });
  assert("Step 7: PaymentTransaction recorded in PENDING state", paymentTx.status === "PENDING");

  // Step 8: Razorpay Webhook Simulation with HMAC-SHA256 Signature
  const webhookSecret = getWebhookSecret();
  const mockWebhookPayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_m9_${timestamp}`,
          order_id: orderRes.orderId,
          amount: 1850000,
          currency: "INR",
          status: "captured",
          notes: {
            expenseId: expense1.id,
            companyId: companyA.id,
          },
        },
      },
    },
  });

  const validHmacSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(mockWebhookPayload)
    .digest("hex");

  assert("Step 8: Cryptographic signature verification passes", verifyWebhookSignature(mockWebhookPayload, validHmacSignature, webhookSecret) === true);

  const webhookResult = await handleRazorpayWebhook(mockWebhookPayload, validHmacSignature);
  assert("Step 8: Webhook processed successfully", webhookResult.success === true);

  // Verify final Expense state & PaymentTransaction state
  const finalizedExpense = await prisma.expense.findUnique({
    where: { id: expense1.id },
  });
  const finalizedTx = await prisma.paymentTransaction.findUnique({
    where: { id: paymentTx.id },
  });

  assert("Step 8: Expense status updated to PAID", finalizedExpense?.status === "PAID" && finalizedExpense?.paymentStatus === "PAID");
  assert("Step 8: PaymentTransaction updated to SUCCESS", finalizedTx?.status === "SUCCESS" && finalizedTx?.razorpayPaymentId === `pay_m9_${timestamp}`);

  // Step 9: Verify Realized Analytics
  const analytics = await getFinanceAnalytics({ companyId: companyA.id, period: "last_30_days" });
  assert("Step 9: Realized spend aggregates the ₹18,500 settled payment", analytics.metrics.totalSpend === 18500.0);
  assert("Step 9: Budget remaining correctly deducted", analytics.metrics.remainingBudget === 1000000.0 - 18500.0);

  // ==========================================
  // 2. NEGATIVE & HARD POLICY BLOCK PROTECTION
  // ==========================================
  console.log("\n--- 2. Negative & Hard Policy Block Enforcement ---");

  // Create Gambling expense that triggers policy block
  const expenseBlocked = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M9-BLK-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: 60000.0,
      currency: "INR",
      merchantName: "Royal Casino Goa",
      category: "Gambling",
      purpose: "Team retreat recreational chips",
      status: "BLOCKED",
      policyDecision: "BLOCKED",
      companyId: companyA.id,
      employeeProfileId: profileEmpA.id,
      departmentId: deptEngA.id,
    },
  });

  // Attempting to create pending approval for a blocked expense returns null
  const blockedApproval = await createPendingApproval(expenseBlocked.id, companyA.id);
  assert("Hard Block: No active approval workflow can be created for BLOCKED expense", blockedApproval === null);

  // Attempting to force-approve blocked expense fails
  let blockedApprovalError: string | null = null;
  try {
    // Fabricate an approval record to test service resistance
    const dummyApproval = await prisma.approval.create({
      data: {
        companyId: companyA.id,
        expenseId: expenseBlocked.id,
        approverId: managerA.id,
        status: "PENDING",
      },
    });

    await processApprovalDecision({
      approvalId: dummyApproval.id,
      approverUser: {
        id: managerA.id,
        name: managerA.name,
        email: managerA.email,
        role: managerA.role,
        companyId: companyA.id,
      },
      decision: "APPROVED",
      comment: "Trying to bypass policy block",
    });
  } catch (err: any) {
    blockedApprovalError = err.message;
  }
  assert("Hard Block: processApprovalDecision rejects approving BLOCKED expense", blockedApprovalError !== null && blockedApprovalError.includes("violates hard corporate rules"));

  // ==========================================
  // 3. ANTI-SELF-APPROVAL & ROLE GUARDS
  // ==========================================
  console.log("\n--- 3. Anti-Self-Approval & Authorization Invariants ---");

  // Manager creates their own expense
  const managerExpense = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M9-MGR-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: 25000.0,
      currency: "INR",
      merchantName: "Dell Technologies",
      category: "Hardware",
      purpose: "Manager test laptop equipment",
      status: "PENDING_APPROVAL",
      companyId: companyA.id,
      employeeProfileId: profileMgrA.id,
      departmentId: deptEngA.id,
    },
  });

  const mgrPendingApproval = await prisma.approval.create({
    data: {
      companyId: companyA.id,
      expenseId: managerExpense.id,
      approverId: adminA.id, // Admin should be designated approver
      status: "PENDING",
    },
  });

  // Manager tries to approve their own expense
  let selfApprovalError: string | null = null;
  try {
    await processApprovalDecision({
      approvalId: mgrPendingApproval.id,
      approverUser: {
        id: managerA.id,
        name: managerA.name,
        email: managerA.email,
        role: managerA.role,
        companyId: companyA.id,
      },
      decision: "APPROVED",
      comment: "Self approval attempt",
    });
  } catch (err: any) {
    selfApprovalError = err.message;
  }
  assert("Anti-Self-Approval: Manager cannot approve their own expense", selfApprovalError !== null && (selfApprovalError.includes("Self-approval is prohibited") || selfApprovalError.includes("cannot approve your own expense")));

  // Short rejection comment validation
  let shortCommentError: string | null = null;
  try {
    await processApprovalDecision({
      approvalId: mgrPendingApproval.id,
      approverUser: {
        id: adminA.id,
        name: adminA.name,
        email: adminA.email,
        role: adminA.role,
        companyId: companyA.id,
      },
      decision: "REJECTED",
      comment: "No", // < 5 chars
    });
  } catch (err: any) {
    shortCommentError = err.message;
  }
  assert("Rejection Validation: Rejection reason < 5 chars is rejected", shortCommentError !== null && shortCommentError.includes("at least 5 characters"));

  // ==========================================
  // 4. MULTI-TENANT CROSS-COMPANY ISOLATION
  // ==========================================
  console.log("\n--- 4. Multi-Tenant Cross-Company Isolation (IDOR Defense) ---");

  let crossTenantApprovalError: string | null = null;
  try {
    await processApprovalDecision({
      approvalId: mgrPendingApproval.id,
      approverUser: {
        id: managerB.id,
        name: managerB.name,
        email: managerB.email,
        role: managerB.role,
        companyId: companyB.id, // Company B manager trying to approve Company A expense
      },
      decision: "APPROVED",
      comment: "Cross-tenant intrusion attempt",
    });
  } catch (err: any) {
    crossTenantApprovalError = err.message;
  }
  assert("Multi-Tenant Isolation: Cross-tenant approval attempt is blocked", crossTenantApprovalError !== null && crossTenantApprovalError.includes("Cross-tenant authorization error"));

  // Analytics isolation test
  const companyBAnalytics = await getFinanceAnalytics({ companyId: companyB.id, period: "last_30_days" });
  assert("Multi-Tenant Analytics: Company B spend is strictly ₹0 (isolated from Company A)", companyBAnalytics.metrics.totalSpend === 0);

  // ==========================================
  // 5. CONCURRENCY & IDEMPOTENCY DEFENSES
  // ==========================================
  console.log("\n--- 5. Concurrency, Replay & Idempotency Defenses ---");

  // Re-approving already decided approval
  let doubleDecisionError: string | null = null;
  try {
    await processApprovalDecision({
      approvalId: approvedResult.approval.id, // Already APPROVED in step 1
      approverUser: {
        id: managerA.id,
        name: managerA.name,
        email: managerA.email,
        role: managerA.role,
        companyId: companyA.id,
      },
      decision: "APPROVED",
      comment: "Duplicate approval attempt",
    });
  } catch (err: any) {
    doubleDecisionError = err.message;
  }
  assert("Idempotency: Re-approving an already decided approval is rejected", doubleDecisionError !== null && doubleDecisionError.includes("already been approved"));

  // Replay Razorpay Webhook Event
  const replayWebhookResult = await handleRazorpayWebhook(mockWebhookPayload, validHmacSignature);
  assert("Idempotency: Duplicate webhook payload returns alreadyProcessed=true without state corruption", replayWebhookResult.success === true && replayWebhookResult.alreadyProcessed === true);

  // Invalid HMAC signature rejection
  let invalidSignatureError: string | null = null;
  try {
    await handleRazorpayWebhook(mockWebhookPayload, "invalid_corrupt_signature_hex");
  } catch (err: any) {
    invalidSignatureError = err.message;
  }
  assert("Security: Forged/Invalid webhook signature is rejected with error", invalidSignatureError !== null && invalidSignatureError.includes("Invalid Razorpay webhook"));

  // ==========================================
  // 6. RECEIPT MISMATCH DETECTION
  // ==========================================
  console.log("\n--- 6. Receipt Mismatch Intelligence & Detection ---");

  const mismatchExp = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M9-MIS-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: 18500.0,
      currency: "INR",
      merchantName: "Zoom Video",
      category: "Software",
      purpose: "Annual team video conference subscription",
      status: "DRAFT",
      companyId: companyA.id,
      employeeProfileId: profileEmpA.id,
      departmentId: deptEngA.id,
    },
  });

  const mismatchReceiptDoc = await prisma.expenseReceipt.create({
    data: {
      expenseId: mismatchExp.id,
      companyId: companyA.id,
      fileName: "zoom_mismatch.png",
      fileType: "image/png",
      fileSize: 45000,
      storageKey: "receipts/zoom_mismatch.png",
      status: "PROCESSED",
    },
  });

  const mismatchReceiptAnalysis = await prisma.receiptAnalysis.create({
    data: {
      companyId: companyA.id,
      receiptId: mismatchReceiptDoc.id,
      merchantName: "Zoom Video Communications",
      totalAmount: 8500.0, // Claim is 18,500 vs Receipt is 8,500!
      currency: "INR",
      transactionDate: "2026-08-15",
      category: "Software",
    },
  });

  const mismatchVerif = await runExpenseVerification({
    expense: {
      id: mismatchExp.id,
      amount: mismatchExp.amount,
      merchantName: mismatchExp.merchantName,
      category: mismatchExp.category,
      companyId: companyA.id,
    },
    receiptAnalysis: {
      id: mismatchReceiptAnalysis.id,
      receiptId: mismatchReceiptDoc.id,
      totalAmount: mismatchReceiptAnalysis.totalAmount,
      merchantName: mismatchReceiptAnalysis.merchantName,
      currency: mismatchReceiptAnalysis.currency,
      category: mismatchReceiptAnalysis.category,
      transactionDate: mismatchReceiptAnalysis.transactionDate,
      invoiceNumber: mismatchReceiptAnalysis.invoiceNumber,
    },
  });

  assert("Receipt Intelligence: Detects severe amount discrepancy (Claim ₹18.5k vs Receipt ₹8.5k)", mismatchVerif.result.status === "MISMATCH");
  assert("Receipt Intelligence: Status is MISMATCH or REVIEW_REQUIRED", mismatchVerif.result.recommendation === "REVIEW" || mismatchVerif.result.status === "MISMATCH");
  assert("Receipt Intelligence: Overall score drops significantly on mismatch", mismatchVerif.result.overallScore < 70);

  // ==========================================
  // 7. GATEWAY PAYMENT FAILURE FLOW
  // ==========================================
  console.log("\n--- 7. Payment Gateway Failure State Lifecycle ---");

  const failExpense = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-M9-FAIL-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: 15000.0,
      currency: "INR",
      merchantName: "Slack Technologies",
      category: "Software",
      purpose: "Slack Enterprise monthly workspace subscription",
      status: "READY_FOR_PAYMENT",
      companyId: companyA.id,
      employeeProfileId: profileEmpA.id,
      departmentId: deptEngA.id,
    },
  });

  const failOrder = await createPaymentOrder({
    expenseId: failExpense.id,
    expenseNumber: failExpense.expenseNumber,
    amount: failExpense.amount,
    currency: "INR",
    companyId: companyA.id,
  });

  const failTx = await prisma.paymentTransaction.create({
    data: {
      companyId: companyA.id,
      expenseId: failExpense.id,
      amount: failExpense.amount,
      currency: "INR",
      paymentMethod: "RAZORPAY_DEMO",
      status: "PENDING",
      razorpayOrderId: failOrder.orderId,
    },
  });

  const failWebhookPayload = JSON.stringify({
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: `pay_fail_${timestamp}`,
          order_id: failOrder.orderId,
          amount: 1500000,
          currency: "INR",
          status: "failed",
          error_code: "BAD_REQUEST_ERROR",
          error_description: "Card declined by issuing bank (insufficient corporate limit)",
        },
      },
    },
  });

  const failHmacSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(failWebhookPayload)
    .digest("hex");

  await handleRazorpayWebhook(failWebhookPayload, failHmacSignature);

  const updatedFailExpense = await prisma.expense.findUnique({ where: { id: failExpense.id } });
  const updatedFailTx = await prisma.paymentTransaction.findUnique({ where: { id: failTx.id } });

  assert("Payment Failure: Expense transitions to PAYMENT_FAILED (distinct from REJECTED)", updatedFailExpense?.status === "PAYMENT_FAILED");
  assert("Payment Failure: PaymentTransaction marked FAILED with gateway error reason", updatedFailTx?.status === "FAILED" && Boolean(updatedFailTx?.failureReason?.includes("Card declined")));

  // ==========================================
  // FINAL SUMMARY
  // ==========================================
  console.log("\n=================================================");
  console.log(`MILESTONE 9 TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log("🎉 ALL MILESTONE 9 TESTS PASSED SUCCESSFULLY!");
  } else {
    console.error(`⚠️ ${totalTests - passedTests} TESTS FAILED!`);
    process.exit(1);
  }
  console.log("=================================================\n");
}

runMilestone9Tests()
  .catch((e) => {
    console.error("Test execution encountered an error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
