import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding SpendGuard AI — Complete Enterprise Dataset...");

  // Clean existing records in correct foreign key order
  await prisma.aIInsight.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.expenseVerification.deleteMany();
  await prisma.receiptAnalysis.deleteMany();
  await prisma.expenseReceipt.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.aIAnalysis.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.employeeProfile.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // 1. Create Company with ₹10,00,000 monthly budget
  const company = await prisma.company.create({
    data: {
      name: "Acme Technologies",
      industry: "Enterprise Software & Cloud",
      size: "51-200",
      currency: "INR",
      monthlyBudget: 1000000.0,
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80",
    },
  });

  const defaultPasswordHash = await bcrypt.hash("Password@123", 10);

  // 2. Create Users
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@acme.com",
      name: "Siddharth Verma",
      role: "FINANCE_ADMIN",
      passwordHash: defaultPasswordHash,
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      companyId: company.id,
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      email: "manager@acme.com",
      name: "Ananya Iyer",
      role: "MANAGER",
      passwordHash: defaultPasswordHash,
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80",
      companyId: company.id,
    },
  });

  const rahulUser = await prisma.user.create({
    data: {
      email: "rahul@acme.com",
      name: "Rahul Sharma",
      role: "EMPLOYEE",
      passwordHash: defaultPasswordHash,
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      companyId: company.id,
    },
  });

  const priyaUser = await prisma.user.create({
    data: {
      email: "priya@acme.com",
      name: "Priya Nair",
      role: "EMPLOYEE",
      passwordHash: defaultPasswordHash,
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
      companyId: company.id,
    },
  });

  const amitUser = await prisma.user.create({
    data: {
      email: "amit@acme.com",
      name: "Amit Patel",
      role: "EMPLOYEE",
      passwordHash: defaultPasswordHash,
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      companyId: company.id,
    },
  });

  const nehaUser = await prisma.user.create({
    data: {
      email: "neha@acme.com",
      name: "Neha Gupta",
      role: "EMPLOYEE",
      passwordHash: defaultPasswordHash,
      avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
      companyId: company.id,
    },
  });

  // 3. Create Departments with Managers
  const engineeringDept = await prisma.department.create({
    data: {
      name: "Engineering",
      code: "ENG",
      description: "Product development, cloud infrastructure, and R&D",
      monthlyBudget: 500000.0,
      companyId: company.id,
      managerId: managerUser.id,
    },
  });

  const marketingDept = await prisma.department.create({
    data: {
      name: "Marketing",
      code: "MKT",
      description: "Brand growth, performance marketing, and corporate communications",
      monthlyBudget: 250000.0,
      companyId: company.id,
      managerId: managerUser.id,
    },
  });

  const salesDept = await prisma.department.create({
    data: {
      name: "Sales",
      code: "SLS",
      description: "Enterprise account expansion and client relations",
      monthlyBudget: 150000.0,
      companyId: company.id,
      managerId: managerUser.id,
    },
  });

  const operationsDept = await prisma.department.create({
    data: {
      name: "Operations",
      code: "OPS",
      description: "Workplace, IT enablement, and corporate facilities",
      monthlyBudget: 100000.0,
      companyId: company.id,
      managerId: managerUser.id,
    },
  });

  // 4. Create Employee Profiles
  const rahulProfile = await prisma.employeeProfile.create({
    data: {
      userId: rahulUser.id,
      companyId: company.id,
      departmentId: marketingDept.id,
      monthlyBudget: 50000.0,
      jobTitle: "Marketing Lead",
      status: "ACTIVE",
    },
  });

  const priyaProfile = await prisma.employeeProfile.create({
    data: {
      userId: priyaUser.id,
      companyId: company.id,
      departmentId: engineeringDept.id,
      monthlyBudget: 80000.0,
      jobTitle: "Senior Cloud Engineer",
      status: "ACTIVE",
    },
  });

  const amitProfile = await prisma.employeeProfile.create({
    data: {
      userId: amitUser.id,
      companyId: company.id,
      departmentId: salesDept.id,
      monthlyBudget: 40000.0,
      jobTitle: "Account Executive",
      status: "ACTIVE",
    },
  });

  const nehaProfile = await prisma.employeeProfile.create({
    data: {
      userId: nehaUser.id,
      companyId: company.id,
      departmentId: operationsDept.id,
      monthlyBudget: 30000.0,
      jobTitle: "Operations Specialist",
      status: "ACTIVE",
    },
  });

  // 5. Create Spending Policies
  await prisma.policy.create({
    data: {
      name: "Company Wide Spending Rules",
      description: "Global threshold limits and prohibited categories",
      scopeType: "COMPANY",
      monthlyLimit: 1000000.0,
      maxTransactionAmount: 50000.0,
      approvalThreshold: 10000.0,
      allowedCategories: JSON.stringify(["Software", "Cloud Infrastructure", "Advertising", "Hardware", "Travel", "Office Supplies"]),
      blockedCategories: JSON.stringify(["Gambling", "Cryptocurrency", "Personal", "Adult Entertainment"]),
      allowedMerchants: JSON.stringify(["AWS", "Google Cloud", "Meta Ads", "Amazon Business", "Uber", "Canva", "Slack"]),
      blockedMerchants: JSON.stringify(["Casino Grand", "Bet365", "CryptoCloud Node Labs"]),
      requireReceiptAbove: 1000.0,
      isActive: true,
      companyId: company.id,
    },
  });

  await prisma.policy.create({
    data: {
      name: "Engineering Infrastructure Policy",
      description: "Cloud compute, SaaS developer tooling, and telemetry",
      scopeType: "DEPARTMENT",
      departmentId: engineeringDept.id,
      monthlyLimit: 500000.0,
      maxTransactionAmount: 100000.0,
      approvalThreshold: 20000.0,
      allowedCategories: JSON.stringify(["Cloud Infrastructure", "Software", "Hardware", "Developer Tools"]),
      blockedCategories: JSON.stringify(["Gambling", "Cryptocurrency", "Personal"]),
      allowedMerchants: JSON.stringify(["AWS", "Google Cloud", "GitHub", "Vercel", "Datadog", "JetBrains", "Docker"]),
      blockedMerchants: JSON.stringify(["Casino", "CryptoCloud Node Labs"]),
      requireReceiptAbove: 2000.0,
      isActive: true,
      companyId: company.id,
    },
  });

  // =========================================================================
  // 6. SEED REALISTIC EXPENSES COVERING ALL 7 CORE LIFECYCLE STATES
  // =========================================================================

  // Scenario 1: Normal Routine Expense (₹2,500 Canva Pro - PAID)
  const exp1 = await prisma.expense.create({
    data: {
      expenseNumber: "EXP-2026-001",
      employeeProfileId: rahulProfile.id,
      departmentId: marketingDept.id,
      companyId: company.id,
      merchantName: "Canva Pro",
      amount: 2500.0,
      currency: "INR",
      category: "Software",
      purpose: "Design assets and marketing social banner templates",
      status: "PAID",
      paymentStatus: "PAID",
      policyDecision: "APPROVED",
      policyReasons: JSON.stringify(["✓ Within employee limit", "✓ Category allowed: Software"]),
      decisionReason: "Fully compliant auto-approved spend.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    },
  });

  await prisma.aIAnalysis.create({
    data: {
      expenseId: exp1.id,
      riskScore: 12,
      riskLevel: "LOW",
      recommendation: "PROCEED",
      summary: "Standard routine subscription for marketing department.",
      signals: JSON.stringify([]),
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      companyId: company.id,
      expenseId: exp1.id,
      amount: 2500.0,
      currency: "INR",
      status: "SUCCESS",
      razorpayPaymentId: "pay_demo_cnv_001",
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    },
  });

  // Scenario 2: Standard Approval Request (₹18,500 AWS Cloud - PENDING APPROVAL)
  const exp2 = await prisma.expense.create({
    data: {
      expenseNumber: "EXP-2026-002",
      employeeProfileId: priyaProfile.id,
      departmentId: engineeringDept.id,
      companyId: company.id,
      merchantName: "Amazon Web Services",
      amount: 18500.0,
      currency: "INR",
      category: "Cloud Infrastructure",
      purpose: "Monthly production compute clusters and RDS read replicas",
      status: "PENDING_APPROVAL",
      paymentStatus: "UNPAID",
      policyDecision: "APPROVAL_REQUIRED",
      policyReasons: JSON.stringify([
        "✓ Category allowed: Cloud Infrastructure",
        "✓ Merchant allowed: AWS",
        "⚠ Amount exceeds single approval threshold ₹10,000.",
      ]),
      decisionReason: "APPROVAL REQUIRED: Requires manager approval under corporate threshold rules.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
    },
  });

  await prisma.approval.create({
    data: {
      companyId: company.id,
      expenseId: exp2.id,
      approverId: managerUser.id,
      status: "PENDING",
    },
  });

  await prisma.aIAnalysis.create({
    data: {
      expenseId: exp2.id,
      riskScore: 42,
      riskLevel: "MEDIUM",
      recommendation: "REVIEW",
      summary: "High value cloud infrastructure spend requiring manager sign-off.",
      signals: JSON.stringify([
        { type: "UNUSUAL_AMOUNT", severity: "MEDIUM", message: "Transaction exceeds ₹10,000 threshold." },
      ]),
    },
  });

  // Scenario 3: High-Risk Anomaly Request (₹75,000 CryptoCloud Node Labs - PENDING APPROVAL)
  const exp3 = await prisma.expense.create({
    data: {
      expenseNumber: "EXP-2026-003",
      employeeProfileId: priyaProfile.id,
      departmentId: engineeringDept.id,
      companyId: company.id,
      merchantName: "CryptoCloud Node Labs",
      amount: 75000.0,
      currency: "INR",
      category: "Software",
      purpose: "Decentralized consensus validation node cluster",
      status: "PENDING_APPROVAL",
      paymentStatus: "UNPAID",
      policyDecision: "APPROVAL_REQUIRED",
      policyReasons: JSON.stringify([
        "⚠ Transaction amount ₹75,000 exceeds threshold limit ₹10,000.",
      ]),
      decisionReason: "Flagged for high-risk manual review by AI Risk Engine.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    },
  });

  await prisma.approval.create({
    data: {
      companyId: company.id,
      expenseId: exp3.id,
      approverId: managerUser.id,
      status: "PENDING",
    },
  });

  await prisma.aIAnalysis.create({
    data: {
      expenseId: exp3.id,
      riskScore: 88,
      riskLevel: "HIGH",
      recommendation: "HIGH_RISK_REVIEW",
      summary: "High contextual risk: Prohibited crypto keyword in merchant name and novel vendor profile.",
      signals: JSON.stringify([
        { type: "PROHIBITED_CATEGORY", severity: "HIGH", message: "Merchant name contains prohibited crypto keyword." },
        { type: "NEW_MERCHANT", severity: "MEDIUM", message: "Merchant has not been seen before in company history." },
      ]),
    },
  });

  // Scenario 4: Hard Blocked Policy Violation (₹60,000 Casino Grand - BLOCKED)
  const exp4 = await prisma.expense.create({
    data: {
      expenseNumber: "EXP-2026-004",
      employeeProfileId: amitProfile.id,
      departmentId: salesDept.id,
      companyId: company.id,
      merchantName: "Casino Grand Macau",
      amount: 60000.0,
      currency: "INR",
      category: "Gambling",
      purpose: "Client hospitality celebration",
      status: "BLOCKED",
      paymentStatus: "FAILED",
      policyDecision: "BLOCKED",
      policyReasons: JSON.stringify([
        "✖ Category 'Gambling' is strictly blocked by corporate spending policy.",
        "✖ Merchant 'Casino Grand' is on corporate blocked merchant list.",
      ]),
      decisionReason: "BLOCKED: Policy violation. Cannot be approved or disbursed.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    },
  });

  await prisma.aIAnalysis.create({
    data: {
      expenseId: exp4.id,
      riskScore: 98,
      riskLevel: "HIGH",
      recommendation: "BLOCK",
      summary: "Prohibited merchant and category violation.",
      signals: JSON.stringify([
        { type: "PROHIBITED_CATEGORY", severity: "HIGH", message: "Gambling category is prohibited." },
      ]),
    },
  });

  // Scenario 5: Receipt Mismatch Discrepancy (Claim: ₹18,500 vs Receipt: ₹8,500 Uber)
  const exp5 = await prisma.expense.create({
    data: {
      expenseNumber: "EXP-2026-005",
      employeeProfileId: rahulProfile.id,
      departmentId: marketingDept.id,
      companyId: company.id,
      merchantName: "Uber Technologies",
      amount: 18500.0,
      currency: "INR",
      category: "Travel",
      purpose: "Airport transfers and partner summit travel",
      status: "PENDING_APPROVAL",
      paymentStatus: "UNPAID",
      policyDecision: "APPROVAL_REQUIRED",
      policyReasons: JSON.stringify(["⚠ Amount exceeds single approval threshold ₹10,000."]),
      decisionReason: "Flagged for review due to receipt verification discrepancy.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
    },
  });

  await prisma.approval.create({
    data: {
      companyId: company.id,
      expenseId: exp5.id,
      approverId: managerUser.id,
      status: "PENDING",
    },
  });

  const receiptRecord = await prisma.expenseReceipt.create({
    data: {
      companyId: company.id,
      expenseId: exp5.id,
      fileName: "uber_ride_receipt.pdf",
      fileType: "application/pdf",
      fileSize: 15420,
      storageKey: `companies/${company.id}/uber_ride_receipt.pdf`,
      status: "PROCESSED",
    },
  });

  const analysisRecord = await prisma.receiptAnalysis.create({
    data: {
      companyId: company.id,
      receiptId: receiptRecord.id,
      merchantName: "Uber Technologies Inc",
      totalAmount: 8500.0, // ₹10,000 mismatch against claim
      transactionDate: "2026-09-01",
      category: "Travel",
      confidence: 0.95,
      status: "PROCESSED",
    },
  });

  await prisma.expenseVerification.create({
    data: {
      companyId: company.id,
      expenseId: exp5.id,
      receiptAnalysisId: analysisRecord.id,
      status: "MISMATCH",
      overallScore: 60,
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
      mismatchReasons: JSON.stringify(["Amount variance: Claim ₹18,500 vs Receipt ₹8,500 (₹10,000 difference)."]),
      matchBreakdown: JSON.stringify({ amount: { claim: 18500, document: 8500, isMatch: false } }),
      recommendation: "REVIEW",
    },
  });

  // Scenario 6: Approved & Paid Razorpay Settlement (₹45,000 Google Cloud - PAID)
  const exp6 = await prisma.expense.create({
    data: {
      expenseNumber: "EXP-2026-006",
      employeeProfileId: priyaProfile.id,
      departmentId: engineeringDept.id,
      companyId: company.id,
      merchantName: "Google Cloud",
      amount: 45000.0,
      currency: "INR",
      category: "Cloud Infrastructure",
      purpose: "BigQuery data warehouse analytical processing",
      status: "PAID",
      paymentStatus: "PAID",
      policyDecision: "APPROVED",
      policyReasons: JSON.stringify(["✓ Department budget available", "✓ Approved merchant"]),
      decisionReason: "Disbursed via Razorpay order order_demo_gcp_006.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      companyId: company.id,
      expenseId: exp6.id,
      razorpayOrderId: "order_demo_gcp_006",
      razorpayPaymentId: "pay_demo_gcp_9921",
      amount: 45000.0,
      currency: "INR",
      status: "SUCCESS",
      type: "PAYMENT",
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    },
  });

  // Scenario 7: Payment Gateway Failure (₹15,000 Slack - PAYMENT_FAILED)
  const exp7 = await prisma.expense.create({
    data: {
      expenseNumber: "EXP-2026-007",
      employeeProfileId: nehaProfile.id,
      departmentId: operationsDept.id,
      companyId: company.id,
      merchantName: "Slack Technologies",
      amount: 15000.0,
      currency: "INR",
      category: "Software",
      purpose: "Operations team communication workspace upgrade",
      status: "PAYMENT_FAILED",
      paymentStatus: "FAILED",
      policyDecision: "APPROVED",
      policyReasons: JSON.stringify(["✓ Approved operational expense"]),
      decisionReason: "Razorpay payment failed: Bank gateway timeout during settlement.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      companyId: company.id,
      expenseId: exp7.id,
      razorpayOrderId: "order_demo_slack_007",
      amount: 15000.0,
      currency: "INR",
      status: "FAILED",
      failureCode: "GATEWAY_TIMEOUT",
      failureReason: "Bank gateway timed out during fund transfer. Ready for retry.",
      type: "PAYMENT",
    },
  });

  // 7. Seed Active AI Insights
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await prisma.aIInsight.create({
    data: {
      companyId: company.id,
      periodStart: thirtyDaysAgo,
      periodEnd: new Date(),
      type: "RECEIPT_MISMATCH_CONCENTRATION",
      severity: "WARNING",
      title: "Receipt Verification Variance Flagged",
      explanation: "An expense claim for Uber Technologies (₹18,500) has a document discrepancy of ₹10,000 compared to the verified receipt (₹8,500).",
      recommendedAction: "Inspect receipt line items in Approvals Center before releasing payment.",
      actionLink: "/dashboard/approvals",
      evidence: JSON.stringify([
        "Expense: EXP-2026-005",
        "Claimed Amount: ₹18,500",
        "Document Amount: ₹8,500",
        "Variance: ₹10,000 difference",
      ]),
      status: "ACTIVE",
    },
  });

  await prisma.aIInsight.create({
    data: {
      companyId: company.id,
      periodStart: thirtyDaysAgo,
      periodEnd: new Date(),
      type: "PAYMENT_FAILURES",
      severity: "CRITICAL",
      title: "1 Payment Gateway Disbursement Failed",
      explanation: "A payout of ₹15,000 to Slack Technologies failed due to a bank gateway timeout.",
      recommendedAction: "Review error details in Transactions log and re-initiate payment.",
      actionLink: "/dashboard/transactions",
      evidence: JSON.stringify([
        "Failed Amount: ₹15,000",
        "Vendor: Slack Technologies",
        "Failure Code: GATEWAY_TIMEOUT",
      ]),
      status: "ACTIVE",
    },
  });

  await prisma.aIInsight.create({
    data: {
      companyId: company.id,
      periodStart: thirtyDaysAgo,
      periodEnd: new Date(),
      type: "SAVINGS_OPPORTUNITY",
      severity: "INFO",
      title: "Policy Engine Prevented ₹60,000 in Policy Violations",
      explanation: "SpendGuard AI prevented ₹60,000 of non-compliant gambling charges via automated deterministic spending policies.",
      recommendedAction: "Review blocked transaction logs to ensure policy boundaries match company guidelines.",
      actionLink: "/dashboard/policies",
      evidence: JSON.stringify([
        "Blocked Spend: ₹60,000",
        "Policy: Company Wide Spending Rules",
        "Blocked Category: Gambling",
      ]),
      status: "ACTIVE",
    },
  });

  console.log("=================================================");
  console.log("✨ SPENDGUARD AI ENTERPRISE DATASET SEEDED ✨");
  console.log("Acme Technologies: 1 Admin, 1 Manager, 4 Employees");
  console.log("7 Expense Lifecycle States: Routine Paid, Approval, High Risk, Blocked, Receipt Mismatch, Paid, Failed");
  console.log("=================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
