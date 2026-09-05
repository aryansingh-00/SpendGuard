import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createRazorpayOrder } from "@/lib/razorpay";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { expenseId } = body;

    if (!expenseId) {
      return NextResponse.json({ error: "Expense ID is required." }, { status: 400 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        employeeProfile: { include: { user: true } },
        department: true,
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    const order = await createRazorpayOrder({
      amount: expense.amount,
      currency: expense.currency,
      receiptId: expense.expenseNumber,
      notes: {
        expenseId: expense.id,
        merchant: expense.merchantName,
        category: expense.category,
      },
    });

    // Create or link transaction
    await prisma.transaction.create({
      data: {
        expenseId: expense.id,
        amount: expense.amount,
        currency: expense.currency,
        paymentMethod: "RAZORPAY",
        razorpayOrderId: order.id,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_spendguard123",
      expense,
    });
  } catch (error) {
    console.error("Create Payment Order Error:", error);
    return NextResponse.json(
      { error: "Failed to create Razorpay payment order." },
      { status: 500 }
    );
  }
}
