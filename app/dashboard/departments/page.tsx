"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  Users,
  ShieldCheck,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { DepartmentData } from "@/types";

export default function DepartmentsPage() {
  const { isFinanceAdmin } = useAuth();
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentData | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("100000");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/departments");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setDepartments(data);
      }
    } catch (err) {
      console.error("Fetch departments error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const openCreateModal = () => {
    setEditingDept(null);
    setName("");
    setCode("");
    setDescription("");
    setMonthlyBudget("100000");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dept: DepartmentData) => {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code || "");
    setDescription(dept.description || "");
    setMonthlyBudget(dept.monthlyBudget.toString());
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Department name is required.");
      return;
    }

    const parsedBudget = parseFloat(monthlyBudget);
    if (isNaN(parsedBudget) || parsedBudget < 0) {
      setError("Monthly budget cannot be negative.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = editingDept
        ? `/api/departments/${editingDept.id}`
        : "/api/departments";
      const method = editingDept ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || null,
          monthlyBudget: parsedBudget,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save department.");
        setSaving(false);
        return;
      }

      setIsModalOpen(false);
      fetchDepartments();
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Unable to delete department.");
        return;
      }

      fetchDepartments();
    } catch {
      setDeleteError("Failed to delete department.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isFinanceAdmin) {
    return (
      <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <ShieldCheck className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-base font-bold text-white">Restricted Access</h2>
        <p className="text-xs text-slate-400">
          Only users with the <strong>FINANCE_ADMIN</strong> role can manage company departments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Department Management
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure departments, set monthly spending limits, and assign team personnel.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </button>
      </div>

      {deleteError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">
          Loading departments...
        </div>
      ) : departments.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No departments yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create departments to organize your company&apos;s spending.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500"
          >
            + Add Department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-indigo-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{dept.name}</h3>
                      {dept.code && (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700 font-bold">
                          {dept.code}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{dept.description || "No description provided."}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(dept)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Edit Department"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dept.id)}
                    disabled={deletingId === dept.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors disabled:opacity-40"
                    title="Delete Department"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Monthly Budget</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    ₹{dept.monthlyBudget.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Personnel</span>
                  <span className="font-semibold text-slate-300 flex items-center gap-1 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{dept.employeeCount || 0} Employees</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold">
                {editingDept ? "Edit Department" : "Create New Department"}
              </h3>
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

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marketing"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Department Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. MKT"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Monthly Budget (₹) *
                </label>
                <input
                  type="number"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder="500000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  min="0"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe department scope and function..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
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
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingDept ? "Update Department" : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
