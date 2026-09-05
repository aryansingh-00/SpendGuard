"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Building2,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Lock,
  Save,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setName(data.name || "");
        setJobTitle(data.jobTitle || "");
      }
    } catch {
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          jobTitle: jobTitle.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update profile.");
        setSaving(false);
        return;
      }

      setSavedSuccess(true);
      await refreshUser();
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      setError("Network error while saving profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        <span>Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          User Account & Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Manage your personal details and view your assigned company role and permissions.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Profile information updated successfully.</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Form */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xl ring-2 ring-indigo-500/40">
            {profile?.name?.charAt(0) || "U"}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{profile?.name}</h2>
            <p className="text-xs text-slate-400 font-mono">{profile?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Editable Name */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          {/* Non-editable Email */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Email Address (Fixed)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 cursor-not-allowed font-mono"
              />
            </div>
          </div>

          {/* Editable Job Title */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Job Title
            </label>
            <div className="relative">
              <Briefcase className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Finance Controller"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Non-editable Role & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                Security Role (Protected)
              </span>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-white font-mono">{profile?.role}</span>
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                <Lock className="w-3 h-3" /> Managed by company administrator
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                Company Workspace
              </span>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-white truncate">
                  {profile?.company?.name || "Acme Technologies"}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Currency: {profile?.company?.currency || "INR (₹)"}
              </p>
            </div>
          </div>

          {profile?.department && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                Assigned Department
              </span>
              <p className="text-white font-semibold">
                {profile.department.name} ({profile.department.code || "DEPT"})
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
