import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { processApprovalDecision } from "@/lib/approval/approval-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(request, ["FINANCE_ADMIN", "MANAGER"]);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { comment } = body;

    const result = await processApprovalDecision({
      expenseId: id,
      approverUser: user,
      decision: "APPROVED",
      comment: comment || "Approved by Manager / Finance Controller.",
    });

    return NextResponse.json({
      success: true,
      message: "Expense approved successfully and marked ready for payment.",
      approval: result.approval,
      expense: result.expense,
    });
  } catch (error: any) {
    console.error("Approve Expense Error:", error);
    const message = error?.message || "Failed to approve expense request.";
    const isClientError =
      message.includes("Violation of Financial Policy") ||
      message.includes("not authorized") ||
      message.includes("already been") ||
      message.includes("No pending approval");

    return NextResponse.json(
      { error: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}
