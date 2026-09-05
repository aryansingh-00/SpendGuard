"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Receipt,
  ShieldCheck,
  BrainCircuit,
  CheckCircle2,
  CheckSquare,
  AlertTriangle,
  XCircle,
  Sparkles,
  Building2,
  User,
  RefreshCw,
  Clock,
  Layers,
  HelpCircle,
  Send,
  Zap,
  CreditCard,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Lock,
  UploadCloud,
  FileText,
  FileCheck,
  AlertCircle,
  FileX,
  X,
  FileCode,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expense, setExpense] = useState<any | null>(null);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [verification, setVerification] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingReceipt, setAnalyzingReceipt] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchExpenseData = async () => {
    try {
      setLoading(true);
      const [expRes, recRes, verRes] = await Promise.all([
        fetch(`/api/expenses`),
        fetch(`/api/expenses/${id}/receipts`),
        fetch(`/api/expenses/${id}/verification`),
      ]);

      if (expRes.ok) {
        const expenses = await expRes.json();
        const found = expenses.find((e: any) => e.id === id);
        if (found) {
          setExpense(found);
        } else {
          setError("Expense record not found.");
        }
      }

      if (recRes.ok) {
        const recData = await recRes.json();
        setReceipts(recData.receipts || []);
      }

      if (verRes.ok) {
        const verData = await verRes.json();
        setVerification(verData.verification || null);
      }
    } catch (err) {
      console.error("Failed to load expense details:", err);
      setError("Failed to fetch expense details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchExpenseData();
  }, [id]);

  const handleRunAIAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      const res = await fetch(`/api/expenses/${id}/analyze`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to analyze expense.");
      } else {
        setFeedback("AI Risk Audit completed successfully.");
        await fetchExpenseData();
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      console.error("Analysis error", err);
      setError("An unexpected error occurred while communicating with the AI service.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUploadReceipt = async (file: File) => {
    if (!file) return;
    try {
      setUploadingReceipt(true);
      setError(null);

      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const res = await fetch(`/api/expenses/${id}/receipts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            fileData: base64Data,
          }),
        });

        const data = await res.json();
        if (res.ok && data.receipt) {
          setFeedback("Receipt document uploaded successfully.");
          // Automatically trigger extraction
          await handleAnalyzeReceiptDoc(data.receipt.id);
        } else {
          setError(data.error || "Failed to upload receipt.");
          setUploadingReceipt(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Receipt upload error", err);
      setError("Failed to process document upload.");
      setUploadingReceipt(false);
    }
  };

  const handleAnalyzeReceiptDoc = async (receiptId: string) => {
    try {
      setAnalyzingReceipt(true);
      setError(null);

      const res = await fetch(`/api/expenses/${id}/receipts/${receiptId}/analyze`, {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback("Receipt analyzed and claim verified successfully.");
        await fetchExpenseData();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setError(data.error || "Failed to analyze receipt document.");
      }
    } catch (err) {
      console.error("Analyze receipt error:", err);
      setError("An error occurred during AI receipt analysis.");
    } finally {
      setAnalyzingReceipt(false);
      setUploadingReceipt(false);
    }
  };

  const handleRunVerification = async () => {
    try {
      setVerifying(true);
      setError(null);

      const res = await fetch(`/api/expenses/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback("Claim vs receipt verification refreshed.");
        await fetchExpenseData();
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setError(data.error || "Failed to execute claim verification.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError("Failed to run verification.");
    } finally {
      setVerifying(false);
    }
  };

  const handleInitiatePayment = async () => {
    try {
      setPaying(true);
      setError(null);

      const res = await fetch(`/api/expenses/${id}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `pay_ui_${id}_${Date.now()}`,
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to initiate payment.");
        setPaying(false);
        return;
      }

      const orderId = data.orderId;
      const simulatedPaymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const verifyRes = await fetch(`/api/payments/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId: id,
          razorpay_order_id: orderId,
          razorpay_payment_id: simulatedPaymentId,
          razorpay_signature: "spendguard_demo_signature",
        }),
      });

      if (verifyRes.ok) {
        setFeedback(`Payment of ₹${expense?.amount?.toLocaleString("en-IN")} successfully settled via Razorpay! Ref: ${simulatedPaymentId}`);
        setShowPayModal(false);
        await fetchExpenseData();
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setError("Payment order created but settlement verification pending.");
      }
    } catch (err: any) {
      console.error("Payment initiation error", err);
      setError("An error occurred during payment execution.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400">Loading expense intelligence...</p>
      </div>
    );
  }

  if (error && !expense) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="p-4 rounded-full bg-rose-500/10 text-rose-400 inline-block">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">Expense Not Found</h2>
        <p className="text-xs text-slate-400">{error}</p>
        <Link
          href="/expenses"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Expenses
        </Link>
      </div>
    );
  }

  const ai = expense?.aiAnalysis;
  let signals: any[] = [];
  try {
    if (ai?.signals) {
      signals = typeof ai.signals === "string" ? JSON.parse(ai.signals) : ai.signals;
    } else if (ai?.anomaliesDetected) {
      const parsed = typeof ai.anomaliesDetected === "string" ? JSON.parse(ai.anomaliesDetected) : ai.anomaliesDetected;
      signals = parsed.map((msg: string) => ({
        type: "OBSERVED_SIGNAL",
        severity: ai.riskLevel || "MEDIUM",
        message: msg,
      }));
    }
  } catch {
    signals = [];
  }

  const riskScore = ai?.riskScore ?? null;
  const riskLevel = ai?.riskLevel || "UNAVAILABLE";
  const recommendation = ai?.recommendation || "REVIEW";

  const policyDecision =
    expense?.policyDecision ||
    (expense?.status === "BLOCKED" ? "BLOCKED" : expense?.status === "APPROVED" ? "APPROVED" : "APPROVAL_REQUIRED");

  let policyReasons: string[] = [];
  try {
    policyReasons = expense?.policyReasons ? JSON.parse(expense.policyReasons) : [];
  } catch {
    policyReasons = [];
  }

  const isFinanceAdminOrManager = user?.role === "FINANCE_ADMIN" || user?.role === "MANAGER";
  const isEligibleForPayment =
    (expense?.status === "READY_FOR_PAYMENT" || expense?.status === "APPROVED" || expense?.status === "PAYMENT_FAILED") &&
    expense?.status !== "PAID" &&
    expense?.paymentStatus !== "PAID" &&
    expense?.status !== "BLOCKED" &&
    expense?.status !== "REJECTED";

  const isPaid = expense?.status === "PAID" || expense?.paymentStatus === "PAID";
  const isBlockedOrRejected = expense?.status === "BLOCKED" || expense?.status === "REJECTED";
  const isPendingApproval = expense?.status === "PENDING_APPROVAL";

  // Latest Receipt and Analysis
  const primaryReceipt = receipts.length > 0 ? receipts[0] : null;
  const primaryAnalysis = primaryReceipt?.receiptAnalyses?.[0] || null;

  let mismatchReasons: string[] = [];
  try {
    if (verification?.mismatchReasons) {
      mismatchReasons = typeof verification.mismatchReasons === "string"
        ? JSON.parse(verification.mismatchReasons)
        : verification.mismatchReasons;
    }
  } catch {
    mismatchReasons = [];
  }

  let lineItems: any[] = [];
  try {
    if (primaryAnalysis?.lineItems) {
      lineItems = typeof primaryAnalysis.lineItems === "string"
        ? JSON.parse(primaryAnalysis.lineItems)
        : primaryAnalysis.lineItems;
    }
  } catch {
    lineItems = [];
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <Link
          href="/expenses"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Expenses
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                {expense?.expenseNumber}
              </span>
              <span className="text-xs text-slate-500">
                Created on {new Date(expense?.expenseDate).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              {expense?.merchantName}
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Pay with Razorpay Button */}
            {isEligibleForPayment && isFinanceAdminOrManager && (
              <button
                onClick={() => setShowPayModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.02]"
              >
                <CreditCard className="w-4 h-4" />
                Pay with Razorpay (₹{expense?.amount.toLocaleString("en-IN")})
              </button>
            )}

            <button
              onClick={handleRunAIAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 hover:scale-[1.02]"
            >
              {analyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing Risk...
                </>
              ) : (
                <>
                  <BrainCircuit className="w-4 h-4" />
                  {ai ? "Re-run AI Risk Audit" : "Run AI Risk Audit"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2 animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Claim Summary & Receipt Intelligence (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Claim Summary Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-400" />
              Submitted Expense Claim
            </h2>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Claim Amount:</span>
                <span className="text-lg font-black font-mono text-white">
                  ₹{expense?.amount.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Claim Merchant:</span>
                <span className="text-xs font-bold text-slate-200">{expense?.merchantName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Category:</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700">
                  {expense?.category}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Submitter:</span>
                <span className="text-xs font-medium text-slate-200">
                  {expense?.employee?.name || expense?.employeeProfile?.user?.name || "Employee"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Department:</span>
                <span className="text-xs font-medium text-slate-200">
                  {expense?.department?.name || "General"}
                </span>
              </div>
            </div>

            {expense?.purpose && (
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Business Purpose</span>
                <p className="text-xs text-slate-300 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 leading-relaxed">
                  {expense.purpose}
                </p>
              </div>
            )}
          </div>

          {/* AI Receipt Intelligence Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-400" />
                Receipt / Invoice Intelligence
              </h2>
              {primaryAnalysis && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {primaryAnalysis.modelName || "gemini-1.5-flash"}
                </span>
              )}
            </div>

            {!primaryReceipt ? (
              <div className="p-6 rounded-xl bg-slate-950/60 border-2 border-dashed border-slate-800 text-center space-y-3">
                <UploadCloud className="w-8 h-8 text-slate-600 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-slate-300">No Receipt Document Attached</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Upload an invoice to extract structured items and verify the claim.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleUploadReceipt(e.target.files[0]);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingReceipt}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {uploadingReceipt ? "Uploading..." : "Upload Receipt"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Document Metadata Bar */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-xs">{primaryReceipt.fileName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {(primaryReceipt.fileSize / 1024).toFixed(1)} KB • {primaryReceipt.fileType}
                      </p>
                    </div>
                  </div>

                  <a
                    href={`/api/expenses/${id}/receipts/${primaryReceipt.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </a>
                </div>

                {!primaryAnalysis ? (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-400">Document uploaded but not analyzed yet.</p>
                    <button
                      onClick={() => handleAnalyzeReceiptDoc(primaryReceipt.id)}
                      disabled={analyzingReceipt}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <BrainCircuit className="w-4 h-4" />
                      {analyzingReceipt ? "Extracting..." : "Analyze Receipt"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Extracted Details Grid */}
                    <div className="grid grid-cols-2 gap-2.5 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Extracted Merchant</span>
                        <span className="font-semibold text-white">{primaryAnalysis.merchantName || "Unknown"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Extracted Total</span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          ₹{primaryAnalysis.totalAmount?.toLocaleString("en-IN") || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Invoice Number</span>
                        <span className="font-mono text-slate-300">{primaryAnalysis.invoiceNumber || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Document Date</span>
                        <span className="font-mono text-slate-300">{primaryAnalysis.transactionDate || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Tax / GST</span>
                        <span className="font-mono text-slate-400">
                          {primaryAnalysis.tax ? `₹${primaryAnalysis.tax.toLocaleString("en-IN")}` : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Confidence</span>
                        <span className="font-mono text-indigo-400 font-bold">
                          {Math.round((primaryAnalysis.confidence || 0.95) * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Extracted Line Items */}
                    {lineItems.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Extracted Line Items</span>
                        <div className="space-y-1 text-xs">
                          {lineItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-slate-300 py-1 border-b border-slate-900 last:border-0">
                              <span className="truncate pr-2">{item.name}</span>
                              <span className="font-mono font-semibold text-white shrink-0">
                                {item.total ? `₹${item.total.toLocaleString("en-IN")}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Expense Claim vs Document Verification (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Expense Verification Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Claim vs Receipt Verification
              </h2>
              {verification && (
                <button
                  onClick={handleRunVerification}
                  disabled={verifying}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${verifying ? "animate-spin" : ""}`} /> Re-verify
                </button>
              )}
            </div>

            {!verification ? (
              <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-dashed border-slate-800/80 space-y-2">
                <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-300">Verification Pending</p>
                <p className="text-[10px] text-slate-500">
                  Upload and analyze a receipt document to run automatic claim matching.
                </p>
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in">
                {/* Score & Gauge Header */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Verification Score</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-3xl font-black font-mono text-white">{verification.overallScore}</span>
                        <span className="text-xs text-slate-500 font-mono">/ 100</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                          verification.status === "VERIFIED"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : verification.status === "REVIEW_REQUIRED"
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {verification.status.replace("_", " ")}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Recommendation: <strong className="text-slate-300">{verification.recommendation}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Progress Gauge */}
                  <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        verification.overallScore >= 90
                          ? "bg-emerald-500"
                          : verification.overallScore >= 70
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, verification.overallScore))}%` }}
                    />
                  </div>
                </div>

                {/* Match Breakdown Checklist */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                    Claim Matching Breakdown
                  </span>

                  <div className="space-y-1.5 text-xs">
                    {/* Amount */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {verification.amountMatch ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="text-slate-300">Amount Match</span>
                      </div>
                      <div className="font-mono text-right">
                        <span className={verification.amountMatch ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                          {verification.amountScore} / 40 pts
                        </span>
                      </div>
                    </div>

                    {/* Merchant */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {verification.merchantMatch ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="text-slate-300">Merchant Identity</span>
                      </div>
                      <div className="font-mono text-right">
                        <span className={verification.merchantMatch ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                          {verification.merchantScore} / 25 pts
                        </span>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {verification.dateMatch ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className="text-slate-300">Date Window</span>
                      </div>
                      <div className="font-mono text-right">
                        <span className="text-slate-300 font-bold">{verification.dateScore} / 15 pts</span>
                      </div>
                    </div>

                    {/* Currency */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {verification.currencyMatch ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="text-slate-300">Currency</span>
                      </div>
                      <div className="font-mono text-right">
                        <span className="text-slate-300 font-bold">{verification.currencyScore} / 10 pts</span>
                      </div>
                    </div>

                    {/* Category */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {verification.categoryMatch ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className="text-slate-300">Category Compatibility</span>
                      </div>
                      <div className="font-mono text-right">
                        <span className="text-slate-300 font-bold">{verification.categoryScore} / 10 pts</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mismatch Warnings */}
                {mismatchReasons.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <span className="text-[10px] font-bold uppercase text-amber-400 block tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Discrepancies &amp; Review Signals
                    </span>
                    <ul className="space-y-1">
                      {mismatchReasons.map((reason: string, i: number) => (
                        <li key={i} className="text-xs text-amber-300 flex items-start gap-1.5">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Contextual Risk Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-400" />
                AI Contextual Risk Evaluation
              </h2>
              <span className="text-[10px] font-mono text-slate-500">
                Score: {riskScore !== null ? `${riskScore}/100` : "—"}
              </span>
            </div>

            {ai?.summary && (
              <p className="text-xs text-slate-300 p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 leading-relaxed">
                {ai.summary}
              </p>
            )}

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-slate-300 block">Separation Principle:</span>
              <p>Receipt verification verifies claim accuracy against documents. AI Risk analyzes contextual spending behavior. Hard spending policy remains absolute.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 text-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Confirm Razorpay Settlement</h3>
                  <p className="text-xs text-slate-400">Server-verified payment execution</p>
                </div>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Payment Summary */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Payable Amount:</span>
                <span className="text-xl font-mono font-black text-emerald-400">
                  ₹{expense?.amount?.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Recipient / Merchant:</span>
                <span className="font-semibold text-white">{expense?.merchantName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Expense Ref:</span>
                <span className="font-mono text-indigo-300">{expense?.expenseNumber}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Authorized Admin:</span>
                <span className="font-medium text-slate-300">{user?.name} ({user?.role})</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPayModal(false)}
                disabled={paying}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiatePayment}
                disabled={paying}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {paying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Executing Settlement...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Confirm &amp; Pay ₹{expense?.amount?.toLocaleString("en-IN")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
