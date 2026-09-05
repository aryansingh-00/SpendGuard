"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, ShieldAlert, CheckCircle2, XCircle, CreditCard, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationDropdown() {
  const { notificationsCount, refreshNotifications } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true, userId: "all" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshNotifications();
    } catch {
      // ignore
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "EXPENSE_BLOCKED":
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case "PAYMENT_SUCCESS":
      case "EXPENSE_APPROVED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "EXPENSE_REJECTED":
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case "APPROVAL_REQUIRED":
        return <CreditCard className="w-4 h-4 text-amber-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {notificationsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
            {notificationsCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Notifications & Alerts</span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Live
              </span>
            </div>
            <button
              onClick={markAllAsRead}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark read
            </button>
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading alerts...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No new notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 hover:bg-slate-800/40 transition-colors ${
                    !n.isRead ? "bg-indigo-950/20" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-slate-800 border border-slate-700">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white leading-snug">{n.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => setIsOpen(false)}
                          className="inline-block mt-1 text-[11px] font-medium text-indigo-400 hover:underline"
                        >
                          View details →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
