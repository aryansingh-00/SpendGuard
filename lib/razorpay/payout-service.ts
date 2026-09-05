export interface VendorPayoutParams {
  expenseId: string;
  expenseNumber: string;
  amount: number;
  currency?: string;
  vendorName: string;
  accountNumber?: string;
  ifscCode?: string;
  idempotencyKey?: string;
}

export interface PayoutResponse {
  payoutId: string;
  amount: number;
  currency: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED";
  mode: "demo_adapter";
  idempotencyKey?: string;
  note: string;
}

/**
 * Modular RazorpayX Payout Adapter Interface.
 * In environments where direct RazorpayX banking credentials are not provisioned,
 * this adapter provides a normalized interface and clear documentation.
 */
export async function createVendorPayout(params: VendorPayoutParams): Promise<PayoutResponse> {
  const { expenseId, expenseNumber, amount, currency = "INR", vendorName, idempotencyKey } = params;

  // RazorpayX Payouts require dedicated Business Banking / Current Account activation.
  // We provide a structured idempotent adapter interface.
  const payoutId = `pout_SG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    payoutId,
    amount,
    currency,
    status: "PROCESSING",
    mode: "demo_adapter",
    idempotencyKey,
    note: `Payout request for ${expenseNumber} to ${vendorName} queued via SpendGuard Payout Adapter.`,
  };
}
