"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Building2,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

interface PolicyCheckResponse {
  decision: "APPROVED" | "APPROVAL_REQUIRED" | "BLOCKED";
  reasons: string[];
  summary: string;
  checks: {
    employeeBudget: "PASS" | "FAIL" | "BLOCKED" | "NA";
    departmentBudget: "PASS" | "FAIL" | "BLOCKED" | "NA";
    companyBudget: "PASS" | "FAIL" | "BLOCKED" | "NA";
    transactionLimit: "PASS" | "FAIL" | "TRIGGERED" | "NA";
    category: "PASS" | "TRIGGERED" | "BLOCKED" | "NA";
    merchant: "PASS" | "TRIGGERED" | "BLOCKED" | "NA";
    approvalThreshold: "PASS" | "TRIGGERED" | "NA";
  };
  budgets: {
    company: { budget: number; spent: number; remaining: number };
    department: { budget: number; spent: number; remaining: number };
    employee: { budget: number; spent: number; remaining: number };
  };
  applicablePolicies: Array<{
    id: string;
    name: string;
    scopeType: string;
  }>;
}

export default function PolicySimulatorPage() {
  const { user } = useAuth();

  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [merchantName, setMerchantName] = useState("Google Ads");
  const [amount, setAmount] = useState("5000");
  const [category, setCategory] = useState("Advertising");
  const [purpose, setPurpose] = useState("Q1 Digital Ad Campaign boost");

  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<PolicyCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch("/api/employees");
        if (res.ok) {
          const data = await res.json();
          setEmployees(data);
          if (data.length > 0) {
            setSelectedEmployeeId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load employees", err);
      }
    };
    fetchEmployees();
  }, []);

  const handleEvaluate = async (customPayload?: any) => {
    setError(null);
    setEvaluating(true);

    const payload = customPayload || {
      employeeProfileId: selectedEmployeeId,
      merchantName: merchantName.trim(),
      amount: parseFloat(amount),
      category: category.trim(),
      purpose: purpose.trim(),
    };

    try {
      const res = await fetch("/api/policy-engine/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to evaluate policy.");
        setResult(null);
      } else {
        setResult(data);
      }
    } catch (err) {
      console.error("Evaluation error", err);
      setError("An unexpected network error occurred.");
    } finally {
      setEvaluating(false);
    }
  };

  const loadScenario = (
    scenarioMerchant: string,
    scenarioAmount: string,
    scenarioCategory: string,
    scenarioPurpose: string
  ) => {
    setMerchantName(scenarioMerchant);
    setAmount(scenarioAmount);
    setCategory(scenarioCategory);
    setPurpose(scenarioPurpose);

    const rahul = employees.find((e) => e.name.toLowerCase().includes("rahul"));
    const empId = rahul ? rahul.id : selectedEmployeeId;
    if (rahul) setSelectedEmployeeId(rahul.id);

    handleEvaluate({
      employeeProfileId: empId,
      merchantName: scenarioMerchant,
      amount: parseFloat(scenarioAmount),
      category: scenarioCategory,
      purpose: scenarioPurpose,
    });
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/policies"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Policies
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide flex items-center gap-1">
                <Zap className="w-3 h-3" /> Sandbox Mode
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              Policy Engine Simulator
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Test candidate transactions in real time against deterministic company budgets, category rules, and spending thresholds.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Scenarios Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          One-Click Test Scenarios
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <button
            onClick={() => loadScenario("Google Ads", "5000", "Advertising", "Search Engine Ads")}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group"
          >
            <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">Scenario 1: Normal</span>
            <p className="text-xs font-bold text-slate-200">₹5,000 — Ads</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Expect: APPROVED</p>
          </button>

          <button
            onClick={() => loadScenario("Google Ads", "12000", "Advertising", "Q1 Ad Budget Boost")}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-left transition-all group"
          >
            <span className="text-[10px] font-bold text-amber-400 block mb-0.5">Scenario 2: Threshold</span>
            <p className="text-xs font-bold text-slate-200">₹12,000 — Ads</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Expect: APPROVAL_REQ</p>
          </button>

          <button
            onClick={() => loadScenario("Google Ads", "25000", "Advertising", "Excessive Ad Campaign")}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-left transition-all group"
          >
            <span className="text-[10px] font-bold text-rose-400 block mb-0.5">Scenario 3: Over Budget</span>
            <p className="text-xs font-bold text-slate-200">₹25,000 — Overlimit</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Expect: BLOCKED</p>
          </button>

          <button
            onClick={() => loadScenario("Steam", "5000", "Gaming", "Office entertainment gaming")}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-left transition-all group"
          >
            <span className="text-[10px] font-bold text-rose-400 block mb-0.5">Scenario 4: Prohibited</span>
            <p className="text-xs font-bold text-slate-200">₹5,000 — Gaming</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Expect: BLOCKED</p>
          </button>

          <button
            onClick={() => loadScenario("UnknownAdNetwork", "6000", "Advertising", "New ad partner trial")}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-left transition-all group"
          >
            <span className="text-[10px] font-bold text-amber-400 block mb-0.5">Scenario 5: New Vendor</span>
            <p className="text-xs font-bold text-slate-200">₹6,000 — Unlisted</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Expect: APPROVAL_REQ</p>
          </button>
        </div>
      </div>

      {/* Simulator Inputs & Result Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Transaction Input Form (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-400" />
              Candidate Transaction
            </h2>

            {/* Employee Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Submitter (Employee Context)
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} — {e.department?.name || "Unassigned"} (Budget: ₹
                    {(e.monthlyBudget || 0).toLocaleString("en-IN")})
                  </option>
                ))}
              </select>
            </div>

            {/* Merchant */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Merchant Name</label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="e.g. Google Ads, AWS, Steam..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Amount (₹)</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono font-bold"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Advertising, Software, Gaming..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Business Purpose</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Ad boost for Q1 campaign..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={() => handleEvaluate()}
              disabled={evaluating}
              className="w-full mt-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01]"
            >
              {evaluating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Evaluating Rules...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Evaluate Transaction
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Simulation Result & Breakdown (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {!result && !error && (
            <div className="p-12 text-center rounded-2xl bg-slate-900/30 border border-dashed border-slate-800 flex flex-col items-center justify-center min-h-[380px]">
              <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400 mb-3">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-300">Awaiting Transaction</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Select an employee, enter spending parameters, and click <strong>Evaluate Transaction</strong> or choose a test scenario above.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-fade-in">
              {/* Decision Banner */}
              <div
                className={`p-6 rounded-2xl border ${
                  result.decision === "APPROVED"
                    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                    : result.decision === "APPROVAL_REQUIRED"
                    ? "bg-amber-950/30 border-amber-500/40 text-amber-300"
                    : "bg-rose-950/30 border-rose-500/40 text-rose-300"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Deterministic Engine Decision
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Decision Priority: BLOCKED &gt; APPROVAL &gt; APPROVED
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {result.decision === "APPROVED" && <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />}
                  {result.decision === "APPROVAL_REQUIRED" && (
                    <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
                  )}
                  {result.decision === "BLOCKED" && <XCircle className="w-8 h-8 text-rose-400 shrink-0" />}

                  <div>
                    <h3 className="text-xl font-black tracking-tight text-white">
                      {result.decision === "APPROVED" && "APPROVED"}
                      {result.decision === "APPROVAL_REQUIRED" && "APPROVAL REQUIRED"}
                      {result.decision === "BLOCKED" && "STRICTLY BLOCKED"}
                    </h3>
                    <p className="text-xs opacity-90 mt-0.5">{result.summary}</p>
                  </div>
                </div>
              </div>

              {/* Human-Readable Reasons Breakdown */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Evaluation Explanation & Reasons
                </h4>

                <div className="space-y-2">
                  {result.reasons.map((reason, i) => {
                    const isPositive = reason.startsWith("✓");
                    const isWarning = reason.startsWith("⚠");
                    const isBlock = reason.startsWith("✖");

                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2.5 ${
                          isBlock
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                            : isWarning
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        <span className="font-bold shrink-0">
                          {isBlock ? "✖" : isWarning ? "⚠" : "✓"}
                        </span>
                        <span>{reason.replace(/^[✓⚠✖]\s*/, "")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Rule Checks Grid */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Deterministic Rule Checks Matrix
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Employee Budget</span>
                    <span
                      className={`text-xs font-bold mt-1 inline-block ${
                        result.checks.employeeBudget === "PASS"
                          ? "text-emerald-400"
                          : result.checks.employeeBudget === "BLOCKED"
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {result.checks.employeeBudget}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Dept Budget</span>
                    <span
                      className={`text-xs font-bold mt-1 inline-block ${
                        result.checks.departmentBudget === "PASS"
                          ? "text-emerald-400"
                          : result.checks.departmentBudget === "BLOCKED"
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {result.checks.departmentBudget}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Company Budget</span>
                    <span
                      className={`text-xs font-bold mt-1 inline-block ${
                        result.checks.companyBudget === "PASS"
                          ? "text-emerald-400"
                          : result.checks.companyBudget === "BLOCKED"
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {result.checks.companyBudget}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Single Tx Limit</span>
                    <span
                      className={`text-xs font-bold mt-1 inline-block ${
                        result.checks.transactionLimit === "PASS"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {result.checks.transactionLimit}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Category Rule</span>
                    <span
                      className={`text-xs font-bold mt-1 inline-block ${
                        result.checks.category === "PASS"
                          ? "text-emerald-400"
                          : result.checks.category === "TRIGGERED"
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {result.checks.category}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Merchant Rule</span>
                    <span
                      className={`text-xs font-bold mt-1 inline-block ${
                        result.checks.merchant === "PASS"
                          ? "text-emerald-400"
                          : result.checks.merchant === "TRIGGERED"
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {result.checks.merchant}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Approval Threshold</span>
                    <span
                      className={`text-xs font-bold mt-1 inline-block ${
                        result.checks.approvalThreshold === "PASS"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {result.checks.approvalThreshold}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Budget Hierarchy Snapshot */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Live Budget Hierarchy Snapshot
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Company */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-purple-400">Company Envelope</span>
                    <p className="text-xs font-semibold text-slate-200 mt-1">
                      Available: ₹{result.budgets.company.remaining.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      ₹{result.budgets.company.spent.toLocaleString("en-IN")} / ₹
                      {result.budgets.company.budget.toLocaleString("en-IN")}
                    </p>
                  </div>

                  {/* Department */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-blue-400">Department Envelope</span>
                    <p className="text-xs font-semibold text-slate-200 mt-1">
                      Available: ₹{result.budgets.department.remaining.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      ₹{result.budgets.department.spent.toLocaleString("en-IN")} / ₹
                      {result.budgets.department.budget.toLocaleString("en-IN")}
                    </p>
                  </div>

                  {/* Employee */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-emerald-400">Employee Envelope</span>
                    <p className="text-xs font-semibold text-slate-200 mt-1">
                      Available: ₹{result.budgets.employee.remaining.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      ₹{result.budgets.employee.spent.toLocaleString("en-IN")} / ₹
                      {result.budgets.employee.budget.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
