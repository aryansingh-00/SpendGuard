import prisma from "@/lib/prisma";

export const AUDIT_ACTIONS = {
  APPROVAL_REQUEST_CREATED: "APPROVAL_REQUEST_CREATED",
  EXPENSE_APPROVED: "EXPENSE_APPROVED",
  EXPENSE_REJECTED: "EXPENSE_REJECTED",
  APPROVAL_COMMENT_ADDED: "APPROVAL_COMMENT_ADDED",
  POLICY_MODIFIED: "POLICY_MODIFIED",
  EXPENSE_CREATED: "EXPENSE_CREATED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;

export interface LogAuditEventParams {
  companyId: string;
  actorId?: string | null;
  action: AuditAction;
  entityType: "EXPENSE" | "APPROVAL" | "POLICY" | "BUDGET" | "USER";
  entityId: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Persists an immutable audit log entry.
 */
export async function logAuditEvent(params: LogAuditEventParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        actorId: params.actorId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to write audit log entry:", error);
    return null;
  }
}
