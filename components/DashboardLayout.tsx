"use client";

import { useState } from "react";
import { useAppStore, store, hasFullAccess } from "@/lib/store";
import { 
  LayoutDashboard, Users, ClipboardCheck, Wallet, Menu, 
  LogOut, FolderKanban, BookOpen, GraduationCap, FileCheck2, 
  Users2, Settings, RefreshCw, X, Sun, Moon, Send
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useDarkMode } from "@/hooks/useDarkMode";

import DashboardView from "./DashboardView";
import StudentsView from "./StudentsView";
import StudentProfileView from "./StudentProfileView";
import GroupsView from "./GroupsView";
import AttendanceView from "./AttendanceView";
import PaymentsView from "./PaymentsView";
import RecitationsView from "./RecitationsView";
import ExamsView from "./ExamsView";
import ReportsView from "./ReportsView";
import SettingsView from "./SettingsView";
import UsersView from "./UsersView";
import SyncHubView from "./SyncHubView";
import AdminPaymentsView from "./AdminPaymentsView";
import WhatsAppAutomationView from "./WhatsAppAutomationView";

export default function DashboardLayout() {
  const state = useAppStore((s) => s);
  const [isDark, toggleDarkMode] = useDarkMode();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [extraParams, setExtraParams] = useState<Record<string, string> | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const handleNavigate = (tabId: string, params?: Record<string, string>) => {
    setActiveTab(tabId);
    setIsMoreMenuOpen(false);
    if (params) {
      setExtraParams(params);
    } else {
      setExtraParams(null);
    }
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        store.logout();
        setShowLogoutConfirm(false);
      } else {
        const errorText = await res.text();
        console.error("Logout request failed with status:", res.status, errorText);
        alert("فشل تسجيل الخروج من الخادم.");
      }
    } catch (e) {
      console.error("Logout API error:", e);
      alert("حدث خطأ أثناء الاتصال بالخادم عند تسجيل الخروج.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getSubjectLabel = () => {
    switch(state.subject) {
      case "mathematics": return "الرياضيات 📐";
      case "physics": return "الفيزياء ⚡";
      case "chemistry": return "الكيمياء 🧪";
      case "science": return "العلوم 🔬";
      case "science_en": return "الساينس 🧬";
      case "math": return "الماث 🧮";
      case "arabic": return "اللغة العربية 📚";
      case "english": return "اللغة الانجليزية 🆎";
      case "social_studies": return "الدراسات 🌍";
      default: return "";
    }
  };

  // Check if active tab belongs to the "More" items category
  const moreTabIds = ["groups", "recitations", "exams", "reports", "users", "sync_hub", "settings", "whatsapp_automation"];
  const isMoreActive = moreTabIds.includes(activeTab);

  const handleBottomTabClick = (tabId: string) => {
    if (tabId === "more") {
      setIsMoreMenuOpen(true);
    } else {
      setIsMoreMenuOpen(false);
      setActiveTab(tabId);
      setExtraParams(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200" dir="rtl" id="dashboard_shell_layout">
      {/* Top Simple Header */}
      <header className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100/80 dark:border-slate-800/80 px-4 py-2.5 flex items-center justify-between z-30 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
        <div 
          onClick={() => handleBottomTabClick("dashboard")}
          className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-all duration-200 select-none"
          title="الرئيسية"
        >
          {/* CenterFlow Logo Emblem */}
          <div className="relative flex items-center justify-center w-9.5 h-9.5 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 shadow-md shadow-blue-500/10 transition-all duration-300 group-hover:rotate-6 group-hover:scale-105">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="w-5 h-5 text-white animate-pulse"
            >
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" strokeDasharray="3 2" />
              <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor" className="text-white/80" />
              <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" />
            </svg>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
          </div>

          <div>
            <h1 className="text-sm font-black tracking-wide text-slate-900 dark:text-white leading-none flex items-center gap-1 group-hover:text-blue-600 transition-colors uppercase font-mono">
              Center<span className="text-blue-600">Flow</span>
            </h1>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold block mt-0.5 font-cairo">منصة الإدارة السحابية الذكية</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Database Sync Status Indicator */}
          <div 
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-150 dark:border-slate-700/70 rounded-xl select-none shadow-3xs transition-all duration-350"
            title={
              state.syncStatus === "syncing" 
                ? "جاري مزامنة البيانات والربط بقاعدة البيانات السحابية..." 
                : state.syncStatus === "offline" 
                  ? "وضع عدم الاتصال: جاري حفظ العمليات محلياً" 
                  : "تمت مزامنة البيانات والاتصال بالقاعدة السحابية بنجاح"
            }
          >
            <span className="relative flex h-2 w-2">
              {state.syncStatus === "syncing" ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </>
              ) : state.syncStatus === "offline" ? (
                <>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </>
              ) : state.syncStatus === "auth_error" ? (
                <>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 animate-pulse"></span>
                </>
              ) : state.syncStatus === "server_error" ? (
                <>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400"></span>
                </>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              )}
            </span>
            <span className="text-[9px] font-black font-sans leading-none">
              {state.syncStatus === "syncing" ? (
                <span className="text-amber-600 dark:text-amber-400 text-3xs">جاري المزامنة السحابية...</span>
              ) : state.syncStatus === "offline" ? (
                <span className="text-amber-600 dark:text-amber-400 text-3xs">مؤقت محلياً (أوفلاين)</span>
              ) : state.syncStatus === "auth_error" ? (
                <span className="text-rose-600 dark:text-rose-400 text-3xs">غير مسجل بالسيرفر</span>
              ) : state.syncStatus === "server_error" ? (
                <span className="text-rose-600 dark:text-rose-400 text-3xs">خطأ اتصال بالخادم</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 text-3xs">متصل بـ Neon SQL ⚡</span>
              )}
            </span>
          </div>

          {/* Dark Mode Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            type="button"
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-500 dark:text-amber-400 border border-slate-200 dark:border-slate-700 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 flex items-center justify-center shadow-3xs"
            title={isDark ? "تغيير للمظهر المضيء" : "تغيير للمظهر الداكن"}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          <span className="text-[10px] px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-lg shadow-2xs font-sans">
            {state.currentUserName} ({state.currentUserRole === "teacher" ? "أدمن" : hasFullAccess(state) ? "مشرف (كامل الصلاحية)" : "مشرف"})
          </span>
          <button 
            onClick={handleLogout}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 rounded-xl transition-all duration-200 cursor-pointer active:scale-90"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Core View Area */}
      <main className="flex-1 pb-32 max-w-lg w-full mx-auto px-4 pt-4 overflow-y-auto">
        {activeTab === "dashboard" && <DashboardView onNavigate={handleNavigate} />}
        {activeTab === "students" && <StudentsView onNavigate={handleNavigate} groupId={extraParams?.groupId} />}
        {activeTab === "student_profile" && <StudentProfileView studentId={extraParams?.id} onNavigate={handleNavigate} />}
        {activeTab === "groups" && <GroupsView onNavigate={handleNavigate} />}
        {activeTab === "attendance" && <AttendanceView />}
        {activeTab === "payments" && <PaymentsView />}
        {activeTab === "recitations" && <RecitationsView />}
        {activeTab === "exams" && <ExamsView />}
        {activeTab === "reports" && <ReportsView />}
        {activeTab === "settings" && <SettingsView />}
        {activeTab === "users" && <UsersView />}
        {activeTab === "sync_hub" && <SyncHubView />}
        {activeTab === "admin_payments" && <AdminPaymentsView onNavigate={handleNavigate} />}
        {activeTab === "whatsapp_automation" && <WhatsAppAutomationView />}
      </main>

      {/* Floating Bottom Navigation – MAXIMAL 5 items of highest frequency */}
      <div 
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-32px)] max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-1.5 flex items-center justify-around shadow-[0_12px_36px_rgba(30,41,59,0.08)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-lg" 
        id="mobile_bottom_bar"
      >
        {/* Term 1: الرئيسية */}
        <button
          onClick={() => handleBottomTabClick("dashboard")}
          className={`relative flex flex-col items-center justify-center py-2 px-1 flex-1 transition-all duration-200 rounded-xl cursor-pointer ${
            activeTab === "dashboard" 
              ? "text-blue-600 dark:text-blue-400 font-extrabold" 
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 active:scale-95"
          }`}
        >
          {activeTab === "dashboard" && (
            <span className="absolute inset-0 bg-blue-50/50 dark:bg-blue-950/40 rounded-xl" />
          )}
          <span className="relative flex flex-col items-center">
            <LayoutDashboard className={`w-5 h-5 transition-transform duration-200 ${activeTab === "dashboard" ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-1 font-extrabold">الرئيسية</span>
          </span>
        </button>

        {/* Term 2: الطلاب */}
        <button
          onClick={() => handleBottomTabClick("students")}
          className={`relative flex flex-col items-center justify-center py-2 px-1 flex-1 transition-all duration-200 rounded-xl cursor-pointer ${
            (activeTab === "students" || activeTab === "student_profile") 
              ? "text-blue-600 dark:text-blue-400 font-extrabold" 
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 active:scale-95"
          }`}
        >
          {(activeTab === "students" || activeTab === "student_profile") && (
            <span className="absolute inset-0 bg-blue-50/50 dark:bg-blue-950/40 rounded-xl" />
          )}
          <span className="relative flex flex-col items-center">
            <Users className={`w-5 h-5 transition-transform duration-200 ${(activeTab === "students" || activeTab === "student_profile") ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-1 font-extrabold">الطلاب</span>
          </span>
        </button>

        {/* Term 3: الحضور */}
        <button
          onClick={() => handleBottomTabClick("attendance")}
          className={`relative flex flex-col items-center justify-center py-2 px-1 flex-1 transition-all duration-200 rounded-xl cursor-pointer ${
            activeTab === "attendance" 
              ? "text-blue-600 dark:text-blue-400 font-extrabold" 
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 active:scale-95"
          }`}
        >
          {activeTab === "attendance" && (
            <span className="absolute inset-0 bg-blue-50/50 dark:bg-blue-950/40 rounded-xl" />
          )}
          <span className="relative flex flex-col items-center">
            <ClipboardCheck className={`w-5 h-5 transition-transform duration-200 ${activeTab === "attendance" ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-1 font-extrabold">الحضور</span>
          </span>
        </button>

        {/* Term 4: المدفوعات */}
        <button
          onClick={() => handleBottomTabClick("payments")}
          className={`relative flex flex-col items-center justify-center py-2 px-1 flex-1 transition-all duration-200 rounded-xl cursor-pointer ${
            activeTab === "payments" 
              ? "text-blue-600 dark:text-blue-400 font-extrabold" 
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 active:scale-95"
          }`}
        >
          {activeTab === "payments" && (
            <span className="absolute inset-0 bg-blue-50/50 dark:bg-blue-950/40 rounded-xl" />
          )}
          <span className="relative flex flex-col items-center">
            <Wallet className={`w-5 h-5 transition-transform duration-250 ${activeTab === "payments" ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-1 font-extrabold">المدفوعات</span>
          </span>
        </button>

        {/* Term 5: المزيد */}
        <button
          onClick={() => handleBottomTabClick("more")}
          className={`relative flex flex-col items-center justify-center py-2 px-1 flex-1 transition-all duration-200 rounded-xl cursor-pointer ${
            isMoreActive 
              ? "text-blue-600 dark:text-blue-400 font-extrabold" 
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 active:scale-95"
          }`}
        >
          {isMoreActive && (
            <span className="absolute inset-0 bg-blue-50/50 dark:bg-blue-950/40 rounded-xl" />
          )}
          <span className="relative flex flex-col items-center">
            <Menu className={`w-5 h-5 transition-transform duration-200 ${isMoreActive ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-1 font-extrabold">المزيد</span>
          </span>
        </button>
      </div>

      {/* MORE OPTIONS FULL-SCREEN/HALF-HEIGHT DIRECT DRAWER POPUP */}
      {isMoreMenuOpen && (
        <div 
          onClick={() => setIsMoreMenuOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-end justify-center px-4 transition-all duration-300 animate-fade-in" 
          id="more_overlay_menu"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-t-3xl max-w-md w-full p-6 pb-8 space-y-6 shadow-2xl relative border-t border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto animate-slide-up"
          >
            {/* Header row in sheet */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">باقي خدمات النظام</h3>
              <button 
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct list of secondary screens */}
            <div className="grid grid-cols-2 gap-3" id="more_features_grid">
              {/* Groups */}
              <button
                onClick={() => handleNavigate("groups")}
                className="flex flex-col items-start p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 active:scale-95 transition border border-slate-200 dark:border-slate-800 rounded-2xl text-right space-y-1 cursor-pointer w-full text-slate-800 dark:text-slate-100"
              >
                <FolderKanban className="w-5 h-5 text-amber-500" />
                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">المجموعات</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">إعداد فترات الحصص</span>
              </button>

              {/* Recitations */}
              <button
                onClick={() => handleNavigate("recitations")}
                className="flex flex-col items-start p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 active:scale-95 transition border border-slate-200 dark:border-slate-800 rounded-2xl text-right space-y-1 cursor-pointer w-full text-slate-800 dark:text-slate-100"
              >
                <BookOpen className="w-5 h-5 text-purple-500" />
                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">التسميعات</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">درجات التسميع الشفوي</span>
              </button>

              {/* Exams */}
              <button
                onClick={() => handleNavigate("exams")}
                className="flex flex-col items-start p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 active:scale-95 transition border border-slate-200 dark:border-slate-800 rounded-2xl text-right space-y-1 cursor-pointer w-full text-slate-800 dark:text-slate-100"
              >
                <GraduationCap className="w-5 h-5 text-indigo-500" />
                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">الامتحانات</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">رصد وحفظ كشوف المواد</span>
              </button>

              {/* Reports */}
              {(state.currentUserRole === "teacher" || state.currentUserRole === "secretary") && (
                <button
                  onClick={() => handleNavigate("reports")}
                  className="flex flex-col items-start p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 active:scale-95 transition border border-slate-200 dark:border-slate-800 rounded-2xl text-right space-y-1 cursor-pointer w-full text-slate-800 dark:text-slate-100"
                >
                  <FileCheck2 className="w-5 h-5 text-emerald-500" />
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">التقارير</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">استخراج PDF وواتساب</span>
                </button>
              )}

              {/* Admin Payments (Teacher / Admin only) */}
              {state.currentUserRole === "teacher" && (
                <button
                  onClick={() => handleNavigate("admin_payments")}
                  className="flex flex-col items-start p-4 bg-emerald-500/10 dark:bg-emerald-950/20 hover:bg-emerald-500/20 dark:hover:bg-emerald-900/30 active:scale-95 transition border border-emerald-150 dark:border-emerald-900/40 rounded-2xl text-right space-y-1 col-span-2 cursor-pointer w-full text-slate-800 dark:text-slate-100"
                >
                  <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-450 animate-bounce" />
                  <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">صندوق الإيرادات والتحصيل (الأدمن) 💰</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">كشف فواتير اليوم والتحصيل الشهري الشامل وإجمالي الخزينة ماليًا</span>
                </button>
              )}

              {/* Secretaries */}
              {hasFullAccess(state) && (
                <button
                  onClick={() => handleNavigate("users")}
                  className="flex flex-col items-start p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 active:scale-95 transition border border-slate-200 dark:border-slate-800 rounded-2xl text-right space-y-1 col-span-2 cursor-pointer w-full text-slate-800 dark:text-slate-100"
                >
                  <Users2 className="w-5 h-5 text-blue-500" />
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">إدارة السكرتارية والمشرفين</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">إدارة من لديهم صلاحيات رصد بالمركز</span>
                </button>
              )}

              {/* Sync Room */}
              <button
                onClick={() => handleNavigate("sync_hub")}
                className="flex flex-col items-start p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 active:scale-95 transition border border-slate-200 dark:border-slate-800 rounded-2xl text-right space-y-1 cursor-pointer w-full text-slate-800 dark:text-slate-100"
              >
                <RefreshCw className="w-5 h-5 text-slate-500" />
                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">غرفة المزامنة</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">سجل عمليات السنتر للربط</span>
              </button>

              {/* WhatsApp Automation */}
              <button
                onClick={() => handleNavigate("whatsapp_automation")}
                className="flex flex-col items-start p-4 bg-emerald-500/10 dark:bg-emerald-950/30 hover:bg-emerald-500/20 dark:hover:bg-emerald-900/40 active:scale-95 transition border border-emerald-200 dark:border-emerald-800 rounded-2xl text-right space-y-1 col-span-2 cursor-pointer w-full text-slate-800 dark:text-slate-100"
              >
                <Send className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                <span className="font-extrabold text-xs text-slate-900 dark:text-white">أتمتة الواتساب التلقائي (Chrome Extension) 🚀</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">إرسال تقارير التسميع والامتحانات تلقائياً لأولياء الأمور مجاناً 100%</span>
              </button>

              {/* Settings */}
              <button
                onClick={() => handleNavigate("settings")}
                className="flex flex-col items-start p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 active:scale-95 transition border border-slate-200 dark:border-slate-800 rounded-2xl text-right space-y-1 cursor-pointer w-full text-slate-800 dark:text-slate-100"
              >
                <Settings className="w-5 h-5 text-pink-500" />
                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">الإعدادات</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">التحكم وضبط أرشفة العام</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            {/* Content card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl relative border border-slate-150 dark:border-slate-800 w-full max-w-xs text-center space-y-5 z-10"
              dir="rtl"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-500">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">تسجيل الخروج</h3>
                <p className="text-3xs text-slate-450 dark:text-slate-550 font-extrabold">هل أنت متأكد من رغبتك في تسجيل الخروج والعودة لشاشة الدخول؟</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  disabled={isLoggingOut}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 active:scale-98 transition text-white text-[11px] font-black rounded-xl cursor-pointer shadow-xs select-none"
                >
                  {isLoggingOut ? "جاري الخروج..." : "نعم، خروج"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-98 transition text-slate-650 dark:text-slate-300 text-[11px] font-black rounded-xl cursor-pointer select-none"
                >
                  إلغاء الأمر
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
