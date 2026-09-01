"use client";

import { useState } from "react";
import { useAppStore, store, RecitationRecord } from "@/lib/store";
import { Check, Save, BookOpen, Plus, ChevronLeft, Trash2, Edit3, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function RecitationsView() {
  const state = useAppStore((s) => s);
  
  // View mode: "new" (record new) | "history" (list past recitations) | "edit" (edit specific recitation)
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [selectedRecitationId, setSelectedRecitationId] = useState<string | null>(null);

  // New Recitation Form States
  const [selectedGroupId, setSelectedGroupId] = useState(state.groups[0]?.id || "");
  const [formTitle, setFormTitle] = useState("");
  const [formMaxScore, setFormMaxScore] = useState("10");
  const [formHasSecondScore, setFormHasSecondScore] = useState(false);
  const [formMaxScore2, setFormMaxScore2] = useState("10");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  
  // Scores entry maps (studentId -> string)
  const [scoresMap, setScoresMap] = useState<Record<string, string>>({});
  const [scoresMap2, setScoresMap2] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit Recitation Form States (for selectedRecitationId)
  const [editTitle, setEditTitle] = useState("");
  const [editMaxScore, setEditMaxScore] = useState("10");
  const [editHasSecondScore, setEditHasSecondScore] = useState(false);
  const [editMaxScore2, setEditMaxScore2] = useState("10");
  const [editDate, setEditDate] = useState("");
  const [editScoresMap, setEditScoresMap] = useState<Record<string, string>>({});
  const [editScoresMap2, setEditScoresMap2] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState(false);

  // Selected recitation for editing
  const currentRecitation = state.recitations.find((r) => r.id === selectedRecitationId);

  // Group Students list for New Recitation
  const groupStudents = state.students.filter(
    st => st.groupId === selectedGroupId && st.status === "active"
  );

  // Students list for Edit Recitation
  const editTargetStudents = currentRecitation
    ? state.students.filter(
        st => st.groupId === currentRecitation.groupId && st.status === "active"
      )
    : [];

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const emptyScores: Record<string, string> = {};
    const emptyScores2: Record<string, string> = {};
    const relevantStudents = state.students.filter(
      st => st.groupId === groupId && st.status === "active"
    );
    relevantStudents.forEach(st => {
      emptyScores[st.id] = "";
      emptyScores2[st.id] = "";
    });
    setScoresMap(emptyScores);
    setScoresMap2(emptyScores2);
    setSaveSuccess(false);
    setFormTitle("");
    setFormHasSecondScore(false);
    setFormError("");
  };

  const handleScoreChange = (stId: string, val: string) => {
    setSaveSuccess(false);
    setScoresMap(prev => ({
      ...prev,
      [stId]: val
    }));
  };

  const handleScore2Change = (stId: string, val: string) => {
    setSaveSuccess(false);
    setScoresMap2(prev => ({
      ...prev,
      [stId]: val
    }));
  };

  const handleEditScoreChange = (stId: string, val: string) => {
    setEditSuccess(false);
    setEditScoresMap(prev => ({
      ...prev,
      [stId]: val
    }));
  };

  const handleEditScore2Change = (stId: string, val: string) => {
    setEditSuccess(false);
    setEditScoresMap2(prev => ({
      ...prev,
      [stId]: val
    }));
  };

  const handleOpenEdit = (rec: RecitationRecord) => {
    setSelectedRecitationId(rec.id);
    setEditTitle(rec.title);
    setEditMaxScore(rec.maxScore.toString());
    setEditHasSecondScore(!!rec.hasSecondScore);
    setEditMaxScore2(rec.maxScore2 ? rec.maxScore2.toString() : "10");
    setEditDate(rec.date);
    setEditError("");
    setEditSuccess(false);

    // Prefill scores for active students in that group
    const initialScores: Record<string, string> = {};
    const initialScores2: Record<string, string> = {};
    const groupSts = state.students.filter(
      st => st.groupId === rec.groupId && st.status === "active"
    );
    groupSts.forEach(st => {
      const existing = rec.scores?.[st.id];
      initialScores[st.id] = existing !== undefined && existing !== null ? existing.toString() : "";
      const existing2 = rec.scores2?.[st.id];
      initialScores2[st.id] = existing2 !== undefined && existing2 !== null ? existing2.toString() : "";
    });
    setEditScoresMap(initialScores);
    setEditScoresMap2(initialScores2);
  };

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedGroupId) return;
    if (!formTitle.trim()) {
      setFormError("الرجاء صياغة موضوع التسميع!");
      return;
    }
    if (!formMaxScore || Number(formMaxScore) <= 0) {
      setFormError("الرجاء تحديد الدرجة الكلية!");
      return;
    }

    const maxGrade = Number(formMaxScore);
    const maxGrade2 = Number(formMaxScore2);
    if (formHasSecondScore && (isNaN(maxGrade2) || maxGrade2 <= 0)) {
      setFormError("الرجاء تحديد الدرجة الكلية للوجه الثاني بشكل صحيح!");
      return;
    }

    const convertedScores: Record<string, number> = {};
    const convertedScores2: Record<string, number> = {};
    let rangeError = false;

    groupStudents.forEach(st => {
      const enteredVal = scoresMap[st.id];
      if (enteredVal !== undefined && enteredVal !== "") {
        const numeric = Number(enteredVal);
        if (isNaN(numeric) || numeric < 0 || numeric > maxGrade) {
          rangeError = true;
        } else {
          convertedScores[st.id] = numeric;
        }
      } else {
        convertedScores[st.id] = 0;
      }

      if (formHasSecondScore) {
        const enteredVal2 = scoresMap2[st.id];
        if (enteredVal2 !== undefined && enteredVal2 !== "") {
          const numeric2 = Number(enteredVal2);
          if (isNaN(numeric2) || numeric2 < 0 || numeric2 > maxGrade2) {
            rangeError = true;
          } else {
            convertedScores2[st.id] = numeric2;
          }
        }
      }
    });

    if (rangeError) {
      setFormError(`خطأ! درجات التسميع يجب أن تقع بين 0 والحد الأقصى المسموح به`);
      return;
    }

    store.recordRecitation(
      selectedGroupId,
      formTitle.trim(),
      maxGrade,
      formDate,
      convertedScores,
      formHasSecondScore,
      maxGrade2,
      convertedScores2
    );
    
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setFormTitle("");
      const cleared: Record<string, string> = {};
      groupStudents.forEach(st => { cleared[st.id] = ""; });
      setScoresMap(cleared);
      setScoresMap2(cleared);
    }, 1500);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    if (!currentRecitation) return;

    if (!editTitle.trim()) {
      setEditError("برجاء إدخال عنوان التسميع!");
      return;
    }

    const maxGrade = Number(editMaxScore);
    if (isNaN(maxGrade) || maxGrade <= 0) {
      setEditError("الرجاء تحديد الدرجة الكلية بشكل صحيح!");
      return;
    }

    const maxGrade2 = Number(editMaxScore2);
    if (editHasSecondScore && (isNaN(maxGrade2) || maxGrade2 <= 0)) {
      setEditError("الرجاء تحديد الدرجة الكلية للوجه الثاني بشكل صحيح!");
      return;
    }

    // Convert scores & check range
    const convertedScores: Record<string, number> = {};
    const convertedScores2: Record<string, number> = {};
    let rangeError = false;

    editTargetStudents.forEach(st => {
      const val = editScoresMap[st.id];
      if (val !== undefined && val !== "") {
        const num = Number(val);
        if (isNaN(num) || num < 0 || num > maxGrade) {
          rangeError = true;
        } else {
          convertedScores[st.id] = num;
        }
      }

      if (editHasSecondScore) {
        const val2 = editScoresMap2[st.id];
        if (val2 !== undefined && val2 !== "") {
          const num2 = Number(val2);
          if (isNaN(num2) || num2 < 0 || num2 > maxGrade2) {
            rangeError = true;
          } else {
            convertedScores2[st.id] = num2;
          }
        }
      }
    });

    if (rangeError) {
      setEditError(`خطأ! درجات التسميع يجب أن تقع بين 0 والحد الأقصى المسموح به`);
      return;
    }

    // Update recitation record
    store.updateRecitation(currentRecitation.id, {
      title: editTitle.trim(),
      maxScore: maxGrade,
      date: editDate,
      scores: convertedScores,
      hasSecondScore: editHasSecondScore,
      maxScore2: editHasSecondScore ? maxGrade2 : undefined,
      scores2: editHasSecondScore ? convertedScores2 : undefined,
    });

    setEditSuccess(true);
    setTimeout(() => {
      setEditSuccess(false);
    }, 2000);
  };

  const handleDeleteRecitation = (recId: string) => {
    if (window.confirm("هل أنت تأكد من رغبتك في حذف سجل التسميع هذا نهائياً؟")) {
      store.deleteRecitation(recId);
      setSelectedRecitationId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans" dir="rtl" id="recitations_view">
      
      {/* Top Header Navigation Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => {
            setActiveTab("new");
            setSelectedRecitationId(null);
          }}
          className={`flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "new" && !selectedRecitationId
              ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>رصد تسميع جديد</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("history");
            setSelectedRecitationId(null);
          }}
          className={`flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "history" || selectedRecitationId
              ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>سجل التسميعات السابقة ({state.recitations.length})</span>
        </button>
      </div>

      {/* MODE 1: EDITING A SPECIFIC PREVIOUS RECITATION */}
      {selectedRecitationId && currentRecitation ? (
        <div className="space-y-5">
          {/* Editor Header Bar */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedRecitationId(null)}
                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>رجوع للسجل</span>
              </button>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>تعديل سجل التسميع</span>
                  <Edit3 className="w-4 h-4 text-blue-500" />
                </h2>
                <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                  تعديل بيانات ودرجات الطلاب للتسميع [ {currentRecitation.title} ]
                </span>
              </div>
            </div>

            <button
              onClick={() => handleDeleteRecitation(currentRecitation.id)}
              className="p-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-xl transition cursor-pointer text-xs font-bold flex items-center gap-1"
              title="حذف هذا السجل نهائياً"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">حذف</span>
            </button>
          </div>

          {/* Edit Metadata Form */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-2xs font-bold text-slate-400 dark:text-slate-500">تفاصيل وسجلات التسميع</h3>
            
            {editError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-red-650 dark:text-red-400 font-bold rounded-xl text-xs text-center">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="sm:col-span-1">
                <label className="block mb-1 font-bold text-slate-500 dark:text-slate-400">مسمى التسميع:</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl p-2 font-bold focus:outline-none text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-500 dark:text-slate-400">الدرجة الكلية القصوى:</label>
                <input 
                  type="number" 
                  step="any"
                  value={editMaxScore}
                  onChange={(e) => setEditMaxScore(e.target.value)}
                  className="w-full bg-blue-50/80 dark:bg-slate-900 border-2 border-blue-200/80 dark:border-blue-900/50 text-blue-950 dark:text-blue-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl p-2 font-black text-sm font-mono text-center focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/25 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-500 dark:text-slate-400">تاريخ التسميع:</label>
                <input 
                  type="date" 
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl p-2 font-bold focus:outline-none text-center text-slate-800 dark:text-slate-100 font-mono"
                />
              </div>

              {/* Toggle Second Grade Edit */}
              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl sm:col-span-3">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editHasSecondScore}
                    onChange={(e) => setEditHasSecondScore(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                  <span>تفعيل درجة ثانية للتسميع (ورقة وش وظهر) 📄</span>
                </label>
                {editHasSecondScore && (
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-bold text-slate-500">الدرجة الثانية من:</span>
                    <input
                      type="number"
                      step="any"
                      value={editMaxScore2}
                      onChange={(e) => setEditMaxScore2(e.target.value)}
                      className="w-16 bg-blue-50/80 dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg p-1 text-center font-black text-xs text-blue-900 dark:text-blue-100"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Edit Students Grades Form */}
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">
                درجات الطلاب المستهدفين:
              </h3>
              <AnimatePresence>
                {editSuccess && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-extrabold rounded-lg flex items-center gap-1"
                  >
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>تم التحديث والحفظ بنجاح</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Floating toast message for edit */}
            <AnimatePresence>
              {editSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  transition={{ duration: 0.35 }}
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-emerald-600 text-white rounded-2xl border border-emerald-400/20 shadow-xl shadow-emerald-500/30 w-[90%] max-w-xs"
                >
                  <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 font-bold" />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-2xs font-extrabold text-white">تأكيد تعديل الدرجات</p>
                    <p className="text-[10px] text-emerald-100 font-bold mt-0.5">تم حفظ التعديلات وإرسال البيانات لقاعدة بيانات النيون فوراً!</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2.5 min-h-[150px]">
              {editTargetStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-2xs">
                  لا يوجد طلاب نشطون حالياً في هذه المجموعة
                </div>
              ) : (
                editTargetStudents.map((st) => (
                  <div 
                    key={st.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-2xl gap-2"
                  >
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{st.name}</span>
                    
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      {/* Score 1 */}
                      <div className="flex items-center gap-1">
                        {editHasSecondScore && <span className="text-[10px] font-extrabold text-slate-400">د1:</span>}
                        <input 
                          type="number"
                          step="any"
                          min="0"
                          max={editMaxScore}
                          value={editScoresMap[st.id] !== undefined ? editScoresMap[st.id] : ""}
                          onChange={(e) => handleEditScoreChange(st.id, e.target.value)}
                          placeholder="--"
                          className="w-16 bg-blue-50/80 dark:bg-slate-900 border-2 border-blue-200/80 dark:border-blue-900/50 text-blue-950 dark:text-blue-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl py-1.5 px-2 text-center font-black text-xs font-mono shadow-xs focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/25 transition-all duration-150"
                        />
                        <span className="text-slate-450 dark:text-slate-500 text-[10px] font-bold">/ {editMaxScore}</span>
                      </div>

                      {/* Score 2 Optional */}
                      {editHasSecondScore && (
                        <div className="flex items-center gap-1 border-r pr-3 border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] font-extrabold text-purple-500">د2:</span>
                          <input 
                            type="number"
                            step="any"
                            min="0"
                            max={editMaxScore2}
                            value={editScoresMap2[st.id] !== undefined ? editScoresMap2[st.id] : ""}
                            onChange={(e) => handleEditScore2Change(st.id, e.target.value)}
                            placeholder="--"
                            className="w-16 bg-purple-50/80 dark:bg-slate-900 border-2 border-purple-200/80 dark:border-purple-900/50 text-purple-950 dark:text-purple-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl py-1.5 px-2 text-center font-black text-xs font-mono shadow-xs focus:outline-none focus:border-purple-600 dark:focus:border-purple-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-purple-500/25 transition-all duration-150"
                          />
                          <span className="text-slate-450 dark:text-slate-500 text-[10px] font-bold">/ {editMaxScore2}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {editTargetStudents.length > 0 && (
              <button 
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Save className="w-4.5 h-4.5" />
                <span>حفظ التعديلات والتزامن مع السحابة</span>
              </button>
            )}
          </form>
        </div>
      ) : activeTab === "history" ? (
        /* MODE 2: HISTORY LIST OF PAST RECITATIONS */
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">أرشيف سجلات التسميع والشفوي</h2>
              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">اضغط على أي تسميع لتعديل درجات الطلاب أو تغيير البيانات</span>
            </div>
            <span className="text-2xs font-extrabold px-3 py-1 bg-purple-50 dark:bg-purple-950/30 text-purple-650 dark:text-purple-400 border border-purple-150 rounded-full">
              إجمالي: {state.recitations.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {state.recitations.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-2xs">
                لا توجد سجلات تسميع سابقة مسجلة بالسيستم حالياً
              </div>
            ) : (
              state.recitations.slice().reverse().map((rec) => {
                const groupName = state.groups.find(g => g.id === rec.groupId)?.name || "المجموعة العامة";
                const gradedCount = Object.keys(rec.scores || {}).length;

                return (
                  <div 
                    key={rec.id}
                    onClick={() => handleOpenEdit(rec)}
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 transition rounded-2xl cursor-pointer active:bg-slate-100 dark:active:bg-slate-800"
                  >
                    <div className="truncate max-w-[65%] space-y-1">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate flex items-center gap-1.5">
                        <span>{rec.title}</span>
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                        <span className="text-blue-600 dark:text-blue-400 font-extrabold">{groupName}</span>
                        <span>•</span>
                        <span>{rec.date}</span>
                        <span>•</span>
                        <span>رُصد لـ {gradedCount} طالب</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2.5 py-1 rounded-full font-mono">
                        من {rec.maxScore}
                      </span>
                      <ChevronLeft className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* MODE 3: RECORD NEW RECITATION (EXISTING FORM) */
        <div className="space-y-6">
          {/* Parameter Settings */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <h3 className="text-2xs font-bold text-slate-400 dark:text-slate-500">إعدادات موضوع التسميع الحالى</h3>
            
            {formError && (
              <div className="p-2 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 font-bold rounded-xl text-center text-xs border border-red-100 dark:border-red-900/40">{formError}</div>
            )}

            <div className="space-y-2.5 text-xs text-right">
              <div>
                <label className="block mb-1 font-bold text-slate-500 dark:text-slate-400">المجموعة الدراسية المستهدفة:</label>
                <select 
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl p-2.5 font-bold focus:outline-none text-slate-800 dark:text-slate-100"
                >
                  <option value="" className="dark:bg-slate-900">اختار مجموعة...</option>
                  {state.groups.map(g => (
                    <option key={g.id} value={g.id} className="dark:bg-slate-900">{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 font-bold text-slate-500 dark:text-slate-400">مسمى التسميع الحالى: *</label>
                  <input 
                    type="text" 
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="تسميع الجزء الأول"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl p-2 font-bold focus:outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-bold text-slate-500 dark:text-slate-400">الدرجة الكلية: *</label>
                  <input 
                    type="number" 
                    step="any"
                    value={formMaxScore}
                    onChange={(e) => setFormMaxScore(e.target.value)}
                    className="w-full bg-blue-50/80 dark:bg-slate-900 border-2 border-blue-200/80 dark:border-blue-900/50 text-blue-950 dark:text-blue-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl p-2 font-black text-sm font-mono text-center focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/25 transition-all duration-150"
                  />
                </div>
              </div>

              {/* Toggle Second Grade New */}
              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formHasSecondScore}
                    onChange={(e) => setFormHasSecondScore(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                  <span>تفعيل درجة ثانية للتسميع (ورقة وش وظهر) 📄</span>
                </label>
                {formHasSecondScore && (
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-bold text-slate-500">الدرجة الثانية من:</span>
                    <input
                      type="number"
                      step="any"
                      value={formMaxScore2}
                      onChange={(e) => setFormMaxScore2(e.target.value)}
                      className="w-16 bg-blue-50/80 dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg p-1 text-center font-black text-xs text-blue-900 dark:text-blue-100"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recitations Student List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">رصد وحفظ درجات الحفظ والشفوي</h3>
              <AnimatePresence>
                {saveSuccess && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-extrabold rounded-lg flex items-center gap-1"
                  >
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>جرى الحفظ</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Floating success toast notification system */}
            <AnimatePresence>
              {saveSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-500 text-white rounded-2xl border border-purple-400/20 shadow-xl shadow-purple-500/30 w-[90%] max-w-xs"
                >
                  <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
                    <BookOpen className="w-4 h-4 text-white font-bold" />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-2xs font-extrabold text-white">تأكيد تسوية التسميع</p>
                    <p className="text-[10px] text-purple-100 font-bold mt-0.5">تم تسجيل وحفظ درجات الطلاب الشفوي والتسميع بنجاح للجميع!</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Student list container */}
            <div className="space-y-2.5 min-h-[150px]">
              {groupStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-2xs">
                  الرجاء اختيار مجموعة صالحة للبدء في تدوين درجات الحفظ والشفوي
                </div>
              ) : (
                groupStudents.map((st) => (
                  <div 
                    key={st.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-2xl gap-2"
                  >
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{st.name}</span>
                    
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      {/* Score 1 */}
                      <div className="flex items-center gap-1">
                        {formHasSecondScore && <span className="text-[10px] font-extrabold text-slate-400">د1:</span>}
                        <input 
                          type="number"
                          step="any"
                          min="0"
                          max={formMaxScore}
                          value={scoresMap[st.id] || ""}
                          onChange={(e) => handleScoreChange(st.id, e.target.value)}
                          placeholder="--"
                          className="w-16 bg-blue-50/80 dark:bg-slate-900 border-2 border-blue-200/80 dark:border-blue-900/50 text-blue-950 dark:text-blue-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl py-1.5 px-2 text-center font-black text-xs font-mono shadow-xs focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/25 transition-all duration-150"
                        />
                        <span className="text-slate-450 dark:text-slate-500 text-[10px] font-bold">/ {formMaxScore}</span>
                      </div>

                      {/* Score 2 Optional */}
                      {formHasSecondScore && (
                        <div className="flex items-center gap-1 border-r pr-3 border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] font-extrabold text-purple-500">د2:</span>
                          <input 
                            type="number"
                            step="any"
                            min="0"
                            max={formMaxScore2}
                            value={scoresMap2[st.id] || ""}
                            onChange={(e) => handleScore2Change(st.id, e.target.value)}
                            placeholder="--"
                            className="w-16 bg-purple-50/80 dark:bg-slate-900 border-2 border-purple-200/80 dark:border-purple-900/50 text-purple-950 dark:text-purple-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl py-1.5 px-2 text-center font-black text-xs font-mono shadow-xs focus:outline-none focus:border-purple-600 dark:focus:border-purple-400 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-purple-500/25 transition-all duration-150"
                          />
                          <span className="text-slate-450 dark:text-slate-500 text-[10px] font-bold">/ {formMaxScore2}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Save Button */}
          {groupStudents.length > 0 && (
            <button 
              onClick={handleSaveNew}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Save className="w-4.5 h-4.5" />
              <span>تأكيد وحفظ درجات التسميع للسنتر</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

