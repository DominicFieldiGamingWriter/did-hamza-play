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
      ? authorization.slice(
          7
        )
      : "";

  if (
    !expectedSecret ||
    suppliedSecret !==
      expectedSecret
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unauthorized"
      },
      {
        status: 401
      }
    );
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
        result.incident_types
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
