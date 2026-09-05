"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { UserData, Role } from "@/types";

interface AuthContextType {
  user: UserData | null;
  currentUser: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; needsCompanySetup?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  notificationsCount: number;
  refreshNotifications: () => Promise<void>;
  isFinanceAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notificationsCount, setNotificationsCount] = useState<number>(0);
  const router = useRouter();
  const pathname = usePathname();

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          return data.user;
        }
      }
      setUser(null);
      return null;
    } catch (err) {
      console.error("Failed to fetch session:", err);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotificationsCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    refreshNotifications();
  }, [fetchCurrentUser]);

  // Route protection effect
  useEffect(() => {
    if (loading) return;

    const publicRoutes = ["/login", "/register"];
    const isPublic = publicRoutes.includes(pathname);

    if (!user && !isPublic) {
      router.push("/login");
    } else if (user && isPublic) {
      if (!user.companyId) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } else if (user && !user.companyId && pathname !== "/onboarding") {
      router.push("/onboarding");
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      setUser(data.user);
      if (data.needsCompanySetup) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
      return { success: true };
    } catch {
      return { success: false, error: "Network error during login" };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Registration failed" };
      }

      setUser(data.user);
      router.push("/onboarding");
      return { success: true, needsCompanySetup: true };
    } catch {
      return { success: false, error: "Network error during registration" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      router.push("/login");
    }
  };

  const isFinanceAdmin = user?.role === "FINANCE_ADMIN";
  const isManager = user?.role === "MANAGER" || user?.role === "FINANCE_ADMIN";
  const isEmployee = user?.role === "EMPLOYEE";

  return (
    <AuthContext.Provider
      value={{
        user,
        currentUser: user,
        loading,
        login,
        register,
        logout,
        refreshUser: fetchCurrentUser,
        notificationsCount,
        refreshNotifications,
        isFinanceAdmin,
        isManager,
        isEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
