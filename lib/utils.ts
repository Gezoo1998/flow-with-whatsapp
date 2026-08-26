import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { 
  Student, 
  Group, 
  AttendanceRecord, 
  ExamRecord, 
  RecitationRecord, 
  PaymentRecord 
} from "./store"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Trigger file download in browser with correct character encoding and type
 */
export function downloadFile(content: string, filename: string, contentType: string) {
  if (typeof window === "undefined") return;
  
  const isCSV = contentType.includes("csv");
  let blob: Blob;
  
  if (isCSV) {
    // UTF-8 BOM so Excel opens Arabic correctly
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    blob = new Blob([bom, content], { type: contentType });
  } else {
    blob = new Blob([content], { type: contentType });
  }
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export services for student attendance, grades, groups, and center reports.
 */
export const ExportService = {
  /**
   * Generates a single student performance report sheet (CSV) containing attendance and exams.
   */
  exportSingleStudentCSV(
    student: Student,
    group: Group | undefined,
    attendance: AttendanceRecord[],
    exams: ExamRecord[],
    recitations: RecitationRecord[]
  ) {
    let csv = "تقرير الكفاءة الفردي والتحصيل للـطـالــب\n";
    csv += `اسم الطالب,${student.name}\n`;
    csv += `الكود الرقمي,${student.id}\n`;
    csv += `المجموعة,${group?.name || "بلا مجموعة"}\n`;
    csv += `تاريخ الاستخراج,${new Date().toISOString().split("T")[0]}\n\n`;
    
    csv += "نوع الحصة/التقييم,تاريخ الحصة,الموضوع / العنوان,الدرجة أو الحالة المرصودة,الدرجة القصوى,النسبة المئوية\n";
    
    // Attendance records
    const grAtts = attendance.filter(a => a.groupId === student.groupId);
    grAtts.forEach(att => {
      const isPresent = att.presentStudentIds.includes(student.id);
      const isAbsent = att.absentStudentIds.includes(student.id);
      if (isPresent || isAbsent) {
        csv += `حصة حضور/غياب,${att.date},حضور وغياب الحصة اليومي,${isPresent ? "حاضر (✔️)" : "غائب (❌)"},-,-\n`;
      }
    });
    
    // Exams
    const stExams = exams.filter(ex => ex.scores[student.id] !== undefined);
    stExams.forEach(ex => {
      const score = ex.scores[student.id];
      const pct = ex.maxScore > 0 ? Number(((score / ex.maxScore) * 100).toFixed(1)) : 0;
      csv += `امتحان تحريري,${ex.date},${ex.title.replace(/,/g, " ")},${score},${ex.maxScore},${pct}%\n`;
    });
    
    // Recitations
    const stRecs = recitations.filter(r => r.scores[student.id] !== undefined);
    stRecs.forEach(r => {
      const score = r.scores[student.id];
      const pct = r.maxScore > 0 ? Number(((score / r.maxScore) * 100).toFixed(1)) : 0;
      csv += `تسميع شفوي,${r.date},${r.title.replace(/,/g, " ")},${score},${r.maxScore},${pct}%\n`;
    });
    
    const filename = `سجل_الطالب_${student.name.replace(/\s+/g, "_")}.csv`;
    downloadFile(csv, filename, "text/csv;charset=utf-8;");
  },

  /**
   * Generates single student comprehensive profile dashboard data (JSON)
   */
  exportSingleStudentJSON(
    student: Student,
    group: Group | undefined,
    attendance: AttendanceRecord[],
    exams: ExamRecord[],
    recitations: RecitationRecord[]
  ) {
    const studentGrAtts = attendance.filter(a => a.groupId === student.groupId);
    const attendanceLogs = studentGrAtts.map(a => ({
      date: a.date,
      status: a.presentStudentIds.includes(student.id) ? "present" : (a.absentStudentIds.includes(student.id) ? "absent" : "none")
    })).filter(a => a.status !== "none");
    
    const examsLogs = exams.filter(ex => ex.scores[student.id] !== undefined).map(ex => ({
      id: ex.id,
      title: ex.title,
      date: ex.date,
      score: ex.scores[student.id],
      maxScore: ex.maxScore
    }));
    
    const recitationLogs = recitations.filter(r => r.scores[student.id] !== undefined).map(r => ({
      id: r.id,
      title: r.title,
      date: r.date,
      score: r.scores[student.id],
      maxScore: r.maxScore
    }));
    
    const report = {
      student,
      group,
      attendance: attendanceLogs,
      exams: examsLogs,
      recitations: recitationLogs,
      backupTimestamp: new Date().toISOString()
    };
    
    const filename = `تقرير_أكاديمي_${student.name.replace(/\s+/g, "_")}.json`;
    downloadFile(JSON.stringify(report, null, 2), filename, "application/json");
  },

  /**
   * Export multiple student performance logs and statistics (CSV)
   */
  exportGroupPerformanceCSV(
    groupName: string,
    studentsInGroup: Student[],
    groups: Group[],
    attendance: AttendanceRecord[],
    exams: ExamRecord[],
    recitations: RecitationRecord[]
  ) {
    let csv = "سجل التقييم والتحصيل الأكاديمي والالتزام الشامل\n";
    csv += `التصنيف / المجموعة,${groupName}\n`;
    csv += `تاريخ التصدير,${new Date().toISOString().split("T")[0]}\n\n`;
    
    csv += "كود الطالب,اسم الطالب,المجموعة المنتسب إليها,الحالة الدراسية,الاشتراك المالي المحدد,نسبة الحضور %,الحصص الحاضرة,الحصص الغائبة,متوسط درجات الامتحانات %,متوسط التسميع الشفوي %\n";
    
    studentsInGroup.forEach(st => {
      const studentGroup = groups.find(g => g.id === st.groupId);
      
      // Attendance rates
      const grAtts = attendance.filter(a => a.groupId === st.groupId);
      const present = grAtts.filter(a => a.presentStudentIds.includes(st.id)).length;
      const absent = grAtts.filter(a => a.absentStudentIds.includes(st.id)).length;
      const totalSess = present + absent;
      const attendanceRate = totalSess > 0 ? Math.round((present / totalSess) * 100) : 100;

      // Exam averages
      const stExams = exams.filter(ex => ex.scores[st.id] !== undefined);
      const examsAvg = stExams.length > 0 
        ? Math.round(stExams.reduce((acc, curr) => acc + (curr.scores[st.id] / curr.maxScore), 0) / stExams.length * 100)
        : 0;

      // Recitation averages
      const stRecs = recitations.filter(r => r.scores[st.id] !== undefined);
      const recAvg = stRecs.length > 0 
        ? Math.round(stRecs.reduce((acc, curr) => acc + (curr.scores[st.id] / curr.maxScore), 0) / stRecs.length * 100)
        : 0;
        
      const statusTitle = st.status === "active" ? "منتظم / نشط" : "مؤرشف / منقطع";
      const feeVal = st.customFee !== undefined ? st.customFee : (studentGroup?.monthlyFee || 0);
      
      csv += `${st.id},${st.name.replace(/,/g, " ")},${(studentGroup?.name || "بلا مجموعة").replace(/,/g, " ")},${statusTitle},${feeVal},${attendanceRate}%,${present},${absent},${examsAvg}%,${recAvg}%\n`;
    });
    
    const sanitizedGroup = groupName.replace(/\s+/g, "_");
    const filename = `شيت_تحصيل_${sanitizedGroup}.csv`;
    downloadFile(csv, filename, "text/csv;charset=utf-8;");
  },

  /**
   * Export all students and groups matching excel table structure.
   */
  exportStudentsAndGroupsExcel(students: Student[], groups: Group[]) {
    let csv = "جدول رصد وتوزيع مبيعات وقيد الطلاب على المجموعات الدراسية المحددة للسنتر\n";
    csv += `تاريخ استخراج الجدول والبيانات,${new Date().toISOString().split("T")[0]}\n\n`;
    
    csv += "معرف الطالب,اسم الطالب,رقم هاتف الطالب,رقم هاتف ولي الأمر,المجموعة المنتسب إليها,الحالة بالسنتر,الاشتراك الشهري المقرر,تاريخ الالتحاق,مواعيد المجموعة المفصلة\n";
    
    students.forEach(st => {
      const group = groups.find(g => g.id === st.groupId);
      const daysArr = group?.daysOfWeek.map(d => {
        switch (d) {
          case 0: return "الأحد";
          case 1: return "الإثنين";
          case 2: return "الثلاثاء";
          case 3: return "الأربعاء";
          case 4: return "الخميس";
          case 5: return "الجمعة";
          case 6: return "السبت";
          default: return "";
        }
      }) || [];
      
      const scheduleStr = group ? `${daysArr.join(" - ")} (من ${group.startTime} إلى ${group.endTime})` : "غير مخصص";
      const groupName = group?.name || "غير محدد";
      const feeStr = st.customFee !== undefined ? `${st.customFee} ج.م` : (group ? `${group.monthlyFee} ج.م` : "0 ج.م");
      const statusStr = st.status === "active" ? "منتظم / نشط" : "مؤرشف / منقطع";
      
      csv += `${st.id},${st.name.replace(/,/g, " ")},${st.phone || "-"},${st.parentPhone || "-"},${groupName.replace(/,/g, " ")},${statusStr},${feeStr},${st.joinDate},"${scheduleStr}"\n`;
    });
    
    downloadFile(csv, "جدول_بيانات_الطلاب_والمجموعات_الكامل.csv", "text/csv;charset=utf-8;");
  },

  /**
   * Export active groups metadata and details (Excel style CSV)
   */
  exportGroupsSummaryExcel(groups: Group[], students: Student[]) {
    let csv = "ملخص إحصاءات المجموعات الدراسية والاشتراكات المقررة ومواعيد الحصص\n";
    csv += `تاريخ التصدير,${new Date().toISOString().split("T")[0]}\n\n`;
    
    csv += "كود المجموعة,اسم المجموعة,الاشتراك الشهري الأساسي,أيام الدراسة الأسبوعية,وقت بدء المحاضرة,وقت الانتهاء,الطلاب المقيدين في الفصل\n";
    
    groups.forEach(g => {
      const studentCount = students.filter(s => s.groupId === g.id && s.status === "active").length;
      const daysArr = g.daysOfWeek.map(d => {
        switch (d) {
          case 0: return "الأحد";
          case 1: return "الإثنين";
          case 2: return "الثلاثاء";
          case 3: return "الأربعاء";
          case 4: return "الخميس";
          case 5: return "الجمعة";
          case 6: return "السبت";
          default: return "";
        }
      });
      
      csv += `${g.id},${g.name.replace(/,/g, " ")},${g.monthlyFee},"${daysArr.join(" - ")}",${g.startTime},${g.endTime},${studentCount}\n`;
    });
    
    downloadFile(csv, "دليل_مواعيد_مجموعات_السنتر_التعليمية.csv", "text/csv;charset=utf-8;");
  },

  /**
   * Generates systematic full system JSON payload backup.
   */
  exportFullBackupJSON(
    students: Student[],
    groups: Group[],
    attendance: AttendanceRecord[],
    exams: ExamRecord[],
    recitations: RecitationRecord[],
    payments: PaymentRecord[]
  ) {
    const backup = {
      students,
      groups,
      attendance,
      exams,
      recitations,
      payments,
      backupTimestamp: new Date().toISOString(),
      system: "TeacherCenterPro",
      version: "1.0.0"
    };
    
    const filename = `نسخة_احتياطية_كاملة_السنتر_${new Date().toISOString().split("T")[0]}.json`;
    downloadFile(JSON.stringify(backup, null, 2), filename, "application/json");
  },

  /**
   * Generates a detailed attendance report matrix (CSV) for all students and all recorded dates.
   */
  exportAttendanceDetailedCSV(
    students: Student[],
    groups: Group[],
    attendance: AttendanceRecord[]
  ) {
    let csv = "سجل الحضور والغياب التفصيلي الشامل لكافة الطلاب والمجموعات\n";
    csv += `تاريخ الاستخراج,${new Date().toISOString().split("T")[0]}\n\n`;

    // Extract all unique dates where attendance was taken, sorted chronological
    const uniqueDates = Array.from(new Set(attendance.map(a => a.date))).sort();

    // CSV Header Columns
    csv += "كود الطالب,اسم الطالب,المجموعة الدراسية,حالة القيد," + uniqueDates.map(d => `تاريخ ${d}`).join(",") + "\n";

    students.forEach(st => {
      const group = groups.find(g => g.id === st.groupId);
      const groupName = group?.name || "بلا مجموعة";
      const statusStr = st.status === "active" ? "منتظم" : "مؤرشف";

      const dailyStatuses = uniqueDates.map(date => {
        // Find attendance record for this student's group on this date
        const rec = attendance.find(a => a.groupId === st.groupId && a.date === date);
        if (!rec) {
          return "-";
        }
        
        // Check if student was marked
        const isPresent = rec.presentStudentIds.includes(st.id);
        const isAbsent = rec.absentStudentIds.includes(st.id);
        const isLate = rec.lateStudentIds?.includes(st.id);

        if (isLate) return "متأخر ⏰";
        if (isPresent) return "حاضر ✔️";
        if (isAbsent) return "غائب ❌";
        return "غير مسجل";
      });

      csv += `${st.id},${st.name.replace(/,/g, " ")},${groupName.replace(/,/g, " ")},${statusStr},${dailyStatuses.join(",")}\n`;
    });

    const filename = `تقرير_الحضور_التفصيلي_الشامل_${new Date().toISOString().split("T")[0]}.csv`;
    downloadFile(csv, filename, "text/csv;charset=utf-8;");
  },

  /**
   * Generates a detailed exams grades report matrix (CSV) for all students across all exams.
   */
  exportExamsDetailedCSV(
    students: Student[],
    groups: Group[],
    exams: ExamRecord[]
  ) {
    let csv = "سجل درجات الاختبارات التحريرية التفصيلي الشامل\n";
    csv += `تاريخ الاستخراج,${new Date().toISOString().split("T")[0]}\n\n`;

    // Sort exams by date
    const sortedExams = [...exams].sort((a, b) => a.date.localeCompare(b.date));

    // CSV Header Columns
    csv += "كود الطالب,اسم الطالب,المجموعة الدراسية,حالة القيد," + sortedExams.map(ex => `${ex.title.replace(/,/g, " ")} (من ${ex.maxScore})`).join(",") + "\n";

    students.forEach(st => {
      const group = groups.find(g => g.id === st.groupId);
      const groupName = group?.name || "بلا مجموعة";
      const statusStr = st.status === "active" ? "منتظم" : "مؤرشف";

      const examMarks = sortedExams.map(ex => {
        const score = ex.scores[st.id];
        if (score !== undefined) {
          return `${score}`;
        }
        // If not tested, check if the exam targeted their group
        const isTargeted = ex.targetGroupIds.includes(st.groupId || "");
        return isTargeted ? "لم يحضر الاختبار" : "-";
      });

      csv += `${st.id},${st.name.replace(/,/g, " ")},${groupName.replace(/,/g, " ")},${statusStr},${examMarks.join(",")}\n`;
    });

    const filename = `تقرير_الامتحانات_التفصيلي_الشامل_${new Date().toISOString().split("T")[0]}.csv`;
    downloadFile(csv, filename, "text/csv;charset=utf-8;");
  }
}
