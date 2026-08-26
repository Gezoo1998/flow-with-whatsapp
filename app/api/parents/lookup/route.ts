import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function sanitizeConnectionString(url: string): string {
  if (!url) return "";
  const clean = url.trim();
  const match = clean.match(/(postgres(?:ql)?:\/\/[^\s'"]+)/i);
  if (match) return match[1];
  return clean;
}

// In-memory sliding window rate limiter for parent lookup
const parentLookupAttempts = new Map<string, { count: number; resetAt: number }>();

function checkParentRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = parentLookupAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    parentLookupAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 }); // 5 minutes window
    return true;
  }
  if (entry.count >= 20) { // Max 20 requests per 5 mins
    return false;
  }
  entry.count++;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "client_ip";
    if (!checkParentRateLimit(ip)) {
      return NextResponse.json(
        { success: false, message: "تم تجاوز عدد محاولات الاستعلام المسموح بها. يرجى الانتظار لمدة 5 دقائق." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim();

    if (!code) {
      return NextResponse.json(
        { success: false, message: "كود الطالب أو رقم الهاتف مطلوب" },
        { status: 400 }
      );
    }

    const dbUrl = sanitizeConnectionString(process.env.DATABASE_URL || "");
    if (!dbUrl) {
      return NextResponse.json(
        { success: false, message: "قاعدة البيانات غير مهيئة" },
        { status: 500 }
      );
    }

    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT payload FROM system_data WHERE id = 'center_v1' LIMIT 1
    `;

    if (!rows || rows.length === 0 || !rows[0].payload) {
      return NextResponse.json(
        { success: false, message: "لم يتم العثور على بيانات السنتر" },
        { status: 404 }
      );
    }

    const systemData = rows[0].payload;
    const students = systemData.students || [];
    const groups = systemData.groups || [];
    const attendance = systemData.attendance || [];
    const recitations = systemData.recitations || [];
    const exams = systemData.exams || [];
    const payments = systemData.payments || [];

    const searchTarget = code.toLowerCase();

    // Find student strictly matching code, phone, parentPhone, or id
    const student = students.find((s: any) => {
      if (!s) return false;
      const sCode = (s.code || s.id || "").toString().trim().toLowerCase();
      const sPhone = (s.phone || "").toString().trim();
      const sParentPhone = (s.parentPhone || "").toString().trim();
      const sId = (s.id || "").toString().trim().toLowerCase();

      return (
        sCode === searchTarget ||
        sPhone === code ||
        sParentPhone === code ||
        sId === searchTarget
      );
    });

    if (!student) {
      return NextResponse.json(
        { success: false, message: "عذراً! لم نجد أي طالب مسجل بهذا الكود أو الرقم. يرجى مراجعة إدارة السنتر." },
        { status: 404 }
      );
    }

    const group = groups.find((g: any) => g.id === student.groupId);

    // Sanitize student payload strictly for parent display
    const studentWithGroup = {
      id: student.id,
      name: student.name,
      groupId: student.groupId,
      groupName: group?.name || "المجموعة العامة",
      joinDate: student.joinDate,
      status: student.status || "active",
      customFee: student.customFee,
      notes: student.notes,
    };

    // Filter student attendance
    const studentAttendance = attendance
      .filter(
        (a: any) =>
          a.groupId === student.groupId &&
          ((Array.isArray(a.presentStudentIds) && a.presentStudentIds.includes(student.id)) ||
           (Array.isArray(a.absentStudentIds) && a.absentStudentIds.includes(student.id)) ||
           (Array.isArray(a.lateStudentIds) && a.lateStudentIds.includes(student.id)))
      )
      .map((a: any) => {
        let status = "absent";
        if (Array.isArray(a.lateStudentIds) && a.lateStudentIds.includes(student.id)) {
          status = "late";
        } else if (Array.isArray(a.presentStudentIds) && a.presentStudentIds.includes(student.id)) {
          status = "present";
        }
        return {
          id: a.id,
          date: a.date,
          status,
        };
      })
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

    // Filter student recitations
    const studentRecitations = recitations
      .filter((r: any) => r && r.scores && r.scores[student.id] !== undefined)
      .map((r: any) => ({
        id: r.id,
        title: r.title,
        maxScore: Number(r.maxScore) || 0,
        date: r.date,
        score: Number(r.scores[student.id]),
      }))
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

    // Filter student exams
    const studentExams = exams
      .filter((e: any) => e && e.scores && e.scores[student.id] !== undefined)
      .map((e: any) => ({
        id: e.id,
        title: e.title,
        maxScore: Number(e.maxScore) || 0,
        date: e.date,
        score: Number(e.scores[student.id]),
      }))
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

    // Filter student payments
    const studentPayments = payments
      .filter((p: any) => p && p.studentId === student.id)
      .map((p: any) => ({
        id: p.id,
        month: p.month,
        date: p.date,
        amount: Number(p.amount) || 0,
      }))
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

    return NextResponse.json({
      success: true,
      student: studentWithGroup,
      attendance: studentAttendance,
      recitations: studentRecitations,
      exams: studentExams,
      payments: studentPayments,
    });
  } catch (err: any) {
    console.error("Error in parent lookup API:", err);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء البحث عن بيانات الطالب" },
      { status: 500 }
    );
  }
}
