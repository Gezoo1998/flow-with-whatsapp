"use client";

import { useState } from "react";
import { useAppStore, store } from "@/lib/store";
import { 
  Plus, Trash2, Key, Info, RefreshCw, Layers, 
  FileDown, FileUp, FileSpreadsheet, Check, HelpCircle, AlertCircle,
  MessageSquare, Undo2, Sparkles, CheckCircle2, Shield, Clock, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";

export default function SettingsView() {
  const state = useAppStore((s) => s);
  const isTrueAdmin = state.currentUserRole === "teacher";
  
  // States
  const [subjectVal, setSubjectVal] = useState(state.subject);
  const [teacherPinVal, setTeacherPinVal] = useState(state.teacherPin);
  const [teacherNameVal, setTeacherNameVal] = useState(state.teacherName || "");
  const [lockEnabledVal, setLockEnabledVal] = useState(state.isLockAccessEnabled);
  const [lockStartVal, setLockStartVal] = useState(state.lockAccessStart || "19:00");
  const [lockEndVal, setLockEndVal] = useState(state.lockAccessEnd || "07:00");
  
  // Secretary ADD form states
  const [secName, setSecName] = useState("");
  const [secPin, setSecPin] = useState("");
  const [isAddingSec, setIsAddingSec] = useState(false);

  // New year reset states
  const [archiveYearName, setArchiveYearName] = useState(`سنة دراسية ${new Date().getFullYear() - 1}/${new Date().getFullYear()}`);
  const [studentAction, setStudentAction] = useState<"keep" | "archive_all" | "delete" | any>("keep");

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Excel/CSV import-export states
  const [exportGroupId, setExportGroupId] = useState("all");
  const [importGroupId, setImportGroupId] = useState("");
  const [parsedStudents, setParsedStudents] = useState<any[]>([]);

  // Full System Data Backup Restore states
  const [restoreRawJson, setRestoreRawJson] = useState<string>("");
  const [restoreParsedData, setRestoreParsedData] = useState<any | null>(null);
  const [showRestoreConfirmModal, setShowRestoreConfirmModal] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Excel/CSV Template download helper
  const handleDownloadTemplate = () => {
    try {
      const headers = ["الاسم", "هاتف الطالب", "هاتف ولي الأمر", "العنوان", "الاشتراك المخصص", "ملاحظات"];
      const sampleRow = ["محمد أحمد", "01012345678", "01234567890", "القاهرة", 0, "طالب متفوق متميز"];
      
      const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
      
      // Auto-adjust column widths for better visual look
      worksheet["!cols"] = [
        { wch: 20 }, // الاسم
        { wch: 15 }, // هاتف الطالب
        { wch: 15 }, // هاتف ولي الأمر
        { wch: 15 }, // العنوان
        { wch: 15 }, // الاشتراك المخصص
        { wch: 25 }, // ملاحظات
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب");
      
      XLSX.writeFile(workbook, "قالب_استيراد_الطلاب.xlsx");
      setSuccessMsg("تم تحميل ملف قالب Excel (.xlsx) بنجاح! يرجى ملؤه ورفعه في القسم أدناه.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      // Fallback to CSV
      const csvHeader = "الاسم,هاتف الطالب,هاتف ولي الأمر,العنوان,الاشتراك المخصص,ملاحظات\n";
      const sampleRow = "محمد أحمد,01012345678,01234567890,القاهرة,0,طالب متفوق متميز\n";
      const csvContent = "\ufeff" + csvHeader + sampleRow;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `قالب_استيراد_الطلاب.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setSuccessMsg("تم تحميل قالب الاستيراد بصيغة CSV.");
      setTimeout(() => setSuccessMsg(""), 2000);
    }
  };

  // Excel (.xlsx) Exporter helper
  const handleExportCSV = (groupId: string) => {
    try {
      const targetStudents = state.students.filter(
        st => groupId === "all" || st.groupId === groupId
      );

      if (targetStudents.length === 0) {
        setErrorMsg("لا يوجد طلاب لتصديرهم في هذه المجموعة!");
        return;
      }

      // Prepare headers
      const headers = [
        "كود الطالب",
        "اسم الطالب",
        "رقم هاتف الطالب",
        "رقم هاتف ولي الأمر",
        "المجموعة",
        "العنوان",
        "قيمة الاشتراك المخصص",
        "ملاحظات",
        "تاريخ الانضمام",
        "الحالة"
      ];

      // Prepare rows data
      const dataRows = targetStudents.map(st => {
        const gp = state.groups.find(g => g.id === st.groupId);
        const gpName = gp ? gp.name : "غير محدد";
        return [
          st.id,
          st.name,
          st.phone || "",
          st.parentPhone || "",
          gpName,
          st.address || "",
          st.customFee || 0,
          st.notes || "",
          st.joinDate,
          st.status === "active" ? "نشط" : "مؤرشف"
        ];
      });

      // Generate worksheet & workbook
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      
      // Auto-fit columns
      worksheet["!cols"] = [
        { wch: 15 }, // ID
        { wch: 20 }, // Name
        { wch: 15 }, // Phone
        { wch: 15 }, // Parent Phone
        { wch: 20 }, // Group
        { wch: 15 }, // Address
        { wch: 15 }, // Fee
        { wch: 25 }, // Notes
        { wch: 12 }, // Join Date
        { wch: 10 }, // Status
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب");

      const grLabel = groupId === "all" ? "كل_المجموعات" : (state.groups.find(g => g.id === groupId)?.name || "مجموعة");
      XLSX.writeFile(workbook, `كشف_الطلاب_${grLabel}_${new Date().toISOString().split("T")[0]}.xlsx`);

      setSuccessMsg("تم تصدير ملف Excel (.xlsx) بنجاح!");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (err) {
      console.error(err);
      setErrorMsg("حدث خطأ أثناء تصدير كشوف الطلاب لمستند Excel!");
    }
  };

  // 1. Full Multi-Sheet Excel Export (.xlsx) - ALL SYSTEM DATA
  const handleExportFullExcel = () => {
    try {
      const dateStr = new Date().toISOString().split("T")[0];
      const workbook = XLSX.utils.book_new();

      // Sheet 1: الطلاب (Students)
      const studentsHeaders = ["كود الطالب", "اسم الطالب", "رقم هاتف الطالب", "رقم هاتف ولي الأمر", "المجموعة", "العنوان", "الاشتراك المخصص", "ملاحظات", "تاريخ الانضمام", "الحالة"];
      const studentsRows = (state.students || []).map((st) => {
        const gp = (state.groups || []).find((g) => g.id === st.groupId);
        return [
          st.id,
          st.name,
          st.phone || "",
          st.parentPhone || "",
          gp ? gp.name : "غير محدد",
          st.address || "",
          st.customFee || 0,
          st.notes || "",
          st.joinDate || "",
          st.status === "active" ? "نشط" : "مؤرشف"
        ];
      });
      const wsStudents = XLSX.utils.aoa_to_sheet([studentsHeaders, ...studentsRows]);
      wsStudents["!cols"] = [{ wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(workbook, wsStudents, "الطلاب");

      // Sheet 2: المجموعات (Groups)
      const groupsHeaders = ["كود المجموعة", "اسم المجموعة", "الاشتراك الشهري", "وقت البداية", "وقت النهاية", "أيام الأسبوع", "الوصف"];
      const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const groupsRows = (state.groups || []).map((g) => [
        g.id,
        g.name,
        g.monthlyFee || 0,
        g.startTime || "",
        g.endTime || "",
        Array.isArray(g.daysOfWeek) ? g.daysOfWeek.map((d) => dayNames[d] || d).join(" - ") : "",
        g.description || ""
      ]);
      const wsGroups = XLSX.utils.aoa_to_sheet([groupsHeaders, ...groupsRows]);
      wsGroups["!cols"] = [{ wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, wsGroups, "المجموعات");

      // Sheet 3: التسميعات الكويزات (Recitations)
      const recHeaders = ["كود التسميع", "عنوان التسميع", "المجموعة", "النهاية العظمى", "التاريخ", "عدد الطلاب المقيّمين"];
      const recRows = (state.recitations || []).map((r) => {
        const gp = (state.groups || []).find((g) => g.id === r.groupId);
        const evalCount = Object.keys(r.scores || {}).length;
        return [r.id, r.title, gp ? gp.name : "غير محدد", r.maxScore, r.date, evalCount];
      });
      const wsRec = XLSX.utils.aoa_to_sheet([recHeaders, ...recRows]);
      wsRec["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(workbook, wsRec, "التسميعات والكويزات");

      // Sheet 4: الامتحانات الرئيسية (Exams)
      const examHeaders = ["كود الامتحان", "عنوان الامتحان", "المجموعات المستهدفة", "النهاية العظمى", "التاريخ", "الوصف", "عدد الطلاب المقيّمين"];
      const examRows = (state.exams || []).map((e) => {
        const groupNames = Array.isArray(e.targetGroupIds)
          ? e.targetGroupIds.map((gid) => (state.groups || []).find((g) => g.id === gid)?.name || gid).join(" - ")
          : "كل المجموعات";
        const evalCount = Object.keys(e.scores || {}).length;
        return [e.id, e.title, groupNames, e.maxScore, e.date, e.description || "", evalCount];
      });
      const wsExam = XLSX.utils.aoa_to_sheet([examHeaders, ...examRows]);
      wsExam["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(workbook, wsExam, "الامتحانات الرئيسية");

      // Sheet 5: درجات الطلاب التفصيلية (Detailed Scores)
      const scoresHeaders = ["نوع التقييم", "عنوان التقييم", "كود الطالب", "اسم الطالب", "المجموعة", "الدرجة المسجلة", "النهاية العظمى", "التاريخ"];
      const scoresRows: any[] = [];

      (state.recitations || []).forEach((r) => {
        const gp = (state.groups || []).find((g) => g.id === r.groupId);
        Object.entries(r.scores || {}).forEach(([studentId, score]) => {
          const st = (state.students || []).find((s) => s.id === studentId);
          scoresRows.push([
            "تسميع / كويز",
            r.title,
            studentId,
            st ? st.name : "طالب محذوف",
            gp ? gp.name : "غير محدد",
            score,
            r.maxScore,
            r.date
          ]);
        });
      });

      (state.exams || []).forEach((e) => {
        Object.entries(e.scores || {}).forEach(([studentId, score]) => {
          const st = (state.students || []).find((s) => s.id === studentId);
          const gp = st ? (state.groups || []).find((g) => g.id === st.groupId) : null;
          scoresRows.push([
            "امتحان رئيسي",
            e.title,
            studentId,
            st ? st.name : "طالب محذوف",
            gp ? gp.name : "غير محدد",
            score,
            e.maxScore,
            e.date
          ]);
        });
      });

      const wsScores = XLSX.utils.aoa_to_sheet([scoresHeaders, ...scoresRows]);
      wsScores["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 22 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, wsScores, "كشف الدرجات التفصيلي");

      // Sheet 6: الحضور والغياب (Attendance)
      const attHeaders = ["كود السجل", "اسم المجموعة", "التاريخ", "عدد الحاضرين", "عدد الغائبين", "عدد المتأخرين"];
      const attRows = (state.attendance || []).map((att) => {
        const gp = (state.groups || []).find((g) => g.id === att.groupId);
        return [
          att.id,
          gp ? gp.name : "غير محدد",
          att.date,
          Array.isArray(att.presentStudentIds) ? att.presentStudentIds.length : 0,
          Array.isArray(att.absentStudentIds) ? att.absentStudentIds.length : 0,
          Array.isArray(att.lateStudentIds) ? att.lateStudentIds.length : 0
        ];
      });
      const wsAtt = XLSX.utils.aoa_to_sheet([attHeaders, ...attRows]);
      wsAtt["!cols"] = [{ wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, wsAtt, "الحضور والغياب");

      // Sheet 7: المدفوعات والتحصيل (Payments)
      const payHeaders = ["كود الفاتورة", "اسم الطالب", "الشهر المستهدف", "المبلغ المدفوع", "التاريخ والوقت", "صلاحية المكتّب", "اسم المسجل", "ملاحظات"];
      const payRows = (state.payments || []).map((p) => {
        const st = (state.students || []).find((s) => s.id === p.studentId);
        return [
          p.id,
          st ? st.name : "غير معروف",
          p.month,
          p.amount,
          p.date,
          p.recordedBy === "teacher" ? "أدمن" : "مشرف",
          p.recordedByName || "",
          p.notes || ""
        ];
      });
      const wsPay = XLSX.utils.aoa_to_sheet([payHeaders, ...payRows]);
      wsPay["!cols"] = [{ wch: 15 }, { wch: 22 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, wsPay, "المدفوعات والاشتراكات");

      // Sheet 8: ملاحظات الطلاب وسجل العمليات (Notes & Activity Logs)
      const logHeaders = ["التاريخ والوقت", "النوع / العملية", "اسم الطالب / المستخدم", "التفاصيل والملاحظة"];
      const logRows = [
        ...(state.studentNotes || []).map((n) => {
          const st = (state.students || []).find((s) => s.id === n.studentId);
          return [n.date, `ملاحظة طالب (${n.type})`, st ? st.name : "", n.content];
        }),
        ...(state.activityLogs || []).map((l) => [l.timestamp, l.actionType, l.recordedByName, l.details])
      ];
      const wsLog = XLSX.utils.aoa_to_sheet([logHeaders, ...logRows]);
      wsLog["!cols"] = [{ wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(workbook, wsLog, "الملاحظات وسجل العمليات");

      XLSX.writeFile(workbook, `سجلات_مركز_CenterFlow_الشاملة_${dateStr}.xlsx`);
      setSuccessMsg("تم تصدير كافة بيانات وسجلات النظام الشاملة بملف Excel (.xlsx) بنجاح!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Full Excel export error:", err);
      setErrorMsg("حدث خطأ أثناء تصدير كافة البيانات لمستند Excel!");
    }
  };

  // 2. Full System Backup JSON Export (.json)
  const handleExportFullJSON = () => {
    try {
      const dateStr = new Date().toISOString().split("T")[0];
      const cleanData = JSON.parse(JSON.stringify(state));
      delete cleanData.teacherPin;

      const jsonStr = JSON.stringify(cleanData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `سجلات_مركز_CenterFlow_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSuccessMsg("تم تصدير النسخة الاحتياطية الشاملة بصيغة JSON بنجاح!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("JSON export error:", err);
      setErrorMsg("حدث خطأ أثناء تصدير ملف النسخة الاحتياطية JSON!");
    }
  };

  // 3. Multi-Section Structured CSV Export (.csv)
  const handleExportFullCSV = () => {
    try {
      const dateStr = new Date().toISOString().split("T")[0];
      let csvContent = "\ufeff"; // UTF-8 BOM

      // SECTION 1: STUDENTS
      csvContent += "--- كشف الطلاب ---\n";
      csvContent += "كود الطالب,اسم الطالب,الهاتف,هاتف ولي الأمر,المجموعة,العنوان,الاشتراك,ملاحظات,التاريخ,الحالة\n";
      (state.students || []).forEach((st) => {
        const gp = (state.groups || []).find((g) => g.id === st.groupId);
        const name = (st.name || "").replace(/,/g, " ");
        const notes = (st.notes || "").replace(/,/g, " ");
        const addr = (st.address || "").replace(/,/g, " ");
        csvContent += `${st.id},${name},${st.phone || ""},${st.parentPhone || ""},${gp ? gp.name : "غير محدد"},${addr},${st.customFee || 0},${notes},${st.joinDate || ""},${st.status}\n`;
      });

      // SECTION 2: RECITATIONS
      csvContent += "\n--- كشف التسميعات والكويزات ---\n";
      csvContent += "كود التسميع,عنوان التسميع,المجموعة,النهاية العظمى,التاريخ\n";
      (state.recitations || []).forEach((r) => {
        const gp = (state.groups || []).find((g) => g.id === r.groupId);
        const title = (r.title || "").replace(/,/g, " ");
        csvContent += `${r.id},${title},${gp ? gp.name : "غير محدد"},${r.maxScore},${r.date}\n`;
      });

      // SECTION 3: EXAMS
      csvContent += "\n--- كشف الامتحانات الرئيسية ---\n";
      csvContent += "كود الامتحان,عنوان الامتحان,النهاية العظمى,التاريخ\n";
      (state.exams || []).forEach((e) => {
        const title = (e.title || "").replace(/,/g, " ");
        csvContent += `${e.id},${title},${e.maxScore},${e.date}\n`;
      });

      // SECTION 4: PAYMENTS
      csvContent += "\n--- كشف المدفوعات والتحصيل ---\n";
      csvContent += "كود الفاتورة,اسم الطالب,الشهر,المبلغ,التاريخ والوقت,اسم المسجل\n";
      (state.payments || []).forEach((p) => {
        const st = (state.students || []).find((s) => s.id === p.studentId);
        const stName = st ? st.name.replace(/,/g, " ") : "غير معروف";
        csvContent += `${p.id},${stName},${p.month},${p.amount},${p.date},${p.recordedByName || ""}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `سجلات_مركز_CenterFlow_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSuccessMsg("تم تصدير كافة البيانات والتقارير بصيغة CSV بنجاح!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("CSV export error:", err);
      setErrorMsg("حدث خطأ أثناء تصدير ملفات CSV!");
    }
  };

  // JSON Backup File Uploader & Inspector Handler
  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg("");
    setSuccessMsg("");
    const file = e.target.files?.[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.readAsText(file, "UTF-8");
    fileReader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (
          parsed &&
          (Array.isArray(parsed.students) ||
            Array.isArray(parsed.groups) ||
            Array.isArray(parsed.recitations) ||
            Array.isArray(parsed.exams) ||
            Array.isArray(parsed.secretaries))
        ) {
          setRestoreRawJson(text);
          setRestoreParsedData(parsed);
          setShowRestoreConfirmModal(true);
        } else {
          setErrorMsg("صيغة ملف النسخة الاحتياطية غير متطابقة مع هيكل بيانات النظام!");
        }
      } catch (err) {
        console.error("Backup JSON parse error:", err);
        setErrorMsg("تعذر قراءة ملف النسخة الاحتياطية! تأكد من اختيار ملف JSON صحيح.");
      }
    };
  };

  // Confirm Full System Restore Execution
  const handleConfirmRestore = async () => {
    if (!restoreRawJson || isRestoring) return;
    setIsRestoring(true);

    try {
      const result = store.restoreSystemData(restoreRawJson);
      if (result.success) {
        setSuccessMsg(result.message);
        setShowRestoreConfirmModal(false);
        setRestoreRawJson("");
        setRestoreParsedData(null);
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        setErrorMsg(result.message);
      }
    } catch (err) {
      console.error("Restore error:", err);
      setErrorMsg("حدث خطأ غير متوقع أثناء استرجاع بيانات النظام!");
    } finally {
      setIsRestoring(false);
    }
  };

  // Excel / CSV Importer uploader handler
  const handleCSVImportUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg("");
    setSuccessMsg("");
    const file = e.target.files?.[0];
    if (!file) return;

    const fileReader = new FileReader();

    fileReader.readAsArrayBuffer(file);
    fileReader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays to handle headers manually and robustly
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          setErrorMsg("عذراً، الملف فارغ أو لا يحتوي على كشوف صالحة!");
          return;
        }

        // Detect column mappings by matching common Arabic/English names
        let nameIdx = 0;
        let phoneIdx = 1;
        let parentPhoneIdx = 2;
        let addressIdx = 3;
        let customFeeIdx = 4;
        let notesIdx = 5;

        // Read the first row (headers) to look for names
        const firstRow = rows[0] || [];
        
        for (let idx = 0; idx < firstRow.length; idx++) {
          const colName = String(firstRow[idx]).trim().toLowerCase();
          if (!colName) continue;
          
          if (colName.includes("اسم") || colName === "الاسم" || colName === "name") {
            nameIdx = idx;
          } else if (colName.includes("هاتف الطالب") || colName.includes("رقم الطالب") || colName === "هاتف" || colName === "phone" || colName === "phone_number") {
            phoneIdx = idx;
          } else if (colName.includes("ولي الأمر") || colName.includes("رقم ولي") || colName.includes("هاتف ولي") || colName === "parent" || colName === "parent_phone") {
            parentPhoneIdx = idx;
          } else if (colName.includes("عنوان") || colName === "العنوان" || colName === "address") {
            addressIdx = idx;
          } else if (colName.includes("اشتراك") || colName.includes("الاشتراك") || colName === "fee" || colName === "custom_fee") {
            customFeeIdx = idx;
          } else if (colName.includes("ملاحظات") || colName === "الملاحظات" || colName === "notes" || colName === "note") {
            notesIdx = idx;
          }
        }

        const list: any[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const nameVal = row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : "";
          if (!nameVal || nameVal === "الاسم" || nameVal === "محمد أحمد") continue; // Skip template placeholder/duplicate headers

          const phoneVal = row[phoneIdx] !== undefined ? String(row[phoneIdx]).trim() : "";
          const parentPhoneVal = row[parentPhoneIdx] !== undefined ? String(row[parentPhoneIdx]).trim() : "";
          const addressVal = row[addressIdx] !== undefined ? String(row[addressIdx]).trim() : "";
          
          let customFeeRaw = 0;
          if (row[customFeeIdx] !== undefined) {
            customFeeRaw = parseFloat(row[customFeeIdx]);
          }
          const notesVal = row[notesIdx] !== undefined ? String(row[notesIdx]).trim() : "";

          list.push({
            name: nameVal,
            phone: phoneVal,
            parentPhone: parentPhoneVal,
            address: addressVal,
            customFee: isNaN(customFeeRaw) ? 0 : customFeeRaw,
            notes: notesVal
          });
        }

        if (list.length === 0) {
          setErrorMsg("لم نتمكن من قراءة أي كشف صحيح من الملف، يرجى الالتزام بتصميم القالب!");
        } else {
          setParsedStudents(list);
          setSuccessMsg(`تمت قراءة ${list.length} طالب بنجاح! الرجاء تحديد المجموعة المستهدفة لتأكيد الاستيراد.`);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("حدث خطأ أثناء قراءة ملف الـ Excel / CSV!");
      }
    };
  };

  // CSV Import commiter
  const handleConfirmImport = () => {
    if (!importGroupId) {
      setErrorMsg("الرجاء اختيار المجموعة المستهدفة أولاً لرصد الطلاب بداخلها!");
      return;
    }
    if (parsedStudents.length === 0) {
      setErrorMsg("لا توجد بيانات صالحة للاستيراد!");
      return;
    }

    let addedCount = 0;
    parsedStudents.forEach(st => {
      store.addStudent({
        name: st.name,
        phone: st.phone,
        parentPhone: st.parentPhone,
        groupId: importGroupId,
        address: st.address || "",
        customFee: st.customFee || undefined,
        notes: st.notes || ""
      });
      addedCount++;
    });

    setParsedStudents([]);
    setSuccessMsg(`🎉 تم استيراد ونقل ${addedCount} طالب بنجاح إلى المجموعة المحددة!`);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleUpdateSubject = (subj: any) => {
    setSubjectVal(subj);
    store.setSubject(subj);
    setSuccessMsg("تم تغيير واجهة المادة بنجاح!");
    setTimeout(() => setSuccessMsg(""), 2000);
  };

  const handleUpdateTeacherName = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!teacherNameVal.trim()) {
      setErrorMsg("يرجى إدخال اسم معلم صالح");
      return;
    }
    store.setTeacherName(teacherNameVal.trim());
    setSuccessMsg("تمت العملية وحفظ اسم المعلم بنجاح! 🎉");
    setTimeout(() => setSuccessMsg(""), 2000);
  };

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    
    const res = store.updateTeacherPin(teacherPinVal);
    if (res.success) {
      setSuccessMsg(res.message);
      setTimeout(() => setSuccessMsg(""), 2000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleAddSecretarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTrueAdmin) {
      setErrorMsg("عذراً، هذا الإجراء متاح للمعلم (الأدمن) فقط!");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    if (!secName.trim() || !secPin.trim()) return;

    store.addSecretary(secName.trim(), secPin.trim());
    setSecName("");
    setSecPin("");
    setIsAddingSec(false);
    setSuccessMsg("تم إضافة السكرتيرة بنجاح!");
    setTimeout(() => setSuccessMsg(""), 2000);
  };

  const handleExportBackup = () => {
    try {
      const rawData = store.getState();
      const jsonString = JSON.stringify(rawData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.setAttribute("download", `سجلات_مركز_CenterFlow_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
      
      setSuccessMsg("تم تصدير وتحميل النسخة الاحتياطية بنجاح إلى جهازك!");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setErrorMsg("عذراً، فشل تصدير النسخة الاحتياطية للبيانات.");
      setTimeout(() => setErrorMsg(""), 3500);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg("");
    setSuccessMsg("");
    const fileReader = new FileReader();
    const uploadedFile = e.target.files?.[0];
    
    if (uploadedFile) {
      fileReader.readAsText(uploadedFile, "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          const res = store.restoreSystemData(JSON.stringify(parsed));
          if (res.success) {
            setSuccessMsg(res.message);
            setTimeout(() => {
              setSuccessMsg("");
              window.location.reload();
            }, 1500);
          } else {
            setErrorMsg(res.message || "ملف النسخة الاحتياطية المرفق غير صالح!");
          }
        } catch (err) {
          setErrorMsg("ملف النسخة الاحتياطية المرفق غير صالح!");
        }
      };
    }
  };

  const handleResetYearSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const confirmed = window.confirm("⚠️ تحذير نهائي: هل أنت متأكد من تفريغ دورة العام الدراسي وبدء موسم أكاديمي جديد تماماً؟ هذا الإجراء غير قابل للتراجع!");
    if (!confirmed) return;

    store.resetAcademicYear(archiveYearName, studentAction);
    setSuccessMsg("تم إعادة تعيين العام الدراسي بنجاح!");
    setTimeout(() => {
      setSuccessMsg("");
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="space-y-6 font-sans text-xs" dir="rtl" id="settings_view">
      
      {/* Notifications */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white rounded-2xl border border-emerald-400/20 shadow-xl shadow-emerald-500/30 w-[90%] max-w-xs"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
              <Check className="w-4.5 h-4.5 font-bold" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-2xs font-extrabold text-white font-cairo">تأكيد الإجراء</p>
              <p className="text-[10px] text-emerald-100 font-bold mt-0.5">{successMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4.5 py-3.5 bg-gradient-to-r from-rose-600 to-red-500 text-white rounded-2xl border border-red-400/20 shadow-xl shadow-red-500/30 w-[90%] max-w-xs"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
              <AlertCircle className="w-4.5 h-4.5 font-bold" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-2xs font-extrabold text-white font-cairo">تنبيه بالنظام</p>
              <p className="text-[10px] text-rose-100 font-bold mt-0.5">{errorMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 1: Teacher Information */}
      <div className="bg-white dark:bg-slate-900 p-5 border border-slate-150 dark:border-slate-800 rounded-3xl space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
          <Layers className="w-4.5 h-4.5 text-blue-600" />
          <span>بيانات المعلم والمواد</span>
        </h3>

        <div className="space-y-3">
          {/* Active Subject choosing */}
          <div>
            <label className="text-slate-500 text-[10px] block mb-1 font-bold">المادة العلمية المفعلة بنظام السنتر:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "mathematics", label: "الرياضيات 📐" },
                { id: "physics", label: "الفيزياء ⚡" },
                { id: "chemistry", label: "الكيمياء 🧪" },
                { id: "science", label: "العلوم 🔬" },
                { id: "science_en", label: "الساينس 🧬" },
                { id: "math", label: "الماث 🧮" },
                { id: "arabic", label: "اللغة العربية 📚" },
                { id: "english", label: "اللغة الانجليزية 🆎" },
                { id: "social_studies", label: "الدراسات 🌍" }
              ].map(subj => {
                const checked = subjectVal === subj.id;
                return (
                  <button
                    type="button"
                    key={subj.id}
                    onClick={() => handleUpdateSubject(subj.id as any)}
                    className={`p-2.5 rounded-xl border font-bold transition text-center text-xs cursor-pointer ${checked ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/50"}`}
                  >
                    {subj.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Teacher Name Input */}
          <form onSubmit={handleUpdateTeacherName} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-850">
            <label className="text-slate-500 text-[10px] block font-bold text-right">اسم المعلم / المدرس (الذي سيظهر على الشاشة الرئيسية والتقارير):</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={teacherNameVal}
                onChange={(e) => setTeacherNameVal(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex-1 font-bold text-right text-slate-900 dark:text-slate-100 focus:outline-none"
                placeholder="أحمد السيد"
              />
              <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition cursor-pointer shrink-0 text-xs">
                حفظ الاسم
              </button>
            </div>
          </form>

          {/* Teacher Verify Credentials Verify Code Pin */}
          <form onSubmit={handleUpdatePin} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-850">
            <label className="text-slate-500 text-[10px] block font-bold text-right">الرمز السري الموحد للمعلم (بيانات المشرف):</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={teacherPinVal}
                onChange={(e) => setTeacherPinVal(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex-1 font-bold text-center text-slate-900 dark:text-slate-100 focus:outline-none"
                placeholder="1234"
              />
              <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition cursor-pointer shrink-0 text-xs">
                حفظ الرمز
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* SECTION 2: Secretary Management */}
      <div className="bg-white dark:bg-slate-900 p-5 border border-slate-150 dark:border-slate-800 rounded-3xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <RefreshCw className="w-4.5 h-4.5 text-blue-600" />
            <span>إدارة حسابات السكرتارية والمشرفين</span>
          </h3>
          {isTrueAdmin ? (
            <button 
              onClick={() => setIsAddingSec(!isAddingSec)}
              className="text-2xs font-extrabold text-blue-600 hover:underline cursor-pointer"
            >
              {isAddingSec ? "إلغاء الإضافة" : "أضف حساب +"}
            </button>
          ) : (
            <span className="text-[10px] text-amber-650 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/10">
              خاص بالمدير 🔒
            </span>
          )}
        </div>

        {/* Add Sec Form Inline */}
        {isAddingSec && (
          <form onSubmit={handleAddSecretarySubmit} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1 font-bold">اسم السكرتيرة: *</label>
                <input 
                  type="text" 
                  value={secName} 
                  onChange={(e) => setSecName(e.target.value)}
                  placeholder="آية محمد"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl p-2 font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  required 
                />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1 font-bold">الرمز السري الخاص (PIN): *</label>
                <input 
                  type="text" 
                  value={secPin} 
                  onChange={(e) => setSecPin(e.target.value)}
                  placeholder="0000"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl p-2 font-bold text-center text-slate-800 dark:text-slate-100 focus:outline-none"
                  required 
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-605 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 font-extrabold transition cursor-pointer">
              تسجيل حساب السكرتارية فورياً بالمركز
            </button>
          </form>
        )}

        {/* ACCESS SCHEDULING LOCKS PANEL */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-3 text-right">
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 justify-end">
            <span>جدولة قفل الدخول التلقائي للسكرتارية</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            يسمح هذا النظام بقفل المنصة على حسابات السكرتارية تلقائياً خارج أوقات العمل لتحديد وتفادي العبث. عند التفعيل، سيتم تسجيل خروج الحسابات وتأمينها تلقائياً، باستثناء المشرفات اللواتي تم منحهن خيار الولوج الدائم.
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-900">
            <label className={`relative inline-flex items-center select-none ${isTrueAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
              <input 
                type="checkbox" 
                checked={lockEnabledVal} 
                disabled={!isTrueAdmin}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setLockEnabledVal(checked);
                  store.setLockAccessSettings(checked, lockStartVal, lockEndVal);
                  setSuccessMsg("تم تحديث حالة القفل التلقائي للسكرتارية");
                  setTimeout(() => setSuccessMsg(""), 2000);
                }} 
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
            <div className="text-right">
              <span className="text-2xs font-extrabold text-slate-855 dark:text-slate-200 block">تفعيل نظام الحظر التلقائي اليومي</span>
              <span className="text-[9px] text-slate-405 font-bold block mt-0.5">عند تعطيله، يتاح لجميع السكرتارية الدخول في أي وقت</span>
            </div>
          </div>

          {lockEnabledVal && (
            <div className={`grid grid-cols-2 gap-3 pt-2 ${!isTrueAdmin ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="space-y-1 text-right">
                <label className="text-[10px] font-bold text-slate-400 block">بدء الحظر اليومي (مساءً - افتراضي 19:00):</label>
                <input 
                  type="time" 
                  value={lockStartVal}
                  disabled={!isTrueAdmin}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLockStartVal(val);
                    store.setLockAccessSettings(lockEnabledVal, val, lockEndVal);
                  }}
                  className="w-full text-xs p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold font-sans text-center text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>
              <div className="space-y-1 text-right">
                <label className="text-[10px] font-bold text-slate-400 block">انتهاء الحظر وفتح النظام (صباحاً - افتراضي 07:00):</label>
                <input 
                  type="time" 
                  value={lockEndVal}
                  disabled={!isTrueAdmin}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLockEndVal(val);
                    store.setLockAccessSettings(lockEnabledVal, lockStartVal, val);
                  }}
                  className="w-full text-xs p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold font-sans text-center text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Secretaries List */}
        <div className="space-y-2.5">
          <div className="text-right">
            <span className="text-[11px] font-black text-slate-500 block">الحسابات الحالية وصلاحياتها:</span>
          </div>
          {state.secretaries.length === 0 ? (
            <div className="text-center py-4 text-slate-405 dark:text-slate-500 font-bold">لا يتوفر حسابات سكرتارية حالياً</div>
          ) : (
            state.secretaries.map(sec => (
              <div key={sec.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-805 dark:border-slate-800 rounded-xl">
                <div className="text-right">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block text-xs">{sec.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5 font-sans">الرمز: {sec.pin} | الحالة: {sec.active ? "نشط" : "معطل"}</span>
                  
                  {/* Status tags */}
                  <div className="flex gap-1.5 mt-2 flex-wrap justify-end">
                    {sec.fullAccess ? (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">مسؤول كامل الصلاحيات</span>
                    ) : (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-150 text-slate-600 dark:bg-slate-900 dark:text-slate-400">مساعد عادي</span>
                    )}

                    {sec.exemptFromLock ? (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">مستثنى (دخول دائم) 🔓</span>
                    ) : (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">يخضع لقفل التوقيت 🔒</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 self-end md:self-auto">
                  <button 
                    disabled={!isTrueAdmin}
                    onClick={() => store.toggleSecretaryFullAccess(sec.id)}
                    className={`p-1 px-2 border rounded font-black text-[10px] transition ${
                      !isTrueAdmin
                        ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                        : sec.fullAccess 
                          ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer'
                    }`}
                  >
                    صلاحية كاملة {sec.fullAccess ? "✓" : ""}
                  </button>
                  <button 
                    disabled={!isTrueAdmin}
                    onClick={() => store.toggleSecretaryExemptFromLock(sec.id)}
                    className={`p-1 px-2 border rounded font-black text-[10px] transition ${
                      !isTrueAdmin
                        ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                        : sec.exemptFromLock 
                          ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 cursor-pointer' 
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer'
                    }`}
                  >
                    دخول دائم {sec.exemptFromLock ? "✓" : ""}
                  </button>
                  <button 
                    disabled={!isTrueAdmin}
                    onClick={() => store.toggleSecretaryStatus(sec.id)}
                    className={`p-1 px-2 border rounded font-semibold text-[10px] transition ${
                      !isTrueAdmin
                        ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                    }`}
                  >
                    تغيير الحالة
                  </button>
                  <button 
                    disabled={!isTrueAdmin}
                    onClick={() => {
                      if (window.confirm(`هل ترغب فعلاً في حذف سجل "${sec.name}"؟`)) {
                        store.deleteSecretary(sec.id);
                      }
                    }}
                    className={`p-1 px-1.5 border rounded transition font-bold text-[10px] ${
                      !isTrueAdmin
                        ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                        : 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 border-red-100 dark:border-red-900/40 cursor-pointer'
                    }`}
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 3: Backups & Restorations */}
      <div className="bg-white dark:bg-slate-900 p-5 border border-slate-150 dark:border-slate-800 rounded-3xl space-y-4" id="backup_restoration_section">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
          <Key className="w-4.5 h-4.5 text-blue-600" />
          <span>النسخ الاحتياطي وحفظ الملفات</span>
        </h3>

        <div className="grid grid-cols-2 gap-3.5">
          {/* Backup */}
          <button 
            onClick={handleExportBackup}
            className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 transition h-24 text-center cursor-pointer"
          >
            <span className="text-xs font-black text-slate-850 dark:text-slate-200 block">تحميل نسخة احتياطية</span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-1">تنزيل ملف بصيغة JSON</span>
          </button>

          {/* Restore */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 transition h-24 text-center relative cursor-pointer">
            <span className="text-xs font-black text-slate-850 dark:text-slate-200 block">استرجاع سجلات السنتر</span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-1">رفع النسخة الاحتياطية</span>
            <input 
              type="file" 
              accept=".json"
              onChange={handleImportBackupFile}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* SECTION Full System Data Export & Backup (NEW FEATURE) */}
      <div className="bg-white dark:bg-slate-900 p-5 border border-slate-150 dark:border-slate-800 rounded-3xl space-y-4 shadow-3xs" id="full_system_export_section">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
          <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
          <span>تصدير كافة بيانات وسجلات النظام والنسخ الاحتياطي الشامل 📦</span>
        </h3>

        <p className="text-3xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
          يمكنك الآن استخراج وتصدير جميع السجلات المقيدة بالنظام (الطلاب، المجموعات، درجات التسميعات والامتحانات التفصيلية، الحضور، المدفوعات، وسجل العمليات) بأكثر من صيغة للحفظ أو النقل:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Option 1: Excel (.xlsx) */}
          <button
            type="button"
            onClick={handleExportFullExcel}
            className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400 rounded-2xl text-right space-y-2 cursor-pointer transition active:scale-95 group shadow-2xs"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">تصدير كـ ملف Excel شامل (.xlsx)</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mt-0.5">
                كراسة عمل بها 8 تبويبات تفصيلية لكل سجلات الطلاب والمجموعات والدرجات والمدفوعات
              </span>
            </div>
          </button>

          {/* Option 2: JSON Backup (.json) */}
          <button
            type="button"
            onClick={handleExportFullJSON}
            className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/60 hover:border-blue-400 rounded-2xl text-right space-y-2 cursor-pointer transition active:scale-95 group shadow-2xs"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">نسخة احتياطية كاملة (.json)</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mt-0.5">
                ملف بيانات مهيكل وشامل لكل السيستم مجهز لاستعادة النظام أو النقل فوراً
              </span>
            </div>
          </button>

          {/* Option 3: CSV (.csv) */}
          <button
            type="button"
            onClick={handleExportFullCSV}
            className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/60 hover:border-amber-400 rounded-2xl text-right space-y-2 cursor-pointer transition active:scale-95 group shadow-2xs"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">تصدير كـ ملفات جدولية (.csv)</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mt-0.5">
                ملف جدول منظم مع تشفير UTF-8 لفتح اللغة العربية بسلاسة في برنامج إكسيل
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* SECTION Excel/CSV Import & Export (NEW FEATURE) */}
      <div className="bg-white dark:bg-slate-900 p-5 border border-slate-150 dark:border-slate-800 rounded-3xl space-y-5" id="csv_excel_section">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
          <FileSpreadsheet className="w-4.5 h-4.5 text-blue-600" />
          <span>استيراد وتصدير بيانات الطلاب (Excel / CSV)</span>
        </h3>

        <div className="space-y-4">
          {/* Sub-section: Export */}
          <div className="p-4 bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3 font-sans">
            <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-2xs">📥 تصدير كشوف الطلاب الحالية:</h4>
            
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <select
                  value={exportGroupId}
                  onChange={(e) => setExportGroupId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-bold text-slate-755 dark:text-slate-200"
                >
                  <option value="all">تصدير كل المجموعات</option>
                  {state.groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleExportCSV(exportGroupId)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <FileDown className="w-4 h-4" />
                <span>تصدير ملف Excel</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">يقوم بتوليد ملف Excel (.xlsx) متكامل ومنظم باللغة العربية متوافق تماماً مع جميع الأجهزة والبرامج.</p>
          </div>

          {/* Sub-section: Import */}
          <div className="p-4 bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-slate-850 dark:text-slate-200 text-2xs">📤 استيراد طلاب جدد من ملف Excel / CSV:</h4>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-2xs font-extrabold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>تحميل قالب Excel الفارغ لمعدلات الطلاب</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Select target group for imported students */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1 font-bold">1. حدد المجموعة المستهدفة للطلاب:</label>
                <select
                  value={importGroupId}
                  onChange={(e) => setImportGroupId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="">اختار صف ومجموعة...</option>
                  {state.groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Upload file button overlay */}
              <div>
                <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1 font-bold">2. اختر ملف Excel أو CSV المعبأ بالقالب:</label>
                <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-2.5 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-850 transition cursor-pointer">
                  <FileUp className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-3xs">رفع كشف طلاب (Excel / CSV)</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleCSVImportUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Parsed list preview and final import submit */}
            {parsedStudents.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-3.5 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-200">
                    📋 الطلاب المكتشفون بالملف ({parsedStudents.length} طلاب):
                  </span>
                  <button
                    type="button"
                    onClick={() => setParsedStudents([])}
                    className="text-red-500 hover:underline text-[10px] font-bold cursor-pointer"
                  >
                    إلغاء وتفريغ
                  </button>
                </div>

                <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                  {parsedStudents.map((pst, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-lg text-[10px]">
                      <span className="font-extrabold text-slate-700 dark:text-slate-200">{pst.name}</span>
                      <span className="font-mono text-slate-400 dark:text-slate-500">ولى الأمر: {pst.parentPhone || "غير مسجل"}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-3xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>تأكيد استيراد ونقل {parsedStudents.length} طلاب للمجموعة المحددة فوراً 🚀</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION Manual WhatsApp/Report Configuration Reassurance (NEW FEATURE) */}
      <div className="bg-white dark:bg-slate-900 p-5 border border-slate-150 dark:border-slate-800 rounded-3xl space-y-4" id="reporting_settings_section">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
          <AlertCircle className="w-4.5 h-4.5 text-blue-600" />
          <span>إعدادات وضبط تقارير أولياء الأمور</span>
        </h3>

        <div className="p-4 bg-blue-50/45 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-ping" />
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">حالة إرسال كشوف الغياب والدرجات:</h4>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-blue-50 dark:border-blue-900/50 p-3.5 rounded-xl flex items-start gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg text-slate-500 dark:text-slate-400 font-mono text-center font-bold">
              🔕 يدوي
            </div>
            <div>
              <p className="font-extrabold text-slate-905 dark:text-slate-100 text-3xs leading-relaxed">
                النظام مثبت حالياً على خيار <span className="text-blue-600 dark:text-blue-450">«الإرسال اليدوي التام بناءً على رغبة المعلم»</span>.
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1 leading-relaxed">
                لن يتم إرسال أي إشعار أو رسالة واتساب أو نتيجة لأولياء الأمور بصورة تلقائية لمنع تشتتهم. يمكنك التوجيه والتحكم اليدوي بنسبة 100% وإصدار التقرير أو توجيه رسالة WhatsApp وقتما تشاء ومن تختاره فقط من خلال قسم <span className="underline">«التقارير»</span> أو صفحة كارت الطالب الشخصية.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION Smart WhatsApp Templates (NEW FEATURE) */}
      <div className="bg-white dark:bg-slate-900 p-5 border border-slate-150 dark:border-slate-800 rounded-3xl space-y-4 shadow-3xs" id="whatsapp_templates_section">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
          <MessageSquare className="w-4.5 h-4.5 text-blue-600" />
          <span>قوالب رسائل واتساب الذكية مسبقة الإعداد</span>
        </h3>

        <p className="text-3xs text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
          يمكنك تخصيص وتعديل قوالب الرسائل المرسلة لأولياء الأمور. استخدم المتغيرات التالية بنسخها ولصقها داخل نص الرسالة أو بالنقر عليها ليتم استبدالها تلقائياً عند الإرسال ببيانات الطالب الفعلية:
        </p>

        {/* Shortcodes Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-3 px-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-850 text-right">
          <div className="p-1 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-200 rounded-lg text-[9px] font-mono font-bold flex justify-between">
            <span className="text-slate-400 dark:text-slate-500">اسم الطالب</span>
            <span className="text-blue-600 font-extrabold">[اسم_الطالب]</span>
          </div>
          <div className="p-1 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-200 rounded-lg text-[9px] font-mono font-bold flex justify-between">
            <span className="text-slate-400 dark:text-slate-500">المجموعة</span>
            <span className="text-indigo-600 font-extrabold">[المجموعة]</span>
          </div>
          <div className="p-1 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-200 rounded-lg text-[9px] font-mono font-bold flex justify-between">
            <span className="text-slate-400 dark:text-slate-500">الدرجات والامتحان</span>
            <span className="text-purple-600 font-extrabold">[الدرجة]</span>
          </div>
          <div className="p-1 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-200 rounded-lg text-[9px] font-mono font-bold flex justify-between">
            <span className="text-slate-400 dark:text-slate-500">نسبة الالتزام</span>
            <span className="text-emerald-600 font-extrabold">[الحالة]</span>
          </div>
          <div className="p-1 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-200 rounded-lg text-[9px] font-mono font-bold flex justify-between">
            <span className="text-slate-400 dark:text-slate-500">عدد الحضور</span>
            <span className="text-sky-600 font-extrabold">[حضر]</span>
          </div>
          <div className="p-1 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-200 rounded-lg text-[9px] font-mono font-bold flex justify-between">
            <span className="text-slate-400 dark:text-slate-500">عدد الغياب</span>
            <span className="text-rose-600 font-extrabold">[غاب]</span>
          </div>
          <div className="p-1 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-200 rounded-lg text-[9px] font-mono font-bold flex justify-between">
            <span className="text-slate-400 dark:text-slate-500">المادة الدراسية</span>
            <span className="text-amber-600 font-extrabold">[المادة]</span>
          </div>
        </div>

        {/* Templates loops */}
        <div className="space-y-4">
          {(state.whatsappTemplates || []).map((tpl) => (
            <TemplateEditorCard 
              key={tpl.id} 
              template={tpl} 
              onSave={(text) => {
                store.updateWhatsAppTemplate(tpl.id, text);
                setSuccessMsg(`تم تعديل وحفظ قالب "${tpl.name}" بنجاح!`);
                setTimeout(() => setSuccessMsg(""), 2000);
              }} 
            />
          ))}
        </div>

        <div className="pt-2 text-left">
          <button
            type="button"
            onClick={() => {
              store.resetWhatsAppTemplates();
              setSuccessMsg("تمت استعادة قوالب الرسائل الافتراضية بنجاح!");
              setTimeout(() => setSuccessMsg(""), 3000);
            }}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 rounded-xl text-3xs font-black transition flex items-center gap-1.5 cursor-pointer border border-transparent dark:border-slate-700"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>استعادة القوالب الافتراضية للسنتر</span>
          </button>
        </div>
      </div>

      {/* SECTION 4: Academic Year Reset */}
      <div className="bg-white dark:bg-slate-900 p-5 border border-slate-150 dark:border-slate-800 rounded-3xl space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-150 border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center gap-2 text-red-650">
          <Info className="w-4.5 h-4.5 text-red-600" />
          <span>تفريغ مح كشوف السنة الدراسية</span>
        </h3>

        <form onSubmit={handleResetYearSubmit} className="space-y-3">
          <div>
            <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1 font-bold">اسم الأرشيف المالي للسنة الحالية:</label>
            <input 
              type="text" 
              value={archiveYearName}
              onChange={(e) => setArchiveYearName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-850 dark:text-slate-200 focus:outline-none"
              required 
            />
          </div>

          <div>
            <label className="text-slate-500 dark:text-slate-400 text-[10px] block mb-1 font-bold">مصير وسيرة الطلاب الحاليين:</label>
            <select 
              value={studentAction}
              onChange={(e) => setStudentAction(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-850 dark:text-slate-350 focus:outline-none"
            >
              <option value="keep">إبقاؤهم جميعا نشطين بالمجموعات</option>
              <option value="archive_all">نقل جميع الطلاب إلى كشف الأرشيف</option>
              <option value="delete">حذف جميع سجلات الطلاب نهائياً</option>
            </select>
          </div>

          <button type="submit" className="w-full py-3.5 bg-red-650 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black transition cursor-pointer">
            تنفيذ تصفير دورة العام الدراسي فورا
          </button>
        </form>
      </div>

      {/* Restore Confirmation Modal */}
      <AnimatePresence>
        {showRestoreConfirmModal && restoreParsedData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRestoreConfirmModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-[3px]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative w-full max-w-md space-y-4 z-10 text-right"
              dir="rtl"
            >
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" /> معاينة وتأكيد استرجاع سجلات النظام
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRestoreConfirmModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Warning Alert */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  ⚠️ تنبيه هام: سيتم استرجاع البيانات المكتشفة بالملف واستبدال كافة كشوف السنتر بالحالة المسجلة فيها وتحديث قاعدة البيانات السحابية فوراً.
                </span>
              </div>

              {/* File Content Preview Metrics Grid */}
              <div className="space-y-2">
                <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 block">
                  📋 البيانات المكتشفة داخل ملف النسخة الاحتياطية:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">الطلاب:</span>
                    <span className="text-blue-600 font-extrabold font-mono text-sm">
                      {Array.isArray(restoreParsedData.students) ? restoreParsedData.students.length : 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">المجموعات:</span>
                    <span className="text-indigo-600 font-extrabold font-mono text-sm">
                      {Array.isArray(restoreParsedData.groups) ? restoreParsedData.groups.length : 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">التسميعات:</span>
                    <span className="text-purple-600 font-extrabold font-mono text-sm">
                      {Array.isArray(restoreParsedData.recitations) ? restoreParsedData.recitations.length : 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">الامتحانات:</span>
                    <span className="text-emerald-600 font-extrabold font-mono text-sm">
                      {Array.isArray(restoreParsedData.exams) ? restoreParsedData.exams.length : 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition text-white text-xs font-black rounded-xl cursor-pointer shadow-md flex items-center justify-center gap-2 select-none disabled:opacity-50"
                >
                  {isRestoring ? "جاري الاسترجاع والمزامنة..." : "تأكيد استرجاع بيانات السيستم فورا 🚀"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRestoreConfirmModal(false)}
                  className="py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Sub-component for editing individual WhatsApp template cards
interface TemplateEditorProps {
  template: {
    id: string;
    name: string;
    text: string;
  };
  onSave: (text: string) => void;
}

function TemplateEditorCard({ template, onSave }: TemplateEditorProps) {
  const [text, setText] = useState(template.text);
  const [isSaved, setIsSaved] = useState(true);
  const [lastPropText, setLastPropText] = useState(template.text);

  // Sync state if store updates (e.g. on reset)
  if (template.text !== lastPropText) {
    setLastPropText(template.text);
    setText(template.text);
    setIsSaved(true);
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setIsSaved(false);
  };

  const insertShortcode = (code: string) => {
    setText((prev) => prev + " " + code);
    setIsSaved(false);
  };

  const handleSave = () => {
    onSave(text);
    setIsSaved(true);
  };

  return (
    <div className="p-4 border border-slate-150 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 space-y-3 text-right">
      <div className="flex justify-between items-center pb-1">
        <span className="text-2xs font-extrabold text-slate-850 dark:text-slate-200">{template.name}</span>
        {isSaved ? (
          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/35 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">حالة: محفوظ</span>
        ) : (
          <span className="text-[10px] bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 rounded-full font-bold">غير محفوظ *</span>
        )}
      </div>

      <textarea
        rows={5}
        value={text}
        onChange={handleTextChange}
        className="w-full p-3 text-2xs font-medium text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-400 placeholder-slate-350 leading-relaxed text-right font-sans"
        dir="rtl"
      />

      <div className="flex flex-wrap gap-1 items-center bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-extrabold ml-1.5 shrink-0">إدراج ذكي:</span>
        {["[اسم_الطالب]", "[المجموعة]", "[الدرجة]", "[الحالة]", "[المادة]", "[حضر]", "[غاب]"].map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => insertShortcode(code)}
            className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-105 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-300 text-[9px] rounded-md font-mono cursor-pointer hover:text-slate-900 transition flex items-center justify-center active:scale-95"
          >
            {code}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaved}
        className={`w-full py-2.5 rounded-xl text-3xs font-extrabold transition flex items-center justify-center gap-1.5 ${
          isSaved 
            ? "bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-850 cursor-not-allowed" 
            : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/10 cursor-pointer active:scale-98"
        }`}
      >
        <Check className="w-3.5 h-3.5 font-bold" />
        <span>تحديث وحفظ نص قالب الرسالة</span>
      </button>
    </div>
  );
}
