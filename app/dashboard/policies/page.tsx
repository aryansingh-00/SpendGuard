"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Plus,
  Zap,
  Search,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Edit,
  Trash2,
  Eye,
  Sliders,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

interface PolicyItem {
  id: string;
  name: string;
  description?: string | null;
  scopeType: "COMPANY" | "DEPARTMENT" | "EMPLOYEE";
  departmentId?: string | null;
  department?: { id: string; name: string; code?: string | null } | null;
  employeeProfileId?: string | null;
  employeeProfile?: {
    user: { id: string; name: string; email: string };
  } | null;
  monthlyLimit?: number | null;
  maxTransactionAmount: number;
  approvalThreshold: number;
  allowedCategories: string[];
  blockedCategories: string[];
  allowedMerchants: string[];
  blockedMerchants: string[];
  requireReceiptAbove: number;
  isActive: boolean;
  createdAt: string;
}

export default function PoliciesPage() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/policies");
      if (res.ok) {
        const data = await res.json();
        setPolicies(data);
      }
    } catch (err) {
      console.error("Failed to load policies", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleToggleStatus = async (policy: PolicyItem) => {
    try {
      setActionLoading(policy.id);
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !policy.isActive }),
      });

      if (res.ok) {
        setPolicies((prev) =>
          prev.map((p) => (p.id === policy.id ? { ...p, isActive: !p.isActive } : p))
        );
        setFeedbackMessage(`Policy "${policy.name}" is now ${!policy.isActive ? "Active" : "Disabled"}.`);
        setTimeout(() => setFeedbackMessage(null), 3000);
      }
    } catch (err) {
      console.error("Toggle error", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePolicy = async (id: string) => {
    try {
      setActionLoading(id);
      const res = await fetch(`/api/policies/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setPolicies((prev) => prev.filter((p) => p.id !== id));
        setDeletingId(null);
        setSelectedPolicy(null);
        setFeedbackMessage("Policy deleted successfully.");
        setTimeout(() => setFeedbackMessage(null), 3000);
      }
    } catch (err) {
      console.error("Delete error", err);
    } finally {
      setActionLoading(null);
    }
  };

  const isFinanceAdmin = user?.role === "FINANCE_ADMIN";

  const filteredPolicies = policies.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.department?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.employeeProfile?.user.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesScope = scopeFilter === "ALL" || p.scopeType === scopeFilter;
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && p.isActive) ||
      (statusFilter === "DISABLED" && !p.isActive);

    return matchesSearch && matchesScope && matchesStatus;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wide">
              Deterministic Financial Rules
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
            Spending Policies
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure hard budget boundaries, single-transaction limits, category allow/blocklists, and approval thresholds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/policies/simulator"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all hover:scale-[1.02] shadow-sm"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            Policy Simulator
          </Link>

          {isFinanceAdmin && (
            <Link
              href="/dashboard/policies/new"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg shadow-indigo-600/20 hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              Create Policy
            </Link>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Configured Policies</p>
            <p className="text-xl font-bold text-white mt-0.5">{policies.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Policy Rules</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">
              {policies.filter((p) => p.isActive).length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Decision Priority</p>
            <p className="text-xs font-mono font-bold text-slate-200 mt-1">
              <span className="text-rose-400">BLOCKED</span> &gt;{" "}
              <span className="text-amber-400">APPROVAL</span> &gt;{" "}
              <span className="text-emerald-400">APPROVED</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search policies by name, department, or employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <span className="px-2 text-[10px] text-slate-500 font-bold uppercase">Scope:</span>
            {["ALL", "COMPANY", "DEPARTMENT", "EMPLOYEE"].map((scope) => (
              <button
                key={scope}
                onClick={() => setScopeFilter(scope)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  scopeFilter === scope
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {scope}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            {["ALL", "ACTIVE", "DISABLED"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  statusFilter === status
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Policies List */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading spending policies...</p>
        </div>
      ) : filteredPolicies.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/30 border border-dashed border-slate-800">
          <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No policies found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery || scopeFilter !== "ALL"
              ? "Try adjusting your search criteria or scope filters."
              : "Create your first spending policy to enforce corporate budget limits and category restrictions."}
          </p>
          {isFinanceAdmin && (
            <Link
              href="/dashboard/policies/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Spending Policy
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPolicies.map((policy) => {
            const scopeLabel =
              policy.scopeType === "COMPANY"
                ? "Company Wide"
                : policy.scopeType === "DEPARTMENT"
                ? `Dept: ${policy.department?.name || "Unassigned"}`
                : `User: ${policy.employeeProfile?.user.name || "Unassigned"}`;

            const scopeBadgeColor =
              policy.scopeType === "COMPANY"
                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                : policy.scopeType === "DEPARTMENT"
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

            return (
              <div
                key={policy.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  policy.isActive
                    ? "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                    : "bg-slate-950/40 border-slate-900 opacity-70"
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${scopeBadgeColor}`}>
                      {scopeLabel}
                    </span>

                    <button
                      onClick={() => isFinanceAdmin && handleToggleStatus(policy)}
                      disabled={!isFinanceAdmin || actionLoading === policy.id}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${
                        policy.isActive
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
                      }`}
                    >
                      {policy.isActive ? (
                        <>
                          <Check className="w-3 h-3" /> Active
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" /> Disabled
                        </>
                      )}
                    </button>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-white tracking-tight">{policy.name}</h3>
                  {policy.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{policy.description}</p>
                  )}

                  {/* Key Limits Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">Max Single Tx</span>
                      <p className="text-xs font-bold text-slate-200 mt-0.5">
                        ₹{policy.maxTransactionAmount.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">Approval Above</span>
                      <p className="text-xs font-bold text-amber-400 mt-0.5">
                        ₹{policy.approvalThreshold.toLocaleString("en-IN")}
                      </p>
                    </div>
                    {policy.monthlyLimit && (
                      <div className="col-span-2 pt-1 border-t border-slate-900 flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Monthly Limit</span>
                        <span className="text-xs font-bold text-indigo-300">
                          ₹{policy.monthlyLimit.toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Rules Summary Pills */}
                  <div className="mt-4 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Allowed Categories:</span>
                      <span className="font-semibold text-slate-200">
                        {policy.allowedCategories.length > 0
                          ? `${policy.allowedCategories.length} pre-approved`
                          : "All (Open)"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>Blocked Categories:</span>
                      <span className="font-semibold text-rose-400">
                        {policy.blockedCategories.length > 0
                          ? `${policy.blockedCategories.length} prohibited`
                          : "None"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>Merchant Rules:</span>
                      <span className="font-semibold text-indigo-300">
                        {policy.allowedMerchants.length > 0 || policy.blockedMerchants.length > 0
                          ? `${policy.allowedMerchants.length} allowed / ${policy.blockedMerchants.length} blocked`
                          : "Standard"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedPolicy(policy)}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect Rules
                  </button>

                  {isFinanceAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDeletingId(policy.id)}
                        disabled={actionLoading === policy.id}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Policy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Policy Modal */}
      {selectedPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                  {selectedPolicy.scopeType} Policy
                </span>
                <h3 className="text-lg font-bold text-white mt-1">{selectedPolicy.name}</h3>
              </div>
              <button
                onClick={() => setSelectedPolicy(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedPolicy.description && (
              <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {selectedPolicy.description}
              </p>
            )}

            {/* Limits */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Financial Thresholds</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Max Single Transaction</span>
                  <p className="text-sm font-bold text-slate-200 mt-0.5">
                    ₹{selectedPolicy.maxTransactionAmount.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Approval Threshold</span>
                  <p className="text-sm font-bold text-amber-400 mt-0.5">
                    ₹{selectedPolicy.approvalThreshold.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>

            {/* Allowed Categories */}
            <div>
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Allowed Categories
              </h4>
              {selectedPolicy.allowedCategories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPolicy.allowedCategories.map((c) => (
                    <span key={c} className="px-2.5 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">All standard categories permitted unless blocked.</p>
              )}
            </div>

            {/* Blocked Categories */}
            <div>
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Blocked Categories (Hard Block)
              </h4>
              {selectedPolicy.blockedCategories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPolicy.blockedCategories.map((c) => (
                    <span key={c} className="px-2.5 py-1 rounded-lg text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No categories strictly blocked.</p>
              )}
            </div>

            {/* Merchants */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Allowed Merchants</h4>
                {selectedPolicy.allowedMerchants.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPolicy.allowedMerchants.map((m) => (
                      <span key={m} className="px-2 py-0.5 rounded-lg text-[11px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Open</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">Blocked Merchants</h4>
                {selectedPolicy.blockedMerchants.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPolicy.blockedMerchants.map((m) => (
                      <span key={m} className="px-2 py-0.5 rounded-lg text-[11px] bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">None</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setSelectedPolicy(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete Spending Policy?</h3>
            </div>
            <p className="text-xs text-slate-400">
              Are you sure you want to delete this policy? This action cannot be undone and transactions under this scope will revert to company fallback rules.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePolicy(deletingId)}
                disabled={actionLoading === deletingId}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-600/20"
              >
                {actionLoading === deletingId ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
