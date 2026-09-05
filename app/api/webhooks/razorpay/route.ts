import { NextResponse } from "next/server";
import { handleRazorpayWebhook } from "@/lib/razorpay/webhook-handler";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";
    const isSimulation =
      request.headers.get("x-spendguard-simulation") === "true" ||
      request.headers.get("x-demo-mode") === "true";

    if (!rawBody) {
      return NextResponse.json({ error: "Empty webhook payload received." }, { status: 400 });
    }

    const result = await handleRazorpayWebhook(rawBody, signature, isSimulation);

    return NextResponse.json({
      received: true,
      success: result.success,
      event: result.event,
      message: result.message,
      transactionId: result.transactionId,
      expenseId: result.expenseId,
      alreadyProcessed: result.alreadyProcessed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Razorpay Webhook API Error:", error);
    const message = error?.message || "Webhook processing error.";
    const isSignatureError = message.toLowerCase().includes("signature");

    return NextResponse.json(
      { error: message },
      { status: isSignatureError ? 401 : 500 }
    );
  }
}
