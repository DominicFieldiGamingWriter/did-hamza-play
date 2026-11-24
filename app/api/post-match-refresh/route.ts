import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST() {
  return NextResponse.json({ ok: false, error: "Post-match checks are handled by the scheduled server-side worker." }, { status: 410 });
}
