"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, Mail, Loader2, ArrowRight, Sparkles, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || "Invalid credentials.");
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password@123");
    setLoading(true);
    setError(null);
    const result = await login(demoEmail, "Password@123");
    if (!result.success) {
      setError(result.error || "Failed to log in.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-slate-950 text-white py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-400 p-0.5 shadow-xl shadow-indigo-500/20 mb-2">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">SpendGuard AI</h1>
          <p className="text-xs text-slate-400">Control every spend. Catch every risk.</p>
        </div>

        {/* Login Box */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-5 backdrop-blur-sm">
          <div>
            <h2 className="text-base font-bold text-white">Sign in to your account</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Access your company finance controller dashboard
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@acme.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-300">Password</label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 font-bold text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50 transition-all text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins for Hackathon Evaluators */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block text-center">
              One-Click Demo Personas (Password: Password@123)
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickLogin("admin@acme.com")}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-left transition-colors flex flex-col"
              >
                <span className="font-semibold text-white">Siddharth V.</span>
                <span className="text-[9px] text-purple-400 font-bold">FINANCE_ADMIN</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("manager@acme.com")}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-left transition-colors flex flex-col"
              >
                <span className="font-semibold text-white">Ananya I.</span>
                <span className="text-[9px] text-amber-400 font-bold">MANAGER</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("rahul@acme.com")}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-left transition-colors flex flex-col"
              >
                <span className="font-semibold text-white">Rahul (Mkt)</span>
                <span className="text-[9px] text-emerald-400 font-bold">EMPLOYEE</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("priya@acme.com")}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-left transition-colors flex flex-col"
              >
                <span className="font-semibold text-white">Priya (Eng)</span>
                <span className="text-[9px] text-emerald-400 font-bold">EMPLOYEE</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          Need a new company workspace?{" "}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold">
            Register company →
          </Link>
        </p>
      </div>
    </div>
  );
}
