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

// In-memory rate limiting map for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 minute window
    return true;
  }
  if (entry.count >= 10) { // Max 10 attempts per 15 mins
    return false;
  }
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "client_ip";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, message: "تم تجاوز عدد محاولات الدخول المسموح بها. يرجى الانتظار لمدة 15 دقيقة." },
        { status: 429 }
      );
    }

    const { pin } = await req.json();
    if (!pin || typeof pin !== "string" || pin.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "رمز الدخول (PIN) مطلوب" },
        { status: 400 }
      );
    }

    const cleanPin = pin.trim();

    const dbUrl = sanitizeConnectionString(process.env.DATABASE_URL || "");
    let teacherPin = "2026";
    let secretaries: any[] = [];
    let isLockAccessEnabled = false;
    let lockAccessStart = "19:00";
    let lockAccessEnd = "07:00";

    if (dbUrl) {
      try {
        const sql = neon(dbUrl);
        const rows = await sql`
          SELECT payload FROM system_data WHERE id = 'center_v1' LIMIT 1
        `;
        if (rows && rows.length > 0 && rows[0].payload) {
          const payload = rows[0].payload;
          if (payload.teacherPin) teacherPin = payload.teacherPin;
          if (Array.isArray(payload.secretaries)) secretaries = payload.secretaries;
          if (payload.isLockAccessEnabled !== undefined) isLockAccessEnabled = payload.isLockAccessEnabled;
          if (payload.lockAccessStart) lockAccessStart = payload.lockAccessStart;
          if (payload.lockAccessEnd) lockAccessEnd = payload.lockAccessEnd;
        }
      } catch (dbErr) {
        console.warn("Login route database check warning:", dbErr);
      }
    }

    let authenticatedUser: { id: string; name: string; role: "teacher" | "secretary" } | null = null;

    // Check teacher PIN
    if (cleanPin === teacherPin) {
      authenticatedUser = {
        id: "teacher",
        name: "المعلم (مسؤول الأستاذ)",
        role: "teacher",
      };
    } else {
      // Check secretary PIN
      const activeSec = secretaries.find((sec: any) => sec.pin === cleanPin && sec.active);
      if (activeSec) {
        // Lockout verification
        if (isLockAccessEnabled && !activeSec.exemptFromLock && !activeSec.fullAccess) {
          const now = new Date();
          const currentMins = now.getHours() * 60 + now.getMinutes();
          const [startH, startM] = lockAccessStart.split(":").map(Number);
          const [endH, endM] = lockAccessEnd.split(":").map(Number);
          const startMins = startH * 60 + startM;
          const endMins = endH * 60 + endM;

          let isLocked = false;
          if (startMins > endMins) {
            isLocked = currentMins >= startMins || currentMins < endMins;
          } else {
            isLocked = currentMins >= startMins && currentMins < endMins;
          }

          if (isLocked) {
            return NextResponse.json(
              { success: false, message: "عذراً! يمنع تسجيل الدخول خارج الأوقات المسموحة بناءً على إعدادات القفل." },
              { status: 403 }
            );
          }
        }

        authenticatedUser = {
          id: activeSec.id,
          name: activeSec.name,
          role: "secretary",
        };
      }
    }

    if (!authenticatedUser) {
      return NextResponse.json(
        { success: false, message: "رمز الدخول (PIN) غير صحيح" },
        { status: 401 }
      );
    }

    // Prepare session payload
    const sessionData = {
      userId: authenticatedUser.id,
      name: authenticatedUser.name,
      role: authenticatedUser.role,
      createdAt: new Date().toISOString(),
    };

    const cookieValue = JSON.stringify(sessionData);

    const response = NextResponse.json({
      success: true,
      message: `تم تسجيل الدخول بنجاح كـ ${authenticatedUser.name}`,
      user: authenticatedUser,
    });

    const xForwardedProto = req.headers.get("x-forwarded-proto");
    const xForwardedSsl = req.headers.get("x-forwarded-ssl");
    const forwarded = req.headers.get("forwarded");
    const referer = req.headers.get("referer") || req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";

    let isSecure = false;
    if (xForwardedProto && xForwardedProto.toLowerCase().includes("https")) {
      isSecure = true;
    } else if (xForwardedSsl && xForwardedSsl.toLowerCase() === "on") {
      isSecure = true;
    } else if (forwarded && forwarded.toLowerCase().includes("proto=https")) {
      isSecure = true;
    } else if (referer && referer.toLowerCase().startsWith("https://")) {
      isSecure = true;
    } else if (host.includes(".run.app") || host.includes(".cloudworkstations.dev") || host.includes("ais-") || host.includes("europe-west2")) {
      isSecure = true;
    } else if (req.nextUrl.protocol === "https:") {
      isSecure = true;
    }

    const detectedProtocol = isSecure ? "https" : "http";
    const sameSite = isSecure ? "none" : "lax";
    const secure = isSecure;

    console.log(`[AUTH LOGIN] detected external protocol: ${detectedProtocol}, cookie SameSite: ${sameSite}, cookie Secure: ${secure}`);

    response.cookies.set("centerflow_session", cookieValue, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? "none" : "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("Error in auth login API:", err);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء معالجة تسجيل الدخول" },
      { status: 500 }
    );
  }
}
