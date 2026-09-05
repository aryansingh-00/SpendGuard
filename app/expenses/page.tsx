"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CreditCard,
  FileText,
  Building,
  TrendingUp,
  Clock,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { ExpenseModal } from "@/components/ExpenseModal";
import { RiskGauge } from "@/components/RiskGauge";
import { StatusBadge } from "@/components/PolicyBadge";
import { ExpenseData } from "@/types";

export default function ExpensesPage() {
  const { currentUser, isEmployee } = useAuth();

  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses");
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (err) {
      console.error("Fetch expenses error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const filteredExpenses = expenses.filter((e) => {
    const matchSearch =
      e.merchantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.expenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.employee?.name || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchCategory = selectedCategory === "all" || e.category === selectedCategory;
    const matchStatus = selectedStatus === "all" || e.status === selectedStatus;

    return matchSearch && matchCategory && matchStatus;
  });

  const employeeBudget = currentUser?.monthlyBudget || 60000;
  const employeeSpent = currentUser?.spentThisMonth || 42000;
  const remainingAllowance = Math.max(0, employeeBudget - employeeSpent);
  const allowancePercent = employeeBudget > 0 ? (employeeSpent / employeeBudget) * 100 : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Expense Management & Requests
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Submit expenses, upload receipts with AI extraction, and monitor approval milestones.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchExpenses}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/dashboard/expenses/new"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Expense</span>
          </Link>
        </div>
      </div>

      {/* Employee Persona Budget Progress Card (if logged in as employee) */}
      {isEmployee && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Monthly Budget Allowance ({currentUser?.name || "Employee"})
            </span>
            <p className="text-xl font-black font-mono text-white">
              ₹{employeeBudget.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-slate-400">Department: {currentUser?.departmentName || "General"}</p>
          </div>

          <div className="space-y-1 sm:border-x sm:border-slate-800 sm:px-4">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Consumed:</span>
              <span className="font-mono font-bold text-indigo-400">
                ₹{employeeSpent.toLocaleString("en-IN")} ({allowancePercent.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, allowancePercent)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500">Resets on the 1st of every month</p>
          </div>

          <div className="space-y-1 sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Remaining Spending Capacity
            </span>
            <p className="text-xl font-black font-mono text-emerald-400">
              ₹{remainingAllowance.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-emerald-400/80">Available for submission</p>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search merchant, ID, employee, purpose..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="Advertising">Advertising</option>
            <option value="Software">Software</option>
            <option value="Cloud Infrastructure">Cloud Infrastructure</option>
            <option value="Travel">Travel</option>
            <option value="Meals">Meals</option>
            <option value="Client Entertainment">Client Entertainment</option>
            <option value="Recruitment">Recruitment</option>
            <option value="Cryptocurrency">Cryptocurrency</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="PAID">Settled (Paid)</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING_APPROVAL">Approval Required</option>
            <option value="AUTO_APPROVED">Auto-Approved</option>
            <option value="BLOCKED">Policy Blocked</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 font-semibold">Expense ID</th>
                <th className="py-3.5 px-4 font-semibold">Merchant & Purpose</th>
                <th className="py-3.5 px-4 font-semibold">Submitter & Dept</th>
                <th className="py-3.5 px-4 font-semibold">Category</th>
                <th className="py-3.5 px-4 font-semibold text-right">Amount</th>
                <th className="py-3.5 px-4 font-semibold text-center">Policy Rule</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No expense records found matching filters.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp: any) => {
                  const policyDecision = exp.policyDecision || (exp.status === "BLOCKED" ? "BLOCKED" : exp.status === "APPROVED" ? "APPROVED" : "APPROVAL_REQUIRED");
                  const policyBadgeColor =
                    policyDecision === "APPROVED"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : policyDecision === "APPROVAL_REQUIRED"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20";

                  return (
                    <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-semibold text-white">{exp.expenseNumber}</span>
                        <p className="text-[10px] text-slate-500">
                          {new Date(exp.expenseDate).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-200">{exp.merchantName}</p>
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">{exp.purpose}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-300">{exp.employee?.name || "Employee"}</p>
                        <p className="text-[10px] text-slate-500">{exp.department?.name || "General"}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-white">
                          ₹{exp.amount.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${policyBadgeColor}`}>
                          {policyDecision}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={exp.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            const reasons = exp.policyReasons || [];
                            alert(
                              `Policy Evaluation for ${exp.expenseNumber}:\nDecision: ${policyDecision}\n\nReasons:\n${reasons.join("\n") || exp.decisionReason || "Compliant"}`
                            );
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-semibold border border-slate-700"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Modal */}
      <ExpenseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchExpenses();
        }}
      />
    </div>
  );
}
