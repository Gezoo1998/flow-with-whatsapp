import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: "تم تسجيل الخروج بنجاح",
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

  console.log(`[AUTH LOGOUT] detected external protocol: ${detectedProtocol}, cookie SameSite: ${sameSite}, cookie Secure: ${secure}`);

  response.cookies.set("centerflow_session", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
