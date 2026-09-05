"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  BarChart3,
  PieChart,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  Filter,
  Calendar,
  Layers,
  FileCheck2,
  CreditCard,
  Briefcase,
  AlertCircle,
  HelpCircle,
  Eye,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

type TimePeriod =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_month"
  | "previous_month";

interface InsightItem {
  id: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  explanation: string;
  evidence: string[];
  recommendedAction: string;
  actionLink?: string;
  departmentId?: string;
  status?: string;
}

export default function DashboardPage() {
  const { user, isFinanceAdmin, isManager, isEmployee } = useAuth();

  const [period, setPeriod] = useState<TimePeriod>("last_30_days");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [departments, setDepartments] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [insightSummary, setInsightSummary] = useState<string>("");
  const [isDemoInsight, setIsDemoInsight] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingInsights, setGeneratingInsights] = useState<boolean>(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  // 1. Fetch dashboard data
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/dashboard", window.location.origin);
      url.searchParams.set("period", period);
      if (departmentId) url.searchParams.set("departmentId", departmentId);

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        setDashboardData(json);
        setDepartments(json.departmentSpending || []);

        if (json.insights && json.insights.length > 0) {
          setInsights(json.insights);
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [period, departmentId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // 2. Generate or refresh AI insights
  const handleGenerateInsights = async () => {
    setGeneratingInsights(true);
    try {
      const res = await fetch("/api/finance/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, departmentId: departmentId || undefined }),
      });

      if (res.ok) {
        const json = await res.json();
        setInsights(json.insights || []);
        setInsightSummary(json.summary || "");
        setIsDemoInsight(json.isDemo || false);
      }
    } catch (err) {
      console.error("AI Insight generation error:", err);
    } finally {
      setGeneratingInsights(false);
    }
  };

  // 3. Dismiss insight
  const handleDismissInsight = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/insights/${id}/dismiss`, { method: "POST" });
      if (res.ok) {
        setInsights((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error("Dismiss insight error:", err);
    }
  };

  // 4. Resolve insight
  const handleResolveInsight = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/insights/${id}/resolve`, { method: "POST" });
      if (res.ok) {
        setInsights((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error("Resolve insight error:", err);
    }
  };

  const toggleEvidence = (id: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Extract analytics shortcuts
  const analytics = dashboardData?.analytics;
  const metrics = dashboardData?.metrics;
  const comparison = dashboardData?.comparison;
  const forecast = dashboardData?.budgetForecast;
  const impact = dashboardData?.impact;
  const categorySpending = dashboardData?.categorySpending || [];
  const topMerchants = dashboardData?.topMerchants || [];
  const spendingTrends = dashboardData?.spendingTrends || [];
  const employees = analytics?.employees || [];
  const recentExpenses = dashboardData?.recentExpenses || [];

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* ========================================================================= */}
      {/* 1. HEADER & CONTROLS */}
      {/* ========================================================================= */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Finance Controller Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {isEmployee ? "My Expense Dashboard" : "Financial Control Center"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-2 flex-wrap">
              <span>Company: <strong className="text-indigo-300">{user?.company?.name || "Acme Technologies"}</strong></span>
              <span>•</span>
              <span className="font-mono text-slate-400">Role: {user?.role}</span>
              {departmentId && (
                <>
                  <span>•</span>
                  <span className="text-amber-300">
                    Dept: {departments.find((d) => d.id === departmentId)?.name || "Filtered"}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Filters & Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Period Selector */}
            <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as TimePeriod)}
                className="bg-transparent text-slate-200 font-medium py-1 px-2 focus:outline-none cursor-pointer"
              >
                <option value="today" className="bg-slate-900 text-white">Today</option>
                <option value="last_7_days" className="bg-slate-900 text-white">Last 7 Days</option>
                <option value="last_30_days" className="bg-slate-900 text-white">Last 30 Days (Default)</option>
                <option value="last_90_days" className="bg-slate-900 text-white">Last 90 Days</option>
                <option value="this_month" className="bg-slate-900 text-white">This Month</option>
                <option value="previous_month" className="bg-slate-900 text-white">Previous Month</option>
              </select>
            </div>

            {/* Department Filter (For Finance Admin) */}
            {isFinanceAdmin && departments.length > 0 && (
              <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="bg-transparent text-slate-200 font-medium py-1 px-2 focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-white">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                      {d.name} ({d.code || "DEPT"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Generate / Refresh AI Insights Button */}
            {!isEmployee && (
              <button
                onClick={handleGenerateInsights}
                disabled={generatingInsights}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generatingInsights ? "animate-spin" : ""}`} />
                <span>{generatingInsights ? "Analyzing Finances..." : "Analyze & Refresh Insights"}</span>
              </button>
            )}

            {isEmployee && (
              <Link
                href="/dashboard/expenses/new"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5"
              >
                <span>+ Submit Expense</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE KPI CARDS (Real Deterministic Numbers) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Spend */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Realized Spend</span>
            <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
            ₹{(analytics?.metrics?.totalSpend || metrics?.paidSpend || 0).toLocaleString("en-IN")}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px]">
            {comparison?.isIncrease ? (
              <span className="text-rose-400 flex items-center font-medium">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                +{comparison?.changePercent}%
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center font-medium">
                <TrendingDown className="w-3 h-3 mr-0.5" />
                {comparison?.changePercent}%
              </span>
            )}
            <span className="text-slate-500 truncate">vs prev. period</span>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Pending Approval</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-amber-400 tracking-tight">
            ₹{(analytics?.metrics?.pendingApprovalSpend || 0).toLocaleString("en-IN")}
          </p>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{analytics?.metrics?.pendingApprovalCount || metrics?.pendingApprovalsCount || 0} requests queued</span>
            {!isEmployee && (
              <Link href="/dashboard/approvals" className="text-indigo-400 hover:text-indigo-300 font-semibold">
                Review &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Budget Remaining */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Budget Remaining</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight">
            ₹{(analytics?.metrics?.remainingBudget || metrics?.remainingBudget || 0).toLocaleString("en-IN")}
          </p>
          <div className="mt-2 text-[11px] flex items-center justify-between">
            <span className="text-slate-400">
              {analytics?.metrics?.utilizationRate || 0}% used
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${analytics?.metrics?.budgetHealth?.badgeClass || "text-emerald-400"}`}>
              {analytics?.metrics?.budgetHealth?.status || "HEALTHY"}
            </span>
          </div>
        </div>

        {/* Risky Spend Flagged */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Risky Spend Flagged</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-rose-400 tracking-tight">
            ₹{(analytics?.metrics?.riskySpend || 0).toLocaleString("en-IN")}
          </p>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{analytics?.metrics?.riskyCount || metrics?.highRiskCount || 0} high-risk items</span>
            <span className="text-rose-500 font-medium">Flagged by AI</span>
          </div>
        </div>

        {/* Spend Blocked (SpendGuard Impact) */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Spend Blocked</span>
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-cyan-400 tracking-tight">
            ₹{(analytics?.metrics?.blockedSpend || impact?.spendBlocked || 0).toLocaleString("en-IN")}
          </p>
          <div className="mt-2 text-[11px] text-cyan-400/80 font-medium truncate">
            {analytics?.metrics?.blockedCount || metrics?.blockedCount || 0} violations prevented
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PROACTIVE AI FINANCE CONTROLLER INSIGHTS SECTION */}
      {/* ========================================================================= */}
      {!isEmployee && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>AI Finance Controller Insights</span>
                  {isDemoInsight && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Deterministic Demo Engine
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">
                  Proactive spending anomalies, budget run-rates, and verified recommendations.
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Evidence-Backed & Zero Hallucination</span>
            </div>
          </div>

          {/* Controller Executive Summary */}
          {insightSummary && (
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-slate-200 text-xs sm:text-sm leading-relaxed flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-semibold mb-0.5">Finance Controller Executive Summary:</strong>
                {insightSummary}
              </div>
            </div>
          )}

          {/* Proactive Insight Cards List */}
          {insights.length === 0 ? (
            <div className="py-8 text-center rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">No active financial risks or anomalies</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                All spending velocities, department budgets, and receipt verifications are operating within normal parameters for this period.
              </p>
              <button
                onClick={handleGenerateInsights}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white border border-slate-700 font-semibold"
              >
                Run AI Controller Analysis
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insights.slice(0, 5).map((insight) => {
                const isCrit = insight.severity === "CRITICAL";
                const isWarn = insight.severity === "WARNING";
                const cardBorder = isCrit
                  ? "border-rose-500/30 hover:border-rose-500/50 bg-rose-950/10"
                  : isWarn
                  ? "border-amber-500/30 hover:border-amber-500/50 bg-amber-950/10"
                  : "border-indigo-500/30 hover:border-indigo-500/50 bg-indigo-950/10";

                const badgeStyle = isCrit
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : isWarn
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";

                const isExpanded = expandedEvidence[insight.id] || false;

                return (
                  <div
                    key={insight.id}
                    className={`p-5 rounded-2xl border ${cardBorder} flex flex-col justify-between space-y-4 transition-all shadow-sm`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${badgeStyle}`}>
                          {insight.severity}
                        </span>
                        {isFinanceAdmin && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <button
                              onClick={() => handleResolveInsight(insight.id)}
                              title="Resolve insight"
                              className="p-1 hover:text-emerald-400 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDismissInsight(insight.id)}
                              title="Dismiss insight"
                              className="p-1 hover:text-rose-400 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
                        {insight.title}
                      </h3>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {insight.explanation}
                      </p>

                      {/* Evidence Details ("Why am I seeing this?") */}
                      {insight.evidence && insight.evidence.length > 0 && (
                        <div className="pt-2">
                          <button
                            onClick={() => toggleEvidence(insight.id)}
                            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                          >
                            <HelpCircle className="w-3 h-3" />
                            <span>{isExpanded ? "Hide Fact Evidence" : "Why am I seeing this?"}</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-[11px] text-slate-300 font-mono">
                              {insight.evidence.map((fact, idx) => (
                                <div key={idx} className="flex items-start gap-1.5">
                                  <span className="text-indigo-400">•</span>
                                  <span>{fact}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Recommendation & Button */}
                    <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                      <div className="text-[11px] text-slate-400">
                        <strong className="text-slate-300 block font-semibold">Recommended Action:</strong>
                        <span>{insight.recommendedAction}</span>
                      </div>

                      {insight.actionLink && (
                        <Link
                          href={insight.actionLink}
                          className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <span>Execute Action</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SPENDING TREND & BUDGET HEALTH FORECAST */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending Trend Visualizer (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>Spending Trend & Velocity</span>
              </h2>
              <p className="text-xs text-slate-400">
                Aggregated daily/weekly realized spend over the selected period
              </p>
            </div>
            <div className="text-xs font-mono font-semibold text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
              {comparison?.formattedChange || "Tracking velocity"}
            </div>
          </div>

          {/* SVG Spending Trend Visualizer */}
          {spendingTrends.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              No transactions recorded in the selected period.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-44 flex items-end gap-2 pt-6 pb-2 border-b border-slate-800 overflow-x-auto">
                {(() => {
                  const maxSpend = Math.max(...spendingTrends.map((t: any) => t.spend), 1);
                  return spendingTrends.map((point: any, idx: number) => {
                    const heightPercent = Math.max(8, (point.spend / maxSpend) * 100);
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center gap-1 min-w-[28px] group relative"
                      >
                        {/* Tooltip */}
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-slate-700 px-2 py-1 rounded text-[10px] font-mono text-white whitespace-nowrap pointer-events-none z-20 shadow-lg">
                          ₹{point.spend.toLocaleString("en-IN")} ({point.transactionCount} txn)
                        </div>

                        {/* Bar */}
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-md transition-all ${
                            point.spend > 0
                              ? "bg-gradient-to-t from-indigo-600 to-cyan-400 group-hover:from-indigo-500 group-hover:to-cyan-300"
                              : "bg-slate-800"
                          }`}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>{spendingTrends[0]?.label || "Start"}</span>
                <span>{spendingTrends[Math.floor(spendingTrends.length / 2)]?.label || "Mid"}</span>
                <span>{spendingTrends[spendingTrends.length - 1]?.label || "End"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Budget Health & Forecast (1 Col) */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-400" />
              <span>Budget Health & Forecast</span>
            </h2>

            {/* Run-Rate Forecast Card */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-400">Monthly Run-Rate Forecast</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${forecast?.isOverBudget ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                  {forecast?.isOverBudget ? "OVER BUDGET RISK" : "ON TRACK"}
                </span>
              </div>

              <p className="text-lg font-black font-mono text-white">
                ₹{(forecast?.projectedMonthlySpend || 0).toLocaleString("en-IN")}
                <span className="text-xs text-slate-400 font-normal ml-1">projected</span>
              </p>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {forecast?.message || "Analyzing spending run-rate..."}
              </p>
            </div>

            {/* Department Utilization Snapshot */}
            <div className="space-y-2.5 pt-2">
              <span className="text-xs font-semibold text-slate-400 block">Department Health</span>
              {departments.slice(0, 4).map((d) => (
                <div key={d.id} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-medium text-slate-300">{d.name}</span>
                    <span className="font-mono text-slate-400">
                      ₹{d.spent.toLocaleString("en-IN")} / ₹{d.monthlyBudget.toLocaleString("en-IN")} ({d.utilization}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, d.utilization)}%` }}
                      className={`h-full rounded-full ${
                        d.utilization >= 90
                          ? "bg-rose-500"
                          : d.utilization >= 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/dashboard/departments"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-between pt-3 border-t border-slate-800"
          >
            <span>Manage All Department Budgets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. SPEND BREAKDOWN: CATEGORIES & TOP MERCHANTS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Category */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Spend by Category</span>
              </h2>
              <p className="text-xs text-slate-400">Distribution across spend types</p>
            </div>
            <span className="text-xs text-slate-500 font-mono">{categorySpending.length} categories</span>
          </div>

          {categorySpending.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No category spending recorded yet.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {categorySpending.slice(0, 6).map((c: any, i: number) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{c.category}</span>
                    <span className="font-mono text-slate-400">
                      ₹{c.amount.toLocaleString("en-IN")} ({c.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${c.percentage}%` }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Merchants Table */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-400" />
                <span>Top Merchants</span>
              </h2>
              <p className="text-xs text-slate-400">High-volume spending vendors</p>
            </div>
            <span className="text-xs text-slate-500 font-mono">{topMerchants.length} vendors</span>
          </div>

          {topMerchants.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No merchant transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium pb-2">
                    <th className="pb-2">Merchant</th>
                    <th className="pb-2 text-right">Transactions</th>
                    <th className="pb-2 text-right">Total Spend</th>
                    <th className="pb-2 text-right">Risk Signals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {topMerchants.slice(0, 5).map((m: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 font-sans font-semibold text-slate-200">{m.merchantName}</td>
                      <td className="py-2.5 text-right text-slate-400">{m.transactionCount}</td>
                      <td className="py-2.5 text-right font-bold text-white">₹{m.totalSpend.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 text-right font-sans">
                        {m.riskFlags && m.riskFlags.length > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {m.riskFlags[0]}
                          </span>
                        ) : (
                          <span className="text-emerald-400 text-[10px] font-bold">NORMAL</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. SPENDGUARD IMPACT & CONTROL EFFECTIVENESS */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-indigo-500/20 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                SpendGuard Control Effectiveness
              </h2>
              <p className="text-xs text-slate-400">
                Measurable value delivered across policy enforcement, risk screening, and verified disbursements.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            Enterprise Governance
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Spend Reviewed</span>
            <p className="text-base font-bold font-mono text-white mt-1">
              ₹{(impact?.spendReviewed || 0).toLocaleString("en-IN")}
            </p>
            <span className="text-[10px] text-slate-500">100% Policy Checked</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Spend Blocked</span>
            <p className="text-base font-bold font-mono text-cyan-400 mt-1">
              ₹{(impact?.spendBlocked || 0).toLocaleString("en-IN")}
            </p>
            <span className="text-[10px] text-cyan-500/80">Prevented Non-Compliance</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Sent for Review</span>
            <p className="text-base font-bold font-mono text-amber-400 mt-1">
              ₹{(impact?.spendSentForReview || 0).toLocaleString("en-IN")}
            </p>
            <span className="text-[10px] text-amber-500/80">Manager Approval Route</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Receipt Mismatches</span>
            <p className="text-base font-bold font-mono text-rose-400 mt-1">
              {impact?.receiptIssuesCount || 0}
            </p>
            <span className="text-[10px] text-rose-500/80">Flagged via Document OCR</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Paid via Razorpay</span>
            <p className="text-base font-bold font-mono text-emerald-400 mt-1">
              ₹{(impact?.successfulDisbursements || 0).toLocaleString("en-IN")}
            </p>
            <span className="text-[10px] text-emerald-500/80">HMAC-SHA256 Verified</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. EMPLOYEE SPENDING TABLE (Finance Admin Only) */}
      {/* ========================================================================= */}
      {isFinanceAdmin && employees.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Employee Spending Overview</span>
              </h2>
              <p className="text-xs text-slate-400">Department assignments and transaction velocities</p>
            </div>
            <Link href="/dashboard/employees" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
              Manage Staff &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium pb-2">
                  <th className="pb-2">Employee</th>
                  <th className="pb-2">Department</th>
                  <th className="pb-2 text-right">Transactions</th>
                  <th className="pb-2 text-right">Total Spent</th>
                  <th className="pb-2 text-right">High Risk</th>
                  <th className="pb-2 text-right">Policy Blocks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {employees.slice(0, 6).map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 font-sans font-semibold text-slate-200">
                      {emp.name}
                      <span className="block text-[10px] text-slate-500 font-mono">{emp.email}</span>
                    </td>
                    <td className="py-2.5 font-sans text-slate-400">{emp.departmentName}</td>
                    <td className="py-2.5 text-right text-slate-300">{emp.transactionCount}</td>
                    <td className="py-2.5 text-right font-bold text-indigo-300">₹{emp.spent.toLocaleString("en-IN")}</td>
                    <td className="py-2.5 text-right font-sans">
                      {emp.highRiskCount > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {emp.highRiskCount} flagged
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">0</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-sans">
                      {emp.policyBlocks > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {emp.policyBlocks} blocked
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. RECENT FINANCIAL ACTIVITY TIMELINE */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Recent Financial Activity</span>
          </h2>
          <Link href="/dashboard/expenses" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
            View All Expenses &rarr;
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No recent activity recorded.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 font-sans">
            {recentExpenses.slice(0, 6).map((exp: any) => {
              const isPaid = exp.status === "PAID";
              const isPending = exp.status === "PENDING_APPROVAL";
              const isBlocked = exp.status === "BLOCKED";

              return (
                <div key={exp.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isPaid ? "bg-emerald-500/10 text-emerald-400" : isBlocked ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {isPaid ? <CreditCard className="w-4 h-4" /> : isBlocked ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white">{exp.merchantName}</span>
                        <span className="text-[10px] font-mono text-slate-500">{exp.expenseNumber}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {exp.employeeProfile?.user?.name || "Employee"} • {exp.category} • {new Date(exp.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold font-mono text-white">
                      ₹{exp.amount.toLocaleString("en-IN")}
                    </p>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-0.5 ${
                      isPaid
                        ? "bg-emerald-500/10 text-emerald-400"
                        : isBlocked
                        ? "bg-rose-500/10 text-rose-400"
                        : isPending
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-slate-800 text-slate-300"
                    }`}>
                      {exp.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
