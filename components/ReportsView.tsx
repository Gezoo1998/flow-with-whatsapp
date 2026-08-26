"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { downloadStudentPDFReport, downloadAbsenteesPDFReport } from "@/lib/pdfHelper";
import { fillWhatsAppTemplate } from "@/lib/whatsappTemplateHelper";
import { 
  FileText, MessageSquare, Check, AlertCircle, X, 
  TrendingUp, Coins, Users, Calendar, Award, 
  AlertTriangle, CheckCircle2, UserX, Frown, Smile, 
  Search, HelpCircle, Send, FileDown, Eye, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";

export default function ReportsView() {
  const state = useAppStore((s) => s);

  // Security guard check
  const isAdmin = state.currentUserRole === "teacher";
  const isSecretary = state.currentUserRole === "secretary";
  const hasAccess = isAdmin || isSecretary;

  // Navigation tab for reports dashboard
  const [activeSubTab, setActiveSubTab] = useState<"individual" | "financial" | "attendance" | "academic">("individual");
  const currentSubTab = isSecretary ? "individual" : activeSubTab;

  // Date selection for general statistics & auditing
  const [targetDate, setTargetDate] = useState(() => {
    // Format YYYY-MM-DD
    return new Date().toISOString().split("T")[0];
  });

  // SUCCESS / ERROR notifications
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ==========================================
  // TAB 1 STATES (INDIVIDUAL REPORTS - ORIGINAL FLOW PRESERVED)
  // ==========================================
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const currentGroupId = selectedGroupId || state.groups[0]?.id || "";

  const [selectedStudentId, setSelectedStudentId] = useState("all");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportContent, setReportContent] = useState<"all" | "exams" | "recitations">("all");
  const [autoDownloadPDF, setAutoDownloadPDF] = useState(true);

  // Smart WhatsApp Template states
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("tpl_followup");
  const [customMessageText, setCustomMessageText] = useState("");

  const activeStudent = state.students.find(s => s.id === selectedStudentId);

  // ==========================================
  // TAB 2 STATES (FINANCIALS)
  // ==========================================
  const [financialGroupId, setFinancialGroupId] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // e.g. "2026-06"
  });

  // ==========================================
  // TAB 3 STATES (ATTENDANCE)
  // ==========================================
  const [attendanceGroupId, setAttendanceGroupId] = useState("all");
  const [absentThreshold, setAbsentThreshold] = useState(3);

  // ==========================================
  // TAB 4 STATES (ACADEMIC)
  // ==========================================
  const [academicGroupId, setAcademicGroupId] = useState("all");
  const [academicReportSubtype, setAcademicReportSubtype] = useState<"honor_exams" | "honor_recs" | "weakness" | "missed_exams">("honor_exams");

  // If neither teacher nor secretary, block render completely
  if (!hasAccess) {
    return (
      <div className="p-6 text-center space-y-4 font-sans select-none" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-500 mx-auto flex items-center justify-center border border-red-100 dark:border-red-900/30">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">بوابة التقارير مشفرة ومؤمنة</h2>
        <p className="text-3xs text-slate-500 max-w-xs mx-auto leading-relaxed">
          عذراً، تقع صلاحية الدخول واستخراج التقارير على المعلم والسكرتارية فقط لتطابق حساب ريادة الأعمال والسرية.
        </p>
      </div>
    );
  }

  // ==========================================
  // KPI CALCULATIONS (Cumulative totals)
  // ==========================================
  const activeStudentsCount = state.students.filter(s => s.status === "active").length;
  
  // Selected daily payments
  const selectedDatePmts = state.payments.filter(p => p.date && p.date.startsWith(targetDate));
  const selectedDatePmtsSum = selectedDatePmts.reduce((sum, p) => sum + p.amount, 0);

  // Monthly collected
  const currentMonthPrefix = targetDate.substring(0, 7); // YYYY-MM
  const monthlyPmts = state.payments.filter(p => p.date && p.date.startsWith(currentMonthPrefix));
  const monthlyCollectedSum = monthlyPmts.reduce((sum, p) => sum + p.amount, 0);

  // General Attendance registered today
  const attendanceToday = state.attendance.filter(a => a.date === targetDate);
  const presentTodayCount = attendanceToday.reduce((acc, curr) => acc + (curr.presentStudentIds?.length || 0), 0);
  const absentTodayCount = attendanceToday.reduce((acc, curr) => acc + (curr.absentStudentIds?.length || 0), 0);

  // ==========================================
  // TAB 1 LOGIC (ORIGINAL WHATSAPP / PDF BUILDER)
  // ==========================================
  const getFilledMessageText = (templateId: string, currentReportContent = reportContent) => {
    if (!activeStudent) return "";
    const activeTemplate = (state.whatsappTemplates || []).find(t => t.id === templateId) || (state.whatsappTemplates || [])[0];
    if (!activeTemplate) return "";

    // Calculate statistics based on current report date selectors
    const present = state.attendance
      .filter(a => a && a.groupId === activeStudent.groupId && a.date >= startDate && a.date <= endDate)
      .filter(a => a.presentStudentIds?.includes(activeStudent.id)).length;

    const absent = state.attendance
      .filter(a => a && a.groupId === activeStudent.groupId && a.date >= startDate && a.date <= endDate)
      .filter(a => a.absentStudentIds?.includes(activeStudent.id)).length;

    const total = present + absent;
    const rate = total > 0 ? Math.round((present / total) * 100) : 100;

    const stExams = currentReportContent !== "recitations"
      ? state.exams.filter(ex => ex.scores?.[activeStudent.id] !== undefined && ex.date >= startDate && ex.date <= endDate)
      : [];
    const stRecs = currentReportContent !== "exams"
      ? state.recitations.filter(r => r.scores?.[activeStudent.id] !== undefined && r.date >= startDate && r.date <= endDate)
      : [];

    const examScoresPart = stExams.map(ex => `- امتحان ${ex.title}: (${ex.scores?.[activeStudent.id]} من ${ex.maxScore})`).join("\n");
    const recitationScoresPart = stRecs.map(rec => `- تسميع ${rec.title}: (${rec.scores?.[activeStudent.id]} من ${rec.maxScore})`).join("\n");
    const scoresStr = [examScoresPart, recitationScoresPart].filter(Boolean).join("\n");

    let filledText = fillWhatsAppTemplate(activeTemplate.text, activeStudent, state.groups.find(g => g.id === activeStudent.groupId), state.subject, {
      present,
      absent,
      attendanceRate: rate,
      scoresStr
    });

    // Add selected range details
    filledText += `\n\n📅 الفترة الزمنية للتقرير: من ${startDate} إلى ${endDate}`;
    if (currentReportContent === "exams") {
      filledText += `\n📝 تصنيف التقرير: تقرير درجات الاختبارات فقط`;
    } else if (currentReportContent === "recitations") {
      filledText += `\n🗣️ تصنيف التقرير: تقرير الأداء والتسميع الشفوي فقط`;
    } else {
      filledText += `\n📋 تصنيف التقرير: التقرير التحصيلي الشامل`;
    }

    return filledText;
  };

  // Filter students for chosen group (Tab 1)
  const groupStudents = state.students.filter(
    st => st.status === "active" && (currentGroupId === "all" || st.groupId === currentGroupId)
  );

  const handleDownloadPDF = async (overrideStudent?: any, isSilent = false) => {
    if (!isSilent) {
      setErrorMsg("");
      setSuccessMsg("");
    }

    const targetStudentId = overrideStudent?.id || selectedStudentId;

    if (targetStudentId === "all") {
      setErrorMsg("الرجاء اختيار طالب معين لاستخراج وطباعة تقرير الـ PDF الفردي المخصص!");
      return;
    }

    const student = overrideStudent || state.students.find(s => s.id === targetStudentId);
    if (!student) return;

    const group = state.groups.find(g => g.id === student.groupId);
    
    // Calculate stats in date range
    const grAtts = state.attendance.filter(a => a && a.groupId === student.groupId && a.date >= startDate && a.date <= endDate);
    const present = grAtts.filter(a => a.presentStudentIds?.includes(student.id)).length;
    const absent = grAtts.filter(a => a.absentStudentIds?.includes(student.id)).length;
    const totalSessions = present + absent;
    const attendanceRate = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 100;

    // Filter exams & recitations within date range according to reportContent
    const stExams = reportContent !== "recitations"
      ? state.exams.filter(ex => ex.scores?.[student.id] !== undefined && ex.date >= startDate && ex.date <= endDate)
      : [];
    const stRecs = reportContent !== "exams"
      ? state.recitations.filter(r => r.scores?.[student.id] !== undefined && r.date >= startDate && r.date <= endDate)
      : [];
    const studentNotes = state.studentNotes.filter(n => n.studentId === student.id && n.date >= startDate && n.date <= endDate);

    try {
      await downloadStudentPDFReport(
        student,
        group,
        attendanceRate,
        present,
        absent,
        totalSessions,
        attendanceRate >= 90 ? "ممتاز 🌟" : attendanceRate >= 75 ? "جيد جداً 👍" : "مقبول متوسط",
        stExams,
        stRecs,
        studentNotes,
        state.subject,
        state.academicYear,
        reportContent
      );
      if (!isSilent) {
        setSuccessMsg("تم توليد وتحميل ملف PDF التقرير بنجاح!");
        setTimeout(() => setSuccessMsg(""), 2000);
      }
    } catch (err: any) {
      if (!isSilent) {
        setErrorMsg("فشل توليد التقرير: " + err.message);
      } else {
        console.error("Error auto-downloading PDF report for WhatsApp:", err);
      }
    }
  };

  const handleSendWhatsApp = () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (selectedStudentId === "all") {
      setErrorMsg("الرجاء تحديد طالب معين لتوجيه تقريره عبر تطبيق واتساب!");
      return;
    }

    const student = state.students.find(s => s.id === selectedStudentId);
    if (!student) return;

    if (!student.parentPhone) {
      setErrorMsg("عذراً! هاتف ولي أمر الطالب غير مسجل بقاعدة البيانات حالياً!");
      return;
    }

    setSelectedTemplateId("tpl_followup");
    setCustomMessageText(getFilledMessageText("tpl_followup"));
    setIsWhatsAppModalOpen(true);
  };

  const executeSendWhatsApp = async () => {
    const student = state.students.find(s => s.id === selectedStudentId);
    if (!student || !student.parentPhone) return;

    if (autoDownloadPDF) {
      await handleDownloadPDF(student, true);
    }

    const cleanPhone = student.parentPhone.replace(/[\s+-]/g, "");
    const formattedPhone = cleanPhone.startsWith("0") ? `2${cleanPhone}` : cleanPhone;
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(customMessageText)}`;
    window.open(url, "_blank");
    setIsWhatsAppModalOpen(false);
    setSuccessMsg("تم تحضير التقرير، وجاري نقلك للواتساب لإعداده وإرساله!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  // ==========================================
  // TAB 2 LOGIC & CALCULATIONS (FINANCIALS)
  // ==========================================
  const activeGroupStudents = state.students.filter(
    s => s.status === "active" && (financialGroupId === "all" || s.groupId === financialGroupId)
  );

  const paidStudentIdsInMonth = state.payments
    .filter(p => p.month === selectedMonth)
    .map(p => p.studentId);

  const unpaidStudents = activeGroupStudents.filter(s => !paidStudentIdsInMonth.includes(s.id));
  const paidStudents = activeGroupStudents.filter(s => paidStudentIdsInMonth.includes(s.id));

  // Trigger Excel download for Unpaid students list
  const handleExportUnpaidExcel = () => {
    try {
      const headers = ["كود الطالب", "اسم الطالب", "المجموعة", "رقم هاتف الطالب", "رقم هاتف ولي الأمر", "الاشتراك المخصص", "ملاحظات"];
      const rows = unpaidStudents.map(s => [
        s.id,
        s.name,
        state.groups.find(g => g.id === s.groupId)?.name || "غير محدد",
        s.phone || "",
        s.parentPhone || "",
        s.customFee || 0,
        s.notes || ""
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "المتأخرين");
      XLSX.writeFile(wb, `كشف_المتأخرين_دفع_شهر_${selectedMonth}.xlsx`);
      setSuccessMsg("تم تصدير كشف المتأخرين عن السداد لملف Excel بنجاح!");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (e) {
      setErrorMsg("فشل تصدير الكشف لمستند Excel!");
    }
  };

  // Trigger quick WhatsApp reminder for unpaid fee
  const handleSendUnpaidReminder = (student: any) => {
    if (!student.parentPhone) {
      setErrorMsg("رقم هاتف ولي الأمر غير مسجل للطالب!");
      return;
    }
    const billingGroup = state.groups.find(g => g.id === student.groupId);
    const subjectLabel = state.subject === "mathematics" ? "الرياضيات 📐" : "المقرر الدراسي";
    const groupLabel = billingGroup ? billingGroup.name : "المجموعات";
    
    // Quick, respectful, customized message in Arabic
    const message = `تنبيه من كشوف المركز السحابية 🔔\n\nنود إفادتكم بضرورة تسوية اشتراك شهر (${selectedMonth}) للطلاب بفرع (${subjectLabel}).\nاسم الطالب: *${student.name}*\nقيد ومجموعة: *${groupLabel}*\nالاشتراك المستحق: *${student.customFee || 0} ج.م*\n\nيرجى سداد المبلغ المستحق مع السكرتارية في أقرب وقت تفادياً لتأخر رصد الكارنيهات والبيانات. شكراً لتفاهمكم ومتابعتكم الدائمة لنا! 🌸`;

    const cleanPhone = student.parentPhone.replace(/[\s+-]/g, "");
    const formattedPhone = cleanPhone.startsWith("0") ? `2${cleanPhone}` : cleanPhone;
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  // ==========================================
  // TAB 3 LOGIC & CALCULATIONS (ATTENDANCE)
  // ==========================================
  const targetDateAbsentStudents = state.students.filter(
    s => s.status === "active" && 
    (attendanceGroupId === "all" || s.groupId === attendanceGroupId) &&
    state.attendance.find(a => a.date === targetDate && a.groupId === s.groupId)?.absentStudentIds.includes(s.id)
  );

  const studentsAbsenceHistory = state.students
    .filter(s => s.status === "active" && (attendanceGroupId === "all" || s.groupId === attendanceGroupId))
    .map(st => {
      const absences = state.attendance.filter(a => a.absentStudentIds?.includes(st.id)).length;
      const totalSessions = state.attendance.filter(a => a.presentStudentIds?.includes(st.id) || a.absentStudentIds?.includes(st.id)).length;
      const rate = totalSessions > 0 ? Math.round(((totalSessions - absences) / totalSessions) * 100) : 100;
      return {
        student: st,
        absences,
        attendanceRate: rate,
        totalSessions
      };
    })
    .filter(item => item.absences >= absentThreshold)
    .sort((a, b) => b.absences - a.absences);

  const handleExportAbsenteesExcel = () => {
    try {
      const headers = ["كود الطالب", "اسم الطالب", "المجموعة", "رقم الهاتف", "رقم ولي الأمر", "عدد مرات الغياب الإجمالي", "نسبة المواظبة"];
      const rows = studentsAbsenceHistory.map(item => [
        item.student.id,
        item.student.name,
        state.groups.find(g => g.id === item.student.groupId)?.name || "",
        item.student.phone || "",
        item.student.parentPhone || "",
        item.absences,
        `${item.attendanceRate}%`
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "إنذارات الغياب");
      XLSX.writeFile(wb, `إنذارات_الغياب_المتكرر_أكبر_من_${absentThreshold}.xlsx`);
      setSuccessMsg("تم تصدير كشف إنذارات الغياب المتراكم لملف Excel!");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (e) {
      setErrorMsg("حدث خطأ أثناء التصدير لمستند Excel!");
    }
  };

  const handleExportAbsenteesTodayPDF = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (targetDateAbsentStudents.length === 0) {
      setErrorMsg("لا يوجد طلاب غائبين في التاريخ واليوم المختار لتوليد كشف PDF!");
      return;
    }
    
    try {
      const absenteesList = targetDateAbsentStudents.map(student => ({
        name: student.name,
        groupName: state.groups.find(g => g.id === student.groupId)?.name || "غير محدد",
        phone: student.phone || "غير مسجل",
        parentPhone: student.parentPhone || "غير مسجل"
      }));

      await downloadAbsenteesPDFReport(
        absenteesList,
        targetDate,
        state.subject,
        state.academicYear
      );

      setSuccessMsg("تم توليد وتحميل كشف غياب اليوم بصيغة PDF بنجاح! 🚨");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg("فشل توليد التقرير: " + err.message);
    }
  };

  // ==========================================
  // TAB 4 LOGIC & CALCULATIONS (ACADEMICS)
  // ==========================================
  const studentExamPerformance = state.students
    .filter(s => s.status === "active" && (academicGroupId === "all" || s.groupId === academicGroupId))
    .map(st => {
      const stExams = state.exams.filter(ex => 
        ex.scores[st.id] !== undefined
      );
      
      let totalScore = 0;
      let totalMax = 0;
      let takenCount = 0;
      // count examinations targeting st.groupId
      const examCount = state.exams.filter(ex => ex.targetGroupIds.includes("all") || ex.targetGroupIds.includes(st.groupId)).length;
      
      stExams.forEach(ex => {
        totalScore += ex.scores[st.id];
        totalMax += ex.maxScore;
        takenCount++;
      });

      const averagePct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
      const missedCount = Math.max(0, examCount - takenCount);

      return {
        student: st,
        averagePct,
        takenCount,
        missedCount,
        totalScore,
        totalMax
      };
    });

  const studentRecitationPerformance = state.students
    .filter(s => s.status === "active" && (academicGroupId === "all" || s.groupId === academicGroupId))
    .map(st => {
      const stRecs = state.recitations.filter(r => r.scores[st.id] !== undefined);
      
      let totalScore = 0;
      let totalMax = 0;
      let takenCount = 0;
      
      stRecs.forEach(r => {
        totalScore += r.scores[st.id];
        totalMax += r.maxScore;
        takenCount++;
      });

      const averagePct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

      return {
        student: st,
        averagePct,
        takenCount,
        totalScore,
        totalMax
      };
    });

  // Filter based on academicReportSubtype
  let academicList: any[] = [];
  if (academicReportSubtype === "honor_exams") {
    academicList = studentExamPerformance
      .filter(item => item.takenCount > 0 && item.averagePct >= 85)
      .sort((a,b) => b.averagePct - a.averagePct);
  } else if (academicReportSubtype === "honor_recs") {
    academicList = studentRecitationPerformance
      .filter(item => item.takenCount > 0 && item.averagePct >= 85)
      .sort((a,b) => b.averagePct - a.averagePct);
  } else if (academicReportSubtype === "weakness") {
    academicList = studentExamPerformance
      .filter(item => item.takenCount > 0 && item.averagePct < 60)
      .sort((a,b) => a.averagePct - b.averagePct);
  } else if (academicReportSubtype === "missed_exams") {
    academicList = studentExamPerformance
      .filter(item => item.missedCount > 0)
      .sort((a,b) => b.missedCount - a.missedCount);
  }

  const handleExportAcademicExcel = () => {
    try {
      const title = academicReportSubtype === "honor_exams" ? "المتفوقين بالامتحانات التحريرية" :
                    academicReportSubtype === "honor_recs" ? "المتفوقين بالتسميع الشفوي" :
                    academicReportSubtype === "weakness" ? "إنذارات ضعف التحصيل الدراسي" : "المتغيبين عن الامتحانات";

      const headers = ["كود الطالب", "اسم الطالب", "المجموعة", "النسبة المئوية الحاصل عليها", "الدرجات المرصودة"];
      const rows = academicList.map(item => [
        item.student.id,
        item.student.name,
        state.groups.find(g => g.id === item.student.groupId)?.name || "",
        `${item.averagePct}%`,
        `${item.totalScore} من ${item.totalMax}`
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "التقرير الأكاديمي");
      XLSX.writeFile(wb, `كشف_${title.replace(/\s+/g, "_")}.xlsx`);
      setSuccessMsg("تمت تصفية الكشف وتصديره لملف Excel بنجاح!");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (e) {
      setErrorMsg("حدث خطأ أثناء تصدير التقرير لمستند Excel!");
    }
  };

  return (
    <div className="space-y-6 font-sans" dir="rtl" id="reports_view">
      
      {/* Title greeting & Restricted marker */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-5 rounded-3xl text-right border border-blue-800/20 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-2 left-3 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/10 text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>{isAdmin ? "حساب الإدارة الرسمية" : "مكتب المتابعة والسكرتارية"}</span>
        </div>
        
        <h2 className="text-sm font-black flex items-center gap-2">
          <span>📊</span>
          <span>{isAdmin ? "منظومة التقارير والمدفوعات الأكاديمية (المدير)" : "بوابة استخراج تقارير ومتابعة الطلاب"}</span>
        </h2>
        <span className="text-[10px] text-slate-300 font-bold block mt-1">
          {isAdmin 
            ? `كشوف فورية ومتحصلات الخزانة لـ ${state.students.length} طالب مسجل` 
            : `توليد تقارير أداء الطلاب الفردية وإرسالها لأولياء الأمور`
          }
        </span>
      </div>

      {/* Success/Error Notify Alert */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white rounded-2xl border border-emerald-400/20 shadow-xl w-[90%] max-w-xs"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
              <Check className="w-4.5 h-4.5 font-bold" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-2xs font-extrabold text-white font-cairo">تقرير الخزانة</p>
              <p className="text-[10px] text-emerald-100 font-bold mt-0.5">{successMsg}</p>
            </div>
            <button onClick={() => setSuccessMsg("")} className="text-white hover:text-slate-100"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-rose-600 to-red-500 text-white rounded-2xl border border-red-400/20 shadow-xl w-[90%] max-w-xs"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
              <AlertCircle className="w-4.5 h-4.5 font-bold" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-2xs font-extrabold text-white font-cairo">تنبيه بالتقارير</p>
              <p className="text-[10px] text-rose-100 font-bold mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg("")} className="text-white hover:text-slate-100"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI ADMIN INDICATOR SLATE CARD */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-4.5 grid grid-cols-2 gap-3 shadow-3xs">
          
          {/* KPI: Target Date Pick & daily revenue */}
          <div className="col-span-2 flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200/50 dark:border-slate-800">
            <div className="flex flex-col text-right">
              <span className="text-slate-500 text-[10px] font-black leading-none">تاريخ المراجعة والفلترة للأرقام:</span>
              <span className="text-[9px] text-[#22c55e] font-extrabold mt-1">تعديل التاريخ لتصفير وتحميل كشوفه</span>
            </div>
            <input 
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl px-2.5 py-1.5 font-bold text-center text-slate-800 dark:text-slate-100 focus:outline-none font-mono text-center text-xs shadow-2xs"
            />
          </div>

          {/* 1. Today's Dues collected */}
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/70 text-right space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-[9px] font-bold block flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-emerald-500" />
              <span>متحصلات التاريخ المختار:</span>
            </span>
            <span className="text-[#22c55e] dark:text-[#22c55e] text-base font-black font-mono block leading-none">
              {selectedDatePmtsSum} ج.م
            </span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium block">
              لرصد {selectedDatePmts.length} فواتير آلياً
            </span>
          </div>

          {/* 2. Total active students */}
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/70 text-right space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-[9px] font-bold block flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span>الطلاب النشطين بالسنتر:</span>
            </span>
            <span className="text-blue-600 dark:text-blue-400 text-base font-black font-mono block leading-none">
              {activeStudentsCount}
            </span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium block">
              توزيع على {state.groups.length} مجموعات
            </span>
          </div>

          {/* 3. Monthly total collected */}
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/70 text-right space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-[9px] font-bold block flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-[#8b5cf6]" />
              <span>نقد الخزانة لشهر ({currentMonthPrefix}):</span>
            </span>
            <span className="text-[#8b5cf6] dark:text-[#a78bfa] text-xs font-black font-mono block">
              {monthlyCollectedSum} ج.م
            </span>
          </div>

          {/* 4. Active secretaries count or daily absent count */}
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/70 text-right space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-[9px] font-bold block flex items-center gap-1">
              <UserX className="w-3.5 h-3.5 text-rose-500" />
              <span>سجل غياب التاريخ المختار:</span>
            </span>
            <span className="text-rose-500 dark:text-rose-400 text-xs font-black font-mono block">
              {absentTodayCount} طالب غائب
            </span>
          </div>
        </div>
      )}

      {/* DASHBOARD TAB-CONTROLLER TRIGGER HEADS */}
      {isAdmin && (
        <div className="bg-slate-150 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-1 flex rounded-xl text-3xs font-black" id="reports_tab_switcher">
          <button
            onClick={() => setActiveSubTab("individual")}
            className={`flex-1 py-2 text-center rounded-lg transition-all duration-200 ${currentSubTab === "individual" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-extrabold" : "text-slate-600 dark:text-slate-400 hover:text-slate-800"}`}
          >
            👤 تقارير فردية
          </button>
          <button
            onClick={() => setActiveSubTab("financial")}
            className={`flex-1 py-2 text-center rounded-lg transition-all duration-200 ${currentSubTab === "financial" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-extrabold" : "text-slate-600 dark:text-slate-400 hover:text-slate-800"}`}
          >
            💰 كشف المتحصلات والذمم
          </button>
          <button
            onClick={() => setActiveSubTab("attendance")}
            className={`flex-1 py-2 text-center rounded-lg transition-all duration-200 ${currentSubTab === "attendance" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-extrabold" : "text-slate-600 dark:text-slate-400 hover:text-slate-800"}`}
          >
            🚨 إنذارات الغياب
          </button>
          <button
            onClick={() => setActiveSubTab("academic")}
            className={`flex-1 py-2 text-center rounded-lg transition-all duration-200 ${currentSubTab === "academic" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-extrabold" : "text-slate-600 dark:text-slate-400 hover:text-slate-800"}`}
          >
            🏆 أوائل وضعاف التحصيل
          </button>
        </div>
      )}

      {/* SUB-VIEW 1: INDIVIDUAL REPORTS FLOW (ORIGINAL FEATURE SAFE-KEEP) */}
      {currentSubTab === "individual" && (
        <div className="space-y-4 animate-fade-in" id="reports_tab_individual">
          <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
            <p className="text-[10px] text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
              💡 <strong>التقارير الفردية السحابية:</strong> يتيح هذا القسم تصوير درجات حضور وامتحانات طالب معين لفترة محددة باليوم، لتصديره كتقرير PDF رسمي للمنزل، أو توجيهه كتقرير نصي منسق فورياً عبر تطبيق WhatsApp.
            </p>
          </div>

          <div className="space-y-4 bg-white dark:bg-slate-900 p-5 border border-slate-150 dark:border-slate-800 rounded-3xl">
            {/* Field 1: Group */}
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block mb-1">1. المجموعة الدراسية وقيد الصف: *</label>
              <select 
                value={currentGroupId}
                onChange={(e) => {
                  setSelectedGroupId(e.target.value);
                  setSelectedStudentId("all");
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-bold text-xs focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                <option value="" className="dark:bg-slate-900">اختار صف ومجموعة...</option>
                {state.groups.map(g => (
                  <option key={g.id} value={g.id} className="dark:bg-slate-900">{g.name}</option>
                ))}
              </select>
            </div>
     
            {/* Field 2: Student */}
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block mb-1">2. تحديد اسم الطالب لاستخراج كشفه الفردي: *</label>
              <select 
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={!currentGroupId}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-bold text-xs focus:outline-none focus:bg-white dark:focus:bg-slate-900 disabled:opacity-50 text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">كل طلاب هذه المجموعة</option>
                {groupStudents.map(st => (
                  <option key={st.id} value={st.id} className="dark:bg-slate-900">{st.name}</option>
                ))}
              </select>
            </div>
     
            {/* Field 3: Date Range */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="text-slate-550 dark:text-slate-400 text-[10px] font-bold block mb-1">3. تاريخ البداية:</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-550 dark:text-slate-400 text-[10px] font-bold block mb-1">تاريخ النهاية:</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
    
            {/* Field 4: Report Content Type */}
            <div className="pt-1.5" id="report_content_field">
              <label className="text-slate-550 dark:text-slate-400 text-[10px] font-bold block mb-1">4. تصفية محتويات ومجال التقرير الصادر:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "all", label: "التقرير الشامل (الكل)" },
                  { id: "exams", label: "الامتحانات فقط 📝" },
                  { id: "recitations", label: "التسميع فقط 🗣️" }
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setReportContent(type.id as any);
                      if (isWhatsAppModalOpen) {
                        setCustomMessageText(getFilledMessageText(selectedTemplateId, type.id as any));
                      }
                    }}
                    className={`py-2 px-1 border rounded-xl text-[10px] font-black tracking-tight transition duration-150 cursor-pointer text-center ${
                      reportContent === type.id
                        ? "bg-blue-600 border-blue-600 text-white dark:text-white"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
    
          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3.5 pt-2">
            <button 
              onClick={() => handleDownloadPDF()}
              disabled={!currentGroupId || selectedStudentId === "all"}
              className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 border border-slate-200 dark:border-slate-800 transition rounded-2xl h-24 text-center cursor-pointer active:scale-95 shadow-2xs"
            >
              <FileDown className="w-6 h-6 text-blue-600 mb-1.5" />
              <span className="text-2xs font-extrabold text-slate-800 dark:text-slate-200">تحميل التقرير PDF</span>
            </button>
     
            <button 
              onClick={handleSendWhatsApp}
              disabled={!currentGroupId || selectedStudentId === "all"}
              className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 border border-slate-200 dark:border-slate-800 transition rounded-2xl h-24 text-center cursor-pointer active:scale-95 shadow-2xs"
            >
              <MessageSquare className="w-6 h-6 text-emerald-600 mb-1.5" />
              <span className="text-2xs font-extrabold text-slate-800 dark:text-slate-200">مراسلة واتساب</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: FINANCIAL STATISTICS & MONTHLY OUTSTANDING LIST */}
      {currentSubTab === "financial" && (
        <div className="space-y-4 animate-fade-in" id="reports_tab_financial">
          <div className="bg-amber-50/60 dark:bg-amber-950/20 p-3.5 border border-amber-150 dark:border-amber-900/40 rounded-2xl">
            <p className="text-[10px] text-amber-900 dark:text-amber-300 font-bold leading-relaxed">
              📉 <strong>مرحلة الرقابة وتدقيق الذمم:</strong> حدد المجموعة والشهر المقابل للرصد الصفي، وسيقوم النظام فوراً بحصر من قاموا بدفع كشوف الاشتراكات الشهرية وتصفية الطلاب المتأخرين لمتابعتهم فوراً.
            </p>
          </div>

          {/* Selector Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4.5 rounded-3xl space-y-3 shadow-3xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-[10px] font-black block mb-1">المجموعة المستهدفة:</label>
                <select 
                  value={financialGroupId}
                  onChange={(e) => setFinancialGroupId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-xs focus:outline-none focus:bg-white text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="all">كل المجموعات بـ CenterFlow</option>
                  {state.groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-500 dark:text-slate-400 text-[10px] font-black block mb-1">شهر الفوترة المطلوب:</label>
                <input 
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-bold text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Paid vs Unpaid Pie Stats preview */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/40 flex items-center justify-between text-2xs">
              <div className="text-center flex-1 border-l border-slate-200 dark:border-slate-800">
                <span className="text-slate-550 block font-bold">المجموعة المختارة:</span>
                <span className="text-xs font-black text-slate-850 dark:text-slate-200">
                  {financialGroupId === "all" ? "إجمالي السنتر" : (state.groups.find(g => g.id === financialGroupId)?.name || "")}
                </span>
              </div>
              <div className="text-center flex-1 border-l border-slate-200 dark:border-slate-805 dark:border-slate-800">
                <span className="text-emerald-600 block font-bold">☑️ قاموا بالدفع ({paidStudents.length}):</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-250">
                  {paidStudents.reduce((sum, s) => sum + (s.customFee || 0), 0)} ج.م محصل
                </span>
              </div>
              <div className="text-center flex-grow-2 px-1">
                <span className="text-red-500 block font-bold">⚠️ معلقين بالتأخير ({unpaidStudents.length}):</span>
                <span className="text-xs font-bold text-red-650 dark:text-red-400 font-mono">
                  {unpaidStudents.reduce((sum, s) => sum + (s.customFee || 0), 0)} ج.م متبقي
                </span>
              </div>
            </div>

            {/* Excel Download button for unpaid */}
            {unpaidStudents.length > 0 && (
              <button
                type="button"
                onClick={handleExportUnpaidExcel}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-2xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileDown className="w-4 h-4" />
                <span>تصدير كشف المتأخرين لمستند Excel (.xlsx)</span>
              </button>
            )}
          </div>

          {/* List of Unpaid Students */}
          <div className="space-y-2">
            <h4 className="text-2xs font-extrabold text-slate-850 dark:text-slate-200 pr-1 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>الطلاب المتأخرين عن الدفع لشهر ({selectedMonth}):</span>
            </h4>

            {unpaidStudents.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-6 text-center rounded-2xl">
                <Smile className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xs font-extrabold text-slate-800 dark:text-slate-200">الكل منتظم وخالٍ من المتأخرات! ⭐</p>
                <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold mt-0.5">تم دفع اشتراكات هذا الشهر لكل طلاب المجموعة بالمركز بالكامل.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {unpaidStudents.map(student => (
                  <div 
                    key={student.id}
                    className="flex justify-between items-center p-3.5 bg-gradient-to-r from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-950 border border-slate-150 dark:border-slate-800 rounded-2xl shadow-3xs border-r-4 border-r-rose-500 hover:shadow-2xs transition-all duration-150"
                  >
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100 block">{student.name}</span>
                      <span className="text-[9.5px] text-slate-450 dark:text-slate-450 font-bold block mt-1 font-sans">
                        المجموعة: {state.groups.find(g => g.id === student.groupId)?.name || "عامة"} | الهاتف: {student.phone || "لا يوجد"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 px-3 py-1 rounded-xl">
                        {student.customFee || 0} ج.م مستحق
                      </span>
                      <button
                        onClick={() => handleSendUnpaidReminder(student)}
                        className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/25 dark:hover:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-[9.5px] font-black flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-3xs"
                        title="أرسل تذكير دفع سريع عبر واتساب لولي الأمر"
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                        <span>تنبيه 📲</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* List of Payments Registered on targetDate */}
          <div className="space-y-2 pt-2">
            <h4 className="text-2xs font-extrabold text-slate-850 dark:text-slate-200 pr-1 flex items-center gap-1.5">
              <span>🧾</span>
              <span>متحصلات وإيرادات التاريخ المختار ({targetDate}):</span>
            </h4>

            {selectedDatePmts.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-5 text-center rounded-2xl text-slate-450 dark:text-slate-500 font-bold text-3xs">
                لا يتوفر مدفوعات مرصودة بالخزينة في التاريخ واليوم المحدد.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {selectedDatePmts.map(p => {
                  const student = state.students.find(s => s.id === p.studentId);
                  return (
                    <div key={p.id} className="p-3 bg-gradient-to-r from-white to-slate-50/30 dark:from-slate-900 dark:to-slate-950 border border-slate-150 dark:border-slate-800 rounded-2xl flex justify-between items-center border-r-4 border-r-emerald-500 shadow-3xs hover:shadow-2xs transition-all">
                      <div>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs block">{student ? student.name : "طالب غير معروف"}</span>
                        <span className="text-[9.5px] text-slate-450 dark:text-slate-400 block font-bold mt-1 leading-relaxed">
                          حساب شهر: {p.month} | المسجل: {p.recordedByName || p.recordedBy} | الوقت: {p.date.split(" ")[1] || ""}
                        </span>
                        {p.notes && <span className="text-[8.5px] text-amber-600 dark:text-amber-500 block font-bold mt-1">ملاحظات: {p.notes}</span>}
                      </div>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black font-mono text-2xs bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-3 py-1 rounded-xl shadow-3xs">
                        +{p.amount} ج.م
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: ATTENDANCE WARNINGS SHEET */}
      {currentSubTab === "attendance" && (
        <div className="space-y-4 animate-fade-in" id="reports_tab_attendance">
          <div className="bg-red-50/50 dark:bg-red-950/20 p-3.5 border border-red-100 dark:border-red-900/30 rounded-2xl">
            <p className="text-[10px] text-red-900 dark:text-red-350 font-bold leading-relaxed">
              🚨 <strong>منذرة الغياب والخصائص الانضباطية:</strong> تتبع وحمل قائمة هؤلاء الذين تغيبوا لعدد كبير من الحصص، أو طالع الغياب الكلي للتاريخ الحالي المختار.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4.5 rounded-3xl space-y-3.5 shadow-3xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-[10px] font-black block mb-1">المجموعة:</label>
                <select
                  value={attendanceGroupId}
                  onChange={(e) => setAttendanceGroupId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-bold text-xs focus:outline-none focus:bg-white text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="all">كل المجموعات</option>
                  {state.groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-505 dark:text-slate-400 text-[10px] font-black block mb-1">حدد حد الغياب الأدنى (مرات):</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    min="1"
                    max="15"
                    value={absentThreshold}
                    onChange={(e) => setAbsentThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-black text-xs focus:outline-none text-slate-800 dark:text-slate-100 text-center font-mono"
                  />
                  <span className="text-[10px] text-slate-400 font-bold shrink-0">حصص غياب وازدياد</span>
                </div>
              </div>
            </div>

            {/* Excel Download button for absentees */}
            {studentsAbsenceHistory.length > 0 && (
              <button
                type="button"
                onClick={handleExportAbsenteesExcel}
                className="w-full bg-red-600 hover:bg-red-750 text-white font-black text-2xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileDown className="w-4 h-4" />
                <span>تصدير كشف المنقطعين والإنذارات لـ Excel (.xlsx)</span>
              </button>
            )}
          </div>

          {/* List of Warning students */}
          <div className="space-y-2">
            <h4 className="text-2xs font-extrabold text-slate-850 dark:text-slate-200 pr-1 flex items-center gap-1.5">
              <span>🚨</span>
              <span>قائمة إنذارات الغياب المتكرر (مساوٍ أو أكبر من {absentThreshold} حصص):</span>
            </h4>

            {studentsAbsenceHistory.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 text-center rounded-2xl text-slate-450 dark:text-slate-500 font-bold text-3xs">
                لا يتوفر أي طالب تخطى حد الغياب المطلوب في المجموعة المحددة حالياً.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {studentsAbsenceHistory.map(item => (
                  <div 
                    key={item.student.id} 
                    className="p-3.5 bg-gradient-to-r from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-950 border border-slate-150 dark:border-slate-800 rounded-2xl flex justify-between items-center shadow-3xs border-r-4 border-r-rose-600 hover:shadow-2xs transition-all duration-150"
                  >
                    <div>
                      <span className="font-extrabold text-xs text-slate-850 dark:text-slate-100 block">{item.student.name}</span>
                      <span className="text-[9.5px] text-slate-400 dark:text-slate-505 font-bold block mt-1">
                        المجموعة: {state.groups.find(g => g.id === item.student.groupId)?.name} | الهاتف: {item.student.phone || "غير مسجل"}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-black text-rose-600 dark:text-rose-400 block font-mono text-left leading-none">
                          {item.absences} غيابات
                        </span>
                        <span className="text-[8.5px] text-slate-450 font-bold block mt-1.5">نسبة الحضور: {item.attendanceRate}%</span>
                      </div>
                      
                      <button
                        onClick={() => {
                          const wpMsg = `تنبيه غياب هام من المركز لولي أمر المتفوق 🚨\n\nنحيطكم علماً بأن الطالب: *${item.student.name}* قد كرر الغياب والتخلف عن الفصول بمعدل بلغ (*${item.absences} غيابات*) حتى تاريخ اليوم.\nنسبة الحضور الصفي الإجمالي: *${item.attendanceRate}%*.\n\nنهيب بكم ضرورة توجيه الطالب والاتصال بنا لتوضيح عذر الغياب تفادياً لفصله من السيستم. شكرًا لمتابعتكم!`;
                          if (!item.student.parentPhone) {
                            setErrorMsg("هاتف ولي الأمر غير مسجل!");
                            return;
                          }
                          const cleanPhone = item.student.parentPhone.replace(/[\s+-]/g, "");
                          const formattedPhone = cleanPhone.startsWith("0") ? `2${cleanPhone}` : cleanPhone;
                          window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(wpMsg)}`, "_blank");
                        }}
                        className="p-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-xl text-rose-600 dark:text-rose-400 cursor-pointer transition-all active:scale-90 border border-rose-100 dark:border-rose-900/40 shadow-3xs"
                        title="توجيه إنذار غياب فوري لولي الأمر عبر واتساب"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* List of Absentees today */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center pr-1">
              <h4 className="text-2xs font-extrabold text-slate-850 dark:text-slate-200 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>الغياب المرصود في التاريخ المختار ({targetDate}):</span>
              </h4>
              {targetDateAbsentStudents.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportAbsenteesTodayPDF}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] py-1.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs active:scale-95"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>تحميل كشف الغياب اليومي (PDF) 📄</span>
                </button>
              )}
            </div>

            {targetDateAbsentStudents.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-5 text-center rounded-2xl text-slate-450 dark:text-slate-500 font-bold text-3xs">
                لا يوجد غياب معلق في هذا التاريخ صدفة، أو لم يرصد المعلم كشف حصة اليوم غياب بحسابها بعد.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {targetDateAbsentStudents.map(student => (
                  <div 
                    key={student.id} 
                    className="p-3 bg-gradient-to-r from-white to-slate-50/20 dark:from-slate-900 dark:to-slate-950 border border-slate-150 dark:border-slate-800 rounded-2xl flex justify-between items-center border-r-4 border-r-orange-500 hover:shadow-2xs transition-all shadow-3xs"
                  >
                    <div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs block">{student.name}</span>
                      <span className="text-[9.5px] text-slate-450 block font-bold mt-1.5 leading-relaxed">
                        رقم هاتف ولي الأمر للتواصل: {student.parentPhone || "لا يوجد هاتف"} | المجموعة: {state.groups.find(g => g.id === student.groupId)?.name}
                      </span>
                    </div>
                    <span className="text-orange-600 dark:text-orange-400 font-black px-3 py-1 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl text-[9.5px]">
                      غائب اليوم 📌
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: ACADEMIC REPORTS (HONOR ROLL & UNDERPERFORMING ALERTS) */}
      {currentSubTab === "academic" && (
        <div className="space-y-4 animate-fade-in" id="reports_tab_academic">
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl">
            <p className="text-[10px] text-indigo-900 dark:text-indigo-300 font-bold leading-relaxed">
              🏆 <strong>التحليل الأكاديمي والمستويات:</strong> يفرز السيستم ويعرض المتفوقين في المركز لتعزيز ثقتهم ووضعهم على لوحة الشرف، كما يلخص هؤلاء القلقين دراسياً أو من تفوتهم الاختبارات بشكل مستمر.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-4.5 rounded-3xl space-y-3.5 shadow-3xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-505 dark:text-slate-400 text-[10px] font-black block mb-1">مجموعة تصفية الكشوف الأكاديمية:</label>
                <select
                  value={academicGroupId}
                  onChange={(e) => setAcademicGroupId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-bold text-xs focus:outline-none focus:bg-white text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="all">كل المجموعات</option>
                  {state.groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-505 dark:text-slate-400 text-[10px] font-black block mb-1 font-sans">تحديد فئة التصفية واللوحة:</label>
                <select
                  value={academicReportSubtype}
                  onChange={(e) => setAcademicReportSubtype(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-bold text-xs focus:outline-none focus:bg-white text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="honor_exams">🏆 لوحة شرف الامتحانات (تحريري &gt;= 85%)</option>
                  <option value="honor_recs">🗣️ الأوائل بالتسميع الشفوي (&gt;= 85%)</option>
                  <option value="weakness">⚠️ إنذار ضعف التحصيل الدراسي (&lt; 60%)</option>
                  <option value="missed_exams">🚫 الأكثر تفويتاً للامتحانات بالسنتر</option>
                </select>
              </div>
            </div>

            {academicList.length > 0 && (
              <button
                type="button"
                onClick={handleExportAcademicExcel}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-2xs py-2 px-4 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileDown className="w-4 h-4" />
                <span>تصدير هذا الكشف للمتفوقين أو الإنذار لـ Excel (.xlsx)</span>
              </button>
            )}
          </div>

          {/* Render Academic Lists */}
          <div className="space-y-2">
            <h4 className="text-2xs font-extrabold text-slate-850 dark:text-slate-200 pr-1 flex items-center gap-1.5">
              <span>{academicReportSubtype.startsWith("honor") ? "🏆" : "⚠️"}</span>
              <span>نتائج الفرز الصفي الحالية ({academicList.length} طالب مصنف):</span>
            </h4>

            {academicList.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 text-center rounded-2xl text-slate-450 text-3xs font-bold font-sans">
                لم نجد طلاب متطابقين مع الفلترة والتحليل المطلوب داخل هذه المجموعة المحددة حالياً.
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {academicList.map((item, idx) => {
                  const displayPct = item.averagePct !== undefined ? item.averagePct : 0;
                  const examsNum = item.takenCount;
                  
                  return (
                    <div 
                      key={item.student.id} 
                      className="p-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl flex justify-between items-center shadow-3xs"
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Position badge */}
                        <div className={`w-6 h-6 rounded-lg text-3xs font-black flex items-center justify-center shrink-0 ${
                          academicReportSubtype.startsWith("honor") 
                            ? "bg-amber-100 text-amber-700 border border-amber-350 dark:bg-amber-950/40 dark:text-amber-400" 
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                          #{idx + 1}
                        </div>
                        
                        <div>
                          <span className="font-extrabold text-xs text-slate-850 dark:text-slate-100 block">{item.student.name}</span>
                          <span className="text-[9.5px] text-slate-450 font-bold block mt-0.5">
                            مجموعته: {state.groups.find(g => g.id === item.student.groupId)?.name} | الهاتف: {item.student.phone || "لا يوجد"}
                          </span>
                        </div>
                      </div>

                      <div className="text-left flex items-center gap-2">
                        <div className="text-right">
                          {academicReportSubtype === "missed_exams" ? (
                            <span className="text-xs font-black text-rose-600 dark:text-rose-400 block font-mono">
                              فوت {item.missedCount} اختبارات
                            </span>
                          ) : (
                            <span className={`text-xs font-black block font-mono ${displayPct >= 85 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {displayPct}%
                            </span>
                          )}
                          <span className="text-[8.5px] text-slate-400 font-extrabold block mt-0.5">
                            {academicReportSubtype === "honor_recs" ? `${examsNum} تسميع شفوي` : `${examsNum} امتحانات مسجلة`}
                          </span>
                        </div>

                        {/* Direct WhatsApp Message with congratulations or warnings */}
                        <button
                          onClick={() => {
                            if (!item.student.parentPhone) {
                              setErrorMsg("لا يتوفر هاتف لولي الأمر!");
                              return;
                            }
                            const parentName = item.student.name;
                            const currentGroup = state.groups.find(g => g.id === item.student.groupId)?.name;
                            let msg = "";

                            if (academicReportSubtype === "honor_exams") {
                              msg = `تهنئة بالتميز والريادة الأكاديمية بالمركز 🏆🌟\n\nنود مسرتكم بإعلامكم بأن ابننا الطالب المتميز: *${parentName}* (قيد ${currentGroup}) قد حقق معدل تفوق باهر بلغ (*${displayPct}%*) في كشوف الامتحانات التحريرية المقررة لمادة (${state.subject === "mathematics" ? "الرياضيات" : "المقرر"}).\nنقدم له درع فخرنا الأكاديمي، متمنين له مواصلة التفوق وصدارة التقييمات القادمة! 🎉👏`;
                            } else if (academicReportSubtype === "honor_recs") {
                              msg = `تهنئة بالأداء التفاعلي المتميز والشفوي الشامل 🗣️✨\n\nيسعدنا إعلامكم بانتظام جودة أداء وجودة تسميع ابننا البطل: *${parentName}* بمعدل أداء شفوي تراكمي بلغ (*${displayPct}%*)، مما يعكس تحضيره المستمر واجتهاده الفائق.\nنهنئه على هذا الاجتهاد ونقدر له فخره الأكاديمي معنا! 🌟`;
                            } else {
                              msg = `تنبيه خاص بمتابعة المستوى العلمي والأكاديمي للطالب ⚠️📉\n\nنحيطكم علماً بأن الطالب: *${parentName}* بمجموعته الدراسية (${currentGroup}) قد حصل على معدل تحصيل ضعيف دون المستوى المقترح بلغ (*${displayPct}%*) في مجمل اختباراته التحريرية المقررة حتى الآن.\n\nنهيب بكم ضرورة متابعة مذاكرة الطالب بالمنزل والحل المنظم والواجبات لحماية الطالب من تكرر هبوط درجاته لاحقاً. شاكرين حسن عونكم وتعاونكم الدائم معنا!`;
                            }

                            const cleanPhone = item.student.parentPhone.replace(/[\s+-]/g, "");
                            const formattedPhone = cleanPhone.startsWith("0") ? `2${cleanPhone}` : cleanPhone;
                            window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg)}`, "_blank");
                          }}
                          className={`p-2 rounded-xl border transition active:scale-90 cursor-pointer ${
                            academicReportSubtype.startsWith("honor") 
                              ? "bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 border-amber-200 text-amber-600 dark:text-amber-400" 
                              : "bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 border-red-200 text-rose-600 dark:text-rose-450"
                          }`}
                          title="مراسلة فخر وتنبيه مباشر لولي الأمر"
                        >
                          <Send className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 1: SMART WHATSAPP GRAPHIC MODAL INTERACTIVE
          ========================================== */}
      <AnimatePresence>
        {isWhatsAppModalOpen && activeStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              onClick={() => setIsWhatsAppModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.90, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl relative border border-slate-150 dark:border-slate-850 w-full max-w-md flex flex-col z-10 max-h-[92vh]"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 flex justify-between items-center pr-5 pl-4">
                <div className="flex items-center gap-2 text-right">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-450 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 font-bold" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[11px] text-white">تقرير وتوجيه الواتساب للأولياء</h3>
                    <p className="text-[9px] text-slate-450 font-bold mt-0.5">مراسلة مخصصة لـ {activeStudent.name}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsWhatsAppModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer active:scale-95 transition">
                  <X className="w-5 h-5 font-bold" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4.5 overflow-y-auto space-y-3.5 text-right flex-1 select-none text-3xs">
                {/* Selector */}
                <div className="space-y-1.5">
                  <label className="text-slate-500 dark:text-slate-400 [font-size:9.5px] block font-bold">1️⃣ اختر قالب إرسال التقرير الصفي:</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(state.whatsappTemplates || []).map((tpl) => {
                      const isSelected = selectedTemplateId === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            setSelectedTemplateId(tpl.id);
                            setCustomMessageText(getFilledMessageText(tpl.id, reportContent));
                          }}
                          className={`w-full text-right p-2.5 rounded-xl border transition text-[10.5px] font-black flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-350 hover:bg-slate-100"
                          }`}
                        >
                          <span>{tpl.name}</span>
                          {isSelected && <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scope selection inside WhatsApp modal */}
                <div className="space-y-1.5">
                  <label className="text-slate-500 dark:text-slate-400 [font-size:9.5px] block font-bold">⚙️ تعديل نطاق محتوى الفلاتر بالتواريخ والامتحانات:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "all", label: "الكل" },
                      { id: "exams", label: "امتحانات فقط" },
                      { id: "recitations", label: "تسميع فقط" }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setReportContent(type.id as any);
                          setCustomMessageText(getFilledMessageText(selectedTemplateId, type.id as any));
                        }}
                        className={`py-1.5 px-2 border rounded-lg text-[9.5px] font-black transition duration-150 cursor-pointer text-center ${
                          reportContent === type.id
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-350 hover:bg-slate-100"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview text */}
                <div className="space-y-1.5">
                  <label className="text-slate-500 dark:text-slate-400 [font-size:9.5px] block font-bold">2️⃣ معاينة النص الصادر وتحريره يدوياً قبل الإرسال:</label>
                  <div className="relative bg-[#efeae2]/40 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-3 rounded-2xl">
                    <textarea
                      rows={6}
                      value={customMessageText}
                      onChange={(e) => setCustomMessageText(e.target.value)}
                      className="w-full text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 focus:bg-white p-3 rounded-xl border border-emerald-600/10 text-[10.5px] font-medium leading-relaxed shadow-inner placeholder-slate-450 focus:outline-none resize-none text-right"
                    />
                    <div className="mt-1 text-left text-[8.5px] text-[#8696a0] font-mono">
                      بفترة الفلترة الموالية: {startDate} ⇄ {endDate}
                    </div>
                  </div>
                </div>

                {/* PDF Auto download check optionally */}
                <div className="p-2.5 bg-blue-55/70 dark:bg-blue-950/20 border border-blue-150 dark:border-blue-900/40 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col text-right">
                    <span className="text-3xs font-black text-blue-900 dark:text-blue-300">تنزيل ملف تقرير PDF مع الإرسال:</span>
                    <span className="text-[8.5px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">تلقين وطباعة مستند PDF مخصص لتوجيهه رفقة الواتساب</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={autoDownloadPDF} 
                      onChange={(e) => setAutoDownloadPDF(e.target.checked)} 
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Modal Footer actions */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="px-3.5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-2xs select-none cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="button"
                  onClick={executeSendWhatsApp}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-2xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>بدء توجيه الواتساب وتنزيل التقرير الملحق 🚀</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
