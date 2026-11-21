
import { NextResponse } from "next/server";
import {
  createUsageSessionToken,
  USAGE_SESSION_COOKIE,
  USAGE_SESSION_SECONDS,
  verifyUsagePassword
} from "../../../../../lib/usage-auth";

export const dynamic = "force-dynamic";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: USAGE_SESSION_SECONDS
};

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!verifyUsagePassword(typeof body?.password === "string" ? body.password : "")) {
    return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(USAGE_SESSION_COOKIE, createUsageSessionToken(), cookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(USAGE_SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
