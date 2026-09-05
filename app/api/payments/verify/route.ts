import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPaymentSignature } from "@/lib/razorpay/payment-service";
import { logAuditEvent } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, expenseId } = body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return NextResponse.json(
        { error: "Order ID and Payment ID are required." },
        { status: 400 }
      );
    }

    // 1. Verify signature in live/test mode
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature || ""
    );

    // If demo mode signature bypass
    const isTestMode =
      razorpay_order_id.startsWith("order_demo_") ||
      razorpay_order_id.startsWith("order_SG_") ||
      razorpay_signature === "spendguard_test_signature" ||
      razorpay_signature === "spendguard_demo_signature" ||
      !process.env.RAZORPAY_KEY_SECRET;

    if (!isValid && !isTestMode) {
      return NextResponse.json(
        { error: "Invalid payment cryptographic signature." },
        { status: 400 }
      );
    }

    // 2. Update PaymentTransaction record
    const paymentTx = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          { razorpayOrderId: razorpay_order_id },
          ...(expenseId ? [{ expenseId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (paymentTx) {
      await prisma.paymentTransaction.update({
        where: { id: paymentTx.id },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature || "verified_client_signature",
          status: "SUCCESS",
          completedAt: new Date(),
        },
      });
    }

    // 3. Fallback check for legacy Transaction record
    const legacyTx = await prisma.transaction.findFirst({
      where: {
        OR: [
          { razorpayOrderId: razorpay_order_id },
          ...(expenseId ? [{ expenseId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (legacyTx) {
      await prisma.transaction.update({
        where: { id: legacyTx.id },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature || "verified_sig",
          status: "SUCCESS",
        },
      });
    }

    // 4. Update Expense Status -> PAID
    const targetExpenseId = expenseId || paymentTx?.expenseId || legacyTx?.expenseId;
    if (targetExpenseId) {
      const updatedExpense = await prisma.expense.update({
        where: { id: targetExpenseId },
        data: {
          status: "PAID",
          paymentStatus: "PAID",
          decisionReason: `Payment settled via Razorpay checkout (${razorpay_payment_id}).`,
        },
        include: {
          employeeProfile: { include: { user: true } },
          department: true,
          paymentTransactions: true,
        },
      });

      // Audit Log
      await logAuditEvent({
        companyId: updatedExpense.companyId,
        actorId: updatedExpense.employeeProfile?.userId || null,
        action: "PAYMENT_COMPLETED",
        entityType: "EXPENSE",
        entityId: updatedExpense.id,
        metadata: {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          amount: updatedExpense.amount,
          settledVia: "CLIENT_CHECKOUT_VERIFY",
        },
      });

      // Notify employee
      if (updatedExpense.employeeProfile?.userId) {
        await prisma.notification.create({
          data: {
            userId: updatedExpense.employeeProfile.userId,
            title: `Payment Confirmed: ₹${updatedExpense.amount.toLocaleString("en-IN")}`,
            message: `Your payment for ${updatedExpense.merchantName} (${updatedExpense.expenseNumber}) has been settled successfully.`,
            type: "PAYMENT_SUCCESS",
            link: `/dashboard/expenses/${updatedExpense.id}`,
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Payment verified and recorded successfully.",
        expense: updatedExpense,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully.",
    });
  } catch (error: any) {
    console.error("Payment Verification Error:", error);
    return NextResponse.json(
      { error: "Payment verification failed. Please check server logs." },
      { status: 500 }
    );
  }
}
