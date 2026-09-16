import { NextResponse } from "next/server";
import { refreshPlayerPage } from "../../../lib/refresh";
import {
  findTeam,
  getTeamFixtures,
  getLineups
} from "../../../lib/api-football";

function getId(
  value: any
): number | null {
  const candidates = [
    value?.id,
    value?.player_id,
    value?.player?.id,
    value?.player?.player_id
  ];

  for (
    const candidate of candidates
  ) {
    const number =
      Number(candidate);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      return number;
    }
  }

  return null;
}

function collectPlayerIds(
  value: any,
  output: number[] = []
): number[] {
  if (
    value === null ||
    value === undefined
  ) {
    return output;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
      collectPlayerIds(
        item,
        output
      );
    }

    return output;
  }

  if (
    typeof value !==
    "object"
  ) {
    return output;
  }

  const id =
    getId(value);

  if (
    id !== null &&
    !output.includes(id)
  ) {
    output.push(id);
  }

  for (
    const child of Object.values(
      value
    )
  ) {
    if (
      child &&
      typeof child === "object"
    ) {
      collectPlayerIds(
        child,
        output
      );
    }
  }

  return output;
}

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

    const teams =
      await findTeam(
        "Sheffield United"
      );

    const team =
      teams?.find(
        (item: any) =>
          String(
            item?.name ?? ""
          ).toLowerCase() ===
          "sheffield united"
      ) ??
      teams?.[0];

    if (!team?.id) {
      throw new Error(
        "Could not find Sheffield United team ID."
      );
    }

    const fixtures =
      await getTeamFixtures(
        Number(team.id)
      );

    const live =
      fixtures.live ??
      null;

    let lineupResult:
      | any
      | null = null;

    let lineupPlayerIds:
      | number[]
      = [];

    if (
      live?.id
    ) {
      try {
        lineupResult =
          await getLineups(
            Number(
              live.id
            )
          );

        lineupPlayerIds =
          collectPlayerIds(
            lineupResult
          );
      } catch (error) {
        lineupResult = {
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

      player_id:
        6135,

      team:
        result.team,

      updated_at:
        result.updated_at,

      live_fixture:
        live
          ? {
              id:
                live.id,

              status:
                live.status ??
                null,

              date:
                live.date ??
                null,

              home_team:
                live.home_team ??
                null,

              away_team:
                live.away_team ??
                null,

              home_score:
                live.home_score ??
                null,

              away_score:
                live.away_score ??
                null
            }
          : null,

      lineup_status:
        lineupResult?.status ??
        null,

      lineup_top_level_keys:
        lineupResult
          ? Object.keys(
              lineupResult
            )
          : [],

      lineup_player_ids:
        lineupPlayerIds,

      hamza_in_lineup:
        lineupPlayerIds.includes(
          6135
        ),

      lineup:
        lineupResult
    });
  } catch (error) {
    console.error(
      "Live lineup diagnostic failed:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Live lineup diagnostic failed"
      },
      {
        status: 500
      }
    );
  }
}
