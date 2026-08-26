"use client";

import { useState } from "react";
import { useAppStore, store, PaymentRecord } from "@/lib/store";
import { 
  Wallet, Coins, CalendarDays, Trash2, ShieldAlert, ArrowLeft, UserCheck, Search, Filter
} from "lucide-react";
import { motion } from "motion/react";

interface AdminPaymentsViewProps {
  onNavigate: (tabId: string, params?: Record<string, string>) => void;
}

export default function AdminPaymentsView({ onNavigate }: AdminPaymentsViewProps) {
  const state = useAppStore((s) => s);
  
  // Guard access to admin/teacher role only
  const isAdmin = state.currentUserRole === "teacher";

  // Date selection states
  const [selectedDay, setSelectedDay] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [filterGroupId, setFilterGroupId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 shadow-sm border border-rose-100 dark:border-rose-900/40 animate-pulse">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">بوابة محظورة الصلاحية ✋</h2>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-extrabold max-w-xs leading-relaxed">
            عذراً! هذه لوحة الرقابة المالية السحابية لمقبوضات السنتر وتدخل الإداريين فقط. يرجى مراجعة المعلم المسؤول.
          </p>
        </div>
        <button
          onClick={() => onNavigate("dashboard")}
          className="py-2.5 px-4 bg-slate-100 dark:bg-slate-850 hover:bg-slate-250 border border-slate-200 dark:border-slate-800 rounded-xl text-3xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>العودة للرئيسية</span>
        </button>
      </div>
    );
  }

  // Helper arrays & lookups
  const getStudentName = (sid: string) => state.students.find(s => s.id === sid)?.name || "طالب غير مسجل";
  const getGroupNameOfStudent = (sid: string) => {
    const student = state.students.find(s => s.id === sid);
    if (!student) return "بدون مجموعة";
    return state.groups.find(g => g.id === student.groupId)?.name || "بدون مجموعة";
  };

  // 1. FILTERING DATA FOR TODAY (Selected Day)
  const todayPayments = state.payments.filter(p => {
    const matchesDay = p.date && p.date.startsWith(selectedDay);
    if (!matchesDay) return false;
    
    const student = state.students.find(s => s.id === p.studentId);
    if (!student) return filterGroupId === "all";
    if (filterGroupId !== "all" && student.groupId !== filterGroupId) return false;

    if (searchTerm) {
      const nameMatch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
      const notesMatch = p.notes?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const recMatch = p.recordedByName?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      return nameMatch || notesMatch || recMatch;
    }
    return true;
  });

  const todayTotalRevenue = todayPayments.reduce((sum, p) => sum + p.amount, 0);

  // 2. FILTERING DATA FOR SELECTED MONTH
  const monthPayments = state.payments.filter(p => {
    const matchesMonth = p.date && p.date.startsWith(selectedMonth);
    if (!matchesMonth) return false;

    const student = state.students.find(s => s.id === p.studentId);
    if (!student) return filterGroupId === "all";
    if (filterGroupId !== "all" && student.groupId !== filterGroupId) return false;

    if (searchTerm) {
      const nameMatch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
      const notesMatch = p.notes?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const recMatch = p.recordedByName?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      return nameMatch || notesMatch || recMatch;
    }
    return true;
  });

  const monthTotalRevenue = monthPayments.reduce((sum, p) => sum + p.amount, 0);

  // Delete payment confirmation
  const handleDeletePayment = (paymentId: string) => {
    const payment = state.payments.find(p => p.id === paymentId);
    if (!payment) return;
    const name = getStudentName(payment.studentId);
    const confirmed = window.confirm(`هل أنت متأكد من رغبتك في حذف دفعة الطالب (${name}) بقيمة ${payment.amount} ج.م؟ سيتم خصمها من الخزينة فوراً.`);
    if (confirmed) {
      store.deletePayment(paymentId);
    }
  };

  return (
    <div className="space-y-5 font-sans" dir="rtl" id="admin_payments_dashboard_view">
      {/* Page Header banner */}
      <div className="relative overflow-hidden bg-gradient-to-tr from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-950 p-5 rounded-3xl text-white shadow-md border border-slate-800/85">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
              <Wallet className="w-5 h-5 animate-pulse" />
            </div>
            <span className="text-[10px] uppercase font-mono font-extrabold tracking-widest bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-lg border border-emerald-500/15">
              Teacher Control Suite
            </span>
          </div>
          <h2 className="text-md font-black tracking-tight pt-1">تقرير الخزينة والإيرادات السحابية</h2>
          <p className="text-[10.5px] text-slate-300 font-extrabold max-w-sm leading-relaxed">
            متابعة وتحليل النقدية المستلمة في السنتر لليوم المختار وللشهر بالكامل والمزامنة التلقائية مع Neon.
          </p>
        </div>
        {/* Subtle background graphic */}
        <div className="absolute top-0 left-0 w-36 h-36 bg-blue-600/10 rounded-full blur-3xl -translate-x-10 -translate-y-10" />
      </div>

      {/* KPI STATISTICS METRICS GRID */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Today's Stats Card */}
        <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl relative overflow-hidden shadow-3xs flex flex-col justify-between h-28">
          <div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black block">إيراد مقبوضات اليوم 📌</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-350 font-mono block mt-1 leading-none">
              {todayTotalRevenue} <span className="text-2xs font-extrabold font-sans">ج.م</span>
            </span>
          </div>
          <span className="text-[9.5px] text-slate-450 dark:text-slate-400 block font-bold mt-1">
            إجمالي {todayPayments.length} فواتير تحصيل مستلمة
          </span>
          <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <Coins className="w-6 h-6 text-emerald-500/30" />
          </div>
        </div>

        {/* Current Month's Stats Card */}
        <div className="p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 dark:from-blue-950/20 dark:to-slate-900 border border-blue-100 dark:border-blue-900/30 rounded-3xl relative overflow-hidden shadow-3xs flex flex-col justify-between h-28">
          <div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-black block">مجموع المقبوضات لشهر الفوترة 📅</span>
            <span className="text-lg font-black text-blue-700 dark:text-blue-350 font-mono block mt-1 leading-none">
              {monthTotalRevenue} <span className="text-2xs font-extrabold font-sans">ج.م</span>
            </span>
          </div>
          <span className="text-[9.5px] text-slate-450 dark:text-slate-400 block font-bold mt-1">
            إجمالي {monthPayments.length} عمليات دفع مسجلة بالدورة
          </span>
          <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
            <CalendarDays className="w-6 h-6 text-blue-500/30" />
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTER CRITERIA BOX */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4 rounded-3xl space-y-3 shadow-3xs">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Filter className="w-4 h-4 text-blue-500" />
          <span>تحديد وضبط فترة مقبوضات الخزينة والمعايير</span>
        </div>

        {/* Triple parameters selection block */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-[10px] font-black block mb-1">تفريغ غطاء التاريخ اليومي:</label>
              <input 
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-bold text-xs focus:outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-slate-500 dark:text-slate-400 text-[10px] font-black block mb-1">أشمل الشهر المالي:</label>
              <input 
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-bold text-xs focus:outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-[10px] font-black block mb-1">المجموعة المستهدفة:</label>
              <select
                value={filterGroupId}
                onChange={(e) => setFilterGroupId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-xs focus:outline-none focus:bg-white text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                <option value="all">كل المجموعات والسنتر</option>
                {state.groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-500 dark:text-slate-400 text-[10px] font-black block mb-1">بحث نصي بالاسم والمذكرات:</label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="ابحث بالاسم، المستلم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 pr-8 font-bold text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABBED PANELS LIST */}
      <div className="space-y-4">
        {/* Toggle Sections Headers */}
        <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-1 px-1">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>كشف إيرادات اليوم المختار ({todayPayments.length} مقبوضات):</span>
          </h3>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">خزينة السنتر</span>
        </div>

        {todayPayments.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 text-center rounded-2xl text-slate-450 dark:text-slate-500 font-bold text-3xs">
            لا تتوفر أي إيرادات مدونة لليوم المختار ({selectedDay}) تطابق شروط التصفية المفعلة.
          </div>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {todayPayments.map(p => (
              <div 
                key={p.id}
                className="p-3.5 bg-gradient-to-r from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-950 border border-slate-150 dark:border-slate-800 rounded-2xl flex justify-between items-center border-r-4 border-r-emerald-500 shadow-3xs hover:shadow-2xs transition-all duration-150"
              >
                <div>
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 block">{getStudentName(p.studentId)}</span>
                  <span className="text-[9.5px] text-slate-450 dark:text-slate-450 font-bold block mt-1 leading-relaxed">
                    مجموعة: {getGroupNameOfStudent(p.studentId)} | لشهر: {p.month} | الوقت: {p.date ? (p.date.split(" ")[1] || "—") : "—"}
                  </span>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[8.5px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black px-2 py-0.5 rounded flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-emerald-500" />
                      <span>المستلم: {p.recordedByName || p.recordedBy}</span>
                    </span>
                    {p.notes && (
                      <span className="text-[8.5px] text-amber-600 dark:text-amber-500 font-extrabold bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-100/30">
                        ملاحظات: {p.notes}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 font-black font-mono text-xs bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-3 py-1 rounded-xl shadow-3xs">
                    +{p.amount} ج.م
                  </span>
                  <button
                    onClick={() => handleDeletePayment(p.id)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900 text-rose-500 rounded-lg cursor-pointer transition active:scale-90 border border-rose-100 dark:border-rose-900/40 shadow-3xs shrink-0"
                    title="حذف هذا الإيراد من الخزينة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section 2: Month receipts list */}
        <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pt-3 pb-1 px-1">
          <h3 className="text-xs font-black text-slate-850 dark:text-slate-200 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
            <span>كشف مقبوضات الشهر بأكمله ({monthPayments.length} مقبوضات):</span>
          </h3>
          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{selectedMonth}</span>
        </div>

        {monthPayments.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 text-center rounded-2xl text-slate-450 dark:text-slate-500 font-bold text-3xs">
            لا توجد أي إيرادات مدونة لعام أو شهر الفوترة المختار ({selectedMonth}) بالكامل.
          </div>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {monthPayments.map(p => (
              <div 
                key={p.id}
                className="p-3 bg-gradient-to-r from-white to-slate-50/20 dark:from-slate-900 dark:to-slate-950 border border-slate-150 dark:border-slate-800 rounded-2xl flex justify-between items-center border-r-4 border-r-blue-500 shadow-3xs hover:shadow-2xs transition-all"
              >
                <div>
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 block">{getStudentName(p.studentId)}</span>
                  <span className="text-[9.5px] text-slate-450 dark:text-slate-400 block font-bold mt-1 leading-relaxed">
                    اليوم: {p.date ? (p.date.split(" ")[0] || "—") : "—"} | مجموعة: {getGroupNameOfStudent(p.studentId)} | الحساب: {p.month}
                  </span>
                  <span className="text-[8.5px] text-slate-400 block mt-1">المدون: {p.recordedByName || p.recordedBy}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-black font-mono text-2xs bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 px-3 py-1 rounded-xl shadow-3xs">
                    +{p.amount} ج.م
                  </span>
                  <button
                    onClick={() => handleDeletePayment(p.id)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900 text-rose-500 rounded-lg cursor-pointer transition active:scale-90 border border-rose-100 dark:border-rose-900/40 shadow-3xs shrink-0"
                    title="حذف هذا الإيراد من الخزينة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Return Button */}
      <div className="pt-2">
        <button
          onClick={() => onNavigate("dashboard")}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-black text-2xs rounded-2xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs border border-slate-200 dark:border-slate-700/80 active:scale-98"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>العودة لشاشة لوحة التحكم الإحصائية</span>
        </button>
      </div>
    </div>
  );
}
