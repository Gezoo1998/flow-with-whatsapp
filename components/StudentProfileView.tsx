"use client";

import { useState, useEffect } from "react";
import { useAppStore, store, Student, Group, hasFullAccess } from "@/lib/store";
import { downloadStudentPDFReport } from "@/lib/pdfHelper";
import { fillWhatsAppTemplate } from "@/lib/whatsappTemplateHelper";
import { 
  ArrowRight, Phone, MapPin, Calendar, CreditCard, Award, 
  BookOpen, FileText, CheckCircle2, XCircle, AlertCircle, PlusCircle,
  MessageSquare, Trash, Edit, Archive, Download, RefreshCw, X, Printer
} from "lucide-react";
import { generateCode128PortraitSVG, printStudentBarcodeLabel } from "@/lib/barcodeHelper";
import { printStudentBarcodeLabelLandscape } from "@/lib/barcodeHelperLandscape";
import { printStudentBarcodeLabelDynamic } from "@/lib/barcodeHelperDynamic";
import { downloadBarcodePNG, printBarcodeImage } from "@/lib/barcodeImageHelper";
import { downloadStudentBarcodePDF, printStudentBarcodePDF } from "@/lib/barcodeHelperPDF";
import { downloadStudentBarcodeCompact, printStudentBarcodeCompact, downloadMultipleBarcodeZip, CompactVariant } from "@/lib/barcodeHelperCompact";
import { BarcodeDiagnostics } from "@/components/BarcodeDiagnostics";
import { motion, AnimatePresence } from "motion/react";

interface StudentProfileProps {
  studentId?: string;
  onNavigate: (view: string, extraParams?: Record<string, string>) => void;
}

export default function StudentProfileView({ studentId, onNavigate }: StudentProfileProps) {
  const state = useAppStore((s) => s);
  
  // Tab selector state
  const [activeTab, setActiveTab] = useState<"data" | "attendance" | "payments" | "exams" | "recitations" | "notes">("data");
  const [compactVariant, setCompactVariant] = useState<CompactVariant>('COMPACT');
  
  // Simple form states for adding inline note or payment quickly
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteType, setNewNoteType] = useState<"academic" | "behavior" | "private">("academic");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  
  // Brief payment form states
  const [payMonth, setPayMonth] = useState(new Date().toISOString().substring(0, 7));
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const [studentEditModal, setStudentEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editParentPhone, setEditParentPhone] = useState("");
  const [editGroupId, setEditGroupId] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCustomFee, setEditCustomFee] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showNoPermissionAlert, setShowNoPermissionAlert] = useState(false);
  const [validationError, setValidationError] = useState("");

  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("tpl_followup");
  const [customMessageText, setCustomMessageText] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportContent, setReportContent] = useState<"all" | "exams" | "recitations">("all");
  const [autoDownloadPDF, setAutoDownloadPDF] = useState(true);

  // Locate resources
  const student = state.students.find((s) => s.id === studentId);

  // Attendance details for student
  const groupAttendanceRecords = student ? state.attendance.filter(a => a.groupId === student.groupId).sort((a,b) => b.date.localeCompare(a.date)) : [];
  const group = student ? state.groups.find((g) => g.id === student.groupId) : undefined;

  // Filter logs
  const studentPayments = student ? state.payments.filter((p) => p.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const studentNotes = student ? state.studentNotes.filter((n) => n.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const studentExams = student ? state.exams.filter((ex) => ex.scores[student.id] !== undefined).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const studentRecitations = student ? state.recitations.filter((rec) => rec.scores[student.id] !== undefined).sort((a, b) => b.date.localeCompare(a.date)) : [];

  const getFilledMessageText = (
    templateId: string,
    currentReportContent = reportContent,
    currentStartDate = startDate,
    currentEndDate = endDate
  ) => {
    if (!student) return "";
    const activeTemplate = (state.whatsappTemplates || []).find(t => t.id === templateId) || (state.whatsappTemplates || [])[0];
    if (!activeTemplate) return "";

    const present = groupAttendanceRecords.filter(a => a && a.presentStudentIds?.includes(student.id) && a.date >= currentStartDate && a.date <= currentEndDate).length;
    const absent = groupAttendanceRecords.filter(a => a && a.absentStudentIds?.includes(student.id) && a.date >= currentStartDate && a.date <= currentEndDate).length;
    const total = present + absent;
    const rate = total > 0 ? Math.round((present / total) * 100) : 100;

    const stExams = currentReportContent !== "recitations"
      ? studentExams.filter(ex => ex.date >= currentStartDate && ex.date <= currentEndDate)
      : [];
    const stRecs = currentReportContent !== "exams"
      ? studentRecitations.filter(rec => rec.date >= currentStartDate && rec.date <= currentEndDate)
      : [];

    const examScoresPart = stExams.slice(0, 5).map(ex => `- امتحان ${ex.title}: (${ex.scores?.[student.id]} من ${ex.maxScore})`).join("\n");
    const recitationScoresPart = stRecs.slice(0, 5).map(rec => `- تسميع ${rec.title}: (${rec.scores?.[student.id]} من ${rec.maxScore})`).join("\n");
    const scoresStr = [examScoresPart, recitationScoresPart].filter(Boolean).join("\n");

    let filledText = fillWhatsAppTemplate(activeTemplate.text, student, group, state.subject, {
      present,
      absent,
      attendanceRate: rate,
      scoresStr
    });

    // Add selected range details
    filledText += `\n\n📅 الفترة الزمنية للتقرير: من ${currentStartDate} إلى ${currentEndDate}`;
    if (currentReportContent === "exams") {
      filledText += `\n📝 تصنيف التقرير: تقرير درجات الاختبارات فقط`;
    } else if (currentReportContent === "recitations") {
      filledText += `\n🗣️ تصنيف التقرير: تقرير الأداء والتسميع الشفوي فقط`;
    } else {
      filledText += `\n📋 تصنيف التقرير: التقرير التحصيلي الشامل`;
    }

    return filledText;
  };

  if (!student) {
    return (
      <div className="text-center py-12 space-y-4" dir="rtl">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="font-extrabold text-sm text-slate-800">بيانات الطالب غير متوفرة</h3>
        <button 
          onClick={() => onNavigate("students")}
          className="px-4 py-2 bg-blue-600 font-extrabold text-xs text-white rounded-xl"
        >
          الرجوع للطلاب
        </button>
      </div>
    );
  }

  const handleEditStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editPhone.trim() || !editParentPhone.trim()) {
      setValidationError("الرجاء ملء الحقول الإجبارية");
      return;
    }
    setValidationError("");
    store.updateStudent(student.id, {
      name: editName.trim(),
      phone: editPhone.trim(),
      parentPhone: editParentPhone.trim(),
      groupId: editGroupId,
      address: editAddress.trim() || undefined,
      customFee: editCustomFee ? Number(editCustomFee) : undefined,
      notes: editNotes.trim(),
    });
    setStudentEditModal(false);
  };

  const openEditModal = () => {
    setValidationError("");
    setEditName(student.name);
    setEditPhone(student.phone);
    setEditParentPhone(student.parentPhone);
    setEditGroupId(student.groupId);
    setEditAddress(student.address || "");
    setEditCustomFee(student.customFee ? student.customFee.toString() : "");
    setEditNotes(student.notes || "");
    setStudentEditModal(true);
  };

  const handleDeleteStudent = () => {
    if (!hasFullAccess(state)) {
      setShowNoPermissionAlert(true);
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteStudent = () => {
    store.deleteStudent(student.id);
    setShowDeleteConfirm(false);
    onNavigate("students");
  };

  const handleToggleArchive = () => {
    if (student.status === "archived") {
      store.unarchiveStudent(student.id);
    } else {
      setShowArchiveConfirm(true);
    }
  };

  const handleConfirmArchiveStudent = () => {
    store.archiveStudent(student.id);
    setShowArchiveConfirm(false);
  };

  const printBarcode = (studentId?: string) => {
    const targetStudentId = studentId || student?.id;
    if (!targetStudentId) return;
    printStudentBarcodeLabel({
      id: targetStudentId,
      name: student?.name || "طالب",
      groupName: group?.name,
      parentPhone: student?.parentPhone,
      phone: student?.phone,
    });
  };

  const printBarcodeLandscape = (studentId?: string) => {
    const targetStudentId = studentId || student?.id;
    if (!targetStudentId) return;
    printStudentBarcodeLabelLandscape({
      id: targetStudentId,
      name: student?.name || "طالب",
      groupName: group?.name,
      parentPhone: student?.parentPhone,
      phone: student?.phone,
    });
  };

  const printBarcodeDynamic = (studentId?: string) => {
    const targetStudentId = studentId || student?.id;
    if (!targetStudentId) return;
    printStudentBarcodeLabelDynamic({
      id: targetStudentId,
      name: student?.name || "طالب",
      groupName: group?.name,
      parentPhone: student?.parentPhone,
      phone: student?.phone,
    });
  };

  const downloadBarcodeSVG = (studentId: string) => {
    const { svgContent } = generateCode128PortraitSVG(studentId, { includeText: true });
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `barcode-${studentId}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    store.addStudentNote(student.id, newNoteType, newNoteContent);
    setNewNoteContent("");
    setIsAddingNote(false);
  };

  const handleAddPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) return;
    store.addPayment(student.id, payMonth, Number(payAmount), payNotes || "");
    setPayAmount("");
    setPayNotes("");
    setIsAddingPayment(false);
  };

  const sendWhatsAppMsg = () => {
    setSelectedTemplateId("tpl_followup");
    setCustomMessageText(getFilledMessageText("tpl_followup"));
    setIsWhatsAppModalOpen(true);
  };

  const executeSendWhatsApp = async () => {
    if (!student?.parentPhone) return;

    if (autoDownloadPDF) {
      // Quietly download the custom PDF report with the chosen dates so the user has it ready as an attachment
      await downloadPdfReport(true);
    }

    const cleanPhone = student.parentPhone.replace(/[\s+-]/g, "");
    const formattedPhone = cleanPhone.startsWith("0") ? `2${cleanPhone}` : cleanPhone;
    const wpUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(customMessageText)}`;
    window.open(wpUrl, "_blank");
    setIsWhatsAppModalOpen(false);
  };

  const downloadPdfReport = async (isSilent = false) => {
    const presentCount = groupAttendanceRecords.filter(a => a && a.presentStudentIds?.includes(student.id) && a.date >= startDate && a.date <= endDate).length;
    const absentCount = groupAttendanceRecords.filter(a => a && a.absentStudentIds?.includes(student.id) && a.date >= startDate && a.date <= endDate).length;
    const totalSessions = presentCount + absentCount;
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

    // Filter exams & recitations within date range according to reportContent
    const stExams = reportContent !== "recitations"
      ? state.exams.filter(ex => ex.scores?.[student.id] !== undefined && ex.date >= startDate && ex.date <= endDate)
      : [];
    const stRecs = reportContent !== "exams"
      ? state.recitations.filter(r => r.scores?.[student.id] !== undefined && r.date >= startDate && r.date <= endDate)
      : [];
    const filteredNotes = studentNotes.filter(n => n.date >= startDate && n.date <= endDate);

    try {
      await downloadStudentPDFReport(
        student,
        group,
        attendanceRate,
        presentCount,
        absentCount,
        totalSessions,
        attendanceRate >= 90 ? "ممتاز 🌟" : attendanceRate >= 75 ? "جيد جداً 👍" : "مقبول متوسط",
        stExams,
        stRecs,
        filteredNotes,
        state.subject,
        state.academicYear,
        reportContent
      );
    } catch (err: any) {
      if (!isSilent) {
        alert("فشل توليد التقرير المرفق: " + err.message);
      } else {
        console.error("Error auto-downloading PDF report for WhatsApp:", err);
      }
    }
  };

  return (
    <div className="space-y-6 font-sans" dir="rtl" id="student_profile_shell">
      {/* Top Banner Row */}
      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/85 dark:border-slate-800">
        <button 
          onClick={() => onNavigate("students")}
          className="p-1 px-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition"
        >
          رجوع
        </button>
        <div className="truncate flex-1">
          <h2 className="text-base font-black text-slate-900 dark:text-slate-100 truncate leading-tight">{student.name}</h2>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">{group ? group.name : "بلا مجموعة"}</span>
        </div>
      </div>

      {/* Tabs Menu Selection Bar */}
      <div className="flex border-b border-slate-150 dark:border-slate-800 overflow-x-auto scrollbar-none pb-0.5 snap-x">
        {[
          { id: "data", label: "البيانات" },
          { id: "attendance", label: "الحضور" },
          { id: "payments", label: "المدفوعات" },
          { id: "exams", label: "الامتحانات" },
          { id: "recitations", label: "التسميعات" },
          { id: "notes", label: "الملاحظات" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[70px] py-2.5 text-center text-xs font-black transition-colors border-b-2 snap-start ${activeTab === tab.id ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400" : "border-transparent text-slate-400 dark:text-slate-500"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ONE TAB CONTENT DISPLAY AT A TIME */}
      <div className="bg-white dark:bg-slate-950 min-h-[220px]">
        {/* Tab 1: DATA */}
        {activeTab === "data" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3.5 text-right text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-0.5">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block">كود ومُعرّف الطالب:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{student.id}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-0.5">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block">رقم هاتف الطالب:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-left">{student.phone}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-0.5 col-span-2">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block">هاتف ولي الأمر للتواصليات:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono block">{student.parentPhone}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-0.5">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block">الاشتراك الشهري المخصص:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{student.customFee !== undefined ? `${student.customFee} ج.م` : "افتراضي للمجموعة"}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-0.5">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block">حالة السجل:</span>
                <span className="font-bold text-slate-850 dark:text-slate-200">{student.status === "active" ? "طالب نشط بالسنتر" : "مؤرشف"}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-0.5 col-span-2">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block">العنوان السكني والملاحظات العامة:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-sans block">{student.address || "غير مدون"}</span>
              </div>
            </div>

            {/* ملصقات باركود الطالب */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 flex flex-col items-center">
              <div className="flex justify-between items-center w-full">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-bold block">ملصقات باركود الطالب:</span>
                <span className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                  معاينة الملصق الحراري
                </span>
              </div>

              {/* High-fidelity Label Box Preview */}
              <div className="w-[150px] h-[317px] max-w-full bg-white border-2 border-slate-900 rounded-xl p-3 pt-5 flex flex-col justify-start items-center text-center shadow-md select-none text-slate-900 font-sans my-2">
                <div className="w-full flex justify-center mb-2">
                  <div dangerouslySetInnerHTML={{ __html: generateCode128PortraitSVG(student.id, { includeText: false, height: 45, width: 1.4 }).svgContent }} className="w-full flex justify-center max-h-[60px]" />
                </div>

                <div className="w-full text-xs font-extrabold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis px-1">
                  <bdi>{student.name}</bdi> - <bdi>{student.id}</bdi>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  onClick={() => printBarcode(student.id)}
                  className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  title="طباعة باركود رأسي (48mm × 101.5mm)"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة باركود رأسي (48 × 101.5mm)</span>
                </button>
                <button
                  onClick={() => printBarcodeLandscape(student.id)}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  title="طباعة باركود أفقي (101.5mm × 48mm)"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة باركود أفقي (101.5 × 48mm)</span>
                </button>
                <button
                  onClick={() => printBarcodeDynamic(student.id)}
                  className="flex-1 py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  title="طباعة باركود ديناميكي (تلقائي بدون أبعاد ثابتة)"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة باركود ديناميكي</span>
                </button>
                <button
                  onClick={() => downloadBarcodeSVG(student.id)}
                  className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-800"
                  title="تحميل الباركود كصورة SVG"
                >
                  <Download className="w-4 h-4" />
                  <span>SVG</span>
                </button>
              </div>

              {/* Experimental Independent PNG Image & PDF System */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full pt-1">
                <button
                  onClick={() => downloadBarcodePNG({ id: student.id, name: student.name, groupName: group?.name, phone: student.phone, parentPhone: student.parentPhone })}
                  className="flex-1 min-w-[140px] py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  title="تحميل الباركود كصورة PNG مقتصة بدقة عالية (بدون خلفيات أو مقاسات ثابتة)"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل باركود كصورة</span>
                </button>
                <button
                  onClick={() => printBarcodeImage({ id: student.id, name: student.name, groupName: group?.name, phone: student.phone, parentPhone: student.parentPhone })}
                  className="flex-1 min-w-[140px] py-2.5 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  title="طباعة صورة الباركود المقتصة مباشرة"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة صورة الباركود</span>
                </button>
                <button
                  onClick={() => downloadStudentBarcodePDF({ id: student.id, name: student.name, groupName: group?.name, phone: student.phone, parentPhone: student.parentPhone })}
                  className="flex-1 min-w-[140px] py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  title="تحميل مستند PDF مخصص للملصق بدون هوامش A4"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل باركود PDF</span>
                </button>
                <button
                  onClick={() => printStudentBarcodePDF({ id: student.id, name: student.name, groupName: group?.name, phone: student.phone, parentPhone: student.parentPhone })}
                  className="flex-1 min-w-[140px] py-2.5 px-3 bg-rose-800 hover:bg-rose-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  title="طباعة مستند PDF مخصص مباشرة"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة باركود PDF</span>
                </button>
              </div>

              {/* NEW Independent Compact Barcode System */}
              <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 rounded-xl space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-teal-800 dark:text-teal-300">
                    نظام الباركود المصغر (Compact System)
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {(['COMPACT', 'EXTRA_COMPACT', 'ULTRA_COMPACT', 'ULTRA_TALL'] as CompactVariant[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCompactVariant(v)}
                        className={`px-2 py-0.5 rounded-lg text-3xs font-extrabold transition cursor-pointer ${
                          compactVariant === v
                            ? 'bg-teal-600 text-white'
                            : 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 hover:bg-teal-200'
                        }`}
                      >
                        {v === 'COMPACT' ? 'Compact' : v === 'EXTRA_COMPACT' ? 'Extra' : v === 'ULTRA_COMPACT' ? 'Ultra' : 'Ultra Tall'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => downloadStudentBarcodeCompact({ id: student.id, name: student.name, groupName: group?.name, phone: student.phone, parentPhone: student.parentPhone }, compactVariant)}
                    className="flex-1 py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    title="تحميل باركود Compact مقتطع تلقائياً بأبعاد صغرى"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل Compact</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadMultipleBarcodeZip([{ id: student.id, name: student.name, groupName: group?.name, phone: student.phone, parentPhone: student.parentPhone }], compactVariant, `barcode_${compactVariant.toLowerCase()}_${student.id}.zip`)}
                    className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    title="تحميل الباركود في ملف ZIP مضغوط"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل ZIP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => printStudentBarcodeCompact({ id: student.id, name: student.name, groupName: group?.name, phone: student.phone, parentPhone: student.parentPhone }, compactVariant)}
                    className="flex-1 py-2.5 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    title="طباعة باركود Compact مقتطع تلقائياً مباشرة"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة Compact</span>
                  </button>
                </div>
              </div>

              {/* Developer Diagnostics Toggle */}
              <div className="pt-2 flex justify-start">
                <BarcodeDiagnostics student={{ id: student.id, name: student.name, groupName: group?.name }} />
              </div>
            </div>

            {/* Admin buttons sheet row */}
            <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-900">
              <div className="flex gap-2">
                <button 
                  onClick={openEditModal}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                  <span>تعديل السجل</span>
                </button>
                <button
                  onClick={handleToggleArchive}
                  className="px-4 py-3.5 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition rounded-xl text-xs font-bold cursor-pointer"
                >
                  {student.status === "archived" ? "إنهاء الأرشفة" : "أرشفة"}
                </button>
              </div>
              <button 
                onClick={handleDeleteStudent}
                className="w-full py-3.5 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-650 dark:text-red-400 hover:text-red-700 transition rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-center cursor-pointer"
              >
                <Trash className="w-4 h-4" />
                <span>حذف ملف الطالب نهائياً</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: ATTENDANCE */}
        {activeTab === "attendance" && (
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">بيانات الحضور التفصيلية</h3>
            <div className="space-y-2">
              {groupAttendanceRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">لا يوجد كشف حضور مسجل لهذه المجموعة حالياً</div>
              ) : (
                groupAttendanceRecords.map((att) => {
                  const present = att.presentStudentIds?.includes(student.id) ?? false;
                  return (
                    <div key={att.id} className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-705 dark:text-slate-300 font-mono">{att.date}</span>
                      <span className={`text-2xs font-extrabold px-3 py-1 rounded-full ${present ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400"}`}>
                        {present ? "حضور" : "غياب"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: PAYMENTS */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">سجل المدفوعات والاشتراكات المالية</h3>
              <button 
                onClick={() => setIsAddingPayment(!isAddingPayment)}
                className="flex items-center gap-1 text-2xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {isAddingPayment ? "إلغاء السداد السريع" : "سداد سريع للصندوق +"}
              </button>
            </div>

            {/* Quick Settle Payment Form */}
            {isAddingPayment && (
              <form onSubmit={handleAddPaymentSubmit} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block mb-1">الدفعة المستهدفة:</label>
                    <input 
                      type="month" 
                      value={payMonth} 
                      onChange={(e) => setPayMonth(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-100" 
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block mb-1">القيمة المدفوعة: *</label>
                    <input 
                      type="number" 
                      placeholder="150" 
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-805 dark:text-slate-100 placeholder-slate-400" 
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block mb-1">ملاحظات أو رقم الإيصال:</label>
                  <input 
                    type="text" 
                    placeholder="بيان اختياري" 
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-805 dark:text-slate-100 placeholder-slate-400" 
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-xs font-bold cursor-pointer">
                  تأكيد سداد المبلغ فورا وحفظ الإيصال
                </button>
              </form>
            )}

            <div className="space-y-2">
              {studentPayments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs"> لم يتم تدوين دفعات مالية مسبقة للعمل المالي</div>
              ) : (
                studentPayments.map((p) => {
                  const monParts = p.month.split("-");
                  return (
                    <div key={p.id} className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 dark:text-slate-200 block">شهر {monParts[1]} / {monParts[0]}</span>
                        <span className="text-[10px] text-slate-450 dark:text-slate-500 font-mono">{p.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-blue-600 dark:text-blue-450 font-mono">{p.amount} ج.م</span>
                        {state.currentUserRole === "teacher" && (
                          <button
                            onClick={() => {
                              if (confirm("هل تريد بالتأكيد حذف هذه الدفعة المالية من سجل الطالب؟")) {
                                store.deletePayment(p.id);
                              }
                            }}
                            className="p-1 hover:bg-red-50 dark:hover:bg-red-955/35 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="حذف الدفعة"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 4: EXAMS */}
        {activeTab === "exams" && (
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">تفاصيل الاختبارات التحريرية والتصحيح</h3>
            <div className="space-y-2">
              {studentExams.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">لم يصحح أو يحدد امتحان مكتوب للطالب بالسنتر إلى الآن</div>
              ) : (
                studentExams.map((ex) => {
                  const scoreVal = ex.scores[student.id];
                  return (
                    <div key={ex.id} className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{ex.title}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5 font-sans">تاريخ الاختبار: {ex.date}</span>
                      </div>
                      <span className="font-extrabold font-mono text-indigo-650 dark:text-indigo-400 shrink-0">
                        {scoreVal} / {ex.maxScore}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 5: RECITATIONS */}
        {activeTab === "recitations" && (
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">سجل التسميعات الشفوية والقرائية</h3>
            <div className="space-y-2">
              {studentRecitations.length === 0 ? (
                <div className="text-center py-8 text-slate-450 dark:text-slate-500 text-xs text-slate-350">لا يتوفر كشف درجات تسميع شفوي حالي في الأرشيف المالي</div>
              ) : (
                studentRecitations.map((rec) => {
                  const scr = rec.scores[student.id];
                  return (
                    <div key={rec.id} className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{rec.title}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-mono mt-0.5">{rec.date}</span>
                      </div>
                      <span className="font-extrabold text-purple-650 dark:text-purple-400 font-mono shrink-0">
                        {scr} / {rec.maxScore}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 6: NOTES */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">ملاحظات كراس المتابعة الفورية</h3>
              <button 
                onClick={() => setIsAddingNote(!isAddingNote)}
                className="text-2xs font-extrabold text-blue-600 dark:text-blue-450 cursor-pointer"
              >
                {isAddingNote ? "إلغاء التقاط الملاحظة" : "تدوين ملاحظة جديدة +"}
              </button>
            </div>

            {isAddingNote && (
              <form onSubmit={handleAddNoteSubmit} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div>
                  <label className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block mb-1">نوع الملاحظة السلوكية أو الطبية:</label>
                  <select 
                    value={newNoteType}
                    onChange={(e) => setNewNoteType(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="academic" className="dark:bg-slate-900">تقرير أكاديمي ومستوى السلوك</option>
                    <option value="behavior" className="dark:bg-slate-900">ملاحظة انضباط أو أخلاق</option>
                    <option value="private" className="dark:bg-slate-900">ملاحظة سرية ومحجوبة مقتصرة</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block mb-1">محتوى وبند المتابعة المكتوب:</label>
                  <textarea 
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="اكتب التنبيه أو الشكوى أو مراجعة الحافظ..."
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 min-h-[60px] text-slate-900 dark:text-slate-100 placeholder-slate-400"
                    required
                  />
                </div>
                <button type="submit" className="w-full p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer">
                  حفظ الملاحظة بسيرة الطالب
                </button>
              </form>
            )}

            <div className="space-y-2">
              {studentNotes.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">لا يتوفر أي ملاحظات مدرجة في كراس المتابعة الأكاديمية</div>
              ) : (
                studentNotes.map((nt) => (
                  <div key={nt.id} className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 relative">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                      <span className="px-2.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-350 rounded-full font-bold">
                        {nt.type === "academic" ? "دراسي" : nt.type === "behavior" ? "سلوكي" : "محجوب"}
                      </span>
                      <span>بواسطة: {nt.recordedByName} | {nt.date}</span>
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-semibold">{nt.content}</p>
                    <button 
                      onClick={() => store.deleteStudentNote(nt.id)}
                      className="absolute left-2.5 bottom-2.5 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded transition cursor-pointer"
                      title="حذف الملاحظة"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Extreme simplified buttons footer for reports */}
      <div className="pt-6 border-t border-slate-100 dark:border-slate-900 flex gap-2">
        <button 
          onClick={sendWhatsAppMsg}
          className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs hover:shadow-md"
        >
          <MessageSquare className="w-4.5 h-4.5" />
          <span>إرسال واتساب لولي الأمر</span>
        </button>

        <button 
          onClick={() => downloadPdfReport()}
          className="px-4 py-4 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          title="تحميل تقرير PDF"
        >
          <Download className="w-4.5 h-4.5" />
          <span>تحميل PDF</span>
        </button>
      </div>

      {/* Brief edit modal overlay */}
      {studentEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <form onSubmit={handleEditStudentSubmit} className="bg-white dark:bg-slate-950 rounded-3xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl relative">
            <div className="bg-slate-950 dark:bg-slate-900 text-white p-4.5 flex justify-between items-center border-b dark:border-slate-800">
              <h3 className="font-extrabold text-xs">تعديل بيانات {student.name}</h3>
              <button type="button" onClick={() => setStudentEditModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {validationError && (
              <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-455 px-5 py-2.5 text-3xs font-extrabold border-b border-rose-100 dark:border-rose-900 flex items-center gap-1.5" dir="rtl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
            <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs text-right">
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">الاسم الثلاثي بالكامل: *</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-800 dark:text-slate-100" required />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">المجموعة المنتسب إليها:</label>
                <select value={editGroupId} onChange={(e) => setEditGroupId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-800 dark:text-slate-100">
                  {state.groups.map(g => (
                    <option key={g.id} value={g.id} className="dark:bg-slate-900">{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">رقم هاتف الطالب: *</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-800 dark:text-slate-100" required />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">رقم هاتف ولي الأمر: *</label>
                <input type="tel" value={editParentPhone} onChange={(e) => setEditParentPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-800 dark:text-slate-100" required />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">قيمة الاشتراك المالي المخصص:</label>
                <input type="number" value={editCustomFee} onChange={(e) => setEditCustomFee(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-100" placeholder="اشتراك مخصص إذا وجد" />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">العنوان وملاحظات عامة:</label>
                <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-100" placeholder="المنطقة والبلد" />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1 font-bold">ملاحظات وتنبيهات مسبقة:</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 min-h-[50px] text-slate-800 dark:text-slate-100" placeholder="أي ملاحظة سلوكية" />
              </div>
              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition select-none cursor-pointer">
                حفظ التعديلات فورية بالسنتر
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Student Delete Confirmation Overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.90, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-950 rounded-3xl p-6 shadow-2xl relative border border-slate-150 dark:border-slate-800 w-full max-w-sm text-center space-y-5 z-10"
              dir="rtl"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/25 flex items-center justify-center text-red-650">
                <Trash className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">حذف سجل الطالب</h3>
                <p className="text-3xs text-slate-400 dark:text-slate-400 font-extrabold leading-relaxed">
                  هل ترغب فعلاً في حذف سجل الطالب <span className="text-slate-700 dark:text-slate-200 font-black">«{student.name}»</span> وكافة المعاملات المالية والتسميعات المتعلقة به نهائياً؟ هذا الإجراء مدمر ولا يمكن التراجع عنه.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleConfirmDeleteStudent}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 active:scale-98 transition text-white text-[11px] font-black rounded-xl cursor-pointer shadow-xs select-none"
                >
                  نعم، احذف الطالب
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-98 transition text-slate-650 dark:text-slate-300 text-[11px] font-black rounded-xl cursor-pointer select-none"
                >
                  إلغاء الأمر
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Student Archive Confirmation Overlay */}
      <AnimatePresence>
        {showArchiveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowArchiveConfirm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.90, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-950 rounded-3xl p-6 shadow-2xl relative border border-slate-150 dark:border-slate-800 w-full max-w-sm text-center space-y-5 z-10"
              dir="rtl"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400">
                <Archive className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">أرشفة سجل الطالب</h3>
                <p className="text-3xs text-slate-400 dark:text-slate-400 font-extrabold leading-relaxed">
                  هل ترغب في أرشفة سجل الطالب <span className="text-slate-700 dark:text-slate-200 font-black">«{student.name}»</span>؟ لن يظهر ضمن قوائم الحضور والطلاب النشطين، ولكن سيظل بالإمكان استرجاعه لاحقاً من الأرشيف.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleConfirmArchiveStudent}
                  className="flex-1 py-2.5 px-4 bg-slate-800 dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-slate-900 active:scale-98 transition text-white text-[11px] font-black rounded-xl cursor-pointer shadow-xs select-none"
                >
                  نعم، أرشفة السجل
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-98 transition text-slate-650 dark:text-slate-300 text-[11px] font-black rounded-xl cursor-pointer select-none"
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
        {showNoPermissionAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNoPermissionAlert(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.90, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-950 rounded-3xl p-6 shadow-2xl relative border border-slate-150 dark:border-slate-800 w-full max-w-sm text-center space-y-4 z-10"
              dir="rtl"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-500">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">خطأ في الصلاحية</h3>
                <p className="text-3xs text-slate-400 dark:text-slate-400 font-extrabold leading-relaxed">
                  عذراً، حمايةً للمعلومات وسجلات السنتر، تقتصر صلاحية حذف السجلات على المعلم المالك فقط، ولا يحق للمشرفين أو السكرتارية الحذف.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNoPermissionAlert(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-black transition select-none cursor-pointer"
              >
                قمت بالقراءة والرجوع
              </button>
            </motion.div>
          </div>
        )}

        {/* Smart WhatsApp Templates Modal (NEW FEATURE) */}
        {isWhatsAppModalOpen && student && (
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
              className="bg-white dark:bg-slate-950 rounded-3xl overflow-hidden shadow-2xl relative border border-slate-150 dark:border-slate-800 w-full max-w-md flex flex-col z-10 max-h-[95vh]"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 dark:bg-slate-900 text-white p-4.5 flex justify-between items-center pr-5 pl-4 border-b dark:border-slate-800">
                <div className="flex items-center gap-2 text-right">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 font-bold" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-2xs text-white text-right">مُرسل وتقارير الواتساب الذكية</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 text-right">إرسال تقرير مخصص فوري لولى الأمر</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsWhatsAppModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer active:scale-95 transition">
                  <X className="w-5 h-5 font-bold" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-right flex-1 select-none">
                {/* Selector */}
                <div className="space-y-1.5 text-right">
                  <label className="text-slate-500 dark:text-slate-400 text-[10px] block font-bold text-right text-right">1️⃣ اختر قالب إرسال الرسالة:</label>
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
                          className={`w-full text-right p-3 rounded-2xl border transition text-2xs font-extrabold flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-slate-950 dark:bg-slate-900 border-slate-950 dark:border-slate-900 text-white"
                              : "bg-slate-50 dark:bg-slate-900/40 border-slate-150 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <span>{tpl.name}</span>
                          {isSelected && <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date filter inputs inside WhatsApp modal */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block text-right">الفترة من تاريخ:</label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStartDate(val);
                        setCustomMessageText(getFilledMessageText(selectedTemplateId, reportContent, val, endDate));
                      }}
                      className="w-full text-[11px] p-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-150 dark:border-slate-800 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block text-right">الفترة حتى تاريخ:</label>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEndDate(val);
                        setCustomMessageText(getFilledMessageText(selectedTemplateId, reportContent, startDate, val));
                      }}
                      className="w-full text-[11px] p-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-150 dark:border-slate-800 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                {/* Scope selection inside WhatsApp modal */}
                <div className="space-y-1.5 text-right">
                  <label className="text-slate-500 dark:text-slate-400 text-[10px] block font-bold text-right">⚙️ تعديل نطاق محتوى رسالة وتقرير ولي الأمر:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "all", label: "الكل" },
                      { id: "exams", label: "امتحانات فقط 📝" },
                      { id: "recitations", label: "تسميع فقط 🗣️" }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          const val = type.id as any;
                          setReportContent(val);
                          setCustomMessageText(getFilledMessageText(selectedTemplateId, val, startDate, endDate));
                        }}
                        className={`py-2 px-2 border rounded-xl text-[10px] font-black transition duration-150 cursor-pointer text-center ${
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

                {/* Edit & Preview */}
                <div className="space-y-1.5 pt-1 text-right">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-500 dark:text-slate-400 text-[10px] block font-bold text-right">2️⃣ معاينة رسالة المتابعة والدرجات وتعديلها يدويًا قبل التوجيه:</label>
                  </div>
                  
                  {/* WhatsApp styled bubble container */}
                  <div className="relative bg-[#efeae2] dark:bg-slate-900 border border-[#dad3ca] dark:border-slate-800 p-3.5 rounded-2xl">
                    <textarea
                      rows={6}
                      value={customMessageText}
                      onChange={(e) => setCustomMessageText(e.target.value)}
                      className="w-full text-slate-800 dark:text-slate-100 bg-white/90 dark:bg-slate-950/90 focus:bg-white dark:focus:bg-slate-950 backdrop-blur-xs p-3.5 rounded-xl border border-emerald-600/10 focus:border-emerald-600/30 text-2xs font-medium leading-relaxed font-sans placeholder-slate-400 focus:outline-none focus:ring-0 resize-none shadow-3xs text-right"
                      dir="rtl"
                    />
                    <div className="mt-1 text-left text-[9px] text-[#8696a0] dark:text-slate-500 font-mono leading-none">
                      يسري بمؤشرات ومواعيد الفلترة: {startDate} ⇄ {endDate}
                    </div>
                  </div>
                </div>

                {/* Auto PDF Attachment Checkbox Option */}
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-150 dark:border-blue-900/40 rounded-2xl flex items-center justify-between">
                  <div className="flex flex-col text-right">
                    <span className="text-2xs font-black text-blue-900 dark:text-blue-350">تحميل التقرير PDF آلياً مع التوجيه</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">توليد وتحميل ملف PDF مخصص بالتواريخ لضمه مع الإرسال</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={autoDownloadPDF} 
                      onChange={(e) => setAutoDownloadPDF(e.target.checked)} 
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="p-3 bg-amber-50/75 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/40 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-805 dark:text-amber-400 font-medium leading-normal text-right">
                    بمجرد النقر على «بدء التوجيه»، سيقوم النظام بتحميل التقرير تلقائياً وفتح تطبيق WhatsApp وتجهيز الرسالة لولي الأمر: {student.parentPhone}.
                  </p>
                </div>
              </div>

              {/* Modal Footer actions */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded-xl font-bold text-xs select-none cursor-pointer"
                >
                  إلغاء الملء
                </button>
                <button
                  type="button"
                  onClick={executeSendWhatsApp}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/15"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>بدء التوجيه وتنزيل التقرير المرفق 🚀</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
