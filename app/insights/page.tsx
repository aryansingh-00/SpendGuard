"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BrainCircuit,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Lightbulb,
  Zap,
} from "lucide-react";
import { AIInsightItem } from "@/types";

export default function InsightsPage() {
  const [insights, setInsights] = useState<AIInsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuditing, setIsAuditing] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/insights");
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
      }
    } catch (err) {
      console.error("Fetch insights error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const triggerLiveAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      fetchInsights();
      setIsAuditing(false);
    }, 1200);
  };

  const getStyle = (type: string) => {
    switch (type) {
      case "alert":
        return {
          bg: "bg-rose-950/20 border-rose-500/30",
          badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
          icon: ShieldAlert,
          iconColor: "text-rose-400",
        };
      case "warning":
        return {
          bg: "bg-amber-950/20 border-amber-500/30",
          badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
          icon: AlertTriangle,
          iconColor: "text-amber-400",
        };
      case "success":
        return {
          bg: "bg-emerald-950/20 border-emerald-500/30",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          icon: CheckCircle2,
          iconColor: "text-emerald-400",
        };
      default:
        return {
          bg: "bg-indigo-950/20 border-indigo-500/30",
          badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
          icon: Lightbulb,
          iconColor: "text-indigo-400",
        };
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              AI Finance Insights & Anomaly Detection
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time intelligence computed directly from active company spending trends, velocity, and policy patterns.
          </p>
        </div>

        <button
          onClick={triggerLiveAudit}
          disabled={isAuditing}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-xs font-bold text-white shadow-lg shadow-purple-500/25 flex items-center gap-2 self-start sm:self-auto disabled:opacity-50 transition-all"
        >
          <Zap className={`w-4 h-4 ${isAuditing ? "animate-spin" : ""}`} />
          <span>{isAuditing ? "Auditing Database..." : "Run AI Spend Audit"}</span>
        </button>
      </div>

      {/* Hero AI Controller Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/90 via-slate-900 to-purple-950/90 border border-indigo-500/30 space-y-3">
        <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Autonomous AI Financial Controller</span>
        </div>
        <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
          SpendGuard AI analyzes 100% of transactions across 4 departments, cross-referencing merchant baselines, duplicate hashes, and velocity drift.
        </p>
        <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Policy Compliance Guard: Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span>Duplicate Invoice Detection: Enabled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>Velocity Drift Model: Operational</span>
          </div>
        </div>
      </div>

      {/* Dynamic Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            <span>Generating real-time financial insights...</span>
          </div>
        ) : (
          insights.map((item) => {
            const style = getStyle(item.type);
            const Icon = style.icon;

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border ${style.bg} flex flex-col justify-between space-y-4 hover:border-slate-600 transition-all shadow-md`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg bg-slate-900 border border-slate-800 ${style.iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-white">{item.title}</span>
                    </div>

                    {item.metric && (
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-mono font-bold ${style.badge}`}>
                        {item.metric}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                  <span className="text-slate-500 font-mono">{item.timestamp}</span>

                  {item.actionable && item.actionLink && (
                    <Link
                      href={item.actionLink}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <span>{item.actionLabel || "Take action"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
