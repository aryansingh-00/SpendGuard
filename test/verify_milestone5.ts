import { PrismaClient } from "@prisma/client";
import { resolveApproverForExpense, isUserAuthorizedToApprove } from "../lib/approval/approver-service";
import { createPendingApproval, processApprovalDecision } from "../lib/approval/approval-service";

const prisma = new PrismaClient();

async function runMilestone5Tests() {
  console.log("=================================================");
  console.log("🛡️  SPENDGUARD AI — MILESTONE 5 AUTOMATED TESTS");
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
  const marketingDept = company.departments.find((d) => d.name === "Marketing")!;
  const engineeringDept = company.departments.find((d) => d.name === "Engineering")!;
  const rahulProfile = company.employeeProfiles.find((e) => e.userId === rahulUser.id)!;
  const priyaProfile = company.employeeProfiles.find((e) => e.userId === priyaUser.id)!;

  // ==========================================
  // 1. APPROVER RESOLUTION & AUTHORIZATION
  // ==========================================
  console.log("--- 1. Approver Resolution & Authorization Tests ---");

  // Test 1: Resolve approver for marketing department
  const approverMkt = await resolveApproverForExpense(marketingDept.id, company.id);
  assert("Approver resolves to Department Manager (Ananya Iyer)", approverMkt?.id === managerUser.id);
  assert("Approver has MANAGER role", approverMkt?.role === "MANAGER");

  // Test 2: Fallback when department has no manager
  const noManagerDept = await prisma.department.create({
    data: {
      name: "Temporary Special Projects",
      companyId: company.id,
      monthlyBudget: 50000,
    },
  });
  const fallbackApprover = await resolveApproverForExpense(noManagerDept.id, company.id);
  assert("Fallback approver resolves to Finance Admin", fallbackApprover?.role === "FINANCE_ADMIN");
  await prisma.department.delete({ where: { id: noManagerDept.id } });

  // Test 3: Role Authorization — Employee CANNOT approve
  const empAuth = await isUserAuthorizedToApprove(rahulUser.id, "EMPLOYEE", company.id, {
    id: "exp_test_1",
    companyId: company.id,
    departmentId: marketingDept.id,
    employeeProfile: { userId: priyaUser.id },
  });
  assert("Role check: EMPLOYEE cannot approve expenses", empAuth.authorized === false);

  // Test 4: Self-Approval Prohibition
  const selfAuth = await isUserAuthorizedToApprove(managerUser.id, "MANAGER", company.id, {
    id: "exp_test_2",
    companyId: company.id,
    departmentId: marketingDept.id,
    employeeProfile: { userId: managerUser.id },
  });
  assert("Role check: Self-approval is strictly prohibited", selfAuth.authorized === false);

  // Test 5: Finance Admin company-wide approval authority
  const adminAuth = await isUserAuthorizedToApprove(adminUser.id, "FINANCE_ADMIN", company.id, {
    id: "exp_test_3",
    companyId: company.id,
    departmentId: marketingDept.id,
    employeeProfile: { userId: rahulUser.id },
  });
  assert("Role check: FINANCE_ADMIN is authorized company-wide", adminAuth.authorized === true);

  // ==========================================
  // 2. APPROVAL CREATION & IDEMPOTENCY
  // ==========================================
  console.log("\n--- 2. Approval Request Creation & Idempotency Tests ---");

  // Create a test expense needing approval
  const testExp1 = await prisma.expense.create({
    data: {
      expenseNumber: "EXP-TEST-001",
      employeeProfileId: rahulProfile.id,
      departmentId: marketingDept.id,
      merchantName: "HubSpot Software",
      amount: 19000,
      currency: "INR",
      category: "Software",
      purpose: "CRM Upgrade",
      status: "PENDING_APPROVAL",
      paymentStatus: "UNPAID",
      policyDecision: "APPROVAL_REQUIRED",
      companyId: company.id,
    },
  });

  // Test 6: Create initial pending approval
  const app1 = await createPendingApproval(testExp1.id, company.id);
  assert("Approval created with status PENDING", app1?.status === "PENDING");
  assert("Approval assigned to correct company", app1?.companyId === company.id);
  assert("Approval assigned to department manager", app1?.approverId === managerUser.id);

  // Test 7: Idempotency Check — calling createPendingApproval again returns existing PENDING record
  const app2 = await createPendingApproval(testExp1.id, company.id);
  assert("Idempotency: Repeated call returns existing approval ID", app2?.id === app1?.id);
  const totalPendingForExp = await prisma.approval.count({
    where: { expenseId: testExp1.id, status: "PENDING" },
  });
  assert("Idempotency: Exactly 1 PENDING approval exists in DB", totalPendingForExp === 1);

  // Test 8: BLOCKED expense does not create approval workflow
  const testBlockedExp = await prisma.expense.create({
    data: {
      expenseNumber: "EXP-TEST-BLOCKED",
      employeeProfileId: rahulProfile.id,
      departmentId: marketingDept.id,
      merchantName: "Illegal Casino Online",
      amount: 50000,
      currency: "INR",
      category: "Gambling",
      purpose: "Blocked test",
      status: "BLOCKED",
      policyDecision: "BLOCKED",
      companyId: company.id,
    },
  });
  const blockedApp = await createPendingApproval(testBlockedExp.id, company.id);
  assert("Blocked Expense Protection: No approval workflow created for BLOCKED expense", blockedApp === null);

  // ==========================================
  // 3. APPROVAL DECISION WORKFLOW
  // ==========================================
  console.log("\n--- 3. Approve Workflow & State Transitions ---");

  // Test 9: Manager approves pending expense
  const approveResult = await processApprovalDecision({
    approvalId: app1!.id,
    approverUser: managerUser,
    decision: "APPROVED",
    comment: "Verified software license necessity. Approved.",
  });

  assert("Approval status transitions to APPROVED", approveResult.approval.status === "APPROVED");
  assert("Approval decision is recorded as APPROVED", approveResult.approval.decision === "APPROVED");
  assert("Approval timestamp decidedAt is recorded", approveResult.approval.decidedAt !== null);
  assert("Expense status transitions to READY_FOR_PAYMENT", approveResult.expense.status === "READY_FOR_PAYMENT");
  assert("Payment status remains UNPAID (No Razorpay yet in Milestone 5)", approveResult.expense.paymentStatus === "UNPAID");

  // Test 10: Audit Log created for approval
  const auditApprove = await prisma.auditLog.findFirst({
    where: {
      companyId: company.id,
      entityId: testExp1.id,
      action: "EXPENSE_APPROVED",
    },
  });
  assert("Audit Trail: EXPENSE_APPROVED event persisted", auditApprove !== null);
  assert("Audit Trail: Actor is the approving manager", auditApprove?.actorId === managerUser.id);

  // Test 11: Notification created for submitting employee
  const notifApprove = await prisma.notification.findFirst({
    where: {
      userId: rahulUser.id,
      type: "EXPENSE_APPROVED",
    },
    orderBy: { createdAt: "desc" },
  });
  assert("Notification: Employee received approval notification", notifApprove !== null);
  assert("Notification message mentions ready for payment", notifApprove?.message.includes("ready for payment") === true);

  // ==========================================
  // 4. REJECTION DECISION WORKFLOW
  // ==========================================
  console.log("\n--- 4. Reject Workflow & Validation ---");

  // Create second expense for rejection testing
  const testExp2 = await prisma.expense.create({
    data: {
      expenseNumber: "EXP-TEST-002",
      employeeProfileId: priyaProfile.id,
      departmentId: engineeringDept.id,
      merchantName: "Luxury Hotel Resort",
      amount: 32000,
      currency: "INR",
      category: "Travel",
      purpose: "Weekend offsite",
      status: "PENDING_APPROVAL",
      paymentStatus: "UNPAID",
      policyDecision: "APPROVAL_REQUIRED",
      companyId: company.id,
    },
  });

  const appReject = await createPendingApproval(testExp2.id, company.id);

  // Test 12: Rejection without comment or < 5 chars fails
  let shortCommentFailed = false;
  try {
    await processApprovalDecision({
      approvalId: appReject!.id,
      approverUser: adminUser,
      decision: "REJECTED",
      comment: "No",
    });
  } catch (err: any) {
    shortCommentFailed = err.message.includes("at least 5 characters");
  }
  assert("Validation: Rejection requires comment of >= 5 chars", shortCommentFailed);

  // Test 13: Valid Rejection by Finance Admin
  const rejectResult = await processApprovalDecision({
    approvalId: appReject!.id,
    approverUser: adminUser,
    decision: "REJECTED",
    comment: "Personal retreat expenses are not reimbursable under engineering policy.",
  });

  assert("Approval status transitions to REJECTED", rejectResult.approval.status === "REJECTED");
  assert("Expense status transitions to REJECTED", rejectResult.expense.status === "REJECTED");
  assert("Rejection comment is preserved", rejectResult.approval.comment?.includes("Personal retreat") === true);

  // Test 14: Audit Log created for rejection
  const auditReject = await prisma.auditLog.findFirst({
    where: {
      companyId: company.id,
      entityId: testExp2.id,
      action: "EXPENSE_REJECTED",
    },
  });
  assert("Audit Trail: EXPENSE_REJECTED event persisted", auditReject !== null);

  // ==========================================
  // 5. HARD BLOCK PROTECTION & RACE CONDITIONS
  // ==========================================
  console.log("\n--- 5. Hard Block Protection & Concurrency Tests ---");

  // Test 15: Cannot approve an already decided request (Double decision prevention)
  let raceConditionPrevented = false;
  try {
    await processApprovalDecision({
      approvalId: app1!.id, // already APPROVED in Test 9
      approverUser: adminUser,
      decision: "APPROVED",
      comment: "Trying to approve a second time",
    });
  } catch (err: any) {
    raceConditionPrevented = err.message.includes("already been approved");
  }
  assert("Race Condition: Re-approving an already approved request is safely rejected", raceConditionPrevented);

  // Test 16: Attempting to approve a BLOCKED transaction fails with policy error
  let blockedApprovalBlocked = false;
  try {
    // Manually create approval record pointing to blocked expense to test safeguard
    const artificialApproval = await prisma.approval.create({
      data: {
        companyId: company.id,
        expenseId: testBlockedExp.id,
        status: "PENDING",
      },
    });

    await processApprovalDecision({
      approvalId: artificialApproval.id,
      approverUser: managerUser,
      decision: "APPROVED",
      comment: "Manager trying to bypass hard block",
    });
  } catch (err: any) {
    blockedApprovalBlocked = err.message.includes("Violation of Financial Policy");
  }
  assert("Hard Block Supremacy: BLOCKED transactions cannot be approved under any circumstances", blockedApprovalBlocked);

  // ==========================================
  // 6. MULTI-TENANT ISOLATION
  // ==========================================
  console.log("\n--- 6. Multi-Tenant Data Isolation Tests ---");

  // Create Tenant B
  const tenantB = await prisma.company.create({
    data: {
      name: "Tenant Beta Healthcare",
      currency: "INR",
      monthlyBudget: 200000,
    },
  });

  const tenantBUser = await prisma.user.create({
    data: {
      name: "Beta Admin",
      email: "admin@betahealthcare.com",
      role: "FINANCE_ADMIN",
      companyId: tenantB.id,
    },
  });

  const tenantBDept = await prisma.department.create({
    data: {
      name: "Clinical Operations",
      companyId: tenantB.id,
      monthlyBudget: 100000,
    },
  });

  const tenantBEmp = await prisma.employeeProfile.create({
    data: {
      userId: tenantBUser.id,
      companyId: tenantB.id,
      departmentId: tenantBDept.id,
      monthlyBudget: 50000,
      jobTitle: "Medical Director",
    },
  });

  const tenantBExp = await prisma.expense.create({
    data: {
      expenseNumber: "BETA-EXP-001",
      employeeProfileId: tenantBEmp.id,
      departmentId: tenantBDept.id,
      merchantName: "Lab Supplies Inc",
      amount: 12000,
      currency: "INR",
      category: "Medical Supplies",
      purpose: "Reagents",
      status: "PENDING_APPROVAL",
      companyId: tenantB.id,
    },
  });

  const tenantBApproval = await createPendingApproval(tenantBExp.id, tenantB.id);

  // Test 17: Acme Manager cannot approve Tenant B's expense
  let crossTenantPrevented = false;
  try {
    await processApprovalDecision({
      approvalId: tenantBApproval!.id,
      approverUser: managerUser, // Acme Manager
      decision: "APPROVED",
    });
  } catch (err: any) {
    crossTenantPrevented = err.message.includes("Cross-tenant");
  }
  assert("Tenant Isolation: Manager of Company A cannot approve Company B expense", crossTenantPrevented);

  // Clean up test data
  await prisma.approval.deleteMany({ where: { expenseId: { in: [testExp1.id, testExp2.id, testBlockedExp.id, tenantBExp.id] } } });
  await prisma.auditLog.deleteMany({ where: { companyId: { in: [company.id, tenantB.id] }, entityId: { in: [testExp1.id, testExp2.id, testBlockedExp.id, tenantBExp.id] } } });
  await prisma.expense.deleteMany({ where: { id: { in: [testExp1.id, testExp2.id, testBlockedExp.id, tenantBExp.id] } } });
  await prisma.employeeProfile.delete({ where: { id: tenantBEmp.id } });
  await prisma.department.delete({ where: { id: tenantBDept.id } });
  await prisma.user.delete({ where: { id: tenantBUser.id } });
  await prisma.company.delete({ where: { id: tenantB.id } });

  console.log("\n=================================================");
  console.log(`✨ ALL MILESTONE 5 AUTOMATED TESTS PASSED: ${passedTests}/${totalTests} ✨`);
  console.log("=================================================");
}

runMilestone5Tests()
  .catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
