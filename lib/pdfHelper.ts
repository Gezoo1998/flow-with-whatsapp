import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Student, Group, ExamRecord, RecitationRecord, StudentNote, store } from "./store";

export async function downloadStudentPDFReport(
  student: Student,
  group: Group | undefined,
  attendanceRate: number,
  totalAttendedCount: number,
  totalAbsentCount: number,
  totalSessions: number,
  performanceLabel: string,
  examsWithScores: ExamRecord[],
  recitationsWithScores: RecitationRecord[],
  notes: StudentNote[],
  subject: string,
  academicYear: string,
  reportType: "all" | "exams" | "recitations" = "all"
) {
  // 1. Map Subject name from general string to Arabic
  const subjectArabic =
    subject === "mathematics"
      ? "الرياضيات 📐"
      : subject === "physics"
      ? "الفيزياء ⚡"
      : subject === "chemistry"
      ? "الكيمياء 🧪"
      : subject === "science"
      ? "العلوم 🔬"
      : subject === "science_en"
      ? "الساينس 🧬"
      : subject === "math"
      ? "الماث 🧮"
      : subject === "arabic"
      ? "اللغة العربية 📚"
      : subject === "english"
      ? "اللغة الانجليزية 🆎"
      : subject === "social_studies"
      ? "الدراسات 🌍"
      : "المادة العلمية";

  // 2. Calculations
  const calcExamAvg =
    examsWithScores.length > 0
      ? Math.round(
          (examsWithScores.reduce(
            (acc, curr) => acc + (curr.scores[student.id] || 0) / (curr.maxScore || 1),
            0
          ) /
            examsWithScores.length) *
            100
        )
      : 0;

  const calcRecitationAvg =
    recitationsWithScores.length > 0
      ? Math.round(
          (recitationsWithScores.reduce(
            (acc, curr) => acc + (curr.scores[student.id] || 0) / (curr.maxScore || 1),
            0
          ) /
            recitationsWithScores.length) *
            100
        )
      : 0;

  // 3. Render table records inside HTML safely
  const examsRows =
    examsWithScores.length === 0
      ? `<tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8; font-size: 11.5px; font-weight: bold; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">
            لا توجد امتحانات تحريرية مسجلة للطالب خلال الفترة المحددة.
          </td>
        </tr>`
      : examsWithScores
          .slice(0, 5)
          .map((ex, idx) => {
            const score = ex.scores[student.id] ?? 0;
            const pct = ex.maxScore > 0 ? Math.round((score / ex.maxScore) * 100) : 0;
            const pctColor = pct >= 90 ? "#0d9488" : pct >= 75 ? "#1e40af" : pct >= 50 ? "#d97706" : "#e11d48";
            return `
              <tr style="background-color: ${idx % 2 === 0 ? "#f8fafc" : "#ffffff"}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-size: 10px; color: #64748b; font-family: monospace; font-weight: bold; text-align: right; letter-spacing: normal !important;">${ex.date}</td>
                <td style="padding: 10px 12px; font-size: 11.5px; font-weight: bold; color: #0f172a; text-align: right; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important; letter-spacing: normal !important; text-transform: none !important;">${ex.title}</td>
                <td style="padding: 10px 12px; font-size: 11.5px; font-weight: 800; color: #0f172a; text-align: center; font-family: monospace;">${score}</td>
                <td style="padding: 10px 12px; font-size: 11px; color: #64748b; text-align: center; font-family: monospace;">${ex.maxScore}</td>
                <td style="padding: 10px 12px; font-size: 11.5px; font-weight: 900; color: ${pctColor}; font-family: monospace; text-align: center;">${pct}%</td>
              </tr>
            `;
          })
          .join("");

  // Filter notes
  const filteredNotes = notes.filter(n => n.type === "academic" || n.type === "behavior").slice(0, 2);
  let notesContainerHtml = "";
  if (filteredNotes.length === 0) {
    notesContainerHtml = `
      <div style="text-align: right; color: #334155; font-size: 11.5px; line-height: 1.8; font-weight: bold; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">
        <p style="color: #0d9488; margin: 0 0 6px 0; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">• يظهر الطالب انضباطاً متميزاً وسرعة استجابة فائقة بالحضور والمشاركة اليومية.</p>
        <p style="margin: 0; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">• نوصي بمواصلة مراجعة وحل الواجبات المقررة بانتظام وتلافي أي تراكم للصفوف اللاحقة.</p>
      </div>
    `;
  } else {
    notesContainerHtml = filteredNotes
      .map(n => {
        const isAcademic = n.type === "academic";
        const typeLabel = isAcademic ? "تقييم دراسي" : "تقييم سلوكي";
        const labelBg = isAcademic ? "#f4f9ff" : "#fffbeb";
        const labelColor = isAcademic ? "#1e40af" : "#b45309";
        const labelBorder = isAcademic ? "#bfdbfe" : "#fde68a";
        return `
          <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; text-align: right; line-height: 1.6; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; background-color: ${labelBg}; color: ${labelColor}; border: 1px solid ${labelBorder}; white-space: nowrap; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">
              ${typeLabel}
            </span>
            <span style="font-size: 11px; font-weight: bold; color: #1e293b; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important; margin-right: 6px;">${n.content}</span>
          </div>
        `;
      })
      .join("");
  }

  // Attendance & Recitations calculations for 2-column layout
  const getDayNameArabic = (dateStr: string) => {
    try {
      const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const date = new Date(dateStr);
      return days[date.getDay()];
    } catch {
      return "حصة";
    }
  };

  const appState = store.getState();
  const studentAttendanceHistory = (appState.attendance || [])
    .filter((att) => {
      const isPresent = att.presentStudentIds?.includes(student.id);
      const isAbsent = att.absentStudentIds?.includes(student.id);
      const isLate = att.lateStudentIds?.includes(student.id);
      return isPresent || isAbsent || isLate;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const attendanceRows =
    studentAttendanceHistory.length === 0
      ? `<tr>
          <td colspan="3" style="text-align: center; padding: 18px; color: #94a3b8; font-size: 11px; font-weight: bold; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">
            لا توجد حصص مرصودة حالياً للطالب.
          </td>
        </tr>`
      : studentAttendanceHistory.map((att, idx) => {
          const isPresent = att.presentStudentIds?.includes(student.id);
          const isLate = att.lateStudentIds?.includes(student.id);
          const dayName = getDayNameArabic(att.date);

          let statusText = "غائب";
          let statusBg = "#fef2f2";
          let statusColor = "#ef4444";
          let statusBorder = "#fee2e2";

          if (isPresent) {
            statusText = "حاضر";
            statusBg = "#f0fdf4";
            statusColor = "#15803d";
            statusBorder = "#bbf7d0";
          } else if (isLate) {
            statusText = "متأخر";
            statusBg = "#fffbeb";
            statusColor = "#d97706";
            statusBorder = "#fef3c7";
          }

          return `
            <tr style="background-color: ${idx % 2 === 0 ? "#f8fafc" : "#ffffff"}; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 10px; font-size: 10px; color: #64748b; font-family: monospace; font-weight: bold; text-align: right; letter-spacing: normal !important;">${att.date}</td>
              <td style="padding: 8px 10px; font-size: 11px; font-weight: bold; color: #0f172a; text-align: right; font-family: 'Cairo', sans-serif; letter-spacing: normal !important;">${dayName}</td>
              <td style="padding: 8px 10px; text-align: center;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 9.5px; font-weight: 800; background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; font-family: 'Cairo', sans-serif; letter-spacing: normal !important;">
                  ${statusText}
                </span>
              </td>
            </tr>
          `;
        }).join("");

  const recitationsCompactRows =
    recitationsWithScores.length === 0
      ? `<tr>
          <td colspan="3" style="text-align: center; padding: 18px; color: #94a3b8; font-size: 11px; font-weight: bold; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">
            لا توجد قيود تسميع شفوي مرصودة حالياً.
          </td>
        </tr>`
      : recitationsWithScores
          .slice(0, 5)
          .map((rec, idx) => {
            const score = rec.scores[student.id] ?? 0;
            const pct = rec.maxScore > 0 ? Math.round((score / rec.maxScore) * 100) : 0;
            const scoreColor = pct >= 90 ? "#0d9488" : pct >= 75 ? "#1e40af" : pct >= 50 ? "#d97706" : "#e11d48";
            return `
              <tr style="background-color: ${idx % 2 === 0 ? "#f8fafc" : "#ffffff"}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 10px; font-size: 10px; color: #64748b; font-family: monospace; font-weight: bold; text-align: right; letter-spacing: normal !important;">${rec.date}</td>
                <td style="padding: 8px 10px; font-size: 11px; font-weight: bold; color: #0f172a; text-align: right; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important; letter-spacing: normal !important; word-break: break-word;">${rec.title}</td>
                <td style="padding: 8px 10px; font-size: 10px; font-weight: 900; color: ${scoreColor}; text-align: center; font-family: monospace;">
                  ${score}/${rec.maxScore} (${pct}%)
                </td>
              </tr>
            `;
          })
          .join("");

  // 4. Create transient DOM node to build the report in
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "800px";
  container.style.height = "1130px";
  container.style.backgroundColor = "#ffffff";
  container.style.direction = "rtl";
  container.style.boxSizing = "border-box";
  container.style.overflow = "hidden";

  // Build high-polish HTML and CSS styles
  container.innerHTML = `
    <style id="pdf-styles-main">
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap');
      
      * {
        box-sizing: border-box;
        letter-spacing: normal !important;
        word-spacing: normal !important;
        font-kerning: none !important;
        text-rendering: optimizeLegibility !important;
        -webkit-font-smoothing: antialiased;
        font-variant-ligatures: common-ligatures !important;
        text-transform: none !important;
      }
      
      body, html, .report-card-shell, .report-card-shell * {
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important;
        letter-spacing: normal !important;
      }
      
      .report-card-shell {
        width: 100%;
        height: 100%;
        padding: 30px;
        box-sizing: border-box;
        background-color: #ffffff;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      
      /* Decorative Double Border Frame */
      .outer-frame {
        position: absolute;
        inset: 14px;
        border: 2px solid #0f172a; /* Deep slate border */
        pointer-events: none;
        border-radius: 20px;
      }
      
      .inner-frame {
        position: absolute;
        inset: 18px;
        border: 1px solid #cbd5e1; /* Fine Slate outline */
        pointer-events: none;
        border-radius: 16px;
      }

      /* Corner badges decoration */
      .corner-dot {
        position: absolute;
        background-color: #0d9488;
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .corner-tl { top: 22px; left: 22px; }
      .corner-tr { top: 22px; right: 22px; }
      .corner-bl { bottom: 22px; left: 22px; }
      .corner-br { bottom: 22px; right: 22px; }
    </style>

    <div class="report-card-shell">
      <!-- Decorative borders -->
      <div class="outer-frame"></div>
      <div class="inner-frame"></div>
      <div class="corner-dot corner-tl"></div>
      <div class="corner-dot corner-tr"></div>
      <div class="corner-dot corner-bl"></div>
      <div class="corner-dot corner-br"></div>

      <!-- Main container content inside frames -->
      <div style="padding: 16px; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
        
        <!-- =================== HEADER SECTION =================== -->
        <div style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1px solid #1e293b; padding: 24px 30px; border-radius: 16px; margin-bottom: 24px; color: #ffffff;">
          
          <!-- Full Width: Title & Core details -->
          <div style="text-align: right; flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="background-color: #0d9488; color: #ffffff; font-size: 9px; font-weight: 900; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: normal !important; font-family: 'Cairo', sans-serif !important;">التقرير الأكاديمي الشامل</span>
            </div>
            <h1 style="margin: 0 0 8px 0; font-size: 21px; font-weight: 800; color: #ffffff; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">
              كشف درجات ومواظبة الطالب الأكاديمية
            </h1>
            <p style="margin: 0; font-size: 11px; font-weight: 500; color: #94a3b8; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">
              العام الدراسي الأكاديمي: <span style="font-family: 'Cairo', sans-serif; font-size: 11px; color: #38bdf8; font-weight: 700;">${academicYear}</span>
              &nbsp;•&nbsp;
              المادة الدراسية المقررة: <span style="color: #ffffff; font-weight: 700;">${subjectArabic}</span>
            </p>
            <div style="margin-top: 8px; font-size: 9.5px; font-weight: 600; color: #94a3b8; display: flex; gap: 20px; font-family: 'Cairo', sans-serif !important;">
              <span>• تاريخ التحرير: ${new Date().toLocaleDateString("ar-EG")}</span>
              <span>• كود الاعتماد الرقمي السحابي الآلي</span>
            </div>
          </div>
          
        </div>

        <!-- =================== STUDENT META INFO MODULE =================== -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 900; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; display: flex; align-items: center; gap: 6px; font-family: 'Cairo', sans-serif !important;">
            <span style="color: #0d9488; font-size: 14px;">👤</span>
            <span style="letter-spacing: normal !important; margin-right: 4px;">بيانات الطالب والالتحاق الصفي</span>
          </h3>
          
          <table style="width: 100%; border-collapse: separate; border-spacing: 10px; text-align: right; font-size: 11.5px; margin: -10px;">
            <tr>
              <td style="width: 50%; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 10px; font-family: 'Cairo', sans-serif !important;">
                <span style="color: #64748b; font-weight: 600;">اسم الطالب:</span>
                <span style="color: #0f172a; font-weight: 800; font-size: 13px; margin-right: 6px; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">${student.name}</span>
              </td>
              <td style="width: 50%; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 10px; font-family: 'Cairo', sans-serif !important;">
                <span style="color: #64748b; font-weight: 600;">هاتف ولي الأمر:</span>
                <span style="color: #0f172a; font-weight: bold; font-family: monospace; font-size: 12px; margin-right: 6px;">${student.parentPhone}</span>
              </td>
            </tr>
            <tr>
              <td style="width: 50%; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 10px; font-family: 'Cairo', sans-serif !important;">
                <span style="color: #64748b; font-weight: 600;">معرف القيد (ID):</span>
                <span style="color: #475569; font-weight: bold; font-family: monospace; margin-right: 6px;">${student.id}</span>
              </td>
              <td style="width: 50%; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 10px; font-family: 'Cairo', sans-serif !important;">
                <span style="color: #64748b; font-weight: 600;">تاريخ الانضمام:</span>
                <span style="color: #475569; font-weight: bold; margin-right: 6px; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">${student.joinDate}</span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 10px; font-family: 'Cairo', sans-serif !important;">
                <span style="color: #64748b; font-weight: 600;">المجموعة الدراسية:</span>
                <span style="color: #0d9488; font-weight: 800; font-size: 12px; margin-right: 6px; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">${group?.name || "المجموعة العامة"}</span>
                <span style="float: left; background-color: #d1fae5; color: #065f46; font-size: 8.5px; font-weight: 900; padding: 3px 10px; border-radius: 6px; font-family: 'Cairo', sans-serif !important; letter-spacing: normal !important;">نشط ومسجل بالمركز</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- =================== ACADEMIC STATS 2-COLUMN BADGES =================== -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 16px; margin: -16px 0 12px 0;">
          <tr>
            <!-- Card 1: Attendance -->
            <td style="width: 50%; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 14px; padding: 18px; text-align: center; vertical-align: middle;">
              <span style="display: block; font-size: 11px; font-weight: 800; color: #1e40af; margin-bottom: 6px; font-family: 'Cairo', sans-serif !important;">🗓️ نسبة الحضور والمواظبة</span>
              <span style="display: block; font-size: 32px; font-weight: 950; color: #1d4ed8; line-height: 1; font-family: monospace;">${attendanceRate}%</span>
              <span style="display: block; font-size: 9.5px; font-weight: 700; color: #1e40af; margin-top: 8px; font-family: 'Cairo', sans-serif !important;">حضر ${totalAttendedCount} حصة من أصل ${totalSessions}</span>
            </td>

            <!-- Card 2: Exams Avg or Recitation Avg -->
            <td style="width: 50%; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px; text-align: center; vertical-align: middle;">
              ${reportType === "recitations" ? `
                <span style="display: block; font-size: 11px; font-weight: 800; color: #0284c7; margin-bottom: 6px; font-family: 'Cairo', sans-serif !important;">🗣️ متوسط الأداء الشفوي (التسميع)</span>
                <span style="display: block; font-size: 32px; font-weight: 950; color: #0369a1; line-height: 1; font-family: monospace;">${calcRecitationAvg}%</span>
                <span style="display: block; font-size: 9.5px; font-weight: 700; color: #0284c7; margin-top: 8px; font-family: 'Cairo', sans-serif !important;">متوسط تفاعل التسميع الشفوي (${recitationsWithScores.length} تقييمات)</span>
              ` : `
                <span style="display: block; font-size: 11px; font-weight: 800; color: #166534; margin-bottom: 6px; font-family: 'Cairo', sans-serif !important;">📝 متوسط التحصيل العملي</span>
                <span style="display: block; font-size: 32px; font-weight: 950; color: #15803d; line-height: 1; font-family: monospace;">${calcExamAvg}%</span>
                <span style="display: block; font-size: 9.5px; font-weight: 700; color: #166534; margin-top: 8px; font-family: 'Cairo', sans-serif !important;">متوسط الامتحانات (${examsWithScores.length} تقييمات)</span>
              `}
            </td>
          </tr>
        </table>

        ${reportType !== "recitations" ? `
        <!-- =================== WRITTEN EXAMS TABLE =================== -->
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 10px 0; font-size: 13.5px; font-weight: 800; color: #0f172a; display: flex; align-items: center; justify-content: space-between; font-family: 'Cairo', sans-serif !important;">
            <span style="letter-spacing: normal !important;">📝 كشف درجات الاختبارات التراكمية (التحريرية)</span>
            <span style="font-size: 9px; color: #64748b; font-weight: bold; background-color: #f1f5f9; padding: 3px 10px; border-radius: 9999px; font-family: 'Cairo', sans-serif !important;">آخر ٥ امتحانات</span>
          </h3>
          <div style="border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05);">
            <table style="width: 100%; border-collapse: collapse; text-align: right; background-color: #ffffff;">
              <thead>
                <tr style="background-color: #0f172a; color: #ffffff; font-size: 11px; border-bottom: 2px solid #0d9488;">
                  <th style="padding: 12px 14px; font-weight: 800; text-align: right; width: 18%; font-family: 'Cairo', sans-serif !important;">تاريخ الامتحان</th>
                  <th style="padding: 12px 14px; font-weight: 800; text-align: right; width: 42%; font-family: 'Cairo', sans-serif !important;">عنوان وموضوع التقييم التحريري</th>
                  <th style="padding: 12px 14px; font-weight: 800; text-align: center; width: 14%; font-family: 'Cairo', sans-serif !important;">درجة الطالب</th>
                  <th style="padding: 12px 14px; font-weight: 800; text-align: center; width: 13%; font-family: 'Cairo', sans-serif !important;">النهائية</th>
                  <th style="padding: 12px 14px; font-weight: 800; text-align: center; width: 13%; font-family: 'Cairo', sans-serif !important;">النسبة المئوية</th>
                </tr>
              </thead>
              <tbody style="font-size: 11.5px;">
                ${examsRows}
              </tbody>
            </table>
          </div>
        </div>
        ` : ""}

        <!-- =================== TWO-COLUMN GRID: ORAL RECITATIONS & ATTENDANCE LOG =================== -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 16px; margin: -16px 0 16px 0;">
          <tr>
            
            ${reportType !== "recitations" ? `
            <!-- Column Right: Attendance History -->
            <td style="width: ${reportType === "all" ? "50%" : "100%"}; vertical-align: top;">
              <h3 style="margin: 0 0 10px 0; font-size: 13.5px; font-weight: 800; color: #0f172a; display: flex; align-items: center; justify-content: space-between; font-family: 'Cairo', sans-serif !important;">
                <span style="letter-spacing: normal !important;">🗓️ سجل مواظبة وحضور الحصص</span>
                <span style="font-size: 9px; color: #64748b; font-weight: bold; background-color: #f1f5f9; padding: 3px 10px; border-radius: 9999px; font-family: 'Cairo', sans-serif !important;">آخر ٥ حصص</span>
              </h3>
              <div style="border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; text-align: right;">
                  <thead>
                    <tr style="background-color: #0f172a; color: #ffffff; font-size: 11px; border-bottom: 2px solid #0d9488;">
                      <th style="padding: 10px 12px; font-weight: 800; text-align: right; width: 35%; font-family: 'Cairo', sans-serif !important;">التاريخ</th>
                      <th style="padding: 10px 12px; font-weight: 800; text-align: right; width: 30%; font-family: 'Cairo', sans-serif !important;">اليوم</th>
                      <th style="padding: 10px 12px; font-weight: 800; text-align: center; width: 35%; font-family: 'Cairo', sans-serif !important;">الحالة</th>
                    </tr>
                  </thead>
                  <tbody style="font-size: 11px;">
                    ${attendanceRows}
                  </tbody>
                </table>
              </div>
            </td>
            ` : ""}

            ${reportType !== "exams" ? `
            <!-- Column Left: Oral Recitations -->
            <td style="width: ${reportType === "all" ? "50%" : "100%"}; vertical-align: top;">
              <h3 style="margin: 0 0 10px 0; font-size: 13.5px; font-weight: 800; color: #0f172a; display: flex; align-items: center; justify-content: space-between; font-family: 'Cairo', sans-serif !important;">
                <span style="letter-spacing: normal !important;">🗣️ التسميع الشفوي والتقويم المستمر</span>
                <span style="font-size: 9px; color: #64748b; font-weight: bold; background-color: #f1f5f9; padding: 3px 10px; border-radius: 9999px; font-family: 'Cairo', sans-serif !important;">آخر ٥ تسميعات</span>
              </h3>
              <div style="border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; text-align: right;">
                  <thead>
                    <tr style="background-color: #344154; color: #ffffff; font-size: 11px; border-bottom: 2px solid #8b5cf6;">
                      <th style="padding: 10px 12px; font-weight: 800; text-align: right; width: 32%; font-family: 'Cairo', sans-serif !important;">تاريخ التسميع</th>
                      <th style="padding: 10px 12px; font-weight: 800; text-align: right; width: 44%; font-family: 'Cairo', sans-serif !important;">الموضوع</th>
                      <th style="padding: 10px 12px; font-weight: 800; text-align: center; width: 24%; font-family: 'Cairo', sans-serif !important;">النتيجة</th>
                    </tr>
                  </thead>
                  <tbody style="font-size: 11px;">
                    ${recitationsCompactRows}
                  </tbody>
                </table>
              </div>
            </td>
            ` : ""}

          </tr>
        </table>

        <!-- =================== METRICS OF TRUST FOOTER (CLEANED) =================== -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b; font-weight: 700; margin-top: auto; font-family: 'Cairo', sans-serif !important;">
          <span style="font-family: monospace; font-size: 11px; color: #64748b;">ST-${student.id}-${new Date().getFullYear()}</span>
        </div>

      </div>
    </div>
  </div>
  `;

  // 4.5. Pre-emptively override document.styleSheets so html2canvas doesn't crash on standard app sheets (such as Tailwind v4's oklch variables)
  const originalStyleSheets = document.styleSheets;
  try {
    Object.defineProperty(document, "styleSheets", {
      get() {
        try {
          return Array.from(originalStyleSheets).filter((sheet) => {
            try {
              const node = sheet.ownerNode as HTMLElement | null;
              return node?.id === "pdf-styles-main";
            } catch {
              return false;
            }
          });
        } catch {
          return [];
        }
      },
      configurable: true,
    });
  } catch (e) {
    console.warn("Could not redefine document.styleSheets:", e);
  }

  // 5. Append transient container to DOM to trigger browser rendering
  document.body.appendChild(container);

  // 6. Wait briefly for Cairo Font layout styles / components to paint in DOM
  await new Promise((resolve) => setTimeout(resolve, 600));

  try {
    // 7. Capture the elements inside using standard DOM canvas screenshot with high scale
    const canvas = await html2canvas(container, {
      scale: 2.2, // Capture at high-res 2.2x for perfect print density
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      allowTaint: true,
    });

    // 8. Build isPDF (210mm x 297mm standard A4 portrait sheet)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Capture canvas base64 image data and draw it perfectly on the A4 canvas
    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);

    // 9. Save PDF using fully sanitized Arabic file label
    const cleanName = student.name.trim().replace(/\s+/g, "_");
    pdf.save(`تقرير_متابعة_الطالب_${cleanName}.pdf`);

  } catch (error) {
    console.error("PDF generation process has failed:", error);
    throw error;
  } finally {
    // Restore document.styleSheets getter
    try {
      delete (document as any).styleSheets;
    } catch (e) {
      console.warn("Could not restore document.styleSheets getter:", e);
    }
    // 10. Clean up transient offscreen DOM node to avoid leakage
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export async function downloadAbsenteesPDFReport(
  absentees: { name: string; groupName: string; phone: string; parentPhone: string }[],
  dateStr: string,
  subject: string,
  academicYear: string
) {
  const subjectArabic =
    subject === "mathematics"
      ? "الرياضيات 📐"
      : subject === "physics"
      ? "الفيزياء ⚡"
      : subject === "chemistry"
      ? "الكيمياء 🧪"
      : subject === "science"
      ? "العلوم 🔬"
      : subject === "science_en"
      ? "الساينس 🧬"
      : subject === "math"
      ? "الماث 🧮"
      : subject === "arabic"
      ? "اللغة العربية 📚"
      : subject === "english"
      ? "اللغة الانجليزية 🆎"
      : subject === "social_studies"
      ? "الدراسات 🌍"
      : "المادة العلمية";

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "800px";
  container.style.height = "1130px";
  container.style.backgroundColor = "#ffffff";
  container.style.direction = "rtl";
  container.style.boxSizing = "border-box";
  container.style.overflow = "hidden";

  const rows = absentees.length === 0
    ? `<tr>
        <td colspan="4" style="text-align: center; padding: 30px; color: #94a3b8; font-size: 13px; font-weight: bold; font-family: 'Cairo', sans-serif !important;">
          لا يوجد غياب مرصود لمثل هذا اليوم! جميع الطلاب حاضرون بنسبة مائة بالمائة. 🌟
        </td>
      </tr>`
    : absentees.map((st, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? "#f8fafc" : "#ffffff"}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; font-size: 12px; font-weight: bold; color: #475569; text-align: center; font-family: monospace;">${idx + 1}</td>
          <td style="padding: 12px; font-size: 12.5px; font-weight: bold; color: #0f172a; text-align: right; font-family: 'Cairo', sans-serif !important;">${st.name}</td>
          <td style="padding: 12px; font-size: 12.5px; font-weight: 700; color: #3b82f6; text-align: center; font-family: 'Cairo', sans-serif !important;">${st.groupName}</td>
          <td style="padding: 12px; font-size: 12px; font-weight: bold; color: #0f172a; text-align: center; font-family: monospace;">${st.parentPhone || "غير مسجل"}</td>
        </tr>
      `).join("");

  container.innerHTML = `
    <style id="pdf-styles-absentees">
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap');
      
      * {
        box-sizing: border-box;
        letter-spacing: normal !important;
        word-spacing: normal !important;
      }
      
      body, html, .absentees-shell, .absentees-shell * {
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important;
      }
      
      .absentees-shell {
        width: 100%;
        height: 100%;
        padding: 40px;
        box-sizing: border-box;
        background-color: #ffffff;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      
      .outer-frame {
        position: absolute;
        inset: 16px;
        border: 2px solid #cbd5e1;
        border-radius: 20px;
        pointer-events: none;
      }
      
      .inner-frame {
        position: absolute;
        inset: 22px;
        border: 1px dashed #e2e8f0;
        border-radius: 16px;
        pointer-events: none;
      }
    </style>
    
    <div class="absentees-shell" style="position: relative; width: 100%; height: 100%;">
      <div class="outer-frame"></div>
      <div class="inner-frame"></div>
      
      <div style="z-index: 1; display: flex; flex-direction: column; height: 100%;">
        
        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #f43f5e; padding-bottom: 20px; margin-bottom: 25px;">
          <div style="text-align: right;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #f43f5e; font-family: 'Cairo', sans-serif !important;">تقرير الغياب اليومي للطلاب 🚨</h1>
            <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: 850; color: #475569;">بوابة الرقابة والمتابعة الفورية بالسنتر</p>
          </div>
          <div style="text-align: left; text-align: left !important;">
            <span style="font-size: 11px; font-weight: bold; color: #f43f5e; background-color: #fff1f2; border: 1px solid #ffe4e6; padding: 4px 12px; border-radius: 8px;">التاريخ: ${dateStr}</span>
            <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: 800; color: #0f172a;">الصف: ${subjectArabic} | ${academicYear}</p>
          </div>
        </div>
        
        <!-- INTRO STATS -->
        <div style="background-color: #fff1f2; border: 1px solid #ffe4e6; border-radius: 14px; padding: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 13px; font-weight: bold; color: #be123c; font-family: 'Cairo', sans-serif !important;">مجموع المتغيبين في هذا اليوم:</span>
          <span style="font-size: 18px; font-weight: 900; color: #f43f5e; font-family: monospace;">${absentees.length} طالب</span>
        </div>
        
        <!-- TABLE -->
        <div style="border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <table style="width: 100%; border-collapse: collapse; text-align: right;">
            <thead>
              <tr style="background-color: #f43f5e; color: #ffffff; font-size: 12.5px;">
                <th style="padding: 12px; font-weight: 850; text-align: center; width: 10%; font-family: 'Cairo', sans-serif !important;">م</th>
                <th style="padding: 12px; font-weight: 850; text-align: right; width: 45%; font-family: 'Cairo', sans-serif !important;">اسم الطالب الغائب</th>
                <th style="padding: 12px; font-weight: 850; text-align: center; width: 22%; font-family: 'Cairo', sans-serif !important;">المجموعة الدراسية</th>
                <th style="padding: 12px; font-weight: 850; text-align: center; width: 23%; font-family: 'Cairo', sans-serif !important;">هاتف للتواصل</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
        
        <!-- FOOTER -->
        <div style="margin-top: auto; border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; font-weight: bold; font-family: 'Cairo', sans-serif !important;">
          <span style="font-family: 'Cairo', sans-serif !important;">توقيع المشرف المسؤول: _________________</span>
          <span style="font-family: monospace;">ABS-${dateStr}-GEN</span>
        </div>
        
      </div>
    </div>
  `;

  const originalStyleSheets = document.styleSheets;
  try {
    Object.defineProperty(document, "styleSheets", {
      get() {
        try {
          return Array.from(originalStyleSheets).filter((sheet) => {
            try {
              const node = sheet.ownerNode as HTMLElement | null;
              return node?.id === "pdf-styles-absentees";
            } catch {
              return false;
            }
          });
        } catch {
          return [];
        }
      },
      configurable: true,
    });
  } catch (e) {
    console.warn("Could not redefine document.styleSheets:", e);
  }

  document.body.appendChild(container);
  await new Promise((resolve) => setTimeout(resolve, 600));

  try {
    const canvas = await html2canvas(container, {
      scale: 2.2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      allowTaint: true,
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
    pdf.save(`كشف_الغياب_اليومي_${dateStr}.pdf`);
  } catch (error) {
    console.error("Absentees PDF generation has failed:", error);
    throw error;
  } finally {
    try {
      delete (document as any).styleSheets;
    } catch (e) {
      console.warn("Could not restore document.styleSheets getter:", e);
    }
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
