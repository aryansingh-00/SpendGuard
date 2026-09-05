"use client";

import React, { useState } from "react";
import {
  Settings,
  CreditCard,
  Webhook,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  Server,
  ShieldCheck,
} from "lucide-react";
import confetti from "canvas-confetti";

export default function SettingsPage() {
  const [selectedEvent, setSelectedEvent] = useState("payment.captured");
  const [targetOrderId, setTargetOrderId] = useState("order_SG_mkt_991823");
  const [simulating, setSimulating] = useState(false);
  const [simLog, setSimLog] = useState<string | null>(null);

  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSimulateWebhook = async () => {
    setSimulating(true);
    setSimLog(null);

    const payload = {
      event: selectedEvent,
      payload: {
        payment: {
          entity: {
            id: `pay_sim_${Date.now()}`,
            order_id: targetOrderId,
            amount: 1200000,
            status: selectedEvent === "payment.captured" ? "captured" : "failed",
            error_description: selectedEvent === "payment.failed" ? "Bank server timed out" : null,
          },
        },
      },
    };

    try {
      const res = await fetch("/api/webhooks/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-spendguard-simulation": "true",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setSimLog(`HTTP ${res.status}: ${JSON.stringify(data, null, 2)}`);
      if (res.ok) {
        confetti({ particleCount: 50, spread: 60 });
      }
    } catch (err: any) {
      setSimLog(`Error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Settings & Razorpay Webhook Simulator
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Test Razorpay cryptographic webhooks, verify environment variables, and manage demo data.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Razorpay Configuration Status */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Razorpay Gateway Configuration</h3>
              <p className="text-[11px] text-slate-400">Server-side credentials & Webhook receiver</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-mono">RAZORPAY_KEY_ID:</span>
              <span className="font-mono text-emerald-400 font-semibold">rzp_test_spendguard123</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-mono">RAZORPAY_KEY_SECRET:</span>
              <span className="font-mono text-slate-400">••••••••••••••••</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-mono">Webhook Endpoint:</span>
              <span className="font-mono text-indigo-400 font-semibold">/api/webhooks/razorpay</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-mono">Signature Verification:</span>
              <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> HMAC-SHA256
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Strict server-side isolation: Zero credentials exposed to frontend.</span>
          </div>
        </div>

        {/* Interactive Webhook Simulator */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/30 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Webhook className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Interactive Webhook Simulator</h3>
                <p className="text-[11px] text-slate-400">Trigger live test webhooks without ngrok tunnels</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
              Demo Tool
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Select Webhook Event Type
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
              >
                <option value="payment.captured">payment.captured (Payment Successful)</option>
                <option value="order.paid">order.paid (Order Settlement Succeeded)</option>
                <option value="payment.failed">payment.failed (Payment Declined)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Target Order / Transaction ID
              </label>
              <input
                type="text"
                value={targetOrderId}
                onChange={(e) => setTargetOrderId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>

            <button
              onClick={handleSimulateWebhook}
              disabled={simulating}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-50 transition-all"
            >
              {simulating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching Webhook...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Simulate Webhook Dispatch</span>
                </>
              )}
            </button>

            {simLog && (
              <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-36">
                <pre>{simLog}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
