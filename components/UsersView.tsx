"use client";

import { useState } from "react";
import { useAppStore, store, Secretary, hasFullAccess } from "@/lib/store";
import { 
  UsersRound, ShieldAlert, KeyRound, Check, Trash2, ShieldCheck, 
  X, BadgeAlert, PlusCircle, ToggleRight, UserMinus, PersonStanding, 
  LockKeyhole, ClipboardList, Clock, Activity, AlertCircle, Shield
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function UsersView() {
  const state = useAppStore((s) => s);
  
  // States
  const [formName, setFormName] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formFullAccess, setFormFullAccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Search & Filter States for Users
  const [secSearchQuery, setSecSearchQuery] = useState("");
  const [secAccessFilter, setSecAccessFilter] = useState<"all" | "full" | "restricted">("all");
  const [secStatusFilter, setSecStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Search & Filter States for Activity Logs
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState<string>("all");

  const isTeacher = hasFullAccess(state);
  const isTrueAdmin = state.currentUserRole === "teacher";

  // Prevent Secretary from viewing other users as per specs
  if (!isTeacher) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm text-center max-w-md mx-auto my-12" id="users_unauthorized">
        <LockKeyhole className="w-16 h-16 text-red-505 text-red-500 mx-auto mb-4 animate-pulse" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">صلاحية تفتيش غير مصرحة!</h3>
        <p className="text-slate-400 text-xs mt-2 mb-6 leading-relaxed">
          عذراً، تملك السكرتارية حالياً كود وصول نشط ومقيد بمهام الرصد والتحصيل اليومي فقط؛ لا تملك صلاحية تعديل السيرفرات وإضافة الزملاء أو الاطلاع على الرموز السرية للمشرفين.
        </p>
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900 text-red-650 dark:text-red-450 dark:text-red-400 text-3xs font-bold rounded-xl animate-fade">
          طلب تفويض: يرجى الرجوع للأستاذ المعلم للتحويل.
        </div>
      </div>
    );
  }

  const handleAddSecretary = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!isTrueAdmin) {
      setErrorMsg("عذراً، لا يمكن للسكرتير إضافة حسابات جديدة! متاح للمدير (الأستاذ) فقط.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    if (!formName.trim() || !formPin.trim()) {
      setErrorMsg("الرجاء إدخال اسم السكرتارية بالكامل وتعيين رمز PIN سري!");
      return;
    }
    if (formPin.length < 3) {
      setErrorMsg("يجب أن يتكون رمز PIN السري من 3 أرقام على الأقل لضمان الأمان الأولي!");
      return;
    }

    const res = store.addSecretary(formName, formPin, formFullAccess);
    if (res.success) {
      setSuccessMsg(res.message);
      setFormName("");
      setFormPin("");
      setFormFullAccess(false);
      setIsAddOpen(false);
      
      setTimeout(() => setSuccessMsg(""), 2000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleToggleStatus = (id: string, name: string) => {
    if (!isTrueAdmin) {
      setErrorMsg("عذراً، لا يمكن للسكرتير تعديل حالة الحساب! متاح للمدير (الأستاذ) فقط.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    store.toggleSecretaryStatus(id);
    setSuccessMsg(`تم تغيير حالة تفعيل حساب السكرتارية: "${name}" بنجاح!`);
    setTimeout(() => setSuccessMsg(""), 2000);
  };

  const handleToggleFullAccess = (id: string, name: string) => {
    if (!isTrueAdmin) {
      setErrorMsg("عذراً، لا يمكن للسكرتير تعديل صلاحيات الوصول! متاح للمدير (الأستاذ) فقط.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    store.toggleSecretaryFullAccess(id);
    setSuccessMsg(`تم تعديل الصلاحية الكاملة لـ: "${name}" بنجاح!`);
    setTimeout(() => setSuccessMsg(""), 2000);
  };

  const handleDelete = (id: string, name: string) => {
    if (!isTrueAdmin) {
      setErrorMsg("عذراً، لا يمكن للسكرتير حذف الحسابات! متاح للمدير (الأستاذ) فقط.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    const confirmed = window.confirm(`هل أنت متأكد تماماً من رغبتك في حذف السكرتارية "${name}" نهائياً من قائمة المشرفين؟`);
    if (confirmed) {
      store.deleteSecretary(id);
      setSuccessMsg("تم مسح حساب السكرتارية من السجل بنجاح.");
      setTimeout(() => setSuccessMsg(""), 2000);
    }
  };

  const filteredSecretaries = state.secretaries.filter((sec) => {
    const matchesSearch = sec.name.toLowerCase().includes(secSearchQuery.toLowerCase()) ||
                          sec.pin.includes(secSearchQuery);
    const matchesAccess = secAccessFilter === "all" ||
      (secAccessFilter === "full" && sec.fullAccess) ||
      (secAccessFilter === "restricted" && !sec.fullAccess);
    const matchesStatus = secStatusFilter === "all" ||
      (secStatusFilter === "active" && sec.active) ||
      (secStatusFilter === "inactive" && !sec.active);
    return matchesSearch && matchesAccess && matchesStatus;
  });

  const filteredLogs = (state.activityLogs || []).filter((log) => {
    const query = logSearchQuery.toLowerCase();
    const matchesSearch = !query ||
      log.recordedByName.toLowerCase().includes(query) ||
      (log.studentName && log.studentName.toLowerCase().includes(query)) ||
      log.details.toLowerCase().includes(query) ||
      log.actionType.toLowerCase().includes(query);

    const matchesType = logTypeFilter === "all" ||
      (logTypeFilter === "marks" && (log.actionType === "عدلت درجة" || log.actionType === "رصد درجات تسميع")) ||
      (logTypeFilter === "payments" && (log.actionType === "سجلت دفعة" || log.actionType === "حذف دفعة مالية")) ||
      (logTypeFilter === "students" && (log.actionType === "إضافة طالب" || log.actionType === "نقلت طالب" || log.actionType === "حذف طالب")) ||
      (logTypeFilter === "deletions" && log.actionType.startsWith("حذف"));

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6" id="users_view">
      
      {/* Header action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">إدارة السكرتارية وتفويض الحسابات</h1>
          <p className="text-slate-400 dark:text-slate-400 text-xs mt-0.5">تسجيل حسابات السكرتارية والمساعدين، توليد وتعديل الرموز السرية (PIN) ومتابعة التراخيص.</p>
        </div>
        {isTrueAdmin ? (
          <button 
            onClick={() => {
              setErrorMsg("");
              setIsAddOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10"
            id="btn_add_secretary"
          >
            <PlusCircle className="w-4 h-4" />
            <span>تفويض سكرتارية جديدة</span>
          </button>
        ) : (
          <div className="text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-extrabold px-3 py-2 rounded-xl border border-amber-105 border-amber-200/50 max-w-xs text-right">
            ⚠️ عرض فقط: إضافة وتعديل السكرتارية مقفل ومتاح للمدير (الأستاذ) فقط.
          </div>
        )}
      </div>

      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-indigo-600 via-blue-500 to-indigo-500 text-white rounded-2xl border border-indigo-400/20 shadow-xl shadow-indigo-500/30 w-[90%] max-w-xs"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-4.5 h-4.5 font-bold" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-2xs font-extrabold text-white font-cairo">تحديث الصلاحيات</p>
              <p className="text-[10px] text-indigo-100 font-bold mt-0.5">{successMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-rose-600 to-red-500 text-white rounded-2xl border border-red-400/20 shadow-xl shadow-red-500/30 w-[90%] max-w-xs"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
              <AlertCircle className="w-4.5 h-4.5 font-bold" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-2xs font-extrabold text-white font-cairo">تنبيه بالحسابات</p>
              <p className="text-[10px] text-rose-100 font-bold mt-0.5">{errorMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filter Controls for Secretaries */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-3xs flex flex-col md:flex-row gap-4 items-center justify-between font-sans">
        <div className="relative w-full md:w-96">
          <input 
            type="text"
            value={secSearchQuery}
            onChange={(e) => setSecSearchQuery(e.target.value)}
            placeholder="البحث باسم المساعد أو كود PIN السري..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pr-10 pl-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100 text-right"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
          {/* Access filter tags */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 text-3xs">
            <span className="text-slate-400 font-bold px-1.5">صلاحية:</span>
            <button 
              onClick={() => setSecAccessFilter("all")} 
              className={`px-2.5 py-1 rounded-lg font-bold transition ${secAccessFilter === "all" ? "bg-blue-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"}`}
            >
              الكل
            </button>
            <button 
              onClick={() => setSecAccessFilter("full")} 
              className={`px-2.5 py-1 rounded-lg font-bold transition ${secAccessFilter === "full" ? "bg-blue-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"}`}
            >
              كاملة (أدمن)
            </button>
            <button 
              onClick={() => setSecAccessFilter("restricted")} 
              className={`px-2.5 py-1 rounded-lg font-bold transition ${secAccessFilter === "restricted" ? "bg-blue-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"}`}
            >
              مقيد ورصد
            </button>
          </div>

          {/* Status filter tags */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 text-3xs">
            <span className="text-slate-400 font-bold px-1.5">الحالة:</span>
            <button 
              onClick={() => setSecStatusFilter("all")} 
              className={`px-2.5 py-1 rounded-lg font-bold transition ${secStatusFilter === "all" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"}`}
            >
              الكل
            </button>
            <button 
              onClick={() => setSecStatusFilter("active")} 
              className={`px-2.5 py-1 rounded-lg font-bold transition ${secStatusFilter === "active" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"}`}
            >
              نشط
            </button>
            <button 
              onClick={() => setSecStatusFilter("inactive")} 
              className={`px-2.5 py-1 rounded-lg font-bold transition ${secStatusFilter === "inactive" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"}`}
            >
              معطل
            </button>
          </div>
        </div>
      </div>

      {/* Grid listing users */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="secretaries_grid">
        
        {/* Core Admin Teacher Indicator (Non-deletable) */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-950 p-6 rounded-3xl border border-indigo-950 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
          
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="p-2 bg-white/10 text-white rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span className="text-emerald-300 bg-emerald-500/15 border border-emerald-500/20 text-4xs font-bold px-2 py-0.5 rounded-full uppercase">
                مالك النظام والأدمن (الأستاذ)
              </span>
            </div>

            <h3 className="font-extrabold text-white text-sm">المعلم (صاحب الحساب)</h3>
            <p className="text-indigo-200 text-3xs mt-1">الرتبة العليا؛ يملك صلاحيات تعديل الرموز المخصصة وبدء العام الدراسي تفوق الجميع.</p>

            <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-white/10 text-3xs">
              <div>
                <span className="text-slate-400 block font-semibold">المقر الرئيسي:</span>
                <span className="font-bold text-white block mt-0.5">كامل الصلاحية</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">رمز PIN الفعال:</span>
                <span className="font-bold font-mono text-indigo-300 block mt-0.5">{state.teacherPin}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Secretaries directory rosters render */}
        {state.secretaries.length === 0 ? (
          <div className="col-span-full md:col-span-2 text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <BadgeAlert className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-slate-550 dark:text-slate-400 font-semibold text-sm">لم يتضمن دليل السكرتارية أي موظفين تم توليد رموزهم حتى الآن.</p>
          </div>
        ) : filteredSecretaries.length === 0 ? (
          <div className="col-span-full md:col-span-2 text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-250 dark:border-slate-800">
            <BadgeAlert className="w-12 h-12 text-amber-500 mx-auto mb-2 animate-bounce" />
            <p className="text-slate-550 dark:text-slate-300 font-semibold text-sm">عذراً، لا يوجد أي مساعد يطابق شروط التصفية والبحث الحالية!</p>
            <p className="text-slate-450 dark:text-slate-500 text-3xs mt-1">تأكد من كتابة الاسم بصورة صحيحة أو تمكين فلتر «الكل».</p>
          </div>
        ) : (
          filteredSecretaries.map((sec) => (
            <div key={sec.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition duration-205 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <KeyRound className="w-5 h-5" />
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      sec.active 
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40" 
                        : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-450 dark:text-red-400 border-red-200 dark:border-red-800/40"
                    }`}>
                      {sec.active ? "نشط ومفوض" : "غير مفعل المساعد"}
                    </span>
                    {sec.fullAccess && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40">
                        صلاحية كاملة (أدمن)
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm tracking-tight">{sec.name}</h3>
                <p className="text-slate-400 dark:text-slate-500 text-3xs mt-1 block font-medium">
                  تاريخ توليد الحساب: {sec.createdAt}
                </p>

                <div className="grid grid-cols-2 gap-3 mt-5 pt-3 border-t border-slate-50 dark:border-slate-800/60 text-3xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl font-sans">
                  <div>
                    <span className="block font-semibold text-slate-450">رتبة الصلاحية:</span>
                    <span className={`font-bold block mt-0.5 ${sec.fullAccess ? "text-amber-600 dark:text-amber-500 font-extrabold" : "text-slate-800 dark:text-slate-205 dark:text-slate-300"}`}>
                      {sec.fullAccess ? "صلاحية كاملة (أدمن)" : "رصد وحسابات مقيدة"}
                    </span>
                  </div>
                  <div>
                    <span className="block font-semibold text-slate-450">رمز PIN السري:</span>
                    <span className="text-indigo-650 dark:text-indigo-400 font-bold font-mono text-xs block mt-0.5">{sec.pin}</span>
                  </div>
                </div>
              </div>

              {/* Toggle activation & full access & delete buttons */}
              <div className="flex flex-col gap-2 mt-5 pt-3 border-t border-slate-50 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                  <button 
                    disabled={!isTrueAdmin}
                    onClick={() => handleToggleStatus(sec.id, sec.name)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 border rounded-xl text-3xs font-bold transition ${
                      !isTrueAdmin 
                        ? "opacity-55 cursor-not-allowed bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 border-slate-205 dark:border-slate-800"
                        : sec.active 
                          ? "bg-slate-50 hover:bg-slate-100 text-slate-655 text-slate-655 border-slate-205 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:border-slate-700 cursor-pointer" 
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-900/60 cursor-pointer"
                    }`}
                  >
                    <span>{sec.active ? "تعطيل الحساب" : "تنشيط وتفويض"}</span>
                  </button>
                  <button 
                    disabled={!isTrueAdmin}
                    onClick={() => handleToggleFullAccess(sec.id, sec.name)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 border rounded-xl text-3xs font-bold transition ${
                      !isTrueAdmin
                        ? "opacity-55 cursor-not-allowed bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 border-slate-205 dark:border-slate-800"
                        : sec.fullAccess 
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:text-amber-400 dark:border-amber-900/60 cursor-pointer" 
                          : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-900/60 cursor-pointer"
                    }`}
                  >
                    <span>{sec.fullAccess ? "سحب الصلاحية" : "منح صلاحية كاملة"}</span>
                  </button>
                </div>
                <button 
                  disabled={!isTrueAdmin}
                  onClick={() => handleDelete(sec.id, sec.name)}
                  className={`w-full flex items-center justify-center gap-1 py-1.8 border rounded-xl transition font-bold text-3xs ${
                    !isTrueAdmin
                      ? "opacity-55 cursor-not-allowed bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 border-slate-205 dark:border-slate-800"
                      : "bg-red-50 hover:bg-red-100 border-red-100 text-red-650 cursor-pointer dark:bg-red-950/30 dark:hover:bg-red-900/40 dark:border-red-900/60 dark:text-red-400"
                  }`}
                  title={isTrueAdmin ? "حذف نهائي" : "غير متاح للسكرتارية"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isTrueAdmin ? "حذف حساب السكرتارية نهائياً" : "حذف غير متاح (للأدمن فقط)"}</span>
                </button>
              </div>
            </div>
          ))
        )}

      </div>

      {/* MODAL: ADD USERS */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm" id="modal_user_add">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm">تفويض وتسجيل سكرتير ومساعد جديد</h2>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSecretary} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs rounded-xl flex items-center gap-1.5 font-bold animate-pulse">
                  <ShieldAlert className="w-4 h-4" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="text-slate-700 dark:text-slate-300 text-xs font-semibold mb-1 block">اسم السكرتير بالثلاثي: *</label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: الأستاذ هاني محمود فريد"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-right font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-705 dark:text-slate-350 text-xs font-semibold mb-1 block">إنشاء الرمز السري (PIN): *</label>
                <input 
                  type="password"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value)}
                  placeholder="رقم سري فريد (مثال: 1122)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-center font-mono font-bold font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <input 
                  type="checkbox"
                  id="formFullAccess"
                  checked={formFullAccess}
                  onChange={(e) => setFormFullAccess(e.target.checked)}
                  className="w-4 h-4 text-indigo-650 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="formFullAccess" className="text-slate-700 dark:text-slate-300 text-xs font-extrabold cursor-pointer select-none">
                  منح صلاحيات وصول كاملة (أدمن)
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-100 dark:border-slate-700 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  إصدار وتدشين التفويض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Log section */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4" id="audit_log_section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">سجل العمليات والرقابة الأمنية الفورية (Activity Log)</h3>
              <p className="text-slate-400 dark:text-slate-400 text-xs mt-0.5">تفاصيل العمليات والتحركات التي تقوم بها السكرتارية والمشرفون على الملفات والدرجات.</p>
            </div>
          </div>
          <span className="text-3xs font-semibold px-2 py-1 bg-slate-105 bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 rounded-full font-sans">
            نشط المستندات: {state.activityLogs?.length || 0} عملية
          </span>
        </div>

        {/* Search & Filter Controls for Activity Logs */}
        {state.activityLogs && state.activityLogs.length > 0 && (
          <div className="flex flex-col md:flex-row gap-3 pt-2 items-center justify-between font-sans border-t border-slate-50 dark:border-slate-800">
            <div className="relative w-full md:w-80">
              <input 
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="البحث باسم الطالب أو المشرف أو الإجراء..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800/80 rounded-xl pr-9 pl-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100 text-right"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              {logSearchQuery && (
                <button 
                  type="button"
                  onClick={() => setLogSearchQuery("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-705 dark:hover:text-white font-sans justify-center pr-3 scale-95 cursor-pointer"
                >
                  <span className="text-[10px] font-extrabold bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-lg text-slate-700 dark:text-slate-300">مسح</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 text-3xs">
              <span className="text-slate-400 font-bold px-1">نوع العمل:</span>
              <button 
                type="button"
                onClick={() => setLogTypeFilter("all")} 
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${logTypeFilter === "all" ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}
              >
                الكل
              </button>
              <button 
                type="button"
                onClick={() => setLogTypeFilter("marks")} 
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${logTypeFilter === "marks" ? "bg-amber-600 text-white shadow-3xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}
              >
                تسميع ودرجات
              </button>
              <button 
                type="button"
                onClick={() => setLogTypeFilter("payments")} 
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${logTypeFilter === "payments" ? "bg-emerald-600 text-white shadow-3xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}
              >
                المدفوعات والمالية
              </button>
              <button 
                type="button"
                onClick={() => setLogTypeFilter("students")} 
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${logTypeFilter === "students" ? "bg-indigo-600 text-white shadow-3xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}
              >
                تسجيل ونقل
              </button>
              <button 
                type="button"
                onClick={() => setLogTypeFilter("deletions")} 
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${logTypeFilter === "deletions" ? "bg-red-650 text-white shadow-3xs" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}
              >
                عمليات الحذف
              </button>
            </div>
          </div>
        )}

        {(!state.activityLogs || state.activityLogs.length === 0) ? (
          <div className="text-center py-10 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <Activity className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2 animate-pulse" />
            <p className="text-slate-550 dark:text-slate-400 font-semibold text-xs font-bold">لا توجد عمليات مسجلة حتى الآن.</p>
            <p className="text-slate-400 dark:text-slate-500 text-[10px] mt-1">سيتم تلقائياً تتبع أي تعديل للدرجات، تسجيل اشتراكات، نقل طلاب، أو حذف ملفات.</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <Activity className="w-10 h-10 text-amber-500 mx-auto mb-2 animate-bounce" />
            <p className="text-slate-550 dark:text-slate-300 text-xs font-bold">لم يتم العثور على أي عملية تطابق خيارات التصفية والبحث الحالية!</p>
            <p className="text-slate-405 dark:text-slate-500 text-[10px] mt-1">جرب إدخال مرادفات أخرى أو مسح صندوق التصفية.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-55 bg-slate-50/50 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 text-3xs uppercase tracking-wider">
                  <th className="p-3">الوقت والتاريخ</th>
                  <th className="p-3">اسم المستخدم</th>
                  <th className="p-3">العملية</th>
                  <th className="p-3 bg-indigo-50/5 hover:bg-indigo-50/10 font-bold">الطالب المستهدف</th>
                  <th className="p-3">التفاصيل والملحقات والتمويل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-semibold text-slate-705 text-slate-700 dark:text-slate-350">
                {filteredLogs.slice(0, 100).map((log) => {
                  let badgeColor = "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
                  if (log.actionType === "عدلت درجة" || log.actionType === "رصد درجات تسميع") {
                    badgeColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/60";
                  } else if (log.actionType === "حذف طالب" || log.actionType === "حذف دفعة مالية" || log.actionType === "حذف سجل تسميع" || log.actionType === "حذف اختبار" || log.actionType === "تعطيل الحساب" || log.actionType === "تعطيل حساب" || log.actionType === "حذف حساب") {
                    badgeColor = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/60";
                  } else if (log.actionType === "سجلت دفعة") {
                    badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/60";
                  } else if (log.actionType === "نقلت طالب") {
                    badgeColor = "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-450 dark:text-sky-400 dark:border-sky-900/60";
                  } else if (log.actionType === "إضافة طالب") {
                    badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/60";
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 text-[11px] text-slate-400 dark:text-slate-500 font-sans font-semibold">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-450" />
                          <span>{log.timestamp}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-extrabold text-slate-800 dark:text-slate-200">{log.recordedByName}</div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {log.userRole === "teacher" ? "أدمن (المعلم)" : "سكرتير"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full border text-3xs font-extrabold ${badgeColor}`}>
                          {log.actionType}
                        </span>
                      </td>
                      <td className="p-3">
                        {log.studentName ? (
                          <span className="font-extrabold text-slate-850 dark:text-slate-100">{log.studentName}</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 font-semibold">-</span>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-slate-550 dark:text-slate-300 leading-relaxed font-semibold">
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
