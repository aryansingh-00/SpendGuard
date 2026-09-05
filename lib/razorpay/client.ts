import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID?.trim();
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "spendguard_webhook_secret_xyz456";

// Determine if we are in live/test credentials mode or mock demo mode
export const isRazorpayConfigured = Boolean(keyId && keySecret && !keyId.includes("rzp_test_placeholder"));

let razorpayInstance: Razorpay | null = null;

/**
 * Server-only Razorpay SDK client.
 * Strictly isolates keys server-side.
 */
export function getRazorpayClient(): Razorpay | null {
  if (!isRazorpayConfigured) {
    return null;
  }

  if (!razorpayInstance && keyId && keySecret) {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
}

export function getRazorpayKeyId(): string {
  return keyId || "rzp_test_spendguard_demo";
}

export function getWebhookSecret(): string {
  return webhookSecret;
}
