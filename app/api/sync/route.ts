import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "../../../lib/serverAuth";

// Dynamic routing configuration for Next.js App Router
export const dynamic = "force-dynamic";

function stripSecrets(state: any) {
  if (!state) return state;
  const cloned = JSON.parse(JSON.stringify(state));
  delete cloned.teacherPin;
  delete cloned.appLockPin;
  if (Array.isArray(cloned.secretaries)) {
    cloned.secretaries = cloned.secretaries.map((s: any) => {
      const { pin, ...rest } = s;
      return rest;
    });
  }
  return cloned;
}

// Helper to sanitize database connection string from cli command wrappers or quotes
function sanitizeConnectionString(url: string): string {
  if (!url) return "";
  const clean = url.trim();
  // Extract everything starting with postgres:// or postgresql:// up to the next quote, whitespace, or bracket
  const match = clean.match(/(postgres(?:ql)?:\/\/[^\s'"]+)/i);
  if (match) {
    return match[1];
  }
  return clean;
}

function sanitizeAttendanceRecords(attendance: any[]): any[] {
  if (!Array.isArray(attendance)) return [];
  const validRecords: any[] = [];
  const corruptedToGroup: Record<string, any[]> = {};

  attendance.forEach((rec) => {
    if (!rec) return;
    if (Array.isArray(rec.presentStudentIds) && Array.isArray(rec.absentStudentIds)) {
      validRecords.push({
        id: rec.id || `att_${Date.now()}_${Math.random()}`,
        groupId: rec.groupId || "",
        date: rec.date || "",
        presentStudentIds: rec.presentStudentIds,
        absentStudentIds: rec.absentStudentIds,
        lateStudentIds: Array.isArray(rec.lateStudentIds) ? rec.lateStudentIds : [],
      });
    } else {
      const groupId = rec.groupId || "";
      const date = rec.date || "";
      if (groupId && date) {
        const key = `${groupId}_${date}`;
        if (!corruptedToGroup[key]) {
          corruptedToGroup[key] = [];
        }
        corruptedToGroup[key].push(rec);
      }
    }
  });

  Object.entries(corruptedToGroup).forEach(([key, toggles]) => {
    const [groupId, date] = key.split("_");
    const presentStudentIds = new Set<string>();
    const absentStudentIds = new Set<string>();
    const lateStudentIds = new Set<string>();

    toggles.forEach((t) => {
      const studentId = t.studentId || t.id;
      if (!studentId) return;
      if (t.present === true) {
        presentStudentIds.add(studentId);
        absentStudentIds.delete(studentId);
        if (t.late === true) {
          lateStudentIds.add(studentId);
        }
      } else if (t.present === false) {
        absentStudentIds.add(studentId);
        presentStudentIds.delete(studentId);
        lateStudentIds.delete(studentId);
      }
    });

    const existingIndex = validRecords.findIndex(
      (r) => r.groupId === groupId && r.date === date
    );

    if (existingIndex > -1) {
      const ext = validRecords[existingIndex];
      presentStudentIds.forEach((id) => {
        if (!ext.presentStudentIds.includes(id)) ext.presentStudentIds.push(id);
        ext.absentStudentIds = ext.absentStudentIds.filter((sid: string) => sid !== id);
      });
      absentStudentIds.forEach((id) => {
        if (!ext.absentStudentIds.includes(id)) ext.absentStudentIds.push(id);
        ext.presentStudentIds = ext.presentStudentIds.filter((sid: string) => sid !== id);
        if (ext.lateStudentIds) ext.lateStudentIds = ext.lateStudentIds.filter((sid: string) => sid !== id);
      });
      lateStudentIds.forEach((id) => {
        if (ext.lateStudentIds && !ext.lateStudentIds.includes(id)) ext.lateStudentIds.push(id);
      });
    } else {
      validRecords.push({
        id: `att_${groupId}_${date}`,
        groupId,
        date,
        presentStudentIds: Array.from(presentStudentIds),
        absentStudentIds: Array.from(absentStudentIds),
        lateStudentIds: Array.from(lateStudentIds),
      });
    }
  });

  return validRecords;
}

function sanitizeState(state: any) {
  if (!state) return state;
  const arrays = [
    "secretaries", "groups", "students", "attendance", "payments",
    "recitations", "exams", "studentNotes", "activityLogs",
    "whatsappTemplates", "archives"
  ];
  arrays.forEach(key => {
    if (!Array.isArray(state[key])) {
      state[key] = [];
    }
  });
  state.attendance = sanitizeAttendanceRecords(state.attendance);
  return state;
}

// Initialize database query client if connection string is configured
const getSql = () => {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sanitizedUrl = sanitizeConnectionString(url);
  return neon(sanitizedUrl);
};

// Auto-run schema setup on startup
async function ensureSchemaSetup() {
  const sql = getSql();
  if (!sql) return;

  try {
    // Create highly optimized table to store single authoritative system state per center/school
    await sql`
      CREATE TABLE IF NOT EXISTS system_data (
        id VARCHAR(50) PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
  } catch (error) {
    console.error("Failed to run postgres schema setup for system_data:", error);
  }
}

// REST GET: Fetch the current server authoritative state
export async function GET(req: NextRequest) {
  const reqId = req.headers.get("x-sync-request-id") || "NO-REQ-ID";
  const hasSessionCookie = Boolean(req.cookies.get("centerflow_session")?.value || req.cookies.get("session")?.value);
  const session = getServerSession(req);
  const isAuthenticated = Boolean(session);
  console.log(`[SYNC GET] whether centerflow_session exists: ${hasSessionCookie}, authenticated: ${isAuthenticated}`);
  const sql = getSql();
  if (!sql) {
    return NextResponse.json({
      status: "fallback",
      message: "DATABASE_URL is not configured. Running in offline/browser mode.",
      payload: null,
    });
  }

  try {
    await ensureSchemaSetup();

    if (!session) {
      return NextResponse.json(
        { status: "error", message: "تنبيه: غير مصرح بالوصول (رمز الجلسة غير صالح أو منتهي). يرجى تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }

    const rows = await sql`
      SELECT payload, updated_at FROM system_data WHERE id = 'center_v1' LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({
        status: "empty",
        message: "No center data exists yet in the Neon cloud database. Ready to initialize.",
        payload: null,
      });
    }

    const cleanPayload = stripSecrets(sanitizeState(rows[0].payload));

    return NextResponse.json({
      status: "success",
      payload: cleanPayload,
      updatedAt: rows[0].updated_at,
    });
  } catch (err: any) {
    console.error("Neon database GET sync failed:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Database connection error" },
      { status: 500 }
    );
  }
}

// REST POST: Receive local events and state from the client, apply replay merge, and output synchronized cloud baseline
export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-sync-request-id") || "NO-REQ-ID";
  const hasSessionCookie = Boolean(req.cookies.get("centerflow_session")?.value || req.cookies.get("session")?.value);
  const session = getServerSession(req);
  const isAuthenticated = Boolean(session);
  console.log(`[SYNC POST] whether centerflow_session exists: ${hasSessionCookie}, authenticated: ${isAuthenticated}`);

  if (!session) {
    return NextResponse.json(
      { status: "error", message: "تنبيه: غير مصرح بتنفيذ المزامنة - يرجى تسجيل الدخول أولاً" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { localState, pendingEvents, forceOverwrite } = body || {};

  if (forceOverwrite && session.role !== "teacher") {
    return NextResponse.json(
      { status: "error", message: "تنبيه: ميزة المزامنة الشاملة القسرية (forceOverwrite) مقتصرة حصرياً على المعلم فقط" },
      { status: 403 }
    );
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({
      status: "fallback",
      message: "DATABASE_URL is not configured. Falling back to local state baseline.",
    });
  }

  try {
    await ensureSchemaSetup();

    const existingRows = await sql`
      SELECT payload FROM system_data WHERE id = 'center_v1' LIMIT 1
    `;
    const hasExistingData = existingRows.length > 0 && existingRows[0].payload;

    let serverState: any = null;

    if (forceOverwrite) {
      console.log("[POST Sync] Full-state force overwrite requested by teacher. Bypassing event replay merge.");
      serverState = localState;
    } else {
      if (hasExistingData) {
        serverState = existingRows[0].payload;
      }

      // 2. If server has no state yet, initialize it directly with the client's current state
      if (!serverState) {
        serverState = {
          secretaries: localState.secretaries || [],
          groups: localState.groups || [],
          students: localState.students || [],
          attendance: localState.attendance || [],
          payments: localState.payments || [],
          recitations: localState.recitations || [],
          exams: localState.exams || [],
          studentNotes: localState.studentNotes || [],
          activityLogs: localState.activityLogs || [],
          academicYear: localState.academicYear || "2026/2027",
          teacherPin: localState.teacherPin || "2026",
          teacherName: localState.teacherName || "",
          centerName: localState.centerName || "",
          subjectName: localState.subjectName || "",
        };
      }

      // 3. Keep server-authoritative collections, but merge non-collection settings and metadata fields directly from localState. 
      // This ensures settings additions and updates (like teacherPin, helper secretaries, WhatsApp templates) sync perfectly in real-time.
      const metadataFields = [
        "subject",
        "teacherName",
        "teacherPin",
        "academicYear",
        "isLockAccessEnabled",
        "lockAccessStart",
        "lockAccessEnd",
        "whatsappTemplates",
        "secretaries",
        "archives",
        "isAppLockActive",
        "appLockPin",
        "centerName",
        "subjectName"
      ];
      metadataFields.forEach(field => {
        if (localState && localState[field] !== undefined) {
          serverState[field] = localState[field];
        }
      });
    }

    serverState = sanitizeState(serverState);

    // 3. Replay each pending event sequentially onto the serverState
    if (Array.isArray(pendingEvents) && pendingEvents.length > 0) {
      // Ensure strict chronological ordering
      const sortedEvents = [...pendingEvents].sort((a: any, b: any) => {
        const timeA = a.timestamp || new Date(0).toISOString();
        const timeB = b.timestamp || new Date(0).toISOString();
        return timeA.localeCompare(timeB);
      });

      for (const event of sortedEvents) {
        const action = event.action || event.type;
        const payload = event.payload;
        if (!action || !payload) continue;

        switch (action) {
          case "ADD_GROUP": {
            if (!serverState.groups) serverState.groups = [];
            // Remove existing group to avoid duplications
            serverState.groups = serverState.groups.filter((g: any) => g.id !== payload.id);
            serverState.groups.push(payload);
            break;
          }
          case "UPDATE_GROUP": {
            if (!serverState.groups) serverState.groups = [];
            serverState.groups = serverState.groups.map((g: any) =>
              g.id === payload.id ? { ...g, ...payload } : g
            );
            break;
          }
          case "DELETE_GROUP": {
            if (!serverState.groups) serverState.groups = [];
            serverState.groups = serverState.groups.filter((g: any) => g.id !== payload.id);
            // Cascading deletion for students under this group (if necessary, or keep as is)
            break;
          }
          case "ADD_STUDENT": {
            if (!serverState.students) serverState.students = [];
            serverState.students = serverState.students.filter((s: any) => s.id !== payload.id);
            serverState.students.push(payload);
            break;
          }
          case "UPDATE_STUDENT": {
            if (!serverState.students) serverState.students = [];
            serverState.students = serverState.students.map((s: any) =>
              s.id === payload.id ? { ...s, ...payload } : s
            );
            break;
          }
          case "DELETE_STUDENT": {
            if (!serverState.students) serverState.students = [];
            serverState.students = serverState.students.filter((s: any) => s.id !== payload.id);
            break;
          }
          case "TOGGLE_ATTENDANCE": {
            if (!serverState.attendance) serverState.attendance = [];
            const { id, studentId, groupId, date, present, late } = payload;
            const targetStudentId = studentId || id;
            if (!groupId || !date || !targetStudentId) break;

            // Find existing record for this group and date
            let record = serverState.attendance.find(
              (att: any) => att.groupId === groupId && att.date === date
            );

            if (record) {
              // Ensure arrays exist and are valid
              if (!Array.isArray(record.presentStudentIds)) record.presentStudentIds = [];
              if (!Array.isArray(record.absentStudentIds)) record.absentStudentIds = [];
              if (!Array.isArray(record.lateStudentIds)) record.lateStudentIds = [];

              if (present) {
                if (!record.presentStudentIds.includes(targetStudentId)) {
                  record.presentStudentIds.push(targetStudentId);
                }
                record.absentStudentIds = record.absentStudentIds.filter((sid: string) => sid !== targetStudentId);
                if (late) {
                  if (!record.lateStudentIds.includes(targetStudentId)) {
                    record.lateStudentIds.push(targetStudentId);
                  }
                } else {
                  record.lateStudentIds = record.lateStudentIds.filter((sid: string) => sid !== targetStudentId);
                }
              } else {
                if (!record.absentStudentIds.includes(targetStudentId)) {
                  record.absentStudentIds.push(targetStudentId);
                }
                record.presentStudentIds = record.presentStudentIds.filter((sid: string) => sid !== targetStudentId);
                record.lateStudentIds = record.lateStudentIds.filter((sid: string) => sid !== targetStudentId);
              }
            } else {
              // Create new record
              const newRecord = {
                id: `att_${groupId}_${date}`,
                groupId,
                date,
                presentStudentIds: present ? [targetStudentId] : [],
                absentStudentIds: !present ? [targetStudentId] : [],
                lateStudentIds: (present && late) ? [targetStudentId] : [],
              };
              serverState.attendance.push(newRecord);
            }
            break;
          }
          case "ADD_PAYMENT": {
            if (!serverState.payments) serverState.payments = [];
            
            // حل تعارض الفواتير والمزامنة المتزامنة (Concurrency Invoice Sync Resolution):
            // لمنع تكرار فواتير أو اشتراكات نفس الطالب لنفس الشهر عند الإدخال المتزامن من أجهزة مختلفة،
            // نقوم بالتحقق مما إذا كان هناك دفع مسجل مسبقاً لنفس الطالب ونفس الشهر.
            // في حال وجود تعارض، نطبق استراتيجية (Last-Write-Wins) بالاعتماد على تاريخ السجل الأحدث.
            const duplicateIndex = serverState.payments.findIndex(
              (p: any) => p.studentId === payload.studentId && p.month === payload.month
            );

            if (duplicateIndex > -1) {
              const existing = serverState.payments[duplicateIndex];
              const existingDate = existing.date || "";
              const incomingDate = payload.date || "";

              if (incomingDate >= existingDate) {
                // استبدال السجل القديم بالسجل الأحدث الوارد في عملية المزامنة
                serverState.payments[duplicateIndex] = payload;
              }
              // إذا كان الوارد أقدم، يتم تجاهله والاحتفاظ بالمسجل على السيرفر لتجنب التكرار
            } else {
              // مسار طبيعي لا يوجد به تعارض لنفس الطالب والشهر: نقوم بالفلترة حسب المعرف الفريد للتأكيد ومن ثم الإضافة
              serverState.payments = serverState.payments.filter((p: any) => p.id !== payload.id);
              serverState.payments.push(payload);
            }
            break;
          }
          case "DELETE_PAYMENT": {
            if (!serverState.payments) serverState.payments = [];
            serverState.payments = serverState.payments.filter((p: any) => p.id !== payload.id);
            break;
          }
          case "ADD_RECITATION": {
            if (!serverState.recitations) serverState.recitations = [];
            serverState.recitations = serverState.recitations.filter((r: any) => r.id !== payload.id);
            serverState.recitations.push(payload);
            break;
          }
          case "UPDATE_RECITATION": {
            if (!serverState.recitations) serverState.recitations = [];
            serverState.recitations = serverState.recitations.map((r: any) =>
              r.id === payload.id ? { ...r, ...payload } : r
            );
            break;
          }
          case "SAVE_RECITATION_SCORES": {
            if (!serverState.recitations) serverState.recitations = [];
            const targetId = payload.recitationId || payload.id;
            const validScores: Record<string, number> = {};
            if (payload.scores && typeof payload.scores === "object") {
              Object.entries(payload.scores).forEach(([stId, val]) => {
                const num = Number(val);
                if (!isNaN(num) && isFinite(num) && num >= 0) {
                  validScores[stId] = num;
                }
              });
            }
            serverState.recitations = serverState.recitations.map((rec: any) =>
              rec.id === targetId ? { ...rec, scores: { ...rec.scores, ...validScores } } : rec
            );
            break;
          }
          case "DELETE_RECITATION": {
            if (!serverState.recitations) serverState.recitations = [];
            serverState.recitations = serverState.recitations.filter((r: any) => r.id !== payload.id);
            break;
          }
          case "ADD_EXAM": {
            if (!serverState.exams) serverState.exams = [];
            serverState.exams = serverState.exams.filter((e: any) => e.id !== payload.id);
            serverState.exams.push(payload);
            break;
          }
          case "UPDATE_EXAM": {
            if (!serverState.exams) serverState.exams = [];
            serverState.exams = serverState.exams.map((ex: any) =>
              ex.id === payload.id ? { ...ex, ...payload } : ex
            );
            break;
          }
          case "SAVE_EXAM_SCORES": {
            if (!serverState.exams) serverState.exams = [];
            const targetId = payload.examId || payload.id;
            const validScores: Record<string, number> = {};
            if (payload.scores && typeof payload.scores === "object") {
              Object.entries(payload.scores).forEach(([stId, val]) => {
                const num = Number(val);
                if (!isNaN(num) && isFinite(num) && num >= 0) {
                  validScores[stId] = num;
                }
              });
            }
            serverState.exams = serverState.exams.map((ex: any) =>
              ex.id === targetId ? { ...ex, scores: { ...ex.scores, ...validScores } } : ex
            );
            break;
          }
          case "DELETE_EXAM": {
            if (!serverState.exams) serverState.exams = [];
            serverState.exams = serverState.exams.filter((e: any) => e.id !== payload.id);
            break;
          }
          case "ADD_NOTE": {
            if (!serverState.studentNotes) serverState.studentNotes = [];
            serverState.studentNotes = serverState.studentNotes.filter((n: any) => n.id !== payload.id);
            serverState.studentNotes.push(payload);
            break;
          }
          case "DELETE_NOTE": {
            if (!serverState.studentNotes) serverState.studentNotes = [];
            serverState.studentNotes = serverState.studentNotes.filter((n: any) => n.id !== payload.id);
            break;
          }
          case "LOG_ACTIVITY": {
            if (!serverState.activityLogs) serverState.activityLogs = [];
            serverState.activityLogs = [payload, ...serverState.activityLogs].slice(0, 500);
            break;
          }
          default:
            break;
        }
      }
    }

    // 4. Save merged State back to Neon Postgres DB, ensuring atomic write-lock behavior
    const sanitizedServerState = sanitizeState(serverState);
    const updatedPayloadStr = JSON.stringify(sanitizedServerState);
    await sql`
      INSERT INTO system_data (id, payload, updated_at)
      VALUES ('center_v1', ${updatedPayloadStr}::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE
      SET payload = EXCLUDED.payload, updated_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({
      status: "success",
      message: "Cloud merging and event replay completed successfully.",
      payload: stripSecrets(sanitizedServerState),
    });
  } catch (err: any) {
    console.error("Neon database POST sync failed:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Database merging failure" },
      { status: 500 }
    );
  }
}
