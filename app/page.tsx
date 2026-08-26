"use client";

import { useState, useEffect } from "react";
import { useAppStore, store } from "@/lib/store";
import AuthScreen from "@/components/AuthScreen";
import DashboardLayout from "@/components/DashboardLayout";

export default function HomePage() {
  const [isMounted, setIsMounted] = useState(false);
  const currentUserRole = useAppStore((s) => s.currentUserRole);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const isLockAccessEnabled = useAppStore((s) => s.isLockAccessEnabled);
  const lockAccessStart = useAppStore((s) => s.lockAccessStart);
  const lockAccessEnd = useAppStore((s) => s.lockAccessEnd);

  useEffect(() => {
    const t = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Check lockout periodically
  useEffect(() => {
    if (!isMounted) return;
    if (currentUserRole !== "secretary" || !currentUserId) return;

    const checkAccess = () => {
      store.checkLockoutAndAutoLogout();
    };

    // Run immediately and periodically
    checkAccess();
    const interval = setInterval(checkAccess, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isMounted, currentUserRole, currentUserId, isLockAccessEnabled, lockAccessStart, lockAccessEnd]);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-cairo" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">جاري تهيئة CenterFlow...</p>
        </div>
      </div>
    );
  }

  if (!currentUserRole) {
    return <AuthScreen />;
  }

  return <DashboardLayout />;
}
