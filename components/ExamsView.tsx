"use client";

import { useState } from "react";
import { useAppStore, store, ExamRecord } from "@/lib/store";
import { Plus, X, ChevronLeft, Save, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function ExamsView() {
  const state = useAppStore((s) => s);
  
  // States
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [gradingSuccess, setGradingSuccess] = useState(false);

  // Creation Form Form Control
  const [examTitle, setExamTitle] = useState("");
  const [examMaxScore, setExamMaxScore] = useState("30");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [examGroups, setExamGroups] = useState<string[]>([]);
  const [examError, setExamError] = useState("");

  // Grades entries
  const [gradesMap, setGradesMap] = useState<Record<string, string>>({});

  const currentExam = state.exams.find((ex) => ex.id === selectedExamId);

  // Target group students
  const targetStudents = currentExam 
    ? state.students.filter(
        st => st.status === "active" && currentExam.targetGroupIds?.includes(st.groupId)
      )
    : [];

  const handleOpenExam = (exam: ExamRecord) => {
    // Fill grades map with existing scores
    const initialGrades: Record<string, string> = {};
    const studentsInTarget = state.students.filter(
      st => st.status === "active" && exam.targetGroupIds?.includes(st.groupId)
    );
    studentsInTarget.forEach(st => {
      const existing = exam.scores[st.id];
      initialGrades[st.id] = existing !== undefined ? existing.toString() : "";
    });
    setGradesMap(initialGrades);
    setGradingSuccess(false);
    setSelectedExamId(exam.id);
  };

  const handleGroupToggle = (groupId: string) => {
    if (examGroups.includes(groupId)) {
      setExamGroups(examGroups.filter(id => id !== groupId));
    } else {
      setExamGroups([...examGroups, groupId]);
    }
  };

  const handleCreateExamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExamError("");

    if (!examTitle.trim() || !examMaxScore) {
      setExamError("برجاء إدخال تفاصيل مسمى الامتحان!");
      return;
    }
    if (examGroups.length === 0) {
      setExamError("برجاء اختيار مجموعة واحدة على الأقل!");
      return;
    }

    const created = store.createExam(
      examTitle.trim(),
      Number(examMaxScore),
      examDate,
      examGroups,
      ""
    );

    setIsCreateOpen(false);
    // Directly open custom scores grading for the newly created exam
    handleOpenExam(created);
  };

  const handleSaveGrades = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentExam) return;

    const maxGrade = currentExam.maxScore;
    const converted: Record<string, number> = {};
    let rangeError = false;

    targetStudents.forEach(st => {
      const val = gradesMap[st.id];
      if (val !== undefined && val !== "") {
        const num = Number(val);
        if (num < 0 || num > maxGrade) {
          rangeError = true;
        } else {
          converted[st.id] = num;
        }
      }
    });

    if (rangeError) {
      alert(`خطأ! درجات الامتحان يجب أن تقع بين 0 والحد الأقصى ${maxGrade}`);
      return;
    }

    store.saveExamScores(currentExam.id, converted);
    setGradingSuccess(true);
    setTimeout(() => setGradingSuccess(false), 2000);
  };

  const handleGradeChange = (stId: string, val: string) => {
    setGradingSuccess(false);
    setGradesMap(prev => ({
      ...prev,
      [stId]: val
    }));
  };

  return (
    <div className="space-y-6 font-sans" dir="rtl" id="exams_view">
      
      {/* CASE 1: NO EXAM OPENED – DISPLAY ALL EXAMS LIST */}
      {!currentExam ? (
        <div className="space-y-6">
          {/* Header row */}
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">سجل درجات الامتحانات</h2>
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block mt-0.5">رصد وحفظ كشوف الامتحانات التحريرية</span>
            </div>
            <button 
              onClick={() => {
                setExamTitle("");
                setExamMaxScore("30");
                setExamGroups([]);
                setExamError("");
                setIsCreateOpen(true);
              }}
              className="p-3 bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white rounded-2xl cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Simple Row List of Exams */}
          <div className="space-y-2.5">
            {state.exams.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-55 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-2xs">
                لا توجد امتحانات مسجلة حالياً
              </div>
            ) : (
              state.exams.map((ex) => (
                <div 
                  key={ex.id}
                  onClick={() => handleOpenExam(ex)}
                  className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 transition rounded-2xl cursor-pointer active:bg-slate-100 dark:active:bg-slate-800 h-[64px]"
                >
                  <div className="truncate max-w-[70%] space-y-0.5">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{ex.title}</h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 block font-bold">تاريخ الامتحان: {ex.date}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-300">
                      الدرجة الكلية: {ex.maxScore}
                    </span>
                    <ChevronLeft className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* CASE 2: SINGLE EXAM OPENED – DISPLAY GRADING SCREEN */
        <div className="space-y-6">
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button 
              onClick={() => setSelectedExamId(null)}
              className="p-1 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition text-2xs font-extrabold cursor-pointer"
            >
              رجوع
            </button>
            <div className="truncate flex-1">
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100 truncate leading-tight">{currentExam.title}</h2>
              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">الدرجة الكلية القصوى: {currentExam.maxScore} | تاريخ: {currentExam.date}</span>
            </div>
          </div>

          {/* Student Grading List Form */}
          <form onSubmit={handleSaveGrades} className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">رصد وحفظ الدرجات التفصيلية:</h3>
              <AnimatePresence>
                {gradingSuccess && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/35 text-emerald-700 dark:text-emerald-400 font-extrabold rounded-lg flex items-center gap-1"
                  >
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>حُفِظ محلياً</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Floating success toast notification system */}
            <AnimatePresence>
              {gradingSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-indigo-600 via-blue-500 to-indigo-500 text-white rounded-2xl border border-indigo-400/20 shadow-xl shadow-indigo-500/30 w-[90%] max-w-xs"
                >
                  <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
                    <Check className="w-4.5 h-4.5 font-bold" />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-2xs font-extrabold text-white">تأكيد رصد الدرجات</p>
                    <p className="text-[10px] text-indigo-100 font-bold mt-0.5">تم حفظ كشف درجات هذا الامتحان وتحديث كارت الطالب والترتيب تلقائياً!</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2.5 min-h-[150px]">
              {targetStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-2xs">
                  لا يتوفر طلاب في المجموعات المستهدفة حالياً للرصيد
                </div>
              ) : (
                targetStudents.map((st) => (
                  <div 
                    key={st.id}
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl h-[64px]"
                  >
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate max-w-[65%]">{st.name}</span>
                    
                    {/* Score Input block */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input 
                        type="number"
                        step="any"
                        min="0"
                        max={currentExam.maxScore}
                        value={gradesMap[st.id] || ""}
                        onChange={(e) => handleGradeChange(st.id, e.target.value)}
                        placeholder="--"
                        className="w-20 bg-blue-50/80 dark:bg-slate-900 border-2 border-blue-200/80 dark:border-blue-900/50 text-blue-950 dark:text-blue-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl py-1.5 px-2 text-center font-black text-sm font-mono shadow-xs focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/25 transition-all duration-150"
                      />
                      <span className="text-slate-450 dark:text-slate-500 text-[10px] font-bold font-sans">/ {currentExam.maxScore}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {targetStudents.length > 0 && (
              <button 
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Save className="w-4.5 h-4.5" />
                <span>حفظ كشف درجات الامتحان فورا</span>
              </button>
            )}
          </form>
        </div>
      )}

      {/* Add Exam Dialog Overlay */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden border border-slate-105 border-slate-100 dark:border-slate-800 shadow-2xl relative">
            <div className="bg-slate-950 text-white p-4.5 flex justify-between items-center">
              <h3 className="font-extrabold text-xs">إضافة تفاصيل امتحان جديد</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white cursor-pointer hover:scale-105 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExamSubmit} className="p-5 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
              {examError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-red-650 dark:text-red-400 font-bold rounded-xl animate-pulse">{examError}</div>
              )}

              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold font-semibold">مسمى وموضوع الامتحان: *</label>
                <input 
                  type="text" 
                  value={examTitle} 
                  onChange={(e) => setExamTitle(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-800 dark:text-slate-200" 
                  placeholder="امتحان الفصل الأول - الميكانيكا"
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">الدرجة النهائية: *</label>
                  <input 
                    type="number" 
                    step="any"
                    value={examMaxScore} 
                    onChange={(e) => setExamMaxScore(e.target.value)} 
                    className="w-full bg-blue-50/80 dark:bg-slate-900 border-2 border-blue-200/80 dark:border-blue-900/50 text-blue-950 dark:text-blue-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl p-2.5 font-black text-sm font-mono text-center focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/25 transition-all duration-150" 
                    placeholder="30"
                    required 
                  />
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">تاريخ الامتحان:</label>
                  <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl p-2.5 font-bold font-mono text-slate-800 dark:text-slate-200" />
                </div>
              </div>

              {/* Target Groups multi-selection */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">المجموعات المستهدفة:</label>
                <div className="space-y-1.5 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl max-h-[120px] overflow-y-auto">
                  {state.groups.map(g => {
                    const checked = examGroups.includes(g.id);
                    return (
                      <label key={g.id} className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                        <input 
                          type="checkbox" 
                          checked={checked}
                          onChange={() => handleGroupToggle(g.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-auto" 
                        />
                        <span>{g.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] cursor-pointer text-white font-extrabold rounded-xl transition">
                تأكيد وبدء رصد درجات الطلاب
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
