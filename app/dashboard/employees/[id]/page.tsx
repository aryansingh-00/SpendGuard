"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Building2,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Mail,
  Briefcase,
  Clock,
  ShieldAlert,
  Loader2,
  Edit2,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { EmployeeProfileData, DepartmentData } from "@/types";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { isFinanceAdmin } = useAuth();

  const [employee, setEmployee] = useState<any | null>(null);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [status, setStatus] = useState("ACTIVE");
  const [saving, setSaving] = useState(false);

  const fetchEmployee = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        fetch(`/api/employees/${id}`),
        fetch("/api/departments"),
      ]);

      if (!empRes.ok) {
        setError("Employee not found or access denied.");
        return;
      }

      const empData = await empRes.json();
      const deptData = await deptRes.json();
      setEmployee(empData);
      if (Array.isArray(deptData)) setDepartments(deptData);

      setName(empData.name || "");
      setJobTitle(empData.jobTitle || "");
      setDepartmentId(empData.departmentId || "");
      setMonthlyBudget(empData.monthlyBudget?.toString() || "0");
      setRole(empData.role || "EMPLOYEE");
      setStatus(empData.status || "ACTIVE");
    } catch {
      setError("Failed to load employee details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchEmployee();
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          jobTitle: jobTitle.trim(),
          departmentId: departmentId || null,
          monthlyBudget: parseFloat(monthlyBudget) || 0,
          role,
          status,
        }),
      });

      if (res.ok) {
        setIsEditOpen(false);
        fetchEmployee();
      }
    } catch {
      console.error("Update error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        <span>Loading employee details...</span>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h2 className="text-base font-bold text-white">Employee Profile Error</h2>
        <p className="text-xs text-rose-400">{error || "Employee not found."}</p>
        <Link
          href="/dashboard/employees"
          className="inline-block text-xs text-indigo-400 hover:underline"
        >
          ← Back to Employees
        </Link>
      </div>
    );
  }

  const budget = employee.monthlyBudget || 0;
  const spent = 0; // Honest ₹0 without fabricated numbers
  const remaining = budget - spent;

  return (
    <div className="space-y-6 pb-12 max-w-5xl">
      {/* Back button */}
      <Link
        href="/dashboard/employees"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Employees</span>
      </Link>

      {/* Header Profile Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xl ring-2 ring-indigo-500/40">
              {employee.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {employee.name}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    employee.status === "ACTIVE"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                  }`}
                >
                  {employee.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{employee.jobTitle || "Employee"}</span>
                <span>•</span>
                <span>{employee.department?.name || "Unassigned Department"}</span>
              </p>
            </div>
          </div>

          {isFinanceAdmin && (
            <button
              onClick={() => setIsEditOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        {/* Budget Allocation Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Monthly Budget</span>
            <span className="font-mono font-bold text-white text-lg sm:text-xl">
              ₹{budget.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Approved Allowance</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Spent This Month</span>
            <span className="font-mono font-bold text-cyan-400 text-lg sm:text-xl">
              ₹{spent.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">0% utilized</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Remaining Allowance</span>
            <span className="font-mono font-bold text-emerald-400 text-lg sm:text-xl">
              ₹{remaining.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-emerald-500/80 block mt-0.5">100% available</span>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            <span>Basic Information</span>
          </h2>

          <div className="divide-y divide-slate-800 text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Email Address</span>
              <span className="font-mono text-white">{employee.email}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Assigned Role</span>
              <span className="font-semibold text-indigo-300">{employee.role}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Account Status</span>
              <span className="font-semibold text-emerald-400">{employee.status}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Joined Date</span>
              <span className="text-slate-300">
                {new Date(employee.createdAt).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Department Information */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span>Department Details</span>
          </h2>

          <div className="divide-y divide-slate-800 text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Department Name</span>
              <span className="font-semibold text-white">{employee.department?.name || "Unassigned"}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Department Code</span>
              <span className="font-mono text-slate-300">{employee.department?.code || "N/A"}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Company</span>
              <span className="text-slate-300">{employee.company?.name || "Acme Technologies"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Spending History Placeholder */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Spending History</span>
        </h2>

        <div className="p-8 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
          <DollarSign className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-300">No spending history recorded yet</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Transactions submitted by this employee will appear here once expense workflows are initiated.
          </p>
        </div>
      </div>

      {/* Risk History Placeholder */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Risk & Anomaly History</span>
        </h2>

        <div className="p-8 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
          <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-300">No risk anomalies recorded</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            SpendGuard AI policy violations and risk flags will appear here in subsequent milestones.
          </p>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold">Edit Employee</h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Job Title</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="">Unassigned</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Monthly Budget (₹)</label>
                  <input
                    type="number"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
