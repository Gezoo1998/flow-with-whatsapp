"use client";

import { useState, useEffect } from "react";
import { useAppStore, store, Student, Group } from "@/lib/store";
import { Search, Plus, ChevronLeft, X, Edit, Trash2, Archive, ArchiveRestore, Printer, Download } from "lucide-react";
import { downloadMultipleBarcodePNGs, printMultipleBarcodeImages } from "@/lib/barcodeImageHelper";
import { downloadMultipleBarcodePDFs, printMultipleBarcodePDFs } from "@/lib/barcodeHelperPDF";
import { downloadMultipleBarcodeCompact, printMultipleBarcodeCompact, downloadMultipleBarcodeZip } from "@/lib/barcodeHelperCompact";

interface StudentManagerProps {
  onNavigate?: (view: string, extraParams?: Record<string, string>) => void;
  initialGroupId?: string;
}

export default function StudentManager({ onNavigate, initialGroupId }: StudentManagerProps) {
  const state = useAppStore((s) => s);
  
  // Filtering & Searching State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || null);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Sync selected group from initialGroupId prop if it changes
  const [prevInitialGroupId, setPrevInitialGroupId] = useState(initialGroupId);
  if (initialGroupId !== prevInitialGroupId) {
    setPrevInitialGroupId(initialGroupId);
    setSelectedGroupId(initialGroupId || null);
  }

  // Form Fields State
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formParentPhone, setFormParentPhone] = useState("");
  const [formGroupId, setFormGroupId] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCustomFee, setFormCustomFee] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");

  // Auto-trigger add mode if action === "add" is detected in layout params
  useEffect(() => {
    // If we passed down action custom triggers, we open modal
    // Checking search params or dynamic custom actions isn't strict, we can handle direct trigger
  }, []);

  const openAddModal = () => {
    setEditingStudent(null);
    // توليد كود طالب بسيط ومتسلسل (مثال: ST-1001، ST-1002...) بناءً على آخر رقم في النظام لسهولة الحفظ والمشاركة
    const activeIds = state.students || [];
    const numericPartList = activeIds
      .map((st) => {
        const match = st.id.match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
      })
      .filter((n): n is number => n !== null && n < 100000); // تصفية التواريخ الكبيرة جداً للحساب السليم
    const maxId = numericPartList.length > 0 ? Math.max(...numericPartList) : 1000;
    const nextId = Math.max(1001, maxId + 1);
    setFormId(`ST-${nextId}`);
    setFormName("");
    setFormPhone("");
    setFormParentPhone("");
    setFormGroupId(state.groups[0]?.id || "");
    setFormAddress("");
    setFormCustomFee("");
    setFormNotes("");
    setFormError("");
    setIsAddEditModalOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("الاسم الثلاثي للطالب مطلوب!");
      return;
    }
    if (!formPhone.trim()) {
      setFormError("رقم الهاتف مطلوب للتواصل!");
      return;
    }
    if (!formParentPhone.trim()) {
      setFormError("رقم ولي الأمر أساسي لمتابعة الغيابات!");
      return;
    }

    const payload = {
      name: formName.trim(),
      phone: formPhone.trim(),
      parentPhone: formParentPhone.trim(),
      groupId: formGroupId,
      address: formAddress.trim() || undefined,
      customFee: formCustomFee ? Number(formCustomFee) : undefined,
      notes: formNotes.trim(),
    };

    if (editingStudent) {
      store.updateStudent(editingStudent.id, payload);
    } else {
      store.addStudent({
        ...payload,
        id: formId,
      } as any);
    }

    setIsAddEditModalOpen(false);
  };

  // Filter students
  const filteredStudents = state.students.filter((st) => {
    const matchesSearch = 
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.phone.includes(searchQuery) ||
      st.parentPhone.includes(searchQuery) ||
      st.id.includes(searchQuery);
    
    let matchesGroup = true;
    if (!searchQuery && selectedGroupId !== null) {
      if (selectedGroupId === "unassigned") {
        matchesGroup = !st.groupId || !state.groups.some(g => g.id === st.groupId);
      } else {
        matchesGroup = st.groupId === selectedGroupId;
      }
    }
    
    return matchesSearch && matchesGroup && st.status === "active";
  });

  const getPaymentStatusLabel = (st: Student) => {
    const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
    const studentPaymentsList = (state.payments || []).filter(
      (p) => p.studentId === st.id && p.month === currentMonthStr
    );
    const totalPaid = studentPaymentsList.reduce((sum, p) => sum + p.amount, 0);

    const group = state.groups.find((g) => g.id === st.groupId);
    const expectedFee = st.customFee !== undefined ? st.customFee : (group ? group.monthlyFee : 0);

    if (expectedFee === 0) return { label: "معفي", color: "text-slate-500 bg-slate-50" };
    if (totalPaid >= expectedFee) return { label: "مسدد", color: "text-emerald-700 bg-emerald-50" };
    if (totalPaid > 0) return { label: "جزئي", color: "text-amber-700 bg-amber-50" };
    return { label: "غير مسدد", color: "text-red-700 bg-red-50" };
  };

  return (
    <div className="space-y-6 font-sans" id="student_manager_component" dir="rtl">
      {/* Top Controls Row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input 
            type="text"
            placeholder="ابحث باسم الطالب أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition"
          />
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <button
          onClick={openAddModal}
          className="p-3 bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white rounded-2xl flex items-center justify-center cursor-pointer shadow-sm"
          title="إضافة طالب جديد"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* If no group selected and no active search queries: show Groups selection */}
      {!searchQuery && selectedGroupId === null ? (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">تفصيل المجموعات:</h3>
            <span className="text-[10px] text-slate-455 dark:text-slate-500 font-bold font-mono">
              مجموعاتي: {state.groups.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {state.groups.map((group) => {
              const studentsInGroup = state.students.filter(
                (st) => st.groupId === group.id && st.status === "active"
              );

              return (
                <div
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xs transition-all duration-200 rounded-2xl p-4.5 cursor-pointer flex flex-col justify-between group shadow-3xs"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm group-hover:text-blue-600 transition-colors truncate max-w-[150px] sm:max-w-[190px]">
                          {group.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">⏱️ {group.startTime} - {group.endTime}</span>
                      </div>
                      <span className="text-2xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-lg shrink-0">
                        {studentsInGroup.length} طلاب
                      </span>
                    </div>

                    {group.description && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
                        {group.description}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-800 mt-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    <span>استعراض الطلاب والحضور</span>
                    <ChevronLeft className="w-4 h-4 shrink-0" />
                  </div>
                </div>
              );
            })}

            {/* Students with missing or deleted groups */}
            {state.students.filter(st => st.status === "active" && (!st.groupId || !state.groups.some(g => g.id === st.groupId))).length > 0 && (
              <div
                onClick={() => setSelectedGroupId("unassigned")}
                className="bg-white dark:bg-slate-900 border border-dashed border-amber-200 dark:border-amber-900/40 hover:border-amber-400 transition-all duration-200 rounded-2xl p-4.5 cursor-pointer flex flex-col justify-between group shadow-3xs"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <h4 className="font-extrabold text-slate-800 dark:text-slate-105 text-sm group-hover:text-amber-600 transition-colors">
                        طلاب بدون مجموعة
                      </h4>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">⚠️ معلقين</span>
                    </div>
                    <span className="text-2xs font-extrabold text-amber-700 dark:text-amber-405 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-lg shrink-0">
                      {state.students.filter(st => st.status === "active" && (!st.groupId || !state.groups.some(g => g.id === st.groupId))).length} طلاب
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
                    تنسيق وتسكين الطلاب الجدد.
                  </p>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-800 mt-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  <span>تعديل المجموعات والطلاب</span>
                  <ChevronLeft className="w-4 h-4 shrink-0" />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Otherwise, show the list of group students with a BACK option */
        <div className="space-y-4">
          {/* Breadcrumb / Back Navigation (only if we didn't get here by direct searchQuery) */}
          {!searchQuery && (
            <div className="flex items-center justify-between px-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-2xs font-extrabold text-slate-800 dark:text-slate-200">
                  {selectedGroupId === "unassigned" 
                    ? "طلاب غير محددين بمجموعة" 
                    : (state.groups.find(g => g.id === selectedGroupId)?.name || "مجموعة مجهولة")}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">• {filteredStudents.length} طلاب</span>
              </div>
              
              <div className="flex items-center gap-2">
                {filteredStudents.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const groupObj = state.groups.find(g => g.id === selectedGroupId);
                        const list = filteredStudents.map(st => ({
                          id: st.id,
                          name: st.name,
                          groupName: groupObj?.name,
                          parentPhone: st.parentPhone,
                          phone: st.phone
                        }));
                        downloadMultipleBarcodePNGs(list);
                      }}
                      className="text-3xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-1.5 py-1.5 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-pointer shadow-3xs"
                      title="تحميل باركودات طلاب المجموعة كصور PNG مقتصة"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>تحميل صور الباركود</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const groupObj = state.groups.find(g => g.id === selectedGroupId);
                        const list = filteredStudents.map(st => ({
                          id: st.id,
                          name: st.name,
                          groupName: groupObj?.name,
                          parentPhone: st.parentPhone,
                          phone: st.phone
                        }));
                        printMultipleBarcodeImages(list);
                      }}
                      className="text-3xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-1.5 py-1.5 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-pointer shadow-3xs"
                      title="طباعة صور الباركود لجميع طلاب المجموعة"
                    >
                      <Printer className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                      <span>طباعة صور الباركود</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const groupObj = state.groups.find(g => g.id === selectedGroupId);
                        const list = filteredStudents.map(st => ({
                          id: st.id,
                          name: st.name,
                          groupName: groupObj?.name,
                          parentPhone: st.parentPhone,
                          phone: st.phone
                        }));
                        downloadMultipleBarcodePDFs(list);
                      }}
                      className="text-3xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-1.5 py-1.5 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-pointer shadow-3xs"
                      title="تحميل مستندات PDF لجميع باركودات الطلاب في المجموعة"
                    >
                      <Download className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>تحميل باركودات PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const groupObj = state.groups.find(g => g.id === selectedGroupId);
                        const list = filteredStudents.map(st => ({
                          id: st.id,
                          name: st.name,
                          groupName: groupObj?.name,
                          parentPhone: st.parentPhone,
                          phone: st.phone
                        }));
                        printMultipleBarcodePDFs(list);
                      }}
                      className="text-3xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-1.5 py-1.5 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-pointer shadow-3xs"
                      title="طباعة مستندات PDF لجميع باركودات الطلاب في المجموعة"
                    >
                      <Printer className="w-3.5 h-3.5 text-rose-700 dark:text-rose-500" />
                      <span>طباعة باركودات PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const groupObj = state.groups.find(g => g.id === selectedGroupId);
                        const list = filteredStudents.map(st => ({
                          id: st.id,
                          name: st.name,
                          groupName: groupObj?.name,
                          parentPhone: st.parentPhone,
                          phone: st.phone
                        }));
                        downloadMultipleBarcodeZip(list, 'COMPACT', `barcodes_compact_${groupObj?.name || 'group'}.zip`);
                      }}
                      className="text-3xs font-extrabold text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-950/80 flex items-center gap-1.5 py-1.5 px-3 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl transition cursor-pointer shadow-3xs"
                      title="تحميل جميع باركودات طلاب المجموعة في ملف ZIP مضغوط (Compact)"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>تحميل ZIP (Compact)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const groupObj = state.groups.find(g => g.id === selectedGroupId);
                        const list = filteredStudents.map(st => ({
                          id: st.id,
                          name: st.name,
                          groupName: groupObj?.name,
                          parentPhone: st.parentPhone,
                          phone: st.phone
                        }));
                        downloadMultipleBarcodeCompact(list, 'COMPACT');
                      }}
                      className="text-3xs font-extrabold text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950 flex items-center gap-1.5 py-1.5 px-3 bg-teal-50/50 dark:bg-slate-950 border border-teal-200 dark:border-teal-800 rounded-xl transition cursor-pointer shadow-3xs"
                      title="تحميل باركودات Compact مقتطعة تلقائياً لجميع الطلاب"
                    >
                      <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>تحميل Compact</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const groupObj = state.groups.find(g => g.id === selectedGroupId);
                        const list = filteredStudents.map(st => ({
                          id: st.id,
                          name: st.name,
                          groupName: groupObj?.name,
                          parentPhone: st.parentPhone,
                          phone: st.phone
                        }));
                        printMultipleBarcodeCompact(list, 'COMPACT');
                      }}
                      className="text-3xs font-extrabold text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950 flex items-center gap-1.5 py-1.5 px-3 bg-teal-50/50 dark:bg-slate-950 border border-teal-200 dark:border-teal-800 rounded-xl transition cursor-pointer shadow-3xs"
                      title="طباعة باركودات Compact مقتطعة تلقائياً لجميع الطلاب"
                    >
                      <Printer className="w-3.5 h-3.5 text-teal-700 dark:text-teal-500" />
                      <span>طباعة Compact</span>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedGroupId(null)}
                  className="text-3xs font-extrabold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1.5 py-1.5 px-3 bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl transition duration-150 cursor-pointer shadow-3xs"
                >
                  <span>الرجوع لكل المجموعات</span>
                  <ChevronLeft className="w-4 h-4 rotate-180 text-blue-600 dark:text-blue-400" />
                </button>
              </div>
            </div>
          )}

          {searchQuery && (
            <div className="px-1.5 text-[10px] text-slate-505 dark:text-slate-400 font-bold">
              🔍 نتائج البحث الشامل لـ «{searchQuery}»: {filteredStudents.length} طلاب
            </div>
          )}

          {/* Simple student list */}
          <div className="space-y-2.5">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs">
                لا يوجد طلاب فى هذه المجموعة حالياً
              </div>
            ) : (
              filteredStudents.map((st) => {
                const gr = state.groups.find(g => g.id === st.groupId);
                const statusObj = getPaymentStatusLabel(st);
                
                return (
                  <div 
                    key={st.id}
                    onClick={() => onNavigate && onNavigate("student_profile", { id: st.id })}
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition rounded-2xl cursor-pointer active:bg-slate-100 dark:active:bg-slate-950 h-[64px]"
                  >
                    <div className="space-y-1 truncate max-w-[65%]">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{st.name}</h4>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold">{gr ? gr.name : "بدون مجموعة"}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusObj.color}`}>
                        {statusObj.label}
                      </span>
                      <ChevronLeft className="w-5 h-5 text-slate-350 dark:text-slate-650" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal form for adding student */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden relative shadow-2xl border border-slate-100 dark:border-slate-800 animate-slide-up">
            {/* Header */}
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-900">
              <h3 className="font-extrabold text-sm">تسجيل بيانات طالب جديد</h3>
              <button onClick={() => setIsAddEditModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer hover:scale-105 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form body */}
            <form onSubmit={handleSaveStudent} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="bg-red-50 dark:bg-red-950/30 text-red-655 dark:text-red-400 text-xs font-bold p-3 rounded-xl border border-red-100 dark:border-red-900">
                  {formError}
                </div>
              )}

              {/* ID */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-2xs font-bold mb-1 block">كود ومُعرّف الطالب:</label>
                <input 
                  type="text" 
                  value={formId} 
                  onChange={(e) => setFormId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-850 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  placeholder="ST_12345"
                />
              </div>

              {/* Name */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-2xs font-bold mb-1 block">الاسم الثلاثي للطالب: *</label>
                <input 
                  type="text" 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-850 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  placeholder="محمد أحمد على"
                  required
                />
              </div>

              {/* Group */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-2xs font-bold mb-1 block">المجموعة الدراسية:</label>
                <select 
                  value={formGroupId}
                  onChange={(e) => setFormGroupId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {state.groups.map(g => (
                    <option key={g.id} value={g.id} className="dark:bg-slate-900">{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-2xs font-bold mb-1 block">رقم هاتف الطالب للتواصل: *</label>
                <input 
                  type="tel" 
                  value={formPhone} 
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-850 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                  placeholder="01234567890"
                  required
                />
              </div>

              {/* Parent Phone */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-2xs font-bold mb-1 block">رقم هاتف ولي الأمر: *</label>
                <input 
                  type="tel" 
                  value={formParentPhone} 
                  onChange={(e) => setFormParentPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-850 dark:text-slate-100 text-right focus:ring-1 focus:ring-blue-500"
                  placeholder="01123456789"
                  required
                />
              </div>

              {/* Custom Fee */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-2xs font-bold mb-1 block">اشتراك مالي شهري مخصص (اختياري):</label>
                <input 
                  type="number" 
                  value={formCustomFee} 
                  onChange={(e) => setFormCustomFee(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-850 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  placeholder="يترك فارغاً لاستخدام اشتراك المجموعة الافتراضي"
                />
              </div>

              {/* Address */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-2xs font-bold mb-1 block">العنوان السكني للطلاب:</label>
                <input 
                  type="text" 
                  value={formAddress} 
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-850 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  placeholder="المنطقة / الشارع"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-2xs font-bold mb-1 block">ملاحظات سلوكية أو طبية:</label>
                <textarea 
                  value={formNotes} 
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-850 dark:text-slate-100 min-h-[60px] focus:ring-1 focus:ring-blue-500"
                  placeholder="أي معلومات إضافية"
                />
              </div>

              {/* Save */}
              <button 
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition text-white font-extrabold text-xs rounded-xl cursor-pointer"
              >
                تأكيد وتسجيل الطالب فورياً
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
