import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createPaymentOrder } from "@/lib/razorpay/payment-service";
import { logAuditEvent } from "@/lib/audit";

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
    const reqHeaderKey = request.headers.get("x-idempotency-key") || request.headers.get("idempotency-key");
    const idempotencyKey = body.idempotencyKey || reqHeaderKey || `idemp_${id}_${Date.now()}`;

    // 1. Fetch Expense
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        employeeProfile: { include: { user: true } },
        department: true,
        paymentTransactions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    // 2. Tenant isolation check
    if (expense.companyId !== user.companyId) {
      return NextResponse.json({ error: "Unauthorized access to expense." }, { status: 403 });
    }

    // 3. Strict Safety & Policy Invariants
    if (expense.status === "BLOCKED" || expense.policyDecision === "BLOCKED") {
      return NextResponse.json(
        { error: "Blocked expenses cannot be paid under corporate spending policy." },
        { status: 400 }
      );
    }

    if (expense.status === "REJECTED") {
      return NextResponse.json(
        { error: "Rejected expenses cannot be paid." },
        { status: 400 }
      );
    }

    if (expense.status === "PAID" || expense.paymentStatus === "PAID") {
      return NextResponse.json(
        { error: "This expense has already been paid and settled." },
        { status: 400 }
      );
    }

    if (expense.status === "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "Expense is pending managerial approval and cannot be paid yet." },
        { status: 400 }
      );
    }

    // Eligible statuses: READY_FOR_PAYMENT, APPROVED, or PAYMENT_FAILED (for retry)
    const eligibleStatuses = ["READY_FOR_PAYMENT", "APPROVED", "PAYMENT_FAILED"];
    if (!eligibleStatuses.includes(expense.status) && expense.paymentStatus !== "UNPAID" && expense.paymentStatus !== "FAILED") {
      return NextResponse.json(
        { error: `Expense status '${expense.status}' is not eligible for payment execution.` },
        { status: 400 }
      );
    }

    // 4. Idempotency Check: Look for an existing transaction with this idempotencyKey
    const existingTx = await prisma.paymentTransaction.findFirst({
      where: { idempotencyKey },
    });

    if (existingTx) {
      if (existingTx.status === "SUCCESS") {
        return NextResponse.json({
          success: true,
          message: "Payment transaction has already succeeded (idempotent).",
          transactionId: existingTx.id,
          orderId: existingTx.razorpayOrderId,
          status: existingTx.status,
          amount: existingTx.amount * 100,
          amountRupees: existingTx.amount,
          currency: existingTx.currency,
        });
      }
      if (existingTx.status === "PROCESSING" && existingTx.razorpayOrderId) {
        return NextResponse.json({
          success: true,
          message: "Payment transaction already initiated and in progress.",
          transactionId: existingTx.id,
          orderId: existingTx.razorpayOrderId,
          status: existingTx.status,
          amount: existingTx.amount * 100,
          amountRupees: existingTx.amount,
          currency: existingTx.currency,
        });
      }
    }

    // 5. Server-Side Amount Supremacy: Always use expense.amount from DB
    const verifiedAmountRupees = expense.amount;

    // 6. Create Razorpay Order via Payment Service
    const order = await createPaymentOrder({
      expenseId: expense.id,
      expenseNumber: expense.expenseNumber,
      amount: verifiedAmountRupees,
      currency: expense.currency || "INR",
      companyId: expense.companyId,
      notes: {
        initiatedBy: user.id,
        userRole: user.role,
        merchantName: expense.merchantName,
        category: expense.category,
      },
      idempotencyKey,
    });

    // 7. Persist PaymentTransaction Record
    const paymentTx = await prisma.paymentTransaction.create({
      data: {
        companyId: expense.companyId,
        expenseId: expense.id,
        razorpayOrderId: order.orderId,
        type: "PAYMENT",
        status: "PROCESSING",
        amount: verifiedAmountRupees,
        currency: expense.currency || "INR",
        idempotencyKey,
        metadata: JSON.stringify({
          mode: order.mode,
          initiatedBy: user.id,
          userRole: user.role,
          notes: order.notes,
        }),
      },
    });

    // 8. Update Expense Payment Status
    await prisma.expense.update({
      where: { id: expense.id },
      data: {
        paymentStatus: "IN_PROGRESS",
      },
    });

    // 9. Log Audit Trail
    await logAuditEvent({
      companyId: expense.companyId,
      actorId: user.id,
      action: "PAYMENT_INITIATED",
      entityType: "EXPENSE",
      entityId: expense.id,
      metadata: {
        transactionId: paymentTx.id,
        orderId: order.orderId,
        amount: verifiedAmountRupees,
        mode: order.mode,
        idempotencyKey,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Payment order created and initiated successfully.",
      transactionId: paymentTx.id,
      orderId: order.orderId,
      amount: order.amount, // in paise
      amountRupees: order.amountRupees, // in INR
      currency: order.currency,
      mode: order.mode,
      keyId: order.keyId,
      expense: {
        id: expense.id,
        expenseNumber: expense.expenseNumber,
        merchantName: expense.merchantName,
        amount: verifiedAmountRupees,
        currency: expense.currency,
      },
    });
  } catch (error: any) {
    console.error("Pay Expense Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to initiate payment." },
      { status: 500 }
    );
  }
}
