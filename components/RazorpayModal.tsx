"use client";

import React, { useState } from "react";
import { X, CreditCard, ShieldCheck, CheckCircle2, Loader2, Lock, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { ExpenseData } from "@/types";

interface RazorpayModalProps {
  isOpen: boolean;
  expense: ExpenseData | null;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export function RazorpayModal({
  isOpen,
  expense,
  onClose,
  onPaymentSuccess,
}: RazorpayModalProps) {
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi" | "netbanking">("card");

  if (!isOpen || !expense) return null;

  const handlePayNow = async () => {
    setProcessing(true);
    try {
      // 1. Create order
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseId: expense.id }),
      });
      const orderData = await orderRes.json();

      const generatedPaymentId = `pay_SG_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setPaymentId(generatedPaymentId);

      // 2. Verify payment
      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: orderData.orderId,
          razorpay_payment_id: generatedPaymentId,
          razorpay_signature: "spendguard_test_signature",
          expenseId: expense.id,
        }),
      });

      if (verifyRes.ok) {
        setSuccess(true);
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
        setTimeout(() => {
          onPaymentSuccess();
          onClose();
        }, 2200);
      }
    } catch (err) {
      console.error("Payment failure:", err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white overflow-hidden">
        {/* Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-emerald-400 to-cyan-500" />

        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Razorpay Payment Gateway</h3>
              <p className="text-[11px] text-slate-400">Secure Corporate Expense Settlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-white">Payment Settled Successfully!</h4>
            <p className="text-xs text-slate-400">
              ₹{expense.amount.toLocaleString("en-IN")} transferred to {expense.merchantName}.
            </p>
            <p className="text-[11px] font-mono text-emerald-400/80 bg-slate-950 p-2 rounded-lg border border-slate-800">
              Payment ID: {paymentId}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Invoice Summary Card */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Merchant / Beneficiary:</span>
                <span className="font-semibold text-white">{expense.merchantName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Expense Ref:</span>
                <span className="font-mono text-slate-300">{expense.expenseNumber}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Employee:</span>
                <span className="text-slate-300">{expense.employee?.name || "Employee"}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Total Settlement:</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  ₹{expense.amount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Select Settlement Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "card", label: "Corporate Card" },
                  { id: "upi", label: "UPI / QR" },
                  { id: "netbanking", label: "Direct Payout" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      paymentMethod === m.id
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                        : "bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Security Badge */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>256-bit encrypted Razorpay financial transaction tunnel</span>
            </div>

            {/* Pay Button */}
            <button
              onClick={handlePayNow}
              disabled={processing}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-indigo-600 to-indigo-500 hover:from-emerald-500 hover:to-indigo-400 font-bold text-xs text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Razorpay Settlement...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirm & Settle ₹{expense.amount.toLocaleString("en-IN")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
