import { NextResponse } from "next/server";
import { refreshPlayerPage } from "../../../lib/refresh";

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

  if (
    !expectedSecret ||
    suppliedSecret !== expectedSecret
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

  try {
    const result =
      await refreshPlayerPage();

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
