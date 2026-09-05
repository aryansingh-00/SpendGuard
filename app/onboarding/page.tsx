"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe, Users, DollarSign, Loader2, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState("Acme Technologies");
  const [industry, setIndustry] = useState("Technology");
  const [size, setSize] = useState("51–200");
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry,
          size,
          currency,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to set up company.");
        setLoading(false);
        return;
      }

      await refreshUser();
      router.push("/dashboard");
    } catch {
      setError("An unexpected network error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-slate-950 text-white py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg space-y-6 relative z-10">
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              1
            </span>
            <span className="text-xs font-semibold text-white">Company Setup</span>
          </div>
          <span className="text-xs text-slate-400">Step 1 of 1</span>
        </div>

        {/* Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6 backdrop-blur-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>SpendGuard AI Workspace</span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">Create your company</h1>
            <p className="text-xs text-slate-400">
              Configure your organization to start setting up department budgets and spending controls.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Company Name *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Technologies"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Industry</label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Technology">Technology / SaaS</option>
                    <option value="Finance">Finance & Banking</option>
                    <option value="Healthcare">Healthcare & Pharma</option>
                    <option value="E-commerce">E-commerce & Retail</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Professional Services">Professional Services</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Company Size</label>
                <div className="relative">
                  <Users className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="1–10">1–10 Employees</option>
                    <option value="11–50">11–50 Employees</option>
                    <option value="51–200">51–200 Employees</option>
                    <option value="201–500">201–500 Employees</option>
                    <option value="500+">500+ Employees</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Default Currency
              </label>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-white">INR (₹) — Indian Rupee</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                  Default
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 font-bold text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50 transition-all text-xs pt-3 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Setting up company...</span>
                </>
              ) : (
                <>
                  <span>Create Workspace & Launch Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
