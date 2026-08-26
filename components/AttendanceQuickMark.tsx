"use client";

import { useState, useEffect } from "react";
import { useAppStore, store, Student, Group } from "@/lib/store";
import { 
  Check, X, Clock, Search, BookOpen, UserCheck, UserX, AlertCircle, 
  HelpCircle, Sparkles, RefreshCw, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function AttendanceQuickMark() {
  const state = useAppStore((s) => s);
  
  // Date tracking (Always current date)
  const todayStr = new Date().toISOString().split("T")[0];

  // Selected Group ID for quick marking
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    return state.groups[0]?.id || "";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showAutoSaveAlert, setShowAutoSaveAlert] = useState(false);

  // Set default group if empty
  useEffect(() => {
    if (state.groups.length > 0 && !selectedGroupId) {
      setTimeout(() => {
        setSelectedGroupId(state.groups[0].id);
      }, 0);
    }
  }, [state.groups, selectedGroupId]);

  // Find students in selected group
  const activeStudents = state.students.filter(
    (st) => st.groupId === selectedGroupId && st.status === "active"
  );

  // Filter students based on search query
  const filteredStudents = activeStudents.filter((st) =>
    st.name.toLowerCase().includes(searchQuery.toLowerCase()) || st.id.includes(searchQuery)
  );

  // Find existing attendance record for this group and date
  const currentRecord = state.attendance.find(
    (att) => att.groupId === selectedGroupId && att.date === todayStr
  );

  const presentIds = currentRecord?.presentStudentIds || [];
  const absentIds = currentRecord?.absentStudentIds || [];
  const lateIds = currentRecord?.lateStudentIds || [];

  // Single-Tap Quick toggle handler
  const handleToggleState = (studentId: string, status: "present" | "absent" | "late") => {
    let nextPresents = [...presentIds];
    let nextAbsents = [...absentIds];
    let nextLates = [...lateIds];

    // Filter out student from all buckets first
    nextPresents = nextPresents.filter((id) => id !== studentId);
    nextAbsents = nextAbsents.filter((id) => id !== studentId);
    nextLates = nextLates.filter((id) => id !== studentId);

    if (status === "present") {
      nextPresents.push(studentId);
    } else if (status === "absent") {
      nextAbsents.push(studentId);
    } else if (status === "late") {
      nextLates.push(studentId);
    }

    // Immediately commit to store which triggers IndexedDB persistence
    store.recordAttendance(selectedGroupId, todayStr, nextPresents, nextAbsents, nextLates);

    // Display temporary success feedback bubble
    setShowAutoSaveAlert(true);
    const t = setTimeout(() => setShowAutoSaveAlert(false), 2000);
    return () => clearTimeout(t);
  };

  const handleMarkAllPresent = () => {
    const studentIds = activeStudents.map(st => st.id);
    store.recordAttendance(selectedGroupId, todayStr, studentIds, [], []);
    setShowAutoSaveAlert(true);
    const t = setTimeout(() => setShowAutoSaveAlert(false), 2000);
    return () => clearTimeout(t);
  };

  const handleMarkAllAbsent = () => {
    const studentIds = activeStudents.map(st => st.id);
    store.recordAttendance(selectedGroupId, todayStr, [], studentIds, []);
    setShowAutoSaveAlert(true);
    const t = setTimeout(() => setShowAutoSaveAlert(false), 2000);
    return () => clearTimeout(t);
  };

  const getStudentStatus = (studentId: string): "present" | "absent" | "late" | "unmarked" => {
    if (presentIds.includes(studentId)) return "present";
    if (absentIds.includes(studentId)) return "absent";
    if (lateIds.includes(studentId)) return "late";
    return "unmarked";
  };

  const currentGroup = state.groups.find((g) => g.id === selectedGroupId);

  const daysNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  let isTodayScheduled = true;
  let todayName = "";
  let scheduledDaysNames = "";

  if (currentGroup) {
    const [year, month, day] = todayStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    todayName = daysNames[dayOfWeek];
    isTodayScheduled = currentGroup.daysOfWeek?.includes(dayOfWeek) ?? true;
    scheduledDaysNames = currentGroup.daysOfWeek?.map(idx => daysNames[idx]).join(" و ") || "";
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5" id="attendance_quick_mark" dir="rtl">
      
      {/* Header Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-blue-50 dark:bg-blue-955/20 text-blue-600 dark:text-blue-405 rounded-full text-4xs font-bold tracking-tight uppercase flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>التحضير السريع بلمسة واحدة</span>
            </span>
            <AnimatePresence>
              {showAutoSaveAlert && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="text-4xs text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900 flex items-center gap-1 shrink-0"
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>تم الحفظ تلقائياً</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
            <span>حارس الحضور اليومي: {new Date(todayStr).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}</span>
          </h3>
        </div>

        {/* Group select drop */}
        <div className="min-w-[170px]">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-3xs font-bold text-slate-705 dark:text-slate-200 focus:outline-blue-500 cursor-pointer"
          >
            {state.groups.length === 0 ? (
              <option value="">لا توجد مجموعات</option>
            ) : (
              state.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {!isTodayScheduled && currentGroup && (
        <div className="p-3 bg-amber-50/50 dark:bg-amber-955/15 border border-amber-100 dark:border-amber-900/40 rounded-xl text-[10px] text-amber-750 dark:text-amber-400 leading-relaxed flex items-start gap-1.5 animate-pulse">
          <span>⚠️</span>
          <div>
            اليوم (<strong>{todayName}</strong>) ليس من الأيام المحددة مسبقاً لمجموعة <strong>{currentGroup.name}</strong>. الأيام المقررة هي: <span className="underline font-bold text-amber-900 dark:text-amber-300">{scheduledDaysNames}</span>. يمكنك رصد الغياب والحضور حالياً كحصة إضافية/استثنائية.
          </div>
        </div>
      )}

      {state.groups.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          يرجى إضافة مجموعات دراسية أولاً لتهيئة كراسة الغياب السريع.
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Quick Stats & Search combo row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="relative flex-1">
              <input 
                type="text"
                placeholder="ابحث عن طالب بالاسم لتسجيل حضوره فورا..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-4xs font-medium text-right focus:bg-white dark:focus:bg-slate-900 focus:outline-blue-500 transition text-slate-850 dark:text-slate-100"
              />
              <Search className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500 absolute left-auto right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Quick counters */}
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="text-slate-400 dark:text-slate-500">إحصائيات المجموعة:</span>
              <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/60 px-1.5 py-0.5 rounded font-mono">
                ح: {presentIds.length}
              </span>
              <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-750 dark:text-amber-455 border border-amber-200 dark:border-amber-900/60 px-1.5 py-0.5 rounded font-mono">
                ت: {lateIds.length}
              </span>
              <span className="bg-red-50 dark:bg-red-950/30 text-red-750 dark:text-red-455 border border-red-150 dark:border-red-900/60 px-1.5 py-0.5 rounded font-mono">
                غ: {absentIds.length}
              </span>
              <span className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded font-mono">
                ك: {activeStudents.length}
              </span>
            </div>
          </div>

          {/* Batch actions for quick log */}
          {activeStudents.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-2xl border border-slate-150 dark:border-slate-800/80 justify-end">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-auto mr-1">إجراءات سريعة للمجموعة:</span>
              <button
                type="button"
                onClick={handleMarkAllAbsent}
                className="px-3 py-1.5 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-450 hover:bg-rose-100/70 dark:hover:bg-rose-955/30 border border-rose-200/50 dark:border-rose-900/60 rounded-xl text-3xs font-extrabold flex items-center gap-1 transition-all cursor-pointer select-none ring-offset-white focus:outline-hidden"
              >
                <X className="w-3.5 h-3.5" />
                <span>تسجيل الغياب للجميع</span>
              </button>
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-100/70 dark:hover:bg-emerald-955/30 border border-emerald-200/50 dark:border-emerald-900/60 rounded-xl text-3xs font-extrabold flex items-center gap-1 transition-all cursor-pointer select-none ring-offset-white focus:outline-hidden"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تحضير الجميع</span>
              </button>
            </div>
          )}

          {/* Scrollable list of students with single-tap status selectors */}
          <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1" id="quickmark_student_scroll">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-3xs">
                {searchQuery ? "تعذر العثور على طالب يطابق البحث!" : "لا يوجد طلاب مسجلين في هذه المجموعة حتى الآن."}
              </div>
            ) : (
              filteredStudents.map((st) => {
                const currentStatus = getStudentStatus(st.id);
                
                return (
                  <div 
                    key={st.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950/50 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-750 rounded-xl transition duration-150"
                  >
                    {/* Student brief info */}
                    <div className="text-right flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        currentStatus === "present" ? "bg-emerald-500" :
                        currentStatus === "late" ? "bg-amber-500 animate-pulse" :
                        currentStatus === "absent" ? "bg-red-500" :
                        "bg-slate-300 dark:bg-slate-700"
                      }`} />
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs tracking-tight">{st.name}</h4>
                        <span className="text-slate-400 dark:text-slate-500 text-4xs font-mono font-bold block">كود: #{st.id}</span>
                      </div>
                    </div>

                    {/* Highly interactive segmented toggle buttons with absolute single click trigger */}
                    <div className="flex items-center gap-1" dir="ltr">
                      
                      {/* Absent Button Option */}
                      <button
                        type="button"
                        onClick={() => handleToggleState(st.id, "absent")}
                        className={`p-1.5 px-3 rounded-xl text-3xs font-bold transition flex items-center gap-1 cursor-pointer select-none ${
                          currentStatus === "absent"
                            ? "bg-rose-600 text-white shadow-xs shadow-rose-300 scale-102"
                            : "bg-slate-50 dark:bg-slate-950 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 dark:text-slate-500 hover:text-rose-600"
                        }`}
                        title="تسجيل غائب اليوم"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">غائب</span>
                      </button>

                      {/* Late Button Option */}
                      <button
                        type="button"
                        onClick={() => handleToggleState(st.id, "late")}
                        className={`p-1.5 px-3 rounded-xl text-3xs font-bold transition flex items-center gap-1 cursor-pointer select-none ${
                          currentStatus === "late"
                            ? "bg-amber-500 text-white shadow-xs shadow-amber-300 scale-102"
                            : "bg-slate-50 dark:bg-slate-950 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-400 dark:text-slate-500 hover:text-amber-500"
                        }`}
                        title="تسجيل متأخر حالياً"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">متأخر</span>
                      </button>

                      {/* Present Button Option */}
                      <button
                        type="button"
                        onClick={() => handleToggleState(st.id, "present")}
                        className={`p-1.5 px-3 rounded-xl text-3xs font-bold transition flex items-center gap-1 cursor-pointer select-none ${
                          currentStatus === "present"
                            ? "bg-emerald-600 text-white shadow-xs shadow-emerald-300 scale-102"
                            : "bg-slate-50 dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-400 dark:text-slate-500 hover:text-emerald-600"
                        }`}
                        title="تسجيل حاضر الحصة"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">حاضر</span>
                      </button>

                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

    </div>
  );
}
