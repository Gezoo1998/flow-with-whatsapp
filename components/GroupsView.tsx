"use client";

import { useState } from "react";
import { useAppStore, store, Group, hasFullAccess } from "@/lib/store";
import { Plus, X, Edit, Trash2, Clock, Calendar, MapPin, ChevronLeft, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GroupsViewProps {
  onNavigate: (view: string, extraParams?: Record<string, string>) => void;
}

export default function GroupsView({ onNavigate }: GroupsViewProps) {
  const state = useAppStore((s) => s);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formFee, setFormFee] = useState("");
  const [formDays, setFormDays] = useState<number[]>([]);
  const [formStart, setFormStart] = useState("16:00");
  const [formEnd, setFormEnd] = useState("17:30");
  const [formDesc, setFormDesc] = useState("");
  const [formError, setFormError] = useState("");

  const [groupToDelete, setGroupToDelete] = useState<{ id: string; name: string } | null>(null);
  const [noPermissionAlert, setNoPermissionAlert] = useState(false);

  const DAYS_ARABIC = [
    { value: 6, label: "السبت" },
    { value: 0, label: "الأحد" },
    { value: 1, label: "الإثنين" },
    { value: 2, label: "الثلاثاء" },
    { value: 3, label: "الأربعاء" },
    { value: 4, label: "الخميس" },
    { value: 5, label: "الجمعة" },
  ];

  const handleOpenAdd = () => {
    setEditingGroup(null);
    setFormName("");
    setFormFee("");
    setFormDays([]);
    setFormStart("16:00");
    setFormEnd("17:30");
    setFormDesc("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroup(group);
    setFormName(group.name);
    setFormFee(group.monthlyFee.toString());
    setFormDays(group.daysOfWeek);
    setFormStart(group.startTime);
    setFormEnd(group.endTime);
    setFormDesc(group.description);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleDayToggle = (day: number) => {
    if (formDays.includes(day)) {
      setFormDays(formDays.filter(d => d !== day));
    } else {
      setFormDays([...formDays, day].sort());
    }
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim() || !formFee.trim()) {
      setFormError("الرجاء إدخال اسم المجموعة والاشتراك الشهري!");
      return;
    }

    if (formDays.length === 0) {
      setFormError("يرجى اختيار يوم واحد على الأقل من أيام محاضرات المجموعة للتأكيد!");
      return;
    }

    const payload = {
      name: formName.trim(),
      monthlyFee: Number(formFee),
      daysOfWeek: formDays,
      startTime: formStart,
      endTime: formEnd,
      description: formDesc.trim(),
    };

    if (editingGroup) {
      store.updateGroup(editingGroup.id, payload);
    } else {
      store.addGroup(payload);
    }

    setIsModalOpen(false);
  };

  const handleDeleteGroup = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasFullAccess(state)) {
      setNoPermissionAlert(true);
      return;
    }
    setGroupToDelete({ id, name });
  };

  const handleConfirmDeleteGroup = () => {
    if (groupToDelete) {
      store.deleteGroup(groupToDelete.id);
      setGroupToDelete(null);
    }
  };

  const getDaysLabels = (days: number[]) => {
    if (!days || days.length === 0) return "غير محدد";
    return days
      .map((d) => DAYS_ARABIC.find((day) => day.value === d)?.label || "")
      .filter(Boolean)
      .join("، ");
  };

  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return "";
    try {
      const [hourStr, minStr] = timeStr.split(":");
      const hour = parseInt(hourStr, 10);
      const ampm = hour >= 12 ? "م" : "ص";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minStr} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="space-y-6 font-sans" dir="rtl" id="groups_view">
      {/* Header toolbars */}
      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">المجموعات الدراسية بالسنتر</h2>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">تهيئة فترات الحصص والاشتراكات الشهرية فورا</span>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="p-3 bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white rounded-2xl cursor-pointer"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Groups Premium Grid */}
      <div>
        {state.groups.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
            لا توجد مجموعات مهيأة حالياً
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.groups.map((g) => {
              const count = state.students.filter(s => s.groupId === g.id && s.status === "active").length;
              return (
                <div 
                  key={g.id}
                  onClick={() => onNavigate("students", { groupId: g.id })}
                  className="group relative bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:border-blue-500/30 dark:hover:border-blue-500/40 p-5 rounded-3xl cursor-pointer transition-all duration-200 hover:shadow-lg dark:hover:shadow-blue-950/20 hover:shadow-slate-100 flex flex-col justify-between space-y-4"
                >
                  {/* Top Section */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 truncate max-w-[70%]">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-450 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5.5 h-5.5" />
                      </div>
                      <div className="truncate">
                        <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm leading-tight truncate">{g.name}</h4>
                        <span className="text-[9px] text-slate-400 dark:text-slate-505 font-bold block mt-0.5">كود: #{g.id.slice(0, 4)}</span>
                      </div>
                    </div>
                    
                    <span className="text-[10px] font-black bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/50 px-2.5 py-1.5 rounded-full font-sans shrink-0">
                      {count} طالب نشط
                    </span>
                  </div>

                  {/* Meta Details Container */}
                  <div className="grid grid-cols-1 gap-2 bg-slate-50/50 dark:bg-slate-950/45 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850/60 text-[10.5px]">
                    {/* Lesson Days */}
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      <span className="font-bold shrink-0 text-slate-400 dark:text-slate-500">أيام المجموعات:</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate">{getDaysLabels(g.daysOfWeek)}</span>
                    </div>
                    
                    {/* Class Time */}
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                      <span className="font-bold shrink-0 text-slate-400 dark:text-slate-500">موعد المحاضرة:</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 font-sans">
                        {formatTime12h(g.startTime)} إلى {formatTime12h(g.endTime)}
                      </span>
                    </div>

                    {/* Location Description */}
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 dark:text-rose-450 shrink-0" />
                      <span className="font-bold shrink-0 text-slate-400 dark:text-slate-500">موقع الحضور:</span>
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 truncate">
                        {g.description || "لم يتم تدوين موقع مخصص للمجموعة"}
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-100 dark:border-slate-800/80">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-450 dark:text-slate-500 font-bold">الاشتراك الأساسي</span>
                      <span className="text-[13px] font-black text-emerald-600 dark:text-emerald-450 font-sans">
                        {g.monthlyFee} ج.م <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">/شهرياً</span>
                      </span>
                    </div>

                    <div className="flex gap-1.5 items-center">
                      <button 
                        onClick={(e) => handleOpenEdit(g, e)}
                        className="flex items-center gap-1 p-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/80 rounded-xl transition text-[10px] font-black cursor-pointer active:scale-95 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <Edit className="w-3 h-3 text-blue-500" />
                        <span>تعديل</span>
                      </button>
                      <button 
                        onClick={(e) => handleDeleteGroup(g.id, g.name, e)}
                        className="flex items-center gap-1 p-1.5 px-3 bg-red-50 hover:bg-red-105/60 dark:bg-red-950/25 dark:hover:bg-red-900/30 text-red-650 dark:text-red-400 border border-red-100/50 dark:border-red-900/40 rounded-xl transition text-[10px] font-black cursor-pointer active:scale-95"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                        <span>حذف</span>
                      </button>
                      
                      <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400 dark:text-slate-600 border border-slate-100 dark:border-slate-850/60">
                        <ChevronLeft className="w-3.5 h-3.5 group-hover:translate-x-[-2px] transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-955/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl relative">
            <div className="bg-slate-950 text-white p-4.5 flex justify-between items-center">
              <h3 className="font-extrabold text-xs">{editingGroup ? `تعديل مجموعة ${editingGroup.name}` : "إنشاء مجموعة جديدة"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer active:scale-95">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="p-5 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-red-650 dark:text-red-400 font-bold rounded-xl">{formError}</div>
              )}

              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">اسم المجموعة: *</label>
                <input 
                  type="text" 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-xl p-2.5 font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-blue-500" 
                  placeholder="مجموعة السبت - الثالث الثانوي"
                  required 
                />
              </div>

              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">الاشتراك الشهري الأساسي (ج.م): *</label>
                <input 
                  type="number" 
                  value={formFee} 
                  onChange={(e) => setFormFee(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-xl p-2.5 font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-blue-500" 
                  placeholder="150"
                  required 
                />
              </div>

              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">موعد الحصة:</label>
                  <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 text-slate-855 dark:text-slate-200 rounded-xl p-2 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">ميعاد الانتهاء:</label>
                  <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 text-slate-855 dark:text-slate-200 rounded-xl p-2 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              {/* Days selection */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">أيام المحاضرات:</label>
                <div className="grid grid-cols-4 gap-1.5 font-sans">
                  {DAYS_ARABIC.map((day) => {
                    const selected = formDays.includes(day.value);
                    return (
                      <button
                        type="button"
                        key={day.value}
                        onClick={() => handleDayToggle(day.value)}
                        className={`p-1 text-center rounded-lg border font-bold transition text-[10px] ${selected ? "bg-blue-600 text-white border-blue-600 pointer-events-auto cursor-pointer" : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 pointer-events-auto cursor-pointer"}`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Desc Description */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">الوصف العام والموقع:</label>
                <textarea 
                  value={formDesc} 
                  onChange={(e) => setFormDesc(e.target.value)} 
                  placeholder="وصف اختياري للمكان"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-855 dark:text-slate-205 rounded-xl p-2.5 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-blue-500 min-h-[50px]" 
                />
              </div>

              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition cursor-pointer active:scale-98 shadow-sm">
                تأكيد وحفظ بيانات المجموعة
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Custom Group Delete Confirmation Overlay */}
      <AnimatePresence>
        {groupToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGroupToDelete(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.90, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl relative border border-slate-150 dark:border-slate-800 w-full max-w-sm text-center space-y-5 z-10"
              dir="rtl"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/25 flex items-center justify-center text-red-650 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">حذف المجموعة الدراسية</h3>
                <p className="text-3xs text-slate-400 dark:text-slate-400 font-extrabold leading-relaxed">
                  هل تريد فعلاً حذف مجموعة <span className="text-slate-700 dark:text-slate-200 font-black">«{groupToDelete.name}»</span> نهائياً من السيستم؟ هذا الإجراء لن يحذف الطلاب ولكن سيقوم بإلغاء تنسيقهم من هذه المجموعة يدوياً.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleConfirmDeleteGroup}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 active:scale-98 transition text-white text-[11px] font-black rounded-xl cursor-pointer shadow-xs select-none"
                >
                  نعم، احذف المجموعة
                </button>
                <button
                  type="button"
                  onClick={() => setGroupToDelete(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 active:scale-98 transition text-slate-650 dark:text-slate-300 text-[11px] font-black rounded-xl cursor-pointer select-none"
                >
                  إلغاء الأمر
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* No Permission Alert Overlay */}
      <AnimatePresence>
        {noPermissionAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNoPermissionAlert(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.90, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl relative border border-slate-150 dark:border-slate-800 w-full max-w-sm text-center space-y-4 z-10"
              dir="rtl"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-955/20 flex items-center justify-center text-amber-550">
                <X className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">خطأ في الصلاحية</h3>
                <p className="text-3xs text-slate-400 dark:text-slate-400 font-extrabold leading-relaxed">
                  عذراً، تقتصر هذه الصلاحية والتعديلات على المدراء والمعلمين فقط بالمركز التعليمي. لا يملك المشرفون العاديون الحق في إزالة المجموعات.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoPermissionAlert(false)}
                className="w-full py-2.5 bg-slate-900 dark:bg-slate-950 text-white rounded-xl text-[11px] font-black transition select-none cursor-pointer"
              >
                قمت بالقراءة والرجوع
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
