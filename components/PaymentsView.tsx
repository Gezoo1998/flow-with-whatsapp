"use client";

import { useState } from "react";
import { useAppStore, store, Student, Group } from "@/lib/store";
import { Plus, X, Check, Landmark, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function PaymentsView() {
  const state = useAppStore((s) => s);
  
  // States
  const [selectedGroupId, setSelectedGroupId] = useState(state.groups[0]?.id || "all");
  const [paymentsSuccess, setPaymentsSuccess] = useState(false);

  // Modal and pay form state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [targetStudent, setTargetStudent] = useState<Student | null>(null);

  const [formMonth, setFormMonth] = useState(new Date().toISOString().substring(0, 7)); // "YYYY-MM"
  const [formAmount, setFormAmount] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");

  // Get active students for the selected group
  const activeStudents = state.students.filter((st) => {
    if (st.status !== "active") return false;
    return selectedGroupId === "all" || st.groupId === selectedGroupId;
  });

  // Find student's last paid month
  const getStudentLastPaidMonth = (studentId: string) => {
    const studentPayments = state.payments.filter(p => p.studentId === studentId);
    if (studentPayments.length === 0) return "لا يوجد كشف دفع سابق";
    
    // Sort descending to get latest month
    const latest = [...studentPayments].sort((a, b) => b.month.localeCompare(a.month))[0];
    const parts = latest.month.split("-");
    return `${parts[1]} / ${parts[0]}`;
  };

  const handleOpenPayModal = (student: Student) => {
    setFormError("");
    setTargetStudent(student);
    const gr = state.groups.find(g => g.id === student.groupId);
    const defaultAmount = student.customFee !== undefined ? student.customFee : (gr ? gr.monthlyFee : 0);
    
    setFormAmount(defaultAmount.toString());
    setFormNotes("");
    setPayModalOpen(true);
  };

  const handleSavePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!targetStudent) return;
    if (!formAmount || Number(formAmount) <= 0) {
      setFormError("الرجاء إدخال قيمة اشتراك مالية صالحة!");
      return;
    }

    store.addPayment(targetStudent.id, formMonth, Number(formAmount), formNotes);

    setPaymentsSuccess(true);
    setPayModalOpen(false);
    setTimeout(() => {
      setPaymentsSuccess(false);
    }, 2000);
  };

  return (
    <div className="space-y-6 font-sans" dir="rtl" id="payments_view">
      {/* Step 1: Choose Group */}
      <div className="space-y-2 bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl text-right">
        <label className="text-slate-500 dark:text-slate-400 text-[10px] block font-bold">تصفية حسب المجموعة الدراسية:</label>
        <select 
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none text-slate-800 dark:text-slate-100"
        >
          <option value="all" className="dark:bg-slate-900">كل المجموعات الدراسية</option>
          {state.groups.map(g => (
            <option key={g.id} value={g.id} className="dark:bg-slate-900">{g.name}</option>
          ))}
        </select>
      </div>

      {/* Step 2: Display list */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">قائمة سداد الاشتراكات ({activeStudents.length} طلاب)</h3>
          <AnimatePresence>
            {paymentsSuccess && (
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
          {paymentsSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white rounded-2xl border border-emerald-400/20 shadow-xl shadow-emerald-500/30 w-[90%] max-w-xs"
            >
              <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
                <Wallet className="w-4 h-4 text-white font-bold" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-2xs font-extrabold text-white">تأكيد سداد الاشتراك</p>
                <p className="text-[10px] text-emerald-100 font-bold mt-0.5">تم تسجيل الدفعة المالية بنجاح في الخزينة وتحديث السجل!</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2.5 min-h-[150px]">
          {activeStudents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-2xs">
              لا يتوفر طلاب في هذه المجموعات حالياً
            </div>
          ) : (
            activeStudents.map((st) => {
              const lastMo = getStudentLastPaidMonth(st.id);
              return (
                <div 
                  key={st.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition rounded-2xl h-[64px]"
                >
                  <div className="space-y-0.5 max-w-[60%] truncate text-right">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block truncate">{st.name}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-550 font-bold block">آخر شهر مدفوع: {lastMo}</span>
                  </div>

                  <button
                    onClick={() => handleOpenPayModal(st)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-2xs font-black rounded-xl transition cursor-pointer select-none"
                  >
                    دفعة +
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Payment Form Dialog Overlay */}
      {payModalOpen && targetStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 rounded-3xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl relative">
            <div className="bg-slate-950 dark:bg-slate-900 text-white p-4 flex justify-between items-center border-b dark:border-slate-850">
              <h3 className="font-extrabold text-xs">تسجيل دفعة لـ {targetStudent.name}</h3>
              <button onClick={() => setPayModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentSubmit} className="p-5 space-y-3.5 text-xs text-right">
              {formError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-105 dark:border-red-950 text-red-650 dark:text-red-400 font-bold rounded-xl">{formError}</div>
              )}

              {/* Month */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">شهر وموسم الاشتراك:</label>
                <input 
                  type="month" 
                  value={formMonth} 
                  onChange={(e) => setFormMonth(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-2.5 font-bold font-mono text-slate-800 dark:text-slate-100" 
                  required 
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">القيمة المالية المحصلة (ج.م): *</label>
                <input 
                  type="number" 
                  value={formAmount} 
                  onChange={(e) => setFormAmount(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-2.5 font-black text-blue-650 dark:text-blue-400" 
                  placeholder="200" 
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">إيصال ورقي وملاحظات الحسابات:</label>
                <input 
                  type="text" 
                  value={formNotes} 
                  onChange={(e) => setFormNotes(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-100" 
                  placeholder="رقم الإيصال أو كشف مالي" 
                />
              </div>

              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition cursor-pointer select-none">
                تأكيد سداد المبلغ فورا
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
