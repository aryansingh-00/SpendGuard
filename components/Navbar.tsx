"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ChevronDown,
  User,
  LogOut,
  Building2,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { NotificationDropdown } from "./NotificationDropdown";

export function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!user) return null;

  const roleBadgeStyle =
    user.role === "FINANCE_ADMIN"
      ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
      : user.role === "MANAGER"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
                <ShieldCheck className="w-5 h-5 text-indigo-400 group-hover:text-emerald-400 transition-colors" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-white">SpendGuard</span>
                <span className="text-xs font-black tracking-widest px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  AI
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 hidden sm:block">
                Control every spend. Catch every risk.
              </p>
            </div>
          </Link>
        </div>

        {/* Center: Tenant badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-medium text-white">{user.company?.name || "Acme Technologies"}</span>
          <span className="text-[10px] text-slate-500 font-mono">({user.company?.currency || "INR"})</span>
        </div>

        {/* Right: User menu & notifications */}
        <div className="flex items-center gap-3">
          <NotificationDropdown />

          {/* User profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-700/80 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs ring-1 ring-indigo-500/40">
                {user.name.charAt(0)}
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-white leading-none">{user.name}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleBadgeStyle}`}>
                    {user.role}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{user.email}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 ml-0.5" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 overflow-hidden py-1">
                <div className="px-4 py-2.5 border-b border-slate-800">
                  <p className="text-xs font-bold text-white">{user.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${roleBadgeStyle}`}>
                    {user.role}
                  </span>
                </div>

                <div className="py-1 text-xs">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </Link>

                  <button
                    onClick={async () => {
                      setDropdownOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
