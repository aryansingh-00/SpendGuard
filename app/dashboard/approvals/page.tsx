"use client";

import React, { useState, useEffect } from "react";
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Receipt,
  Building2,
  User,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  BrainCircuit,
  Clock,
  ChevronRight,
  X,
  AlertCircle,
  TrendingUp,
  CreditCard,
  RefreshCw,
  FileCheck,
  ExternalLink,
  FileText,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/lib/context/AuthContext";

export default function ApprovalCenterPage() {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "FINANCE_ADMIN";

  const [approvals, setApprovals] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    pendingAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filters state
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer / Detail Modal state
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approvalDetail, setApprovalDetail] = useState<any | null>(null);

  // Rejection Modal state
  const [rejectingExpenseId, setRejectingExpenseId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (riskFilter !== "ALL") params.set("riskLevel", riskFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/approvals?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load approvals:", err);
      setFeedback({ type: "error", message: "Failed to load approval requests." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter, riskFilter, searchQuery]);

  const openDetailDrawer = async (approval: any) => {
    setSelectedApproval(approval);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/approvals/${approval.id}`);
      if (res.ok) {
        const data = await res.json();
        setApprovalDetail(data);
      } else {
        setApprovalDetail(null);
      }
    } catch (err) {
      console.error("Failed to load approval details:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedApproval(null);
    setApprovalDetail(null);
  };

  const handleApprove = async (expenseId: string) => {
    try {
      setActionLoading(expenseId);
      const res = await fetch(`/api/expenses/${expenseId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "Approved by reviewer." }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", message: data.error || "Approval failed." });
        return;
      }

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.8 },
      });

      setFeedback({
        type: "success",
        message: "Expense approved successfully and marked ready for payment.",
      });

      if (selectedApproval && selectedApproval.expense.id === expenseId) {
        closeDrawer();
      }

      await fetchApprovals();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Approve error:", err);
      setFeedback({ type: "error", message: "An unexpected error occurred." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingExpenseId) return;

    if (!rejectComment || rejectComment.trim().length < 5) {
      setRejectError("Please provide a rejection reason of at least 5 characters.");
      return;
    }

    try {
      setActionLoading(rejectingExpenseId);
      setRejectError(null);

      const res = await fetch(`/api/expenses/${rejectingExpenseId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: rejectComment.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRejectError(data.error || "Rejection failed.");
        return;
      }

      setFeedback({
        type: "success",
        message: "Expense request rejected with feedback recorded.",
      });

      setRejectingExpenseId(null);
      setRejectComment("");

      if (selectedApproval && selectedApproval.expense.id === rejectingExpenseId) {
        closeDrawer();
      }

      await fetchApprovals();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Reject error:", err);
      setRejectError("An unexpected error occurred while submitting rejection.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Manager Approval Center
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400">
            Review, verify, and authorize employee spending requests with AI risk insights and receipt intelligence.
          </p>
        </div>

        <button
          onClick={fetchApprovals}
          disabled={loading}
          className="self-start md:self-auto px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Global Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between animate-fade-in ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Approvals */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-white">{stats.pendingCount}</span>
            <span className="text-xs text-amber-400 font-medium">requests</span>
          </div>
          <p className="text-[11px] text-slate-500">Requires managerial authorization</p>
        </div>

        {/* Pending Amount */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Pending Volume</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              ₹{stats.pendingAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Total queued disbursements</p>
        </div>

        {/* Approved Count */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Approved &amp; Ready</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-white">{stats.approvedCount}</span>
            <span className="text-xs text-emerald-400 font-medium">authorized</span>
          </div>
          <p className="text-[11px] text-slate-500">Ready for payment settlement</p>
        </div>

        {/* Rejected Count */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Rejected</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-white">{stats.rejectedCount}</span>
            <span className="text-xs text-slate-500 font-medium">declined</span>
          </div>
          <p className="text-[11px] text-slate-500">Policy violations or mismatches</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {["ALL", "PENDING", "APPROVED", "REJECTED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === tab
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab === "ALL" ? "All Requests" : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Risk Level Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Risk:</span>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="LOW">Low Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="HIGH">High Risk</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search merchant, employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Approvals Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading approval requests...</p>
          </div>
        ) : approvals.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No Pending Approvals</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You&apos;re all caught up. No spending requests currently match the selected criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Employee</th>
                  <th className="py-3.5 px-4 font-bold">Merchant / Purpose</th>
                  <th className="py-3.5 px-4 font-bold">Category</th>
                  <th className="py-3.5 px-4 font-bold text-right">Amount</th>
                  <th className="py-3.5 px-4 font-bold text-center">AI Risk</th>
                  <th className="py-3.5 px-4 font-bold text-center">Receipt Verification</th>
                  <th className="py-3.5 px-4 font-bold text-center">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {approvals.map((app) => {
                  const exp = app.expense;
                  const ai = exp.aiAnalysis;
                  const riskLevel = ai?.riskLevel || "MEDIUM";
                  const isPending = app.status === "PENDING";
                  const ver = exp.verification;

                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                      onClick={() => openDetailDrawer(app)}
                    >
                      {/* Submitter */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {exp.employee.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-200 block">{exp.employee.name}</span>
                            <span className="text-[10px] text-slate-500">{exp.department?.name || "Dept"}</span>
                          </div>
                        </div>
                      </td>

                      {/* Merchant & Expense Number */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-white block group-hover:text-indigo-400 transition-colors">
                            {exp.merchantName}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 block truncate max-w-[200px]">
                            {exp.expenseNumber} • {exp.purpose}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-300">
                          {exp.category}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-sm">
                        ₹{exp.amount.toLocaleString("en-IN")}
                      </td>

                      {/* AI Risk */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            riskLevel === "LOW"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : riskLevel === "MEDIUM"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : riskLevel === "HIGH"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {riskLevel}
                        </span>
                      </td>

                      {/* Receipt Verification Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {ver ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              ver.status === "VERIFIED"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : ver.status === "REVIEW_REQUIRED"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            <FileCheck className="w-3 h-3" />
                            {ver.overallScore}/100 {ver.status === "VERIFIED" ? "✓" : "⚠"}
                          </span>
                        ) : exp.hasReceipt ? (
                          <span className="text-[10px] text-slate-400 font-mono">Uploaded</span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No receipt</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            app.status === "APPROVED"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : app.status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {isPending && isManagerOrAdmin ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setRejectingExpenseId(exp.id);
                                setRejectComment("");
                                setRejectError(null);
                              }}
                              disabled={actionLoading === exp.id}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-300 text-[11px] font-semibold border border-slate-700 transition-all disabled:opacity-40"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleApprove(exp.id)}
                              disabled={actionLoading === exp.id}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm flex items-center gap-1 transition-all disabled:opacity-40"
                            >
                              {actionLoading === exp.id ? "..." : "Approve"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openDetailDrawer(app)}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-all inline-flex items-center gap-1"
                          >
                            Details <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approval Detail Drawer / Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-y-auto flex flex-col text-white">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{selectedApproval.expense.merchantName}</span>
                    <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      {selectedApproval.expense.expenseNumber}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Submitted by {selectedApproval.expense.employee.name} ({selectedApproval.expense.department?.name} Dept)
                  </p>
                </div>
              </div>

              <button
                onClick={closeDrawer}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 flex-1">
              {detailLoading ? (
                <div className="py-16 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Loading comprehensive financial intelligence...</p>
                </div>
              ) : (
                <>
                  {/* Transaction Overview & Amount */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Claim Amount</span>
                      <div className="text-2xl font-black font-mono text-white">
                        ₹{selectedApproval.expense.amount.toLocaleString("en-IN")}
                      </div>
                      <span className="text-[10px] text-slate-400 block">{selectedApproval.expense.category}</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Submission Date</span>
                      <div className="text-sm font-semibold text-slate-200">
                        {new Date(selectedApproval.expense.expenseDate).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <span className="text-[10px] text-slate-400 block">Status: {selectedApproval.status}</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500">AI Risk Score</span>
                      <div className="text-2xl font-black font-mono text-indigo-400 flex items-center gap-2">
                        <span>{selectedApproval.expense.aiAnalysis?.riskScore ?? "—"}</span>
                        <span className="text-xs font-bold text-slate-400 font-sans">
                          ({selectedApproval.expense.aiAnalysis?.riskLevel || "MEDIUM"})
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">Contextual Risk</span>
                    </div>
                  </div>

                  {/* Business Justification */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Business Justification</span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedApproval.expense.purpose || "No justification provided."}
                    </p>
                  </div>

                  {/* Receipt Intelligence & Document Verification Card */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-emerald-400" />
                        Receipt Intelligence &amp; Claim Match
                      </h3>

                      {approvalDetail?.expense?.receipt && (
                        <a
                          href={`/api/expenses/${selectedApproval.expense.id}/receipts/${approvalDetail.expense.receipt.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> View Original Document
                        </a>
                      )}
                    </div>

                    {approvalDetail?.expense?.verification ? (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs p-3 rounded-lg bg-slate-900 border border-slate-800">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Verification Score</span>
                            <span className="font-mono font-bold text-white text-base">
                              {approvalDetail.expense.verification.overallScore} / 100
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Document Merchant</span>
                            <span className="font-semibold text-slate-200 truncate block">
                              {approvalDetail.expense.receiptAnalysis?.merchantName || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Document Total</span>
                            <span className="font-mono font-bold text-emerald-400 text-sm">
                              ₹{approvalDetail.expense.receiptAnalysis?.totalAmount?.toLocaleString("en-IN") || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Match Status</span>
                            <span
                              className={`font-bold ${
                                approvalDetail.expense.verification.status === "VERIFIED"
                                  ? "text-emerald-400"
                                  : "text-amber-400"
                              }`}
                            >
                              {approvalDetail.expense.verification.status}
                            </span>
                          </div>
                        </div>

                        {approvalDetail.expense.verification.mismatchReasons && (
                          <div className="space-y-1 text-xs">
                            {JSON.parse(approvalDetail.expense.verification.mismatchReasons || "[]").map((r: string, idx: number) => (
                              <p key={idx} className="text-amber-300/90 text-[11px] flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <span>{r}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : approvalDetail?.expense?.receipt ? (
                      <p className="text-xs text-slate-400">Document attached but verification analysis pending.</p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No receipt document attached to this expense claim.</p>
                    )}
                  </div>

                  {/* Real-time Budget Impact Breakdown */}
                  {approvalDetail?.budgetImpact && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                        Live Budget Impact Analysis
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Department Budget */}
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                          <span className="text-[11px] font-bold text-indigo-300">
                            {selectedApproval.expense.department?.name} Department Budget
                          </span>
                          <div className="space-y-1 text-xs font-mono">
                            <div className="flex justify-between text-slate-400">
                              <span>Monthly Envelope:</span>
                              <span className="text-white">
                                ₹{approvalDetail.budgetImpact.department.budget.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Spent To Date:</span>
                              <span className="text-white">
                                ₹{approvalDetail.budgetImpact.department.spent.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Available Remaining:</span>
                              <span className="text-emerald-400 font-bold">
                                ₹{approvalDetail.budgetImpact.department.remainingBefore.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                              <span>Projected Remaining After:</span>
                              <span className="text-indigo-400 font-bold">
                                ₹{approvalDetail.budgetImpact.department.remainingAfter.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Employee Personal Budget */}
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                          <span className="text-[11px] font-bold text-indigo-300">
                            Employee Personal Spending Envelope
                          </span>
                          <div className="space-y-1 text-xs font-mono">
                            <div className="flex justify-between text-slate-400">
                              <span>Monthly Limit:</span>
                              <span className="text-white">
                                ₹{approvalDetail.budgetImpact.employee.budget.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Spent To Date:</span>
                              <span className="text-white">
                                ₹{approvalDetail.budgetImpact.employee.spent.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Available Remaining:</span>
                              <span className="text-emerald-400 font-bold">
                                ₹{approvalDetail.budgetImpact.employee.remainingBefore.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                              <span>Projected Remaining After:</span>
                              <span className="text-indigo-400 font-bold">
                                ₹{approvalDetail.budgetImpact.employee.remainingAfter.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Deterministic Policy Checklist */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Deterministic Spending Policy Rules
                    </h3>
                    <div className="space-y-1.5">
                      {selectedApproval.expense.policyReasons?.map((reason: string, idx: number) => {
                        const isWarn = reason.startsWith("⚠");
                        const isBlock = reason.startsWith("✖");
                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                              isBlock
                                ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                                : isWarn
                                ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            }`}
                          >
                            <span className="font-bold">{isBlock ? "✖" : isWarn ? "⚠" : "✓"}</span>
                            <span>{reason.replace(/^[✓⚠✖]\s*/, "")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI Risk Analysis Signals */}
                  {selectedApproval.expense.aiAnalysis && (
                    <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                          <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
                          AI Risk Intelligence &amp; Signals
                        </h3>
                        <span className="text-[10px] text-slate-400">
                          Recommendation: <strong>{selectedApproval.expense.aiAnalysis.recommendation}</strong>
                        </span>
                      </div>

                      {selectedApproval.expense.aiAnalysis.summary && (
                        <p className="text-xs text-slate-200 leading-relaxed">
                          {selectedApproval.expense.aiAnalysis.summary}
                        </p>
                      )}

                      {selectedApproval.expense.aiAnalysis.signals?.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {selectedApproval.expense.aiAnalysis.signals.map((sig: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-2 rounded-lg bg-slate-900/80 border border-indigo-500/20 text-xs text-slate-300 flex items-center gap-2"
                            >
                              <span className="text-amber-400 font-bold">⚡</span>
                              <span>{sig.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Decision Review Note / Previous Comments */}
                  {selectedApproval.comment && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Reviewer Decision Note
                      </span>
                      <p className="text-xs text-slate-300 italic">&ldquo;{selectedApproval.comment}&rdquo;</p>
                      {selectedApproval.decidedAt && (
                        <span className="text-[10px] text-slate-500 block pt-1">
                          Decided on {new Date(selectedApproval.decidedAt).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Action Controls */}
            <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between sticky bottom-0">
              <button
                onClick={closeDrawer}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Close
              </button>

              {selectedApproval.status === "PENDING" && isManagerOrAdmin ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setRejectingExpenseId(selectedApproval.expense.id);
                      setRejectComment("");
                      setRejectError(null);
                    }}
                    disabled={actionLoading === selectedApproval.expense.id}
                    className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all"
                  >
                    Reject Expense
                  </button>
                  <button
                    onClick={() => handleApprove(selectedApproval.expense.id)}
                    disabled={actionLoading === selectedApproval.expense.id}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve &amp; Mark Ready for Payment</span>
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400 font-mono">
                  Status: <strong className="text-white">{selectedApproval.status}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Rejection Reason Modal */}
      {rejectingExpenseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <XCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Reject Spending Request</h3>
            </div>
            <p className="text-xs text-slate-400">
              Please state the specific reason or policy violation. This feedback will be recorded in the audit log and shared with the submitting employee.
            </p>

            <textarea
              rows={4}
              value={rejectComment}
              onChange={(e) => {
                setRejectComment(e.target.value);
                setRejectError(null);
              }}
              placeholder="e.g. Please provide a formal GST tax invoice, or reduce team dinner expense to match per-diem limits."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />

            {rejectError && (
              <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{rejectError}</span>
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setRejectingExpenseId(null);
                  setRejectError(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === rejectingExpenseId}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-500/25 disabled:opacity-50"
              >
                {actionLoading === rejectingExpenseId ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
