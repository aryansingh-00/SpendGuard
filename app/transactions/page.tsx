"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeftRight,
  Search,
  Filter,
  CreditCard,
  Building,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  X,
  FileText,
  Calendar,
} from "lucide-react";
import { RiskGauge } from "@/components/RiskGauge";
import { StatusBadge } from "@/components/PolicyBadge";
import { ExpenseData } from "@/types";

export default function TransactionsPage() {
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedRisk, setSelectedRisk] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedExpense, setSelectedExpense] = useState<ExpenseData | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses");
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (err) {
      console.error("Fetch transactions error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filtered = expenses.filter((e) => {
    const matchSearch =
      e.merchantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.employee?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.expenseNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchDept = selectedDept === "all" || e.departmentId === selectedDept;
    const matchRisk = selectedRisk === "all" || e.aiAnalysis?.riskLevel === selectedRisk;
    const matchStatus = selectedStatus === "all" || e.status === selectedStatus;

    return matchSearch && matchDept && matchRisk && matchStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Transaction Audit Trail
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete cryptographic audit log with AI risk evaluations and Razorpay payment records.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search merchant, employee, reference..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="LOW">Low Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="HIGH">High Risk (Anomalies)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="PAID">Settled (Paid)</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="BLOCKED">Blocked</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 font-semibold">Reference</th>
                <th className="py-3.5 px-4 font-semibold">Merchant / Purpose</th>
                <th className="py-3.5 px-4 font-semibold">Employee</th>
                <th className="py-3.5 px-4 font-semibold">Department</th>
                <th className="py-3.5 px-4 font-semibold">Category</th>
                <th className="py-3.5 px-4 font-semibold text-right">Amount</th>
                <th className="py-3.5 px-4 font-semibold text-center">AI Risk</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading transactions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No transactions match your search filter.
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => (
                  <tr
                    key={exp.id}
                    onClick={() => setSelectedExpense(exp)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-300">
                      {exp.expenseNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white">{exp.merchantName}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-xs">{exp.purpose}</p>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-300">
                      {exp.employee?.name || "Employee"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {exp.department?.name || "General"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      ₹{exp.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-block">
                        <RiskGauge
                          score={exp.aiAnalysis?.riskScore || 15}
                          level={exp.aiAnalysis?.riskLevel}
                          size="sm"
                          showLabel={false}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={exp.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[11px] font-semibold text-indigo-400 hover:underline">
                        View Audit →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Inspection Detail Modal */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 sm:p-8 text-white my-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-indigo-400">
                    {selectedExpense.expenseNumber}
                  </span>
                  <StatusBadge status={selectedExpense.status} size="sm" />
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {selectedExpense.merchantName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedExpense(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Amount</span>
                <span className="text-base font-bold font-mono text-white">
                  ₹{selectedExpense.amount.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Category</span>
                <span className="font-semibold text-slate-300">{selectedExpense.category}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Department</span>
                <span className="font-semibold text-slate-300">
                  {selectedExpense.department?.name || "General"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Payment Status</span>
                <span className="font-semibold text-cyan-400">
                  {selectedExpense.paymentStatus}
                </span>
              </div>
            </div>

            {/* AI Risk Score Analysis Card */}
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white">AI Risk Engine Evaluation</span>
                </div>
                <RiskGauge
                  score={selectedExpense.aiAnalysis?.riskScore || 20}
                  level={selectedExpense.aiAnalysis?.riskLevel}
                  size="sm"
                />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {selectedExpense.aiAnalysis?.reason || selectedExpense.decisionReason}
              </p>

              {selectedExpense.aiAnalysis?.anomaliesDetected &&
                selectedExpense.aiAnalysis.anomaliesDetected.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-indigo-500/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Detected Anomalies & Rule Triggers
                    </span>
                    <ul className="space-y-1">
                      {selectedExpense.aiAnalysis.anomaliesDetected.map((a, i) => (
                        <li key={i} className="text-xs text-amber-300 flex items-start gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>

            {/* Policy Breakdown */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-300 block">
                Deterministic Policy Audit
              </span>
              <p className="text-xs text-slate-400">
                {selectedExpense.decisionReason || "Meets departmental spending parameters."}
              </p>
            </div>

            {/* Payment & Razorpay Transactions Audit */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-300">
                  Razorpay Payment Records
                </span>
              </div>
              {selectedExpense.transactions && selectedExpense.transactions.length > 0 ? (
                <div className="space-y-2 pt-1 font-mono text-[11px]">
                  {selectedExpense.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-slate-400">Order ID: </span>
                        <span className="text-indigo-300">{tx.razorpayOrderId || "N/A"}</span>
                        {tx.razorpayPaymentId && (
                          <span className="text-slate-500 block">
                            Payment ID: {tx.razorpayPaymentId}
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                        {tx.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No gateway payments executed yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
