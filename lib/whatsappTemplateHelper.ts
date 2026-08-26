/**
 * Helper to process and parse smart WhatsApp templates containing shortcodes
 */
export function fillWhatsAppTemplate(
  templateText: string,
  student: any,
  group: any,
  subject: string,
  stats: {
    present: number;
    absent: number;
    attendanceRate: number;
    scoresStr: string;
  }
): string {
  const subjLabel = 
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

  return templateText
    .replace(/\[اسم_الطالب\]/g, student.name)
    .replace(/\[المجموعة\]/g, group ? group.name : "غير محدد")
    .replace(/\[المادة\]/g, subjLabel)
    .replace(/\[الحالة\]/g, `${stats.attendanceRate}%`)
    .replace(/\[حضر\]/g, String(stats.present))
    .replace(/\[غاب\]/g, String(stats.absent))
    .replace(/\[الدرجة\]/g, stats.scoresStr || "لا توجد درجات مسجلة للفترة المحددة.");
}
