"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  User, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard, 
  Award, 
  FileText, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Activity, 
  ShieldCheck, 
  Sparkles,
  Phone,
  Hash,
  HelpCircle,
  TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function ParentsPortal() {
  const [studentCode, setStudentCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dbState, setDbState] = useState<any>(null);
  const [searchedStudent, setSearchedStudent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "recitations" | "exams" | "payments">("overview");

  const [parentResult, setParentResult] = useState<any>(null);

  const handleLookup = async (codeToSearch?: string) => {
    setErrorMsg("");
    const targetCode = (codeToSearch || studentCode).trim();
    if (!targetCode) {
      setErrorMsg("الرجاء إدخال كود الطالب أولاً!");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/parents/lookup?code=${encodeURIComponent(targetCode)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setParentResult(data);
        setSearchedStudent(data.student);
        setActiveTab("overview");
      } else {
        setErrorMsg(data.message || "عذراً! لم نجد أي طالب مسجل بهذا الكود. يرجى مراجعة الإدارة.");
        setSearchedStudent(null);
        setParentResult(null);
      }
    } catch (err) {
      console.error("Error performing parent lookup:", err);
      setErrorMsg("تعذر الاتصال بالسيرفر. يرجى المحاولة بعد قليل.");
      setSearchedStudent(null);
      setParentResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Check URL parameter on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get("code");
      if (codeParam) {
        setTimeout(() => {
          setStudentCode(codeParam);
          handleLookup(codeParam);
        }, 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper calculation functions
  const getStudentGroup = (): { name: string; monthlyFee?: number } | null => {
    if (!searchedStudent) return null;
    return { name: searchedStudent.groupName || "المجموعة العامة", monthlyFee: 0 };
  };

  const getStudentAttendanceStatistics = () => {
    if (!parentResult || !Array.isArray(parentResult.attendance)) {
      return { total: 0, present: 0, absent: 0, late: 0, rate: 100, list: [] };
    }

    const list = parentResult.attendance;
    let present = 0;
    let absent = 0;
    let late = 0;

    list.forEach((item: any) => {
      if (item.status === "present") present++;
      else if (item.status === "late") {
        late++;
        present++;
      } else if (item.status === "absent") {
        absent++;
      }
    });

    const total = list.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 100;

    return { total, present, absent, late, rate, list };
  };

  const getStudentRecitations = () => {
    if (!parentResult || !Array.isArray(parentResult.recitations)) return [];
    return parentResult.recitations;
  };

  const getStudentExams = () => {
    if (!parentResult || !Array.isArray(parentResult.exams)) return [];
    return parentResult.exams;
  };

  const getStudentPayments = () => {
    if (!parentResult || !Array.isArray(parentResult.payments)) return [];
    return parentResult.payments;
  };

  const getFinancialStatus = () => {
    if (!searchedStudent) return { totalPaid: 0, outstandingMonths: [] };
    const payments = getStudentPayments();
    const group = getStudentGroup();
    const activeFee = searchedStudent.customFee !== undefined ? searchedStudent.customFee : (group?.monthlyFee || 0);

    const paidMonths = new Set(payments.map((p: any) => p.month));
    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);

    // Calculate months the student should have paid since joinDate
    const joinDateStr = searchedStudent.joinDate || "2026-01-01";
    const outstandingMonths: string[] = [];

    try {
      const joinDate = new Date(joinDateStr);
      const currentDate = new Date();
      let iterDate = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);

      while (iterDate <= currentDate) {
        const yyyymm = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, "0")}`;
        if (!paidMonths.has(yyyymm)) {
          outstandingMonths.push(yyyymm);
        }
        iterDate.setMonth(iterDate.getMonth() + 1);
      }
    } catch (e) {
      console.error(e);
    }

    return { totalPaid, outstandingMonths, activeFee };
  };

  const scoreFeedback = (percentageReady: number) => {
    if (percentageReady >= 95) return { label: "ممتاز وباهر 🌟", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400" };
    if (percentageReady >= 85) return { label: "جيد جداً ومتميز 👏", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400" };
    if (percentageReady >= 70) return { label: "أداء جيد، شد حيلك 👍", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400" };
    return { label: "يحتاج لمراجعة واهتمام ⚠️", color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400" };
  };

  const formatArabicMonthName = (yyyymm: string) => {
    const parts = yyyymm.split("-");
    if (parts.length !== 2) return yyyymm;
    const monthIndex = parseInt(parts[1], 10);
    const monthsArabic = [
      "يناير (1)", "فبراير (2)", "مارس (3)", "أبريل (4)", "مايو (5)", "يونيو (6)",
      "يوليو (7)", "أغسطس (8)", "سبتمبر (9)", "أكتوبر (10)", "نوفمبر (11)", "ديسمبر (12)"
    ];
    return `${monthsArabic[monthIndex - 1]} ${parts[0]}`;
  };

  // Compute stats if student loaded
  const group = getStudentGroup();
  const attStats = getStudentAttendanceStatistics();
  const recitations = getStudentRecitations();
  const exams = getStudentExams();
  const payments = getStudentPayments();
  const financial = getFinancialStatus();

  // Average calculations
  const avgRecitation = recitations.length > 0 
    ? Math.round((recitations.reduce((sum: number, r: any) => sum + (r.score / r.maxScore), 0) / recitations.length) * 100)
    : 100;

  const avgExam = exams.length > 0
    ? Math.round((exams.reduce((sum: number, e: any) => sum + (e.score / e.maxScore), 0) / exams.length) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100 pb-12 font-cairo" dir="rtl">
      
      {/* Wave Header */}
      <div className="bg-slate-900 text-white relative overflow-hidden py-10 px-4 md:px-8 shadow-xl border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/45 via-slate-900 to-slate-900 pointer-events-none opacity-80" />
        <div className="absolute top-10 left-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-20 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-4xl mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-right space-y-2 text-center md:text-right">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/15 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-full uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>منصة المتابعة المخصصة لمستقبل أبنائنا</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center md:justify-start gap-1.5 mt-2">
              <span>بوابة أولياء الأمور الذكية</span>
              <span className="text-blue-500 font-black">CenterFlow</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-305 font-medium max-w-lg mx-auto md:mx-0">
              تابع الحضور الفوري والغياب، درجات التسميع الشفوي، تقييم الامتحانات وسداد الاشتراكات الشهرية لحظة بلحظة وبكل سهولة.
            </p>
          </div>
          
          <div className="flex flex-col items-center bg-slate-950/40 backdrop-blur-md p-4 rounded-2xl border border-slate-800 max-w-sm w-full">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>دخول سريع فوري بدون كلمة مرور معقدة</span>
            </div>
            
            <div className="flex w-full gap-2 relative">
              <input 
                type="text" 
                placeholder="أدخل كود الطالب (مثال: ST-1002)" 
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                className="flex-1 px-3 sm:px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-xs text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-slate-500"
                id="parent_stud_code_input"
              />
              <button 
                onClick={() => handleLookup()}
                className="px-3 sm:px-5 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-blue-500/10 flex items-center justify-center gap-1 cursor-pointer shrink-0 min-h-[44px]"
                id="parent_submit_btn"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">عرض التقرير</span>
                <span className="inline sm:hidden">عرض</span>
              </button>
            </div>
            
            {errorMsg && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] text-rose-400 font-extrabold mt-2 text-center"
              >
                ⚠️ {errorMsg}
              </motion.p>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 mt-8">
        
        <AnimatePresence mode="wait">
          {!searchedStudent ? (
            // Empty State View
            <motion.div 
              key="empty-state"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-100/40 dark:shadow-none text-center space-y-5"
            >
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                <User className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">بانتظار إدخال كود الطالب الخاص بكم</h2>
                <p className="text-xs text-slate-400 dark:text-slate-400 leading-relaxed font-medium">
                  للحصول على تقارير تفصيلية فورية، يرجى كتابة الكود التعريفي للطالب في الخانة المخصصة بالأعلى ثم الضغط على زر <span className="text-blue-600 dark:text-blue-400 font-black">عرض التقرير</span>.
                </p>
              </div>

              {/* Quick instructions panel */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-right border-t border-slate-100 dark:border-slate-800/80">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                    <Activity className="w-4 h-4" />
                    <span>متابعة الحضور الفوري</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">تأكد التزام ابنك بالمواعيد المحددة ومواعيد حضوره للدروس أولاً بأول.</p>
                </div>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <Award className="w-4 h-4" />
                    <span>تقييمات التسميع والدرجات</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">عرض فوري لتقييم الحفظ والواجب المنزلي لكل حصة مع الملاحظات.</p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs">
                    <CreditCard className="w-4 h-4" />
                    <span>المدفوعات والاشتراكات</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">مراجعة تاريخ الأقساط الشهرية المدفوعة ومستحقات الشهور المتبقية بصورة مبسطة.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            // Student Report Loaded View
            <motion.div 
              key="student-loaded"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              {/* Student Hero Card */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-100/30 dark:shadow-none relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  {/* Avatar + Main Details */}
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-14 h-14 bg-blue-100 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold shadow-inner shrink-0 text-lg">
                      {searchedStudent.name ? searchedStudent.name.charAt(0) : "ط"}
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{searchedStudent.name}</span>
                        <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg border border-blue-500/10 font-black">
                          {searchedStudent.id}
                        </span>
                      </h2>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 font-semibold">
                        <span className="flex items-center gap-1 text-slate-550 dark:text-slate-300">
                          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                          <span>المجموعة: {group ? group.name : "غير محدد"}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>تاريخ الانضمام: {searchedStudent.joinDate}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Top Badge for Guardian Status */}
                  <div className="flex gap-2 shrink-0 self-start md:self-auto">
                    <div className="px-4 py-2.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-2xl text-center border border-emerald-500/10 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide leading-none">حالة الحساب</p>
                        <p className="text-2xs font-extrabold mt-0.5">تقارير نشطة وحية ✓</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* 1. Attendance Card */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">نسبة الحضور</p>
                    <p className="text-sm font-extrabold text-blue-600 dark:text-blue-400">{attStats.rate}%</p>
                    <p className="text-[8px] text-slate-400 dark:text-slate-400 mt-0.5">حضر {attStats.present} من أصل {attStats.total}</p>
                  </div>
                </div>

                {/* 2. Recitations Avg */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">مستوى التسميع</p>
                    <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{avgRecitation}%</p>
                    <p className="text-[8px] text-slate-400 dark:text-slate-400 mt-0.5">{recitations.length} تسميعات مسجلة</p>
                  </div>
                </div>

                {/* 3. Exams Avg */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">نتائج الاختبارات</p>
                    <p className="text-sm font-extrabold text-purple-600 dark:text-purple-400">{avgExam}%</p>
                    <p className="text-[8px] text-slate-400 dark:text-slate-400 mt-0.5">{exams.length} اختبارات مسجلة</p>
                  </div>
                </div>

                {/* 4. Payment Standing */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md flex items-center gap-3 col-span-2 md:col-span-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    financial.outstandingMonths.length === 0 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">الاشتراك الشهري</p>
                    <p className="text-xs font-black">
                      {financial.outstandingMonths.length === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">مسدد بالكامل 👍</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">{financial.outstandingMonths.length} شهور مستحقة</span>
                      )}
                    </p>
                    <p className="text-[8px] text-slate-400 dark:text-slate-400 mt-0.5">رسوم الشريحة {financial.activeFee} ج.م</p>
                  </div>
                </div>

              </div>

              {/* Interactive Tabs Menu */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-px snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button 
                  onClick={() => setActiveTab("overview")}
                  className={`px-3 sm:px-4 py-3 text-3xs sm:text-xs font-black border-b-2 transition shrink-0 cursor-pointer snap-center ${
                    activeTab === "overview" 
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-extrabold" 
                      : "border-transparent text-slate-450 hover:text-slate-600 dark:hover:text-slate-350"
                  }`}
                >
                  نظرة شمولية وملخص الأداء
                </button>
                <button 
                  onClick={() => setActiveTab("attendance")}
                  className={`px-3 sm:px-4 py-3 text-3xs sm:text-xs font-black border-b-2 transition shrink-0 cursor-pointer snap-center ${
                    activeTab === "attendance" 
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-extrabold" 
                      : "border-transparent text-slate-450 hover:text-slate-600 dark:hover:text-slate-350"
                  }`}
                >
                  دفتر المواظبة والحضور ({attStats.total})
                </button>
                <button 
                  onClick={() => setActiveTab("recitations")}
                  className={`px-3 sm:px-4 py-3 text-3xs sm:text-xs font-black border-b-2 transition shrink-0 cursor-pointer snap-center ${
                    activeTab === "recitations" 
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-extrabold" 
                      : "border-transparent text-slate-450 hover:text-slate-600 dark:hover:text-slate-350"
                  }`}
                >
                  سجل درجات التسميع ({recitations.length})
                </button>
                <button 
                  onClick={() => setActiveTab("exams")}
                  className={`px-3 sm:px-4 py-3 text-3xs sm:text-xs font-black border-b-2 transition shrink-0 cursor-pointer snap-center ${
                    activeTab === "exams" 
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-extrabold" 
                      : "border-transparent text-slate-450 hover:text-slate-600 dark:hover:text-slate-350"
                  }`}
                >
                  كشف التقييمات والاختبارات ({exams.length})
                </button>
                <button 
                  onClick={() => setActiveTab("payments")}
                  className={`px-3 sm:px-4 py-3 text-3xs sm:text-xs font-black border-b-2 transition shrink-0 cursor-pointer snap-center ${
                    activeTab === "payments" 
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-extrabold" 
                      : "border-transparent text-slate-450 hover:text-slate-600 dark:hover:text-slate-350"
                  }`}
                >
                  الاشتراكات الشهرية والفواتير
                </button>
              </div>

              {/* Tabs Content */}
              <div className="mt-2">
                
                {/* 1. OVERVIEW TAB */}
                {activeTab === "overview" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    {/* Right: Academic Recommendation */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md space-y-4">
                      <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <Activity className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                        <span>تقييم الأداء الحالي والتوجيهات</span>
                      </h3>

                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl space-y-1">
                          <p className="text-[10px] font-bold text-slate-400">التوصية الدراسية العامة:</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {avgRecitation >= 90 && avgExam >= 90 ? (
                              "ما شاء الله! الطالب يبدي تميزاً باهراً والتزاماً تاماً بالخطة التعليمية المقررة. نوصي بالاستمرار في تحفيزه ومتابعته للمحافظة على هذا المستوى المشرّف 🌟."
                            ) : avgRecitation >= 75 || avgExam >= 75 ? (
                              "أداء الطالب مستقر وجيد جداً، يحتاج فقط للمواظبة المستمرة وتكثيف المراجعة اليومية لتخطي العقبات الطفيفة والانتقال لخانة التميز المطلق 👍."
                            ) : (
                              "يحتاج الطالب لزيادة مستويات المتابعة المكثفة في المنزل والتحضير المسبق ومراجعة الواجبات بانتظام. نرجو التواصل مع إدارة المعلم لترتيب جلسة توجيه مخصصة لرفع مستواه ⚠️."
                            )}
                          </p>
                        </div>

                        {/* Quick Contact with Center */}
                        {searchedStudent.notes && (
                          <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 space-y-1">
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">ملاحظات هامة من معلم السنتر:</p>
                            <p className="text-xs text-slate-655 dark:text-slate-300 font-bold leading-relaxed">
                              {searchedStudent.notes}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-3 p-3 bg-blue-500/5 rounded-xl text-xs font-bold text-blue-800 dark:text-blue-300">
                          <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <div className="text-right">
                            <p className="text-[9px] text-slate-400">هاتف ولي الأمر للتأكيد:</p>
                            <p className="text-2xs font-extrabold mt-0.5">{searchedStudent.parentPhone || "غير مسجل"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Left: Latest Activity Brief */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md space-y-4">
                      <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <User className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                        <span>آخر 3 حركات ومتابعات مسجلة</span>
                      </h3>

                      <div className="space-y-3">
                        {/* Attendance latest brief */}
                        {attStats.list.length > 0 && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/60">
                            <div className="flex items-center gap-2">
                              <span className="p-1 px-1.8 bg-blue-500/10 text-blue-600 rounded text-[9px] font-bold">حصة</span>
                              <p className="text-xs font-extrabold">مواظبة آخر حصة تابعة للمجموعة</p>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                              attStats.list[0].status === "present"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : attStats.list[0].status === "late"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            }`}>
                              {attStats.list[0].status === "present" && "حاضر ✓"}
                              {attStats.list[0].status === "late" && "متأخر 🕒"}
                              {attStats.list[0].status === "absent" && "غائب ✖"}
                            </span>
                          </div>
                        )}

                        {/* Recitations latest brief */}
                        {recitations.length > 0 && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/60">
                            <div className="flex items-center gap-2">
                              <span className="p-1 px-1.8 bg-emerald-500/10 text-emerald-600 rounded text-[9px] font-bold">تسميع</span>
                              <p className="text-xs font-extrabold max-w-[170px] truncate">{recitations[0].title}</p>
                            </div>
                            <span className="text-xs font-bold text-slate-650 dark:text-slate-300">
                              {recitations[0].score} / {recitations[0].maxScore}
                            </span>
                          </div>
                        )}

                        {/* Exams latest brief */}
                        {exams.length > 0 && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/60">
                            <div className="flex items-center gap-2">
                              <span className="p-1 px-1.8 bg-purple-500/10 text-purple-600 rounded text-[9px] font-bold">اختبار</span>
                              <p className="text-xs font-extrabold max-w-[170px] truncate">{exams[0].title}</p>
                            </div>
                            <span className="text-xs font-bold text-slate-650 dark:text-slate-300">
                              {exams[0].score} / {exams[0].maxScore}
                            </span>
                          </div>
                        )}

                        {recitations.length === 0 && exams.length === 0 && attStats.list.length === 0 && (
                          <p className="text-2xs text-slate-400 text-center py-6">لا يوجد تقارير دورية مسجلة بعد لهذا الطالب.</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 2. ATTENDANCE TAB */}
                {activeTab === "attendance" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">سجل الانضباط التراكمي للطالب</h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">رصد فوري لحضور الحصص والغياب والتأخير بناءً على تحضير المساعدين.</p>
                      </div>

                      <div className="flex gap-2 text-3xs font-extrabold">
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">حاضر: {attStats.present - attStats.late}</span>
                        <span className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">متأخر: {attStats.late}</span>
                        <span className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">غائب: {attStats.absent}</span>
                      </div>
                    </div>

                    {attStats.list.length === 0 ? (
                      <p className="text-xs font-bold text-slate-400 text-center py-8">لم يتم رصد أو تسجيل حصص حضور لهذا السجل بعد.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
                        {attStats.list.map((att: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-450 shrink-0" />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{att.date}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {att.status === "present" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-xl border border-emerald-200/40">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>حاضر وملتزم</span>
                                </span>
                              )}
                              {att.status === "late" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-xl border border-amber-200/40">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>حاضر (متأخر)</span>
                                </span>
                              )}
                              {att.status === "absent" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 dark:text-rose-405 bg-rose-50 dark:bg-rose-950/20 px-2.5 py-1 rounded-xl border border-rose-200/40">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span> غائب بعذر/بدون</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 3. RECITATIONS TAB */}
                {activeTab === "recitations" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md space-y-4"
                  >
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">سجل تقييم الحفظ والتسميع الشفوي</h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">درجات التسميع اليومية مع التقييمات اللفظية والتقدير العام.</p>
                    </div>

                    {recitations.length === 0 ? (
                      <p className="text-xs font-bold text-slate-400 text-center py-8">لا يوجد سجلات تسميع مسجلة درجاتها للطالب لحسن الحظ.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recitations.map((rec: any, idx: number) => {
                          const percentage = Math.round((rec.score / rec.maxScore) * 100);
                          const fd = scoreFeedback(percentage);
                          return (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2 text-right">
                              <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-850 pb-1.5">
                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {rec.date}
                                </span>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${fd.color}`}>
                                  {fd.label}
                                </span>
                              </div>

                              <p className="text-xs font-extrabold text-slate-850 dark:text-slate-200">{rec.title}</p>
                              
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <p className="text-[8px] text-slate-400 block font-bold">الدرجة المحققة :</p>
                                  <p className="text-xs font-black text-slate-850 dark:text-white">
                                    {rec.score} <span className="text-slate-400 text-3xs font-medium">من {rec.maxScore}</span>
                                  </p>
                                </div>

                                <div className="text-left">
                                  <span className="text-xs font-black text-blue-600 dark:text-blue-400">{percentage}%</span>
                                  <div className="w-20 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${percentage}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 4. EXAMS TAB */}
                {activeTab === "exams" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md space-y-4"
                  >
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">سجل الامتحانات الشهرية والدورية</h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">درجات الاختبارات المنعقدة لقياس تقدم الطالب مع التفاصيل والتحليلات.</p>
                    </div>

                    {exams.length === 0 ? (
                      <p className="text-xs font-bold text-slate-400 text-center py-8">لا توجد نتائج امتحانات منشورة أو مسجلة للطالب.</p>
                    ) : (
                      <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[500px] overflow-y-auto pr-1">
                        {exams.map((ex: any, idx: number) => {
                          const percentage = Math.round((ex.score / ex.maxScore) * 100);
                          const fd = scoreFeedback(percentage);
                          return (
                            <div key={idx} className="pt-4 first:pt-0 space-y-2 text-right">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                <div className="space-y-0.5">
                                  <h4 className="text-xs font-black text-slate-850 dark:text-slate-100 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-purple-500" />
                                    <span>{ex.title}</span>
                                  </h4>
                                  {ex.description && (
                                    <p className="text-[10px] text-slate-400 font-bold max-w-sm">{ex.description}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg ${fd.color}`}>
                                    {fd.label}
                                  </span>
                                  <span className="text-[10px] text-slate-450 flex items-center gap-1 font-bold">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {ex.date}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/30">
                                <div>
                                  <span className="text-3xs text-slate-400 font-bold uppercase block mb-1">نسبة النجاح والتحقيق:</span>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                                      <div className="bg-purple-600 h-full rounded-full" style={{ width: `${percentage}%` }} />
                                    </div>
                                    <span className="text-xs font-black text-purple-600 dark:text-purple-400">{percentage}%</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-1.5 text-left">
                                  <span className="text-[10px] text-slate-500 font-bold">الدرجة المحققة :</span>
                                  <span className="text-2xs font-extrabold text-slate-900 dark:text-white">
                                    <strong className="text-sm font-black text-purple-600 dark:text-purple-400">{ex.score}</strong>
                                    <span className="text-slate-500 font-bold"> / {ex.maxScore} درجات</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 5. PAYMENTS TAB */}
                {activeTab === "payments" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                  >
                    {/* Left: Outstanding and Financial standing overview */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md space-y-4 md:col-span-1 text-right">
                      <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <CreditCard className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                        <span>كشف الحساب التراكمي</span>
                      </h3>

                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                          <p className="text-[10px] font-bold text-slate-500">منظومة الرسوم للشريحة:</p>
                          <p className="text-sm font-black text-slate-850 dark:text-white mt-1">
                            {financial.activeFee} ج.م <span className="text-[10px] font-medium text-slate-500">شهرياً</span>
                          </p>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                          <p className="text-[10px] font-bold text-slate-500">إجمالي المدفوعات المسجلة:</p>
                          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
                            {financial.totalPaid} ج.م <span className="text-[10px] font-medium text-slate-500">مسدد</span>
                          </p>
                        </div>

                        <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 text-right space-y-1">
                          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">الشهور المستحقة السداد:</p>
                          {financial.outstandingMonths.length === 0 ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold mt-1">جميع الدفعات مسددة بانتظام، شكراً لكم! 👍</p>
                          ) : (
                            <div className="flex flex-col gap-1 mt-1">
                              {financial.outstandingMonths.map((m, idx) => (
                                <span key={idx} className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-lg font-black border border-amber-500/10 w-fit">
                                  {formatArabicMonthName(m)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Payments Receipts Logs */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-md space-y-4 md:col-span-2 text-right">
                      <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <FileText className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                        <span>سندات القبض ومحفوظات الدفع الإلكتروني</span>
                      </h3>

                      {payments.length === 0 ? (
                        <p className="text-xs font-bold text-slate-450 text-center py-10">لم يتم تسجيل أي مستند دفع مالي بعد لهذا الكود.</p>
                      ) : (
                        <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
                          {payments.map((pay: any, idx: number) => (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800/40 space-y-3">
                              {/* Card Header: Type + Invoice code */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-150 dark:border-slate-800/80 pb-2">
                                <span className="inline-block text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.8 rounded-xl font-bold">
                                  تم دفع اشتراك: {formatArabicMonthName(pay.month)}
                                </span>
                                <span className="text-3xs font-black text-slate-400 dark:text-slate-500 tracking-wider">
                                  سند إلكتروني #{(pay.id || "").substring(0, 5)}
                                </span>
                              </div>
                              
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between pt-1">
                                  <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                                    القيمة المسددة: <strong className="text-emerald-600 text-sm font-extrabold">{pay.amount} ج.م</strong>
                                  </p>

                                  <div className="text-left space-y-0.5">
                                    <span className="text-[9px] text-slate-400 block font-bold">تاريخ الرصد:</span>
                                    <span className="text-3xs font-extrabold text-slate-655">{pay.date}</span>
                                  </div>
                                </div>

                                {pay.notes && (
                                  <div className="text-[10px] bg-slate-200/50 dark:bg-slate-800 px-2 py-1.5 rounded-lg text-slate-500 mt-2 font-bold leading-relaxed border-r-2 border-blue-500">
                                    ملاحظات السند: {pay.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

              </div>
              
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
