"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Receipt,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Send,
  AlertCircle,
  Building2,
  Zap,
  UploadCloud,
  FileText,
  X,
  BrainCircuit,
  FileCheck,
  Info,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

const COMMON_CATEGORIES = [
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
  "Gaming",
  "Cryptocurrency",
  "Personal Expenses",
];

export default function NewExpensePage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Advertising");
  const [purpose, setPurpose] = useState("");
  const [employeeProfileId, setEmployeeProfileId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);

  // Receipt Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [analyzingReceipt, setAnalyzingReceipt] = useState(false);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const [preCheckResult, setPreCheckResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch("/api/employees");
        if (res.ok) {
          const data = await res.json();
          setEmployees(data);
          if (data.length > 0) {
            const self = data.find((e: any) => e.userId === user?.id);
            setEmployeeProfileId(self ? self.id : data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load employees", err);
      }
    };
    fetchEmployees();
  }, [user]);

  // Handle File Selection
  const handleFileChange = (file: File) => {
    setReceiptError(null);
    if (!file) return;

    // Check size limit: 10 MB
    if (file.size > 10 * 1024 * 1024) {
      setReceiptError("File exceeds the 10 MB size limit.");
      return;
    }

    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp)$/i)) {
      setReceiptError("Unsupported format. Please upload a PDF, JPG, PNG, or WEBP document.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Run AI Receipt Analysis
  const handleAnalyzeReceipt = async () => {
    if (!selectedFile || !receiptBase64) return;

    try {
      setAnalyzingReceipt(true);
      setReceiptError(null);

      // Call extraction endpoint
      const res = await fetch("/api/expenses/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: receiptBase64,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
        }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        const ext = json.data;
        setExtractedData(ext);

        // Autofill form if fields are empty or user wants assistance
        if (ext.merchantName && !merchantName) setMerchantName(ext.merchantName);
        if (ext.amount && !amount) setAmount(String(ext.amount));
        if (ext.category && COMMON_CATEGORIES.includes(ext.category)) {
          setCategory(ext.category);
        }
      } else {
        setReceiptError(json.error || "Failed to extract receipt data.");
      }
    } catch (err: any) {
      console.error("Receipt analysis error:", err);
      setReceiptError("An error occurred during AI receipt analysis.");
    } finally {
      setAnalyzingReceipt(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setReceiptBase64(null);
    setExtractedData(null);
    setReceiptError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Run live pre-check debounce
  useEffect(() => {
    const runPreCheck = async () => {
      const parsedAmount = parseFloat(amount);
      if (!merchantName.trim() || isNaN(parsedAmount) || parsedAmount <= 0 || !category) {
        setPreCheckResult(null);
        return;
      }

      setChecking(true);
      try {
        const res = await fetch("/api/policy-engine/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantName: merchantName.trim(),
            amount: parsedAmount,
            category,
            purpose: purpose.trim(),
            employeeProfileId: employeeProfileId || undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setPreCheckResult(data);
        }
      } catch (err) {
        console.error("Pre-check error", err);
      } finally {
        setChecking(false);
      }
    };

    const timer = setTimeout(runPreCheck, 400);
    return () => clearTimeout(timer);
  }, [merchantName, amount, category, purpose, employeeProfileId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!merchantName.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please provide a valid merchant and positive amount.");
      return;
    }

    try {
      setSubmitting(true);

      // 1. Create Expense
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantName: merchantName.trim(),
          amount: parsedAmount,
          category,
          purpose: purpose.trim() || "Operational expense",
          employeeProfileId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit expense.");
        setSubmitting(false);
        return;
      }

      const createdExpenseId = data.id;

      // 2. If a receipt file was uploaded, attach it to the newly created expense
      if (selectedFile && receiptBase64 && createdExpenseId) {
        try {
          const uploadRes = await fetch(`/api/expenses/${createdExpenseId}/receipts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: selectedFile.name,
              mimeType: selectedFile.type,
              fileData: receiptBase64,
            }),
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            const receiptId = uploadData.receipt?.id;

            if (receiptId) {
              // Trigger analysis & claim-vs-document verification
              await fetch(`/api/expenses/${createdExpenseId}/receipts/${receiptId}/analyze`, {
                method: "POST",
              });
            }
          }
        } catch (uploadErr) {
          console.warn("Receipt upload after expense creation failed non-blocking:", uploadErr);
        }
      }

      router.push(`/dashboard/expenses/${createdExpenseId}`);
    } catch (err) {
      console.error("Expense submission error", err);
      setError("An unexpected network error occurred.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <Link
          href="/expenses"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Expenses
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Receipt className="w-8 h-8 text-indigo-400" />
          Create Expense Request
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Submit an expense claim with automated receipt intelligence and spending policy verification.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-5">
          {/* Receipt Upload Section */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                Receipt or Invoice Document
              </h2>
              <span className="text-[10px] text-slate-500">Max 10 MB (PDF, JPG, PNG)</span>
            </div>

            {!selectedFile ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="p-6 rounded-xl bg-slate-950/60 border-2 border-dashed border-slate-800 hover:border-indigo-500/50 transition-colors cursor-pointer text-center space-y-2 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
                <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 mx-auto transition-colors" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    Click to upload or drag and drop receipt
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    PDF, JPG, PNG, WEBP supported
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-xs">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || "Document"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {!extractedData && (
                  <button
                    type="button"
                    onClick={handleAnalyzeReceipt}
                    disabled={analyzingReceipt}
                    className="w-full py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {analyzingReceipt ? (
                      <>
                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        Extracting Receipt Metadata...
                      </>
                    ) : (
                      <>
                        <BrainCircuit className="w-4 h-4" />
                        Analyze Receipt with AI
                      </>
                    )}
                  </button>
                )}

                {receiptError && (
                  <p className="text-[11px] text-rose-400 font-medium">{receiptError}</p>
                )}

                {extractedData && (
                  <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between text-indigo-400 font-bold text-[11px] uppercase">
                      <span className="flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5" /> Extracted Intelligence
                      </span>
                      <span className="font-mono text-[10px] bg-indigo-500/10 px-2 py-0.5 rounded">
                        Confidence: {Math.round((extractedData.confidence || extractedData.confidenceScore || 0.95) * 100)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1 border-t border-indigo-500/10">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Extracted Merchant</span>
                        <span className="font-semibold text-white">{extractedData.merchantName || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Extracted Total</span>
                        <span className="font-mono font-bold text-emerald-400">
                          ₹{(extractedData.totalAmount || extractedData.amount)?.toLocaleString("en-IN") || "N/A"}
                        </span>
                      </div>
                      {extractedData.invoiceNumber && (
                        <div>
                          <span className="text-slate-500 block text-[10px]">Invoice #</span>
                          <span className="font-mono text-slate-300">{extractedData.invoiceNumber}</span>
                        </div>
                      )}
                      {extractedData.category && (
                        <div>
                          <span className="text-slate-500 block text-[10px]">Category</span>
                          <span className="text-slate-300">{extractedData.category}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expense Fields */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Expense Claim Details
            </h2>

            {/* Submitter */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Submitter</label>
              <select
                value={employeeProfileId}
                onChange={(e) => setEmployeeProfileId(e.target.value)}
                disabled={user?.role === "EMPLOYEE"}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} — {e.departmentName || "Unassigned"}
                  </option>
                ))}
              </select>
            </div>

            {/* Merchant */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Merchant Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Google Ads, AWS, Canva, Meta..."
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount (₹ INR) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="e.g. 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono font-bold"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Expense Category <span className="text-rose-400">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Business Purpose</label>
              <textarea
                rows={3}
                placeholder="Explain why this expense was incurred and what business need it fulfills..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || checking}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting & Verifying...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Expense Request
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Pre-Evaluation Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 min-h-[380px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Live Policy Pre-Evaluation
                </span>
                {checking && (
                  <span className="text-[10px] text-indigo-400 flex items-center gap-1 animate-pulse">
                    <Zap className="w-3 h-3" /> Checking...
                  </span>
                )}
              </div>

              {!preCheckResult ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-dashed border-slate-800/80 my-4">
                  <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Enter amount and merchant</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Deterministic policy rules will pre-evaluate your request before submission.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Decision Badge */}
                  <div
                    className={`p-4 rounded-xl border flex items-center gap-3 ${
                      preCheckResult.decision === "APPROVED"
                        ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                        : preCheckResult.decision === "APPROVAL_REQUIRED"
                        ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                        : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                    }`}
                  >
                    {preCheckResult.decision === "APPROVED" && (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    )}
                    {preCheckResult.decision === "APPROVAL_REQUIRED" && (
                      <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                    )}
                    {preCheckResult.decision === "BLOCKED" && (
                      <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                    )}

                    <div>
                      <span className="text-[10px] font-bold uppercase block opacity-80">Pre-Evaluation</span>
                      <p className="text-base font-bold text-white">
                        {preCheckResult.decision === "APPROVED" && "Compliant (APPROVED)"}
                        {preCheckResult.decision === "APPROVAL_REQUIRED" && "APPROVAL REQUIRED"}
                        {preCheckResult.decision === "BLOCKED" && "BLOCKED BY POLICY"}
                      </p>
                    </div>
                  </div>

                  {/* Reasons */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {preCheckResult.reasons.map((r: string, i: number) => {
                      const isBlock = r.startsWith("✖");
                      const isWarn = r.startsWith("⚠");
                      return (
                        <div
                          key={i}
                          className={`p-2.5 rounded-lg text-[11px] font-medium border flex items-start gap-2 ${
                            isBlock
                              ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                              : isWarn
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          <span className="font-bold shrink-0">{isBlock ? "✖" : isWarn ? "⚠" : "✓"}</span>
                          <span>{r.replace(/^[✓⚠✖]\s*/, "")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* AI Risk Layer Notice */}
            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center justify-between">
                <span>Deterministic Rules:</span>
                <span className="text-indigo-400 font-semibold">Active & Enforced</span>
              </div>
              <div className="flex items-center justify-between">
                <span>AI Receipt Intelligence:</span>
                <span className={selectedFile ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                  {selectedFile ? "Document Attached" : "Optional (Recommended)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
