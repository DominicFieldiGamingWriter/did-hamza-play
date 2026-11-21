
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { hasUsageDashboardSession } from "../../../../lib/usage-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await hasUsageDashboardSession())) {
    return NextResponse.json({ ok: false }, {
      status: 401,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  }

  const { data, error } = await getSupabaseAdmin().rpc("get_bsd_api_usage_summary");
  if (error) {
    console.error("BSD_USAGE_DASHBOARD_QUERY_FAILED", error.message);
    return NextResponse.json({ ok: false, error: "Could not load usage summary." }, {
      status: 500,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  }

  return NextResponse.json({ ok: true, summary: data }, {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
