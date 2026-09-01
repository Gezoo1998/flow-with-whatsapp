"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppStore, store } from "@/lib/store";
import { fillWhatsAppTemplate } from "@/lib/whatsappTemplateHelper";
import { 
  Send, CheckCircle2, XCircle, Clock, AlertTriangle, 
  HelpCircle, ShieldCheck, Sparkles, Filter, Users, 
  BookOpen, GraduationCap, Play, Square, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface StudentSendItem {
  studentId: string;
  studentName: string;
  groupName: string;
  parentPhone: string;
  actualPhone: string;
  scoreStr: string;
  rawScore: number | null;
  maxScore: number;
  messageText: string;
  status: "idle" | "sending" | "sent" | "failed";
  failReason?: string;
}

export default function WhatsAppAutomationView() {
  const state = useAppStore((s) => s);

  // Chrome Extension state detection
  const [isExtensionConnected, setIsExtensionConnected] = useState<boolean>(false);
  const [showExtensionHelp, setShowExtensionHelp] = useState<boolean>(false);

  // Safe In-Memory Test Mode
  const [isTestModeActive, setIsTestModeActive] = useState<boolean>(false);

  // Filter State
  const [reportType, setReportType] = useState<"recitation" | "exam">("recitation");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");

  // Sending Batch State
  const [isSending, setIsSending] = useState<boolean>(false);
  const [currentBatchId, setCurrentBatchId] = useState<string>("");
  const [sendQueue, setSendQueue] = useState<StudentSendItem[]>([]);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [pauseNoticeMsg, setPauseNoticeMsg] = useState<string>("");

  // Auto-detect Chrome Extension handshake via window message
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      const { type, studentId, success, reason, batchId, message } = event.data;

      if (type === "CENTERFLOW_EXTENSION_PONG") {
        setIsExtensionConnected(true);
      } else if (type === "WHATSAPP_ITEM_SENT_SUCCESS") {
        setSendQueue((prev) =>
          prev.map((item) =>
            item.studentId === studentId ? { ...item, status: "sent" } : item
          )
        );
        setCompletedCount((c) => c + 1);
      } else if (type === "WHATSAPP_ITEM_FAILED") {
        setSendQueue((prev) =>
          prev.map((item) =>
            item.studentId === studentId
              ? { ...item, status: "failed", failReason: reason || "فشل الإرسال" }
              : item
          )
        );
        setFailedCount((f) => f + 1);
      } else if (type === "WHATSAPP_ITEM_SENDING") {
        setPauseNoticeMsg("");
        setSendQueue((prev) =>
          prev.map((item) =>
            item.studentId === studentId ? { ...item, status: "sending" } : item
          )
        );
      } else if (type === "WHATSAPP_BATCH_PAUSED") {
        setPauseNoticeMsg(message || "فترة استراحة آمنة لمدة دقيقة واحدة...");
      } else if (type === "WHATSAPP_BATCH_COMPLETE" || type === "WHATSAPP_BATCH_STOPPED") {
        setIsSending(false);
        setPauseNoticeMsg("");
        setSendQueue((prev) =>
          prev.map((item) => (item.status === "sending" ? { ...item, status: "idle" } : item))
        );
        store.logActivity(
          "أتمتة الواتساب",
          type === "WHATSAPP_BATCH_STOPPED"
            ? `تم إيقاف دفعة إرسال الواتساب مؤقتاً`
            : `اكتملت دفعة إرسال نتائج الواتساب (دفعة ${batchId || ""})`
        );
      }
    };

    window.addEventListener("message", handleWindowMessage);

    // Initial ping to extension
    window.postMessage({ type: "CENTERFLOW_CHECK_EXTENSION" }, "*");
    const pingInterval = setInterval(() => {
      window.postMessage({ type: "CENTERFLOW_CHECK_EXTENSION" }, "*");
    }, 3000);

    return () => {
      window.removeEventListener("message", handleWindowMessage);
      clearInterval(pingInterval);
    };
  }, []);

  // Filter available Assessments based on Report Type & Selected Group
  const availableAssessments = useMemo(() => {
    if (reportType === "recitation") {
      return (state.recitations || []).filter((r) => {
        if (selectedGroupId === "all") return true;
        return r.groupId === selectedGroupId;
      });
    } else {
      return (state.exams || []).filter((e) => {
        if (selectedGroupId === "all") return true;
        return Array.isArray(e.targetGroupIds) && e.targetGroupIds.includes(selectedGroupId);
      });
    }
  }, [reportType, selectedGroupId, state.recitations, state.exams]);

  // Set default selected assessment when list updates
  useEffect(() => {
    if (availableAssessments.length > 0) {
      if (!availableAssessments.some((a) => a.id === selectedAssessmentId)) {
        setSelectedAssessmentId(availableAssessments[0].id);
      }
    } else {
      setSelectedAssessmentId("");
    }
  }, [availableAssessments, selectedAssessmentId]);

  // Active WhatsApp Template
  const activeTemplate = useMemo(() => {
    return (
      (state.whatsappTemplates || [])[0]?.text ||
      "مرحبا بولي أمر الطالب: *[اسم_الطالب]* 🌸\nنرسل لحضراتكم تقرير متابعة مادة *[المادة]* تحت إشراف أستاذ/ *[اسم_المعلم]*\nلمجموعة *[المجموعة]*:\n\n📌 الحضور والمواظبة:\n- نسبة الالتزام: [الحالة]\n- حضر: [حضر] حصة | غاب: [غاب] حصة\n\n📊 آخر نتائج التقييم والامتحانات:\n[الدرجة]\n\nنشكر حسن تعاونكم للمصلحة الدراسية لولدنا. ❤️"
    );
  }, [state.whatsappTemplates]);

  // Active Selected Assessment Object
  const selectedAssessmentObj = useMemo(() => {
    if (!selectedAssessmentId) return null;
    if (reportType === "recitation") {
      return (state.recitations || []).find((r) => r.id === selectedAssessmentId) || null;
    } else {
      return (state.exams || []).find((e) => e.id === selectedAssessmentId) || null;
    }
  }, [reportType, selectedAssessmentId, state.recitations, state.exams]);

  // Calculate target student list & apply STRICT EXCLUSION for missing grades or zero score
  const { eligibleItems, excludedCount } = useMemo(() => {
    if (!selectedAssessmentObj) {
      return { eligibleItems: [], excludedCount: 0 };
    }

    const assessment = selectedAssessmentObj;
    const scores = assessment.scores || {};
    const maxScore = assessment.maxScore || 100;

    // Filter students belonging to target group
    const groupStudents = (state.students || []).filter((s) => {
      if (s.status === "archived") return false;
      if (selectedGroupId === "all") {
        if (reportType === "recitation") {
          return s.groupId === (assessment as any).groupId || true;
        } else {
          const targetGroups = (assessment as any).targetGroupIds || [];
          return targetGroups.length === 0 || targetGroups.includes(s.groupId);
        }
      }
      return s.groupId === selectedGroupId;
    });

    const eligible: StudentSendItem[] = [];
    let excluded = 0;

    groupStudents.forEach((student) => {
      const score = scores[student.id];
      const numScore = Number(score);

      const hasSecScore = (assessment as any).hasSecondScore;
      const score2 = (assessment as any).scores2?.[student.id];
      const maxScore2 = (assessment as any).maxScore2 || 10;
      const numScore2 = Number(score2);

      const hasValid1 = score !== undefined && score !== null && !isNaN(numScore) && numScore > 0;
      const hasValid2 = hasSecScore && score2 !== undefined && score2 !== null && !isNaN(numScore2) && numScore2 > 0;

      // STRICT RULE: If neither grade is valid (> 0), EXCLUDE automatically!
      if (!hasValid1 && !hasValid2) {
        excluded++;
        return;
      }

      let scoreStr = "";
      if (hasSecScore) {
        if (hasValid1 && hasValid2) {
          scoreStr = `${assessment.title}\n- الدرجة الأولى: ${score} / ${maxScore}\n- الدرجة الثانية: ${score2} / ${maxScore2}`;
        } else if (hasValid1) {
          scoreStr = `${assessment.title}\n- الدرجة الأولى: ${score} / ${maxScore}`;
        } else if (hasValid2) {
          scoreStr = `${assessment.title}\n- الدرجة الثانية: ${score2} / ${maxScore2}`;
        }
      } else {
        scoreStr = `${assessment.title}\n- الدرجة: ${score} / ${maxScore}`;
      }

      // Calculate real cumulative attendance stats up to current time
      let totalPresent = 0;
      let totalAbsent = 0;

      (state.attendance || []).forEach((att) => {
        if (att.groupId === student.groupId || selectedGroupId === "all") {
          if (att.presentStudentIds?.includes(student.id)) {
            totalPresent++;
          } else if (att.absentStudentIds?.includes(student.id)) {
            totalAbsent++;
          }
        }
      });

      const totalSessions = totalPresent + totalAbsent;
      const attendanceRate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 100;
      const grp = (state.groups || []).find((g) => g.id === student.groupId);

      const formattedText = fillWhatsAppTemplate(
        activeTemplate,
        student,
        grp,
        state.subject || "mathematics",
        {
          present: totalPresent,
          absent: totalAbsent,
          attendanceRate: attendanceRate,
          scoresStr: scoreStr
        },
        state.teacherName
      );

      const actualPhone = student.parentPhone || student.phone || "";
      const parentPhone = isTestModeActive ? "01022372501" : actualPhone;

      eligible.push({
        studentId: student.id,
        studentName: student.name,
        groupName: grp ? grp.name : "غير محدد",
        parentPhone,
        actualPhone,
        scoreStr,
        rawScore: score,
        maxScore,
        messageText: formattedText,
        status: "idle"
      });
    });

    return { eligibleItems: eligible, excludedCount: excluded };
  }, [selectedAssessmentObj, selectedGroupId, state.students, state.groups, state.subject, activeTemplate, isTestModeActive, reportType]);

  // Sync queue when eligible items change and not sending
  useEffect(() => {
    if (!isSending) {
      setSendQueue(eligibleItems);
      setCompletedCount(0);
      setFailedCount(0);
    }
  }, [eligibleItems, isSending]);

  // Handle Start Batch
  const handleStartSending = () => {
    if (sendQueue.length === 0) {
      alert("لا يوجد طلاب مستهدفين للإرسال!");
      return;
    }

    const batchId = Date.now().toString();
    setCurrentBatchId(batchId);
    setIsSending(true);
    setCompletedCount(0);
    setFailedCount(0);

    const payload = {
      batchId,
      items: sendQueue.map((item) => ({
        studentId: item.studentId,
        studentName: item.studentName,
        phone: item.parentPhone,
        messageText: item.messageText
      }))
    };

    window.postMessage(
      {
        type: "START_WHATSAPP_BATCH",
        payload
      },
      "*"
    );
  };

  // Handle Stop Batch
  const handleStopSending = () => {
    window.postMessage({ type: "STOP_WHATSAPP_BATCH" }, "*");
    setIsSending(false);
    setSendQueue((prev) =>
      prev.map((item) => (item.status === "sending" ? { ...item, status: "idle" } : item))
    );
  };

  const totalCount = sendQueue.length;
  const progressPercent = totalCount > 0 ? Math.round(((completedCount + failedCount) / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-12 font-sans" dir="rtl">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-extrabold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> أتمتة الواتساب التلقائي (v3.0)
              </span>
              {/* Extension Status Badge */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 transition-all ${
                  isExtensionConnected
                    ? "bg-emerald-400/30 text-emerald-100 border border-emerald-300/40"
                    : "bg-amber-400/30 text-amber-100 border border-amber-300/40"
                }`}
              >
                {isExtensionConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> إضافة Chrome متصلة وجاهزة 🧩✅
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-300 animate-pulse" /> لم يتم اكتشاف إضافة الكروم ⚠️
                  </>
                )}
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">محرك أتمتة رسائل الواتساب مجاناً 🚀</h2>
            <p className="text-xs text-white/80 max-w-xl">
              إرسال تقارير التسميع والدرجات تلقائياً لأولياء الأمور عبر إضافة الكروم المخصصة دون أي تكاليف أو سيرفرات مدفوعة.
            </p>
          </div>

          <button
            onClick={() => setShowExtensionHelp(!showExtensionHelp)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 transition backdrop-blur-md border border-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <HelpCircle className="w-4 h-4 text-emerald-300" />
            {showExtensionHelp ? "إخفاء التعليمات" : "دليل تثبيت الإضافة"}
          </button>
        </div>
      </div>

      {/* Extension Setup Guide Collapsible */}
      <AnimatePresence>
        {showExtensionHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-3xl p-5 space-y-3 text-slate-800 dark:text-amber-200 text-xs"
          >
            <div className="flex items-center gap-2 font-black text-amber-900 dark:text-amber-300 text-sm">
              <ShieldCheck className="w-5 h-5 text-amber-600" /> طريقة تثبيت إضافة الكروم (مرة واحدة فقط):
            </div>
            <ol className="list-decimal list-inside space-y-1.5 font-bold leading-relaxed pr-2">
              <li>افتح صفحة الإضافات بالمتصفح: <code className="bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded font-mono text-amber-900 dark:text-amber-200">chrome://extensions/</code></li>
              <li>قم بتفعيل <strong>«وضع المطور Developer Mode»</strong> في الأعلى.</li>
              <li>اضغط على <strong>«تحميل إضافة غير محزومة Load Unpacked»</strong> في اليسار.</li>
              <li>اختر مجلد <code className="bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded font-mono text-amber-900 dark:text-amber-200">chrome-extension</code> من جذر هذا المشروع.</li>
              <li>افتح موقع <code className="bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded font-mono text-amber-900 dark:text-amber-200">web.whatsapp.com</code> في تبويب بالمتصفح، وستصبح الإضافة جاهزة فوراً!</li>
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safe In-Memory Test Mode Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              🧪 وضع التجربة الآمن 100% (In-Memory Safe Test Mode)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              توجيه كل الرسائل مؤقتاً في ذاكرة الشاشة لـ <code className="font-bold font-mono">01022372501</code> للتحقق بدون التعديل على قاعدة البيانات الأصلية.
            </p>
          </div>

          {!isTestModeActive ? (
            <button
              onClick={() => setIsTestModeActive(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 transition text-white text-xs font-black rounded-xl cursor-pointer shadow-xs flex items-center justify-center gap-2 select-none"
            >
              🧪 تفعيل رقم التجربة 01022372501
            </button>
          ) : (
            <button
              onClick={() => setIsTestModeActive(false)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 transition text-white text-xs font-black rounded-xl cursor-pointer shadow-xs flex items-center justify-center gap-2 select-none"
            >
              🔴 إيقاف وضع التجربة (استعادة الأرقام الحقيقية)
            </button>
          )}
        </div>

        {isTestModeActive && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-300 text-xs font-extrabold animate-pulse">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              ⚠️ وضع التجربة مفعّل: جميع الرسائل موجهة مؤقتاً للرقم <strong>01022372501</strong> لجميع الطلاب. تظل أرقام أولياء الأمور الأصلية صالحة ومحمية في قاعدة البيانات!
            </span>
          </div>
        )}
      </div>

      {/* Filter and Selection Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
          <Filter className="w-4 h-4 text-blue-600" /> تصفية وتحديد التقرير والدرجة المستهدفة
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Report Type */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400">1. نوع التقرير</label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                onClick={() => setReportType("recitation")}
                className={`py-2 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  reportType === "recitation"
                    ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> تسميع / كويز
              </button>
              <button
                onClick={() => setReportType("exam")}
                className={`py-2 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  reportType === "exam"
                    ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" /> امتحان رئيسي
              </button>
            </div>
          </div>

          {/* 2. Target Group */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400">2. المجموعة المستهدفة</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع المجموعات الدراسية</option>
              {(state.groups || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Selected Assessment */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400">
              3. {reportType === "recitation" ? "التسميع/الكويز المحدد" : "الامتحان المحدد"}
            </label>
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              disabled={availableAssessments.length === 0}
              className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {availableAssessments.length === 0 ? (
                <option value="">لا توجد تقييمات مسجلة لهذه المجموعة</option>
              ) : (
                availableAssessments.map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.date}) - النهاية العظمى: {item.maxScore}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Exclusion Stats & Info */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
            <Users className="w-4 h-4 text-blue-500" />
            <span>الطلاب الجاهزين للإرسال: <strong className="text-blue-600 dark:text-blue-400 font-extrabold text-sm">{sendQueue.length}</strong> طالب</span>
          </div>

          {excludedCount > 0 && (
            <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 self-start sm:self-auto">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> تم استبعاد {excludedCount} طالب تلقائياً لعدم وجود درجة مسجلة له ⚠️
            </span>
          )}
        </div>
      </div>

      {/* Sending Controls & Real-Time Progress Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" /> التحكم بالطابور والإرسال التلقائي
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              يتم التنقل بمعدل 12 ثانية بين الرسائل، وتوقف آمن لمدة دقيقة واحدة تلقائياً بعد كل 10 رسائل لضمان حماية الرقم.
            </p>
          </div>

          {!isSending ? (
            <button
              onClick={handleStartSending}
              disabled={sendQueue.length === 0}
              className="py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition text-white text-xs font-black rounded-2xl shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 select-none"
            >
              <Play className="w-4 h-4 fill-white" /> بدء الإرسال الآلي بواسطة إضافة Chrome 🚀
            </button>
          ) : (
            <button
              onClick={handleStopSending}
              className="py-3 px-6 bg-rose-600 hover:bg-rose-700 active:scale-95 transition text-white text-xs font-black rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2 select-none"
            >
              <Square className="w-4 h-4 fill-white" /> إيقاف الإرسال الآلي مؤقتاً
            </button>
          )}
        </div>

        {/* 1-Minute Safety Pause Notice Banner */}
        {pauseNoticeMsg && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center gap-2 text-xs font-extrabold text-blue-800 dark:text-blue-200 animate-pulse" dir="rtl">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{pauseNoticeMsg}</span>
          </div>
        )}

        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-extrabold text-slate-700 dark:text-slate-300">
              <span>نسبة الإكتمال: {progressPercent}%</span>
              <span>المكتمل: {completedCount} | الفاشل: {failedCount} | الإجمالي: {totalCount}</span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Target Students Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" /> كشف الطلاب المستهدفين وقناة الإرسال
          </h3>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
            عدد الصفوف: {sendQueue.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">اسم الطالب</th>
                <th className="py-3 px-4">المجموعة</th>
                <th className="py-3 px-4">رقم ولي الأمر (الموجه له)</th>
                <th className="py-3 px-4">الدرجة المسجلة</th>
                <th className="py-3 px-4 text-center">حالة الإرسال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
              {sendQueue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs font-bold">
                    لا يوجد طلاب ينطبق عليهم شرط الإرسال حالياً. قم باختيار التقييم أو استكمال رصد الدرجات أولاً.
                  </td>
                </tr>
              ) : (
                sendQueue.map((item, idx) => (
                  <tr key={item.studentId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-3 px-4 text-slate-900 dark:text-white font-extrabold">{item.studentName}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{item.groupName}</td>
                    <td className="py-3 px-4 font-mono dir-ltr text-right text-slate-700 dark:text-slate-300">
                      {item.parentPhone}
                      {isTestModeActive && item.actualPhone && (
                        <span className="text-[9px] text-slate-400 block dir-rtl"> الأكلي: {item.actualPhone}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-blue-600 dark:text-blue-400 font-mono">{item.scoreStr}</td>
                    <td className="py-3 px-4 text-center">
                      {item.status === "idle" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px]">
                          <Clock className="w-3 h-3" /> في الانتظار
                        </span>
                      )}
                      {item.status === "sending" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" /> جاري الإرسال...
                        </span>
                      )}
                      {item.status === "sent" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> تم الإرسال ✅
                        </span>
                      )}
                      {item.status === "failed" && (
                        <span
                          title={item.failReason}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-lg text-[10px]"
                        >
                          <XCircle className="w-3 h-3" /> فشل / تخطي ❌
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
