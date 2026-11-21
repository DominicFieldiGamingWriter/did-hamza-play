
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidSecret(supplied: string, expected: string) {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function boundedText(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function integerOrNull(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

export async function POST(request: Request) {
  const expected = process.env.BSD_USAGE_INGEST_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!expected || !isValidSecret(supplied, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  if (!payload || payload.record?.site !== "ben") {
    return NextResponse.json({ ok: false, error: "Invalid usage record." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  if (payload.kind === "api_request") {
    const r = payload.record;
    const outcome = ["success", "http_error", "network_error"].includes(r.outcome)
      ? r.outcome
      : null;
    const endpoint = boundedText(r.endpoint, 140);
    const requestedAt = typeof r.requested_at === "string" && Number.isFinite(Date.parse(r.requested_at))
      ? new Date(r.requested_at).toISOString()
      : new Date().toISOString();

    if (!outcome || !endpoint) {
      return NextResponse.json({ ok: false, error: "Invalid API event." }, { status: 400 });
    }

    const { error } = await admin.from("bsd_api_usage_events").insert({
      requested_at: requestedAt,
      site: "ben",
      endpoint,
      http_status: integerOrNull(r.http_status, 100, 599),
      latency_ms: integerOrNull(r.latency_ms, 0, 3600000) ?? 0,
      outcome,
      provider_code: boundedText(r.provider_code, 100),
      rate_limit_limit: integerOrNull(r.rate_limit_limit, 0),
      rate_limit_remaining: integerOrNull(r.rate_limit_remaining, 0),
      rate_limit_reset_at: typeof r.rate_limit_reset_at === "string" && Number.isFinite(Date.parse(r.rate_limit_reset_at))
        ? new Date(r.rate_limit_reset_at).toISOString()
        : null
    });

    if (error) {
      console.error("BSD_USAGE_INGEST_FAILED", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  if (payload.kind === "refresh_run") {
    const r = payload.record;
    const result = ["success", "skipped_rate_limited", "error"].includes(r.result)
      ? r.result
      : null;
    if (!result) {
      return NextResponse.json({ ok: false, error: "Invalid refresh event." }, { status: 400 });
    }

    const startedAt = typeof r.started_at === "string" && Number.isFinite(Date.parse(r.started_at))
      ? new Date(r.started_at).toISOString()
      : new Date().toISOString();
    const finishedAt = typeof r.finished_at === "string" && Number.isFinite(Date.parse(r.finished_at))
      ? new Date(r.finished_at).toISOString()
      : new Date().toISOString();

    const { error } = await admin.from("bsd_api_refresh_runs").insert({
      started_at: startedAt,
      finished_at: finishedAt,
      site: "ben",
      result,
      duration_ms: integerOrNull(r.duration_ms, 0, 3600000) ?? 0,
      provider_code: boundedText(r.provider_code, 100)
    });

    if (error) {
      console.error("BSD_USAGE_INGEST_FAILED", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  return NextResponse.json({ ok: false, error: "Unknown event type." }, { status: 400 });
}
