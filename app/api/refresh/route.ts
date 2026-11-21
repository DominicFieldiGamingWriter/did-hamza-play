import { BsdApiCircuitOpenError } from "../../../lib/bsd-circuit-breaker";
import { NextResponse } from "next/server";
import { refreshPlayerPage } from "../../../lib/refresh";
import { trackBsdRefreshRun } from "../../../lib/bsd-usage";

export async function GET(
  request: Request
) {
  const expectedSecret =
    process.env.CRON_SECRET;

  const authorization =
    request.headers.get(
      "authorization"
    );

  const suppliedSecret =
    authorization?.startsWith(
      "Bearer "
    )
      ? authorization.slice(7)
      : "";

  const acceptedSecrets = [
    expectedSecret,
    process.env.SUPABASE_CRON_SECRET
  ].filter((secret): secret is string => Boolean(secret));

  if (
    acceptedSecrets.length === 0 ||
    !acceptedSecrets.includes(suppliedSecret)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );
  }

  const buildSha =
    process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  if (
    new URL(request.url).searchParams.get("check_build") === "1"
  ) {
    return NextResponse.json({
      ok: true,
      build_sha: buildSha
    });
  }

  const refreshStartedAt = Date.now();

  try {
    const result =
      await refreshPlayerPage();

    trackBsdRefreshRun({
      started_at: new Date(refreshStartedAt).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - refreshStartedAt,
      result: "success",
      provider_code: null
    });

    return NextResponse.json({
      ok: true,

      player:
        result.player,

      team:
        result.team,

      updated_at:
        result.updated_at,

      incident_count:
        result.incident_count,

      incident_types:
        result.incident_types,

      appearance_minutes:
        result.appearance_minutes,

      appearance_summary:
        result.appearance_summary,

      sent_off_minute:
        result.sent_off_minute,

      build_sha:
        buildSha
    });
  } catch (error) {
    if (error instanceof BsdApiCircuitOpenError) {
      trackBsdRefreshRun({
        started_at: new Date(refreshStartedAt).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - refreshStartedAt,
        result: "skipped_rate_limited",
        provider_code: error.providerCode ?? null
      });
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "bsd_rate_limited",
        retry_at: error.retryAt,
        provider_code: error.providerCode,
        build_sha: buildSha
      }, {
        headers: { "Cache-Control": "no-store, max-age=0" }
      });
    }

    trackBsdRefreshRun({
      started_at: new Date(refreshStartedAt).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - refreshStartedAt,
      result: "error",
      provider_code: null
    });

    console.error(
      "Refresh failed:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Refresh failed"
      },
      {
        status: 500
      }
    );
  }
}
