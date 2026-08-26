"use client";

import { useState } from "react";
import { useAppStore, store } from "@/lib/store";
import { 
  UserPlus, CalendarCheck, Wallet, FileSpreadsheet, 
  Users, Layers, Award, Sparkles, TrendingUp,
  Database, Download, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DashboardViewProps {
  onNavigate: (view: string, extraParams?: Record<string, string>) => void;
}

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const state = useAppStore((s) => s);
  const [backupSuccess, setBackupSuccess] = useState(false);

  const handleManualBackup = () => {
    try {
      const rawData = store.getState();
      const jsonString = JSON.stringify(rawData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.setAttribute("download", `نسخة_احتياطية_كاملة_CenterFlow_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
      
      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 4400);
    } catch (err) {
      console.error("Manual backup error:", err);
    }
  };
  
  // Calculate Today's Counts based on ISO string or standard current date
  const todayStr = new Date().toISOString().split("T")[0];
  
  const todayAttendanceLogs = state.attendance.filter(a => a && a.date === todayStr);
  const todayAttendanceCount = todayAttendanceLogs.reduce((acc, curr) => acc + (curr.presentStudentIds?.length || 0), 0);
  
  const todayPaymentsCount = state.payments.filter(p => p.date === todayStr || p.date.startsWith(todayStr)).length;

  // Additional quick global stats
  const activeStudentsCount = state.students.filter(st => st.status === "active").length;
  const groupsCount = state.groups.length;
  const examsCount = state.exams.length;

  const getSubjectArabic = () => {
    switch (state.subject) {
      case "mathematics": return "الرياضيات";
      case "physics": return "الفيزياء";
      case "chemistry": return "الكيمياء";
      case "science": return "العلوم";
      case "science_en": return "الساينس";
      case "math": return "الماث";
      case "arabic": return "اللغة العربية";
      case "english": return "اللغة الانجليزية";
      case "social_studies": return "الدراسات";
      default: return "المادة الدراسية";
    }
  };

  return (
    <div className="space-y-6 select-none font-sans" id="dashboard_view" dir="rtl">
      {/* Title greeting card styled in high-fidelity preview */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-3xl relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl" />
        
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/5 text-[10px] font-black text-blue-200">
            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            <span>لوحة تحكم المكتب الشامل</span>
          </div>
          <h1 className="text-xl font-black tracking-tight mt-1">
            {state.currentUserRole === "secretary" 
              ? `مرحباً بكِ، ${state.currentUserName || "المساعدة"} 🌸` 
              : `مرحباً بك، أستاذ/ ${state.teacherName || "المعلم الفاضل"}`}
          </h1>
          <p className="text-slate-300 text-3xs font-medium max-w-sm leading-relaxed">
            مساحتك الذكية لإدارة مجموعات <span className="text-white font-extrabold">{getSubjectArabic()}</span>{state.teacherName && <span> تحت إشراف الأستاذ <span className="text-white font-extrabold">{state.teacherName}</span></span>}، ومتابعة التحضير والدرجات، والمدفوعات والمستندات بسهولة تامة.
          </p>
        </div>
      </div>

      {/* Main Today's Summary & Quick Stats Bento-Grid */}
      <div className="space-y-3">
        <h3 className="text-slate-900 dark:text-white font-black text-xs px-1 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-indigo-500 animate-pulse" />
          <span>ملخص ونشاط اليوم</span>
        </h3>

        <div className="grid grid-cols-2 gap-3.5">
          {/* Today's Attendance widget */}
          <div className="bg-gradient-to-br from-blue-50/30 via-white to-slate-50/50 dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-950 border border-blue-100/70 dark:border-blue-900/60 p-4.5 rounded-2xl relative overflow-hidden group hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/5 transition-all duration-300">
            <div className="absolute top-2.5 left-2.5 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold block mb-1">الحضور المسجل اليوم</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2.5xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{todayAttendanceCount}</span>
              <span className="text-3xs text-slate-400 dark:text-slate-500 font-extrabold">طلاب</span>
            </div>
            <div className="mt-2 text-[9px] text-slate-400 dark:text-slate-500 font-bold">كشوف نشطة للحصص اليومية</div>
          </div>

          {/* Today's Payments widget */}
          <div className="bg-gradient-to-br from-emerald-50/30 via-white to-slate-50/50 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-950 border border-emerald-100/70 dark:border-emerald-900/60 p-4.5 rounded-2xl relative overflow-hidden group hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-300">
            <div className="absolute top-2.5 left-2.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold block mb-1">المقبوضات والتحصيلات اليوم</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2.5xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">{todayPaymentsCount}</span>
              <span className="text-3xs text-slate-400 dark:text-slate-500 font-extrabold">عمليات</span>
            </div>
            <div className="mt-2 text-[9px] text-slate-400 dark:text-slate-500 font-bold">مدفوعات الاشتراكات المستلمة</div>
          </div>
        </div>
      </div>

      {/* Global Counters with cute Minimal Icons */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl grid grid-cols-3 gap-2 text-center shadow-3xs">
        <div className="space-y-1 group cursor-pointer hover:bg-blue-50/10 dark:hover:bg-blue-950/15 p-1 rounded-xl transition">
          <div className="flex justify-center text-slate-400 group-hover:scale-110 transition duration-200">
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block">إجمالي الطلاب</span>
          <span className="text-sm font-black text-slate-800 dark:text-slate-205 font-mono">
            {activeStudentsCount}
          </span>
        </div>
        <div className="space-y-1 border-r border-l border-slate-100 dark:border-slate-800 group cursor-pointer hover:bg-indigo-50/10 dark:hover:bg-indigo-950/15 p-1 rounded-xl transition">
          <div className="flex justify-center text-slate-400 group-hover:scale-110 transition duration-200">
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block">المجموعات</span>
          <span className="text-sm font-black text-slate-800 dark:text-slate-205 font-mono">
            {groupsCount}
          </span>
        </div>
        <div className="space-y-1 group cursor-pointer hover:bg-purple-50/10 dark:hover:bg-purple-950/15 p-1 rounded-xl transition">
          <div className="flex justify-center text-slate-400 group-hover:scale-110 transition duration-200">
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <span className="text-[9px] text-slate-400 dark:text-slate-505 font-bold block">الامتحانات</span>
          <span className="text-sm font-black text-slate-800 dark:text-slate-205 font-mono">
            {examsCount}
          </span>
        </div>
      </div>

      {/* Four Quick Actions Actions Grid with description */}
      <div className="space-y-3">
        <h3 className="text-slate-900 dark:text-white font-black text-xs px-1">الإجراءات والعمليات السريعة</h3>
        <div className="grid grid-cols-2 gap-3.5" id="quick_actions_grid">
          {/* Action 1: Add Student */}
          <button
            onClick={() => onNavigate("students", { action: "add" })}
            className="flex flex-col items-center justify-center p-5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-gradient-to-br hover:from-white hover:to-blue-50/20 dark:hover:from-slate-900 dark:hover:to-blue-950/20 active:scale-95 transition-all duration-300 rounded-3xl text-center h-28 cursor-pointer shadow-3xs group"
          >
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mb-1.5 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition duration-300 shadow-sm shadow-blue-500/10">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-extrabold text-slate-850 dark:text-slate-205">إضافة طالب</span>
            <span className="text-[8px] text-slate-400 dark:text-slate-505 mt-1 font-bold">تسجيل ملف طالب جديد</span>
          </button>

          {/* Action 2: Record Attendance */}
          <button
            onClick={() => onNavigate("attendance")}
            className="flex flex-col items-center justify-center p-5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/20 dark:hover:from-slate-900 dark:hover:to-indigo-950/20 active:scale-95 transition-all duration-300 rounded-3xl text-center h-28 cursor-pointer shadow-3xs group"
          >
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mb-1.5 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition duration-300 shadow-sm shadow-indigo-500/10">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-extrabold text-slate-850 dark:text-slate-205">تسجيل حضور</span>
            <span className="text-[8px] text-slate-400 dark:text-slate-505 mt-1 font-bold">رصد غياب المجموعات اليوم</span>
          </button>

          {/* Action 3: Record Payment */}
          <button
            onClick={() => onNavigate("payments")}
            className="flex flex-col items-center justify-center p-5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 hover:bg-gradient-to-br hover:from-white hover:to-emerald-50/20 dark:hover:from-slate-900 dark:hover:to-emerald-950/20 active:scale-95 transition-all duration-300 rounded-3xl text-center h-28 cursor-pointer shadow-3xs group"
          >
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mb-1.5 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition duration-300 shadow-sm shadow-emerald-500/10">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs font-extrabold text-slate-850 dark:text-slate-205">تسجيل دفعة</span>
            <span className="text-[8px] text-slate-400 dark:text-slate-505 mt-1 font-bold">قبض وتوريد الاشتراك الشهري</span>
          </button>

          {/* Action 4: Record Score */}
          <button
            onClick={() => onNavigate("exams")}
            className="flex flex-col items-center justify-center p-5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 hover:bg-gradient-to-br hover:from-white hover:to-purple-50/20 dark:hover:from-slate-900 dark:hover:to-purple-950/20 active:scale-95 transition-all duration-300 rounded-3xl text-center h-28 cursor-pointer shadow-3xs group"
          >
            <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 mb-1.5 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition duration-300 shadow-sm shadow-purple-500/10">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span className="text-xs font-extrabold text-slate-850 dark:text-slate-205">تسجيل درجات</span>
            <span className="text-[8px] text-slate-400 dark:text-slate-505 mt-1 font-bold">رصد امتحانات ومستويات</span>
          </button>
        </div>
      </div>

      {/* MANUAL SYSTEM DATA BACKUP BOX */}
      <div className="bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/20 dark:from-indigo-950/20 dark:via-slate-900 dark:to-blue-950/10 border border-indigo-100 dark:border-indigo-900/50 p-5 rounded-3xl space-y-4 shadow-3xs relative overflow-hidden">
        <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl" />
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="text-xs font-black text-slate-900 dark:text-white">تأمين وحفظ بيانات السنتر يدوياً</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
              قم بتحميل وتنزيل ملف النسخة الاحتياطية المحدثة بالكامل وبكل الطلاب والمجموعات والحسابات والدرجات في ملف بجهازك الذكي للرجوع إليه عند الحاجة.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualBackup}
          className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-2xs rounded-2xl transition-all duration-300 shadow-sm shadow-indigo-500/10 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          <Download className="w-4 h-4 font-bold" />
          <span>تحميل النسخة الاحتياطية كاملة (JSON)</span>
        </button>
      </div>

      {/* Floating backup success toast */}
      <AnimatePresence>
        {backupSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white rounded-2xl border border-emerald-400/20 shadow-xl shadow-emerald-500/30 w-[90%] max-w-xs"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
              <Check className="w-4.5 h-4.5 font-bold" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-2xs font-extrabold text-white">تأمين وتصدير البيانات</p>
              <p className="text-[10px] text-emerald-100 font-bold mt-0.5">تم تنزيل وتصدير ملف النسخة الاحتياطية بالكامل بنجاح!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
