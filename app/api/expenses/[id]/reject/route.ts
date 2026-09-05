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

    if (!comment || typeof comment !== "string" || comment.trim().length < 5) {
      return NextResponse.json(
        { error: "A rejection reason of at least 5 characters is required." },
        { status: 400 }
      );
    }

    const result = await processApprovalDecision({
      expenseId: id,
      approverUser: user,
      decision: "REJECTED",
      comment: comment.trim(),
    });

    return NextResponse.json({
      success: true,
      message: "Expense request rejected.",
      approval: result.approval,
      expense: result.expense,
    });
  } catch (error: any) {
    console.error("Reject Expense Error:", error);
    const message = error?.message || "Failed to reject expense request.";
    const isClientError =
      message.includes("not authorized") ||
      message.includes("already been") ||
      message.includes("No pending approval") ||
      message.includes("rejection reason");

    return NextResponse.json(
      { error: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}
