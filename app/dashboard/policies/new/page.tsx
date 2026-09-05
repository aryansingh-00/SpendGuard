"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  Building2,
  Users,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

const STANDARD_CATEGORIES = [
  "Advertising",
  "Software",
  "Cloud Infrastructure",
  "Travel",
  "Meals",
  "Office Supplies",
  "Marketing Services",
  "Subscriptions",
  "Hardware",
  "Developer Tools",
  "Legal & Professional",
  "Events",
];

const STANDARD_BLOCKED_CATEGORIES = [
  "Gambling",
  "Cryptocurrency",
  "Adult Entertainment",
  "Personal Expenses",
  "Gaming",
  "Alcohol & Tobacco",
];

export default function CreatePolicyPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopeType, setScopeType] = useState<"COMPANY" | "DEPARTMENT" | "EMPLOYEE">("DEPARTMENT");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeProfileId, setEmployeeProfileId] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [maxTransactionAmount, setMaxTransactionAmount] = useState("50000");
  const [approvalThreshold, setApprovalThreshold] = useState("10000");
  const [requireReceiptAbove, setRequireReceiptAbove] = useState("1000");
  const [isActive, setIsActive] = useState(true);

  // Category State
  const [allowedCategories, setAllowedCategories] = useState<string[]>([
    "Advertising",
    "Software",
    "Subscriptions",
  ]);
  const [blockedCategories, setBlockedCategories] = useState<string[]>([
    "Gambling",
    "Cryptocurrency",
    "Personal Expenses",
  ]);
  const [customAllowedCat, setCustomAllowedCat] = useState("");
  const [customBlockedCat, setCustomBlockedCat] = useState("");

  // Merchant State
  const [allowedMerchants, setAllowedMerchants] = useState<string[]>(["Google Ads", "Meta"]);
  const [blockedMerchants, setBlockedMerchants] = useState<string[]>(["Casino Royale", "Bet365"]);
  const [merchantInput, setMerchantInput] = useState("");
  const [blockedMerchantInput, setBlockedMerchantInput] = useState("");

  // Relational options
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; departmentName?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch departments and employees
    const loadOptions = async () => {
      try {
        const [deptRes, empRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/employees"),
        ]);
        if (deptRes.ok) {
          const depts = await deptRes.json();
          setDepartments(depts);
          if (depts.length > 0 && !departmentId) {
            setDepartmentId(depts[0].id);
          }
        }
        if (empRes.ok) {
          const emps = await empRes.json();
          setEmployees(emps);
          if (emps.length > 0 && !employeeProfileId) {
            setEmployeeProfileId(emps[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load options", err);
      }
    };
    loadOptions();
  }, []);

  const toggleAllowedCategory = (cat: string) => {
    if (allowedCategories.includes(cat)) {
      setAllowedCategories(allowedCategories.filter((c) => c !== cat));
    } else {
      setAllowedCategories([...allowedCategories, cat]);
      // Remove from blocked if present
      setBlockedCategories(blockedCategories.filter((c) => c !== cat));
    }
  };

  const toggleBlockedCategory = (cat: string) => {
    if (blockedCategories.includes(cat)) {
      setBlockedCategories(blockedCategories.filter((c) => c !== cat));
    } else {
      setBlockedCategories([...blockedCategories, cat]);
      // Remove from allowed if present
      setAllowedCategories(allowedCategories.filter((c) => c !== cat));
    }
  };

  const handleAddCustomAllowed = () => {
    if (customAllowedCat.trim() && !allowedCategories.includes(customAllowedCat.trim())) {
      setAllowedCategories([...allowedCategories, customAllowedCat.trim()]);
      setCustomAllowedCat("");
    }
  };

  const handleAddCustomBlocked = () => {
    if (customBlockedCat.trim() && !blockedCategories.includes(customBlockedCat.trim())) {
      setBlockedCategories([...blockedCategories, customBlockedCat.trim()]);
      setCustomBlockedCat("");
    }
  };

  const handleAddAllowedMerchant = () => {
    if (merchantInput.trim() && !allowedMerchants.includes(merchantInput.trim())) {
      setAllowedMerchants([...allowedMerchants, merchantInput.trim()]);
      setMerchantInput("");
    }
  };

  const handleAddBlockedMerchant = () => {
    if (blockedMerchantInput.trim() && !blockedMerchants.includes(blockedMerchantInput.trim())) {
      setBlockedMerchants([...blockedMerchants, blockedMerchantInput.trim()]);
      setBlockedMerchantInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please provide a policy name.");
      return;
    }

    const maxTx = parseFloat(maxTransactionAmount);
    const threshold = parseFloat(approvalThreshold);

    if (isNaN(maxTx) || maxTx < 0) {
      setError("Maximum transaction amount must be a non-negative number.");
      return;
    }

    if (isNaN(threshold) || threshold < 0) {
      setError("Approval threshold must be a non-negative number.");
      return;
    }

    if (threshold > maxTx && maxTx > 0) {
      setError("Approval threshold should not exceed maximum single transaction amount.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        scopeType,
        departmentId: scopeType === "DEPARTMENT" ? departmentId : null,
        employeeProfileId: scopeType === "EMPLOYEE" ? employeeProfileId : null,
        monthlyLimit: monthlyLimit ? parseFloat(monthlyLimit) : null,
        maxTransactionAmount: maxTx,
        approvalThreshold: threshold,
        requireReceiptAbove: requireReceiptAbove ? parseFloat(requireReceiptAbove) : 1000,
        allowedCategories,
        blockedCategories,
        allowedMerchants,
        blockedMerchants,
        isActive,
      };

      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create policy.");
        setLoading(false);
        return;
      }

      router.push("/dashboard/policies");
    } catch (err) {
      console.error("Create policy error", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/policies"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Policies
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-indigo-400" />
          Create Spending Policy
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Define financial boundaries, pre-approved categories, blocked vendors, and approval trigger levels.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            1. Policy Overview
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Policy Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Marketing Digital Advertising & Tooling Policy"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
              <textarea
                rows={2}
                placeholder="Explain the purpose and scope of this policy..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Scope Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Scope Target</label>
              <select
                value={scopeType}
                onChange={(e: any) => setScopeType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="DEPARTMENT">Department Specific</option>
                <option value="COMPANY">Company Wide (All Employees)</option>
                <option value="EMPLOYEE">Individual Employee</option>
              </select>
            </div>

            {/* Target Selector */}
            {scopeType === "DEPARTMENT" && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scopeType === "EMPLOYEE" && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Employee</label>
                <select
                  value={employeeProfileId}
                  onChange={(e) => setEmployeeProfileId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.departmentName ? `(${e.departmentName})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Financial Limits */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            2. Financial Thresholds & Limits
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Max Single Transaction (₹)
              </label>
              <input
                type="number"
                min="0"
                required
                value={maxTransactionAmount}
                onChange={(e) => setMaxTransactionAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">Expenses exceeding this require approval.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Approval Required Above (₹)
              </label>
              <input
                type="number"
                min="0"
                required
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">Triggers manager review requirement.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Monthly Cap / Limit (₹) <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 500000"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">Total monthly envelope for scope.</p>
            </div>
          </div>
        </div>

        {/* Category Rules */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            3. Category Rules
          </h2>

          {/* Allowed Categories */}
          <div>
            <label className="block text-xs font-semibold text-emerald-400 mb-2">
              Pre-Approved Categories (Instant Approval Eligible)
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {STANDARD_CATEGORIES.map((cat) => {
                const isSelected = allowedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleAllowedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                        : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Custom Allowed Category Input */}
            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                placeholder="Add custom allowed category..."
                value={customAllowedCat}
                onChange={(e) => setCustomAllowedCat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomAllowed())}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddCustomAllowed}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Add
              </button>
            </div>
          </div>

          <hr className="border-slate-800/80 my-4" />

          {/* Blocked Categories */}
          <div>
            <label className="block text-xs font-semibold text-rose-400 mb-2">
              Strictly Blocked Categories (Hard Prohibition)
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {STANDARD_BLOCKED_CATEGORIES.map((cat) => {
                const isSelected = blockedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleBlockedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                        : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {isSelected ? "✖ " : "+ "}
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Custom Blocked Category Input */}
            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                placeholder="Add custom blocked category..."
                value={customBlockedCat}
                onChange={(e) => setCustomBlockedCat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomBlocked())}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddCustomBlocked}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Merchant Rules */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            4. Merchant Whitelist & Blacklist
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Allowed Merchants */}
            <div>
              <label className="block text-xs font-semibold text-indigo-300 mb-2">
                Pre-Approved Merchants (Allow-list)
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2.5 min-h-[36px] p-2 rounded-xl bg-slate-950 border border-slate-800">
                {allowedMerchants.length === 0 ? (
                  <span className="text-[11px] text-slate-500 self-center">No explicit whitelist (all allowed)</span>
                ) : (
                  allowedMerchants.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                    >
                      {m}
                      <button
                        type="button"
                        onClick={() => setAllowedMerchants(allowedMerchants.filter((item) => item !== m))}
                        className="hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. AWS, Meta, Canva..."
                  value={merchantInput}
                  onChange={(e) => setMerchantInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddAllowedMerchant())}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddAllowedMerchant}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Blocked Merchants */}
            <div>
              <label className="block text-xs font-semibold text-rose-400 mb-2">
                Prohibited Merchants (Blacklist)
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2.5 min-h-[36px] p-2 rounded-xl bg-slate-950 border border-slate-800">
                {blockedMerchants.length === 0 ? (
                  <span className="text-[11px] text-slate-500 self-center">No blacklisted merchants</span>
                ) : (
                  blockedMerchants.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-rose-500/15 text-rose-300 border border-rose-500/30"
                    >
                      {m}
                      <button
                        type="button"
                        onClick={() => setBlockedMerchants(blockedMerchants.filter((item) => item !== m))}
                        className="hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Casino Royale, Steam..."
                  value={blockedMerchantInput}
                  onChange={(e) => setBlockedMerchantInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddBlockedMerchant())}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddBlockedMerchant}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Status Toggle & Submit */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500"
            />
            <span className="text-xs font-semibold text-slate-300">
              Activate policy immediately upon creation
            </span>
          </label>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/dashboard/policies"
              className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {loading ? "Saving Policy..." : "Save Policy"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
