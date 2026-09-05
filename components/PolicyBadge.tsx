import React from "react";
import { CheckCircle2, AlertCircle, XCircle, Clock, Check, Ban, CreditCard } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const normalized = status.toUpperCase();

  const configs: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    AUTO_APPROVED: {
      label: "Auto-Approved",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      icon: CheckCircle2,
    },
    APPROVED: {
      label: "Approved",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      icon: Check,
    },
    READY_FOR_PAYMENT: {
      label: "Ready for Payment",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      icon: CreditCard,
    },
    PAID: {
      label: "Settled (Razorpay)",
      bg: "bg-cyan-500/10",
      text: "text-cyan-400",
      border: "border-cyan-500/30",
      icon: CheckCircle2,
    },
    PENDING_APPROVAL: {
      label: "Approval Required",
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
      icon: Clock,
    },
    PROCESSING: {
      label: "Processing",
      bg: "bg-indigo-500/10",
      text: "text-indigo-400",
      border: "border-indigo-500/30",
      icon: Clock,
    },
    BLOCKED: {
      label: "Policy Blocked",
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/30",
      icon: Ban,
    },
    REJECTED: {
      label: "Rejected",
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/30",
      icon: XCircle,
    },
    PAYMENT_FAILED: {
      label: "Payment Failed",
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/30",
      icon: AlertCircle,
    },
  };

  const config = configs[normalized] || {
    label: status,
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/30",
    icon: AlertCircle,
  };

  const Icon = config.icon;
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${padding} ${config.bg} ${config.text} ${config.border}`}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {config.label}
    </span>
  );
}
