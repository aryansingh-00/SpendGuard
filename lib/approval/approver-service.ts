import prisma from "@/lib/prisma";

export interface ResolvedApprover {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * Resolves the appropriate approver for an expense based on organizational hierarchy.
 * Priority:
 * 1. Department Manager (if assigned and role is MANAGER or FINANCE_ADMIN)
 * 2. Fallback: Active FINANCE_ADMIN in the same company
 */
export async function resolveApproverForExpense(
  departmentId: string | null | undefined,
  companyId: string
): Promise<ResolvedApprover | null> {
  // 1. Check department manager
  if (departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: { manager: true },
    });

    if (
      department &&
      department.companyId === companyId &&
      department.manager &&
      (department.manager.role === "MANAGER" || department.manager.role === "FINANCE_ADMIN")
    ) {
      return {
        id: department.manager.id,
        name: department.manager.name,
        email: department.manager.email,
        role: department.manager.role,
      };
    }
  }

  // 2. Fallback to any active Finance Admin in the same company
  const fallbackAdmin = await prisma.user.findFirst({
    where: {
      companyId,
      role: "FINANCE_ADMIN",
    },
    orderBy: { createdAt: "asc" },
  });

  if (fallbackAdmin) {
    return {
      id: fallbackAdmin.id,
      name: fallbackAdmin.name,
      email: fallbackAdmin.email,
      role: fallbackAdmin.role,
    };
  }

  // 3. Last resort fallback: any manager in the same company
  const fallbackManager = await prisma.user.findFirst({
    where: {
      companyId,
      role: "MANAGER",
    },
    orderBy: { createdAt: "asc" },
  });

  if (fallbackManager) {
    return {
      id: fallbackManager.id,
      name: fallbackManager.name,
      email: fallbackManager.email,
      role: fallbackManager.role,
    };
  }

  return null;
}

/**
 * Server-side authorization check: Determines if a given user can approve/reject an expense.
 * Rules:
 * - User must belong to the same company.
 * - Role must be FINANCE_ADMIN or MANAGER (EMPLOYEE can NEVER approve).
 * - FINANCE_ADMIN can approve any expense within the company.
 * - MANAGER can approve if they manage the department, or if assigned as approver, or if company allows department management.
 */
export async function isUserAuthorizedToApprove(
  userId: string,
  userRole: string,
  userCompanyId: string | null,
  expense: {
    id: string;
    companyId: string;
    departmentId: string;
    employeeProfile?: { userId: string } | null;
  }
): Promise<{ authorized: boolean; reason?: string }> {
  // Multi-tenant check
  if (!userCompanyId || userCompanyId !== expense.companyId) {
    return { authorized: false, reason: "Cross-tenant access forbidden. Expense belongs to another company." };
  }

  // Role check
  if (userRole === "EMPLOYEE") {
    return { authorized: false, reason: "Employees cannot approve expense requests." };
  }

  // Self-approval prohibition (cannot approve your own expense)
  if (expense.employeeProfile && expense.employeeProfile.userId === userId) {
    return { authorized: false, reason: "Self-approval is prohibited. Another manager or finance admin must review this request." };
  }

  // Finance Admin has company-wide approval authority
  if (userRole === "FINANCE_ADMIN") {
    return { authorized: true };
  }

  // Manager: check if they manage this department or are assigned approver
  if (userRole === "MANAGER") {
    const department = await prisma.department.findUnique({
      where: { id: expense.departmentId },
    });

    if (department && department.managerId === userId) {
      return { authorized: true };
    }

    // Check if directly assigned to the pending approval
    const directApproval = await prisma.approval.findFirst({
      where: {
        expenseId: expense.id,
        approverId: userId,
        status: "PENDING",
      },
    });

    if (directApproval) {
      return { authorized: true };
    }

    // Default for manager in MVP: if department manager isn't set, any manager in the company can review
    if (department && !department.managerId) {
      return { authorized: true };
    }

    return { authorized: false, reason: "You are not the designated manager for this department." };
  }

  return { authorized: false, reason: "Unauthorized role." };
}
