"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldCheck,
  Receipt,
  ArrowLeftRight,
  CheckSquare,
  BrainCircuit,
  Settings,
  User,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const role = user.role;

  // Role-based navigation matrix
  let navItems: { name: string; href: string; icon: any }[] = [];

  if (role === "FINANCE_ADMIN") {
    navItems = [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Employees", href: "/dashboard/employees", icon: Users },
      { name: "Departments", href: "/dashboard/departments", icon: Building2 },
      { name: "Spending Policies", href: "/dashboard/policies", icon: ShieldCheck },
      { name: "Policy Simulator", href: "/dashboard/policies/simulator", icon: Sparkles },
      { name: "Expenses", href: "/expenses", icon: Receipt },
      { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
      { name: "Approval Center", href: "/dashboard/approvals", icon: CheckSquare },
      { name: "AI Insights", href: "/insights", icon: BrainCircuit },
      { name: "Settings", href: "/settings", icon: Settings },
    ];
  } else if (role === "MANAGER") {
    navItems = [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Employees", href: "/dashboard/employees", icon: Users },
      { name: "Spending Policies", href: "/dashboard/policies", icon: ShieldCheck },
      { name: "Policy Simulator", href: "/dashboard/policies/simulator", icon: Sparkles },
      { name: "Expenses", href: "/expenses", icon: Receipt },
      { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
      { name: "Approval Center", href: "/dashboard/approvals", icon: CheckSquare },
      { name: "AI Insights", href: "/insights", icon: BrainCircuit },
    ];
  } else {
    // EMPLOYEE
    navItems = [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Submit Expense", href: "/dashboard/expenses/new", icon: Receipt },
      { name: "My Expenses", href: "/expenses", icon: Receipt },
      { name: "Approval Status", href: "/dashboard/approvals", icon: CheckSquare },
      { name: "My Transactions", href: "/transactions", icon: ArrowLeftRight },
      { name: "Profile", href: "/dashboard/profile", icon: User },
    ];
  }

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/60 hidden lg:flex flex-col justify-between py-6 px-4">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            {role === "FINANCE_ADMIN"
              ? "Finance Administration"
              : role === "MANAGER"
              ? "Management Console"
              : "Employee Portal"}
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/80"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-indigo-400" : "text-slate-400"
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Multi-Tenant Company Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white">Active Tenant</span>
          </div>
          <p className="text-xs font-semibold text-indigo-300 truncate">
            {user.company?.name || "Acme Technologies"}
          </p>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Role:</span>
            <span className="text-emerald-400 font-bold">{role}</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-900 px-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>SpendGuard AI</span>
        <span>v0.2.0</span>
      </div>
    </aside>
  );
}
