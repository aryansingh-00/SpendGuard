"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Building2,
  Mail,
  X,
  Loader2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Ban,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { EmployeeProfileData, DepartmentData } from "@/types";

export default function EmployeesPage() {
  const { isFinanceAdmin, user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeProfileData[]>([]);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [monthlyBudget, setMonthlyBudget] = useState("50000");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/departments"),
      ]);

      if (empRes.ok && deptRes.ok) {
        const empData = await empRes.json();
        const deptData = await deptRes.json();
        if (Array.isArray(empData)) setEmployees(empData);
        if (Array.isArray(deptData)) {
          setDepartments(deptData);
          if (deptData.length > 0 && !departmentId) {
            setDepartmentId(deptData[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Fetch employees error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }

    const parsedBudget = parseFloat(monthlyBudget);
    if (isNaN(parsedBudget) || parsedBudget < 0) {
      setError("Monthly budget cannot be negative.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          jobTitle: jobTitle.trim() || "Employee",
          departmentId: departmentId || null,
          role,
          monthlyBudget: parsedBudget,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create employee.");
        setCreating(false);
        return;
      }

      setIsModalOpen(false);
      setName("");
      setEmail("");
      setJobTitle("");
      setMonthlyBudget("50000");
      fetchData();
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (employeeId: string, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === employeeId ? { ...emp, status: nextStatus as any } : emp))
      );
    } catch (err) {
      console.error("Toggle status error:", err);
    }
  };

  const filtered = employees.filter((emp) =>
    (emp.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.jobTitle || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.department?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Employee Management
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Maintain company personnel, assign department budgets, and configure roles.
          </p>
        </div>

        {isFinanceAdmin && (
          <button
            onClick={() => {
              setError(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 flex items-center gap-2 self-start sm:self-auto transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search employee by name, email, department..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <span className="text-xs text-slate-400 font-medium hidden sm:block">
          {filtered.length} Employees Registered
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 font-semibold">Name & Email</th>
                <th className="py-3.5 px-4 font-semibold">Job Title</th>
                <th className="py-3.5 px-4 font-semibold">Department</th>
                <th className="py-3.5 px-4 font-semibold">Role</th>
                <th className="py-3.5 px-4 font-semibold text-right">Monthly Budget</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading employees...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 space-y-2">
                    <Users className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="font-semibold text-white">No employees yet</p>
                    <p className="text-xs text-slate-500">
                      Add your first employee to start controlling company spending.
                    </p>
                    {isFinanceAdmin && (
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500"
                      >
                        + Add Employee
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => {
                      window.location.href = `/dashboard/employees/${emp.id}`;
                    }}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
                          {(emp.name || "E").charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{emp.name || "Employee"}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{emp.email || ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {emp.jobTitle || "Employee"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {emp.department?.name || <span className="text-slate-500 italic">Unassigned</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          emp.role === "FINANCE_ADMIN"
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                            : emp.role === "MANAGER"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        }`}
                      >
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      ₹{emp.monthlyBudget.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          emp.status === "ACTIVE"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isFinanceAdmin && (
                          <button
                            onClick={(e) => handleToggleStatus(emp.id, emp.status, e)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                              emp.status === "ACTIVE"
                                ? "bg-rose-950/40 text-rose-300 border-rose-500/30 hover:bg-rose-900/50"
                                : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/50"
                            }`}
                          >
                            {emp.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold">Add Employee</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul@acme.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Marketing Executive"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.code ? `(${d.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="FINANCE_ADMIN">FINANCE_ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Monthly Budget (₹)
                  </label>
                  <input
                    type="number"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                    placeholder="50000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
