import { describe, it, expect } from "vitest";
import { getServerSession } from "../lib/serverAuth";
import { NextRequest } from "next/server";

describe("Server Authentication Hardening (SEC-01)", () => {
  it("should return null when no auth cookie, headers, or token are provided", () => {
    const req = new NextRequest("http://localhost:3000/api/sync");
    const session = getServerSession(req);
    expect(session).toBeNull();
  });

  it("should parse session from valid centerflow_session cookie", () => {
    const sessionObj = { role: "secretary", userId: "sec_100", name: "Sara Ahmed" };
    const cookieStr = encodeURIComponent(JSON.stringify(sessionObj));

    const req = new NextRequest("http://localhost:3000/api/sync", {
      headers: {
        cookie: `centerflow_session=${cookieStr}`,
      },
    });

    const session = getServerSession(req);
    expect(session).not.toBeNull();
    expect(session?.role).toBe("secretary");
    expect(session?.userId).toBe("sec_100");
    expect(session?.name).toBe("Sara Ahmed");
  });

  it("should reject custom x-user-role headers without valid centerflow_session cookie", () => {
    const req = new NextRequest("http://localhost:3000/api/sync", {
      headers: {
        "x-user-role": "teacher",
        "x-user-id": "teacher_primary",
        "x-user-name": "Dr. Mohamed",
      },
    });

    const session = getServerSession(req);
    expect(session).toBeNull();
  });

  it("should reject Bearer authorization token without valid centerflow_session cookie", () => {
    const sessionObj = { role: "admin", userId: "admin_1", name: "System Admin" };
    const token = Buffer.from(JSON.stringify(sessionObj)).toString("base64");

    const req = new NextRequest("http://localhost:3000/api/sync", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const session = getServerSession(req);
    expect(session).toBeNull();
  });
});
