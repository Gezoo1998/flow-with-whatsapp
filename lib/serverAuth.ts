import { NextRequest } from "next/server";

export interface ServerSession {
  userId?: string;
  name?: string;
  role: "teacher" | "secretary" | "admin";
}

export function getServerSession(req: NextRequest): ServerSession | null {
  // Authentication Source of Truth: centerflow_session cookie
  const sessionCookie = req.cookies.get("centerflow_session")?.value || req.cookies.get("session")?.value;
  if (!sessionCookie) {
    return null;
  }

  try {
    let raw = sessionCookie;
    try {
      raw = decodeURIComponent(sessionCookie);
    } catch {
      // Keep as-is if decodeURIComponent throws
    }
    const parsed = JSON.parse(raw);
    if (parsed && parsed.role && ["teacher", "secretary", "admin"].includes(parsed.role)) {
      return {
        userId: parsed.userId || parsed.id || "user_1",
        name: parsed.name || parsed.username || "User",
        role: parsed.role,
      };
    }
  } catch {
    // Legacy fallback for plain string role in cookie
    if (["teacher", "secretary", "admin"].includes(sessionCookie)) {
      return {
        role: sessionCookie as any,
        userId: "user_1",
        name: "User",
      };
    }
  }

  // Strictly return null for unauthenticated requests
  return null;
}

