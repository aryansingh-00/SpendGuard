"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  UploadCloud,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Building,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { ReceiptExtractionResult } from "@/types";

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExpenseModal({ isOpen, onClose, onSuccess }: ExpenseModalProps) {
  const { currentUser } = useAuth();

  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Software");
  const [purpose, setPurpose] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);

  // Receipt & OCR states
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ReceiptExtractionResult | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch employees
  useEffect(() => {
    if (isOpen) {
      fetch("/api/employees")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setEmployees(data);
            // Default to current user's employee if matches email, or first employee
            const match = data.find((e) => e.email === currentUser?.email);
            if (match) {
              setSelectedEmployeeId(match.id);
            } else if (data.length > 0) {
              setSelectedEmployeeId(data[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const categories = [
    "Advertising",
    "Software",
    "Cloud Infrastructure",
    "Developer Tools",
    "Client Entertainment",
    "Travel",
    "Meals",
    "Team Events",
    "Recruitment",
    "Office Supplies",
    "Cryptocurrency",
    "Hardware",
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFileName(file.name);
    setIsScanningReceipt(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const fileData = reader.result as string;

      try {
        const res = await fetch("/api/expenses/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileData,
            fileName: file.name,
            mimeType: file.type,
          }),
        });

        const json = await res.json();
        if (json.success && json.data) {
          const ext: ReceiptExtractionResult = json.data;
          setExtractedData(ext);
          if (ext.merchantName) setMerchantName(ext.merchantName);
          if (ext.amount) setAmount(ext.amount.toString());
          if (ext.category) setCategory(ext.category);
          if (ext.date) setExpenseDate(ext.date);
        }
      } catch (err) {
        console.error("OCR error:", err);
      } finally {
        setIsScanningReceipt(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!merchantName.trim() || !amount || parseFloat(amount) <= 0) {
      setError("Please provide a valid merchant name and amount.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          merchantName: merchantName.trim(),
          amount: parseFloat(amount),
          category,
          purpose: purpose.trim() || "Corporate business expenditure",
          expenseDate,
          receiptUrl: receiptFileName ? `/uploads/${receiptFileName}` : null,
          receiptData: extractedData
            ? { ...extractedData, fileName: receiptFileName }
            : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit expense.");
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Submission error:", err);
      setError("An unexpected error occurred while processing the expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEmp = employees.find((e) => e.id === selectedEmployeeId);
  const parsedAmount = parseFloat(amount) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 sm:p-8 text-white my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Create Expense Request</h2>
              <p className="text-xs text-slate-400">
                AI Controller verifies policies, risk score & budgets before submission
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Employee Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Submitter / Employee
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.department?.name || "General"} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>

          {/* Receipt Intelligence Upload Zone */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-dashed border-indigo-500/30 hover:border-indigo-500/60 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white">Receipt / Invoice AI OCR</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Upload PDF, PNG, or JPG receipt for automatic merchant, tax & total extraction.
                </p>
              </div>

              <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-md">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {isScanningReceipt && (
              <div className="mt-3 flex items-center gap-2 text-xs text-indigo-300 animate-pulse bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-500/30">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>SpendGuard AI OCR is extracting invoice details & checking duplicates...</span>
              </div>
            )}

            {extractedData && !isScanningReceipt && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Receipt Scanned Successfully ({receiptFileName})</span>
                  </div>
                  <span className="text-[10px] text-emerald-400/80 font-mono">
                    {(extractedData.confidenceScore * 100).toFixed(0)}% Confidence
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 font-mono mt-2">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Extracted Vendor</span>
                    {extractedData.merchantName || "—"}
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Invoice No.</span>
                    {extractedData.invoiceNumber || "—"}
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Tax / GST</span>
                    ₹{extractedData.taxAmount || 0}
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Detected Amount</span>
                    ₹{extractedData.amount || 0}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Fields: Merchant & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Merchant / Vendor Name *
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="e.g. Google Ads, AWS, Taj Dining"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount (₹ INR) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Expense Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Expense Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Business Purpose */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Business Purpose / Justification
            </label>
            <textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Explain the business context for this payment..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Live Policy Pre-Check Box */}
          {parsedAmount > 0 && selectedEmp && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <div>
                  <span className="text-slate-300 font-medium">Policy Pre-Evaluation:</span>{" "}
                  <span className="text-slate-400">
                    {category === "Cryptocurrency" || category === "Gambling" ? (
                      <span className="text-rose-400 font-semibold">Prohibited Category (Will be Blocked)</span>
                    ) : parsedAmount > 10000 ? (
                      <span className="text-amber-400 font-semibold">Requires Manager Approval (&gt; ₹10K)</span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">Eligible for Auto-Approval</span>
                    )}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Budget: ₹{selectedEmp.spentThisMonth.toLocaleString("en-IN")} / ₹{selectedEmp.monthlyBudget.toLocaleString("en-IN")}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing & Submitting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Submit Expense</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
