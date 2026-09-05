import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getWebhookSecret } from "./client";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

export interface WebhookResult {
  success: boolean;
  event: string;
  transactionId?: string;
  expenseId?: string;
  message: string;
  alreadyProcessed?: boolean;
}

/**
 * Verifies Razorpay Webhook Cryptographic HMAC-SHA256 Signature using constant-time comparison.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string = getWebhookSecret()
): boolean {
  if (!signature || !rawBody) return false;

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const signatureBuf = Buffer.from(signature, "utf8");

    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Idempotently processes a verified Razorpay Webhook payload.
 */
export async function handleRazorpayWebhook(
  rawBody: string,
  signature: string,
  isSimulation: boolean = false
): Promise<WebhookResult> {
  // 1. Verify cryptographic signature
  if (!isSimulation) {
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new Error("Invalid Razorpay webhook cryptographic signature.");
    }
  }

  // 2. Parse JSON payload
  let eventData: any;
  try {
    eventData = JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid JSON webhook payload.");
  }

  const event: string = eventData.event || "unknown";
  const payload: any = eventData.payload || {};

  console.log(`🔔 SpendGuard Webhook Handler Processing: ${event}`);

  // 3. Process Payment / Order Events
  if (event === "payment.captured" || event === "order.paid") {
    const paymentEntity = payload.payment?.entity;
    const orderId = paymentEntity?.order_id || payload.order?.entity?.id;
    const paymentId = paymentEntity?.id || `pay_wh_${Date.now()}`;
    const expenseId = paymentEntity?.notes?.expenseId;
    const companyId = paymentEntity?.notes?.companyId;

    // Find transaction by orderId or expenseId
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          ...(orderId ? [{ razorpayOrderId: orderId }] : []),
          ...(expenseId ? [{ expenseId }] : []),
        ],
      },
      include: {
        expense: {
          include: {
            employeeProfile: { include: { user: true } },
          },
        },
      },
    });

    if (!transaction) {
      // If transaction not found in PaymentTransaction, try legacy Transaction model
      const legacyTx = await prisma.transaction.findFirst({
        where: {
          OR: [
            ...(orderId ? [{ razorpayOrderId: orderId }] : []),
            ...(expenseId ? [{ expenseId }] : []),
          ],
        },
        include: {
          expense: { include: { employeeProfile: { include: { user: true } } } },
        },
      });

      if (legacyTx) {
        await prisma.transaction.update({
          where: { id: legacyTx.id },
          data: { razorpayPaymentId: paymentId, status: "SUCCESS" },
        });
        await prisma.expense.update({
          where: { id: legacyTx.expenseId },
          data: {
            status: "PAID",
            paymentStatus: "PAID",
            decisionReason: `Settled via Razorpay webhook (${event}).`,
          },
        });
        return {
          success: true,
          event,
          expenseId: legacyTx.expenseId,
          message: "Legacy transaction marked SUCCESS via webhook.",
        };
      }

      return {
        success: false,
        event,
        message: "No matching payment transaction found for webhook event.",
      };
    }

    // Idempotency: If already SUCCESS, return without state corruption
    if (transaction.status === "SUCCESS") {
      return {
        success: true,
        event,
        transactionId: transaction.id,
        expenseId: transaction.expenseId,
        message: "Webhook event already processed (idempotent skip).",
        alreadyProcessed: true,
      };
    }

    // Update PaymentTransaction -> SUCCESS
    const updatedTx = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        razorpayPaymentId: paymentId,
        status: "SUCCESS",
        completedAt: new Date(),
      },
    });

    // Update Expense -> PAID
    await prisma.expense.update({
      where: { id: transaction.expenseId },
      data: {
        status: "PAID",
        paymentStatus: "PAID",
        decisionReason: `Settlement confirmed via Razorpay webhook (${event}: ${paymentId}).`,
      },
    });

    // Write Audit Log
    await logAuditEvent({
      companyId: transaction.companyId,
      actorId: null,
      action: "PAYMENT_COMPLETED",
      entityType: "EXPENSE",
      entityId: transaction.expenseId,
      metadata: {
        event,
        paymentId,
        orderId,
        amount: transaction.amount,
        settledAt: new Date().toISOString(),
      },
    });

    // Notify Submitting Employee
    if (transaction.expense.employeeProfile?.userId) {
      await prisma.notification.create({
        data: {
          userId: transaction.expense.employeeProfile.userId,
          title: "Payment Confirmed via Razorpay",
          message: `Your expense ${transaction.expense.expenseNumber} of ₹${transaction.amount.toLocaleString("en-IN")} was paid successfully (Payment Ref: ${paymentId}).`,
          type: "PAYMENT_SUCCESS",
          link: `/dashboard/expenses/${transaction.expenseId}`,
        },
      });
    }

    return {
      success: true,
      event,
      transactionId: updatedTx.id,
      expenseId: transaction.expenseId,
      message: `Payment successfully captured and confirmed.`,
    };
  }

  // 4. Process Payment Failure Event
  if (event === "payment.failed") {
    const paymentEntity = payload.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const errorDesc = paymentEntity?.error_description || "Payment failed at gateway";

    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          ...(orderId ? [{ razorpayOrderId: orderId }] : []),
        ],
      },
    });

    if (transaction) {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "FAILED",
          failureReason: errorDesc,
          failureCode: paymentEntity?.error_code || "PAYMENT_ERROR",
        },
      });

      // Update Expense -> PAYMENT_FAILED (distinct from REJECTED)
      await prisma.expense.update({
        where: { id: transaction.expenseId },
        data: {
          status: "PAYMENT_FAILED",
          paymentStatus: "FAILED",
          decisionReason: `Razorpay payment attempt failed: ${errorDesc}`,
        },
      });

      await logAuditEvent({
        companyId: transaction.companyId,
        actorId: null,
        action: "PAYMENT_FAILED",
        entityType: "EXPENSE",
        entityId: transaction.expenseId,
        metadata: {
          event,
          errorDesc,
          orderId,
        },
      });

      return {
        success: true,
        event,
        transactionId: transaction.id,
        expenseId: transaction.expenseId,
        message: `Payment failure recorded: ${errorDesc}`,
      };
    }
  }

  return {
    success: true,
    event,
    message: `Webhook event ${event} acknowledged.`,
  };
}
