import { NextResponse } from "next/server";
import {
  refreshPlayerPage
} from "../../../lib/refresh";
import {
  getTeamFixtures,
  getLineups
} from "../../../lib/api-football";

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
    authorization?.startsWith("Bearer ")
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

  try {
    const result =
      await refreshPlayerPage();

    const fixtures =
      await getTeamFixtures(
        result.team_id
      );

    const nextFixture =
      fixtures.next?.[0] ?? null;

    let lineupData: any = null;

    if (
      nextFixture?.id
    ) {
      try {
        lineupData =
          await getLineups(
            Number(
              nextFixture.id
            )
          );
      } catch (error) {
        lineupData = {
          error:
            error instanceof Error
              ? error.message
              : "Lineup request failed"
        };
      }
    }

    return NextResponse.json({
      ok: true,

      player:
        result.player,

      team:
        result.team,

      updated_at:
        result.updated_at,

      next_fixture:
        nextFixture
          ? {
              id:
                nextFixture.id,

              date:
                nextFixture.date,

              home_team:
                nextFixture.home_team,

              away_team:
                nextFixture.away_team,

              status:
                nextFixture.status,

              unavailable_players:
                nextFixture.unavailable_players ??
                null
            }
          : null,

      lineup:
        lineupData
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
