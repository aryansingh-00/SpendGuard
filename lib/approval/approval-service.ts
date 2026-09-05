import prisma from "@/lib/prisma";
import { resolveApproverForExpense, isUserAuthorizedToApprove } from "./approver-service";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

export interface ProcessApprovalParams {
  expenseId?: string;
  approvalId?: string;
  approverUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyId?: string | null;
  };
  decision: "APPROVED" | "REJECTED";
  comment?: string | null;
}

/**
 * Idempotently creates or returns a PENDING Approval record for an expense that requires approval.
 */
export async function createPendingApproval(expenseId: string, companyId: string) {
  // 1. Fetch expense details
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      employeeProfile: { include: { user: true } },
      department: true,
      approvals: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!expense || expense.companyId !== companyId) {
    throw new Error("Expense not found or does not belong to specified company.");
  }

  // 2. Hard block protection: do not create active approval workflows for blocked expenses
  if (expense.status === "BLOCKED" || expense.policyDecision === "BLOCKED") {
    return null;
  }

  // 3. Idempotency Check: if a PENDING approval already exists, return it
  if (expense.approvals.length > 0) {
    return expense.approvals[0];
  }

  // 4. Resolve designated approver
  const approver = await resolveApproverForExpense(expense.departmentId, companyId);

  // 5. Create new PENDING Approval record
  const approval = await prisma.approval.create({
    data: {
      companyId,
      expenseId: expense.id,
      approverId: approver ? approver.id : null,
      status: "PENDING",
      decision: null,
      comment: null,
    },
    include: {
      approver: {
        select: { id: true, name: true, email: true, role: true },
      },
      expense: true,
    },
  });

  // 6. Audit Trail: Log Approval Request Created
  await logAuditEvent({
    companyId,
    actorId: expense.employeeProfile.userId,
    action: AUDIT_ACTIONS.APPROVAL_REQUEST_CREATED,
    entityType: "APPROVAL",
    entityId: approval.id,
    metadata: {
      expenseId: expense.id,
      expenseNumber: expense.expenseNumber,
      amount: expense.amount,
      merchantName: expense.merchantName,
      assignedApproverId: approver?.id || null,
    },
  });

  // 7. Notify designated approver if available
  if (approver) {
    await prisma.notification.create({
      data: {
        userId: approver.id,
        title: `Approval Required: ${expense.merchantName}`,
        message: `${expense.employeeProfile.user.name} submitted ${expense.expenseNumber} (₹${expense.amount.toLocaleString("en-IN")}) for review.`,
        type: "APPROVAL_REQUIRED",
        link: `/dashboard/approvals`,
      },
    });
  }

  return approval;
}

/**
 * Atomically processes a manager/admin decision on an approval request.
 * Transitions expense to READY_FOR_PAYMENT on approval, or REJECTED on rejection.
 */
export async function processApprovalDecision(params: ProcessApprovalParams) {
  const { expenseId, approvalId, approverUser, decision, comment } = params;

  // Validate decision
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    throw new Error("Invalid decision. Must be APPROVED or REJECTED.");
  }

  // Validate rejection comment length (min 5 chars)
  if (decision === "REJECTED" && (!comment || comment.trim().length < 5)) {
    throw new Error("A rejection reason of at least 5 characters is required.");
  }

  // Execute in Prisma interactive transaction to prevent race conditions
  return await prisma.$transaction(async (tx) => {
    // 1. Find approval and associated expense
    let approval = null;
    if (approvalId) {
      approval = await tx.approval.findUnique({
        where: { id: approvalId },
        include: {
          expense: {
            include: {
              employeeProfile: { include: { user: true } },
              department: true,
            },
          },
        },
      });
    } else if (expenseId) {
      approval = await tx.approval.findFirst({
        where: { expenseId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        include: {
          expense: {
            include: {
              employeeProfile: { include: { user: true } },
              department: true,
            },
          },
        },
      });
    }

    if (!approval) {
      throw new Error("No pending approval request found for this transaction.");
    }

    const expense = approval.expense;

    // 2. Tenancy check
    if (approval.companyId !== approverUser.companyId || expense.companyId !== approverUser.companyId) {
      throw new Error("Cross-tenant authorization error. Approval does not belong to your company.");
    }

    // 3. Race condition check: Ensure status is still PENDING
    if (approval.status !== "PENDING") {
      throw new Error(`This request has already been ${approval.status.toLowerCase()} by an approver.`);
    }

    // 4. Hard Block Protection: BLOCKED transactions can never be approved
    if (expense.status === "BLOCKED" || expense.policyDecision === "BLOCKED") {
      throw new Error("Violation of Financial Policy: This transaction violates hard corporate rules and cannot be approved.");
    }

    // 5. Authorization Check
    const authCheck = await isUserAuthorizedToApprove(
      approverUser.id,
      approverUser.role,
      approverUser.companyId || null,
      expense
    );

    if (!authCheck.authorized) {
      throw new Error(authCheck.reason || "You are not authorized to make a decision on this approval request.");
    }

    // 6. Update Approval Record
    const updatedApproval = await tx.approval.update({
      where: { id: approval.id },
      data: {
        status: decision,
        decision,
        comment: comment?.trim() || (decision === "APPROVED" ? "Approved by reviewer." : null),
        approverId: approverUser.id,
        decidedAt: new Date(),
      },
      include: {
        approver: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // 7. Update Expense Status
    // NOTE: Milestone 5 requirement: Approved expenses become READY_FOR_PAYMENT (No Razorpay yet)
    const newExpenseStatus = decision === "APPROVED" ? "READY_FOR_PAYMENT" : "REJECTED";
    const decisionNote =
      decision === "APPROVED"
        ? `Approved by ${approverUser.name}: ${comment?.trim() || "Verified compliance."}`
        : `Rejected by ${approverUser.name}: ${comment?.trim()}`;

    const updatedExpense = await tx.expense.update({
      where: { id: expense.id },
      data: {
        status: newExpenseStatus,
        decisionReason: decisionNote,
      },
      include: {
        employeeProfile: { include: { user: true } },
        department: true,
        aiAnalysis: true,
        approvals: { include: { approver: true } },
      },
    });

    // 8. Audit Log
    await tx.auditLog.create({
      data: {
        companyId: approverUser.companyId!,
        actorId: approverUser.id,
        action: decision === "APPROVED" ? AUDIT_ACTIONS.EXPENSE_APPROVED : AUDIT_ACTIONS.EXPENSE_REJECTED,
        entityType: "EXPENSE",
        entityId: expense.id,
        metadata: JSON.stringify({
          approvalId: approval.id,
          expenseNumber: expense.expenseNumber,
          amount: expense.amount,
          decision,
          comment: comment?.trim() || null,
          previousStatus: expense.status,
          newStatus: newExpenseStatus,
        }),
      },
    });

    // 9. Send Notification to Submitting Employee
    if (expense.employeeProfile.userId) {
      await tx.notification.create({
        data: {
          userId: expense.employeeProfile.userId,
          title: decision === "APPROVED" ? `Expense Approved: ${expense.merchantName}` : `Expense Rejected: ${expense.merchantName}`,
          message:
            decision === "APPROVED"
              ? `Your expense ${expense.expenseNumber} (₹${expense.amount.toLocaleString("en-IN")}) has been approved and is ready for payment.`
              : `Your expense ${expense.expenseNumber} (₹${expense.amount.toLocaleString("en-IN")}) was rejected. Reason: ${comment?.trim()}`,
          type: decision === "APPROVED" ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
          link: `/dashboard/expenses/${expense.id}`,
        },
      });
    }

    return {
      approval: updatedApproval,
      expense: updatedExpense,
    };
  });
}
