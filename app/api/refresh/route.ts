import { NextResponse } from "next/server";
import { refreshPlayerPage } from "../../../lib/refresh";
import {
  findTeam
} from "../../../lib/api-football";

const BASE_URL =
  "https://sports.bzzoiro.com/api/v2";

function getKey() {
  const key =
    process.env.BSD_API_KEY;

  if (!key) {
    throw new Error(
      "BSD_API_KEY is not configured."
    );
  }

  return key;
}

async function bsdGet(
  path: string,
  params: Record<
    string,
    string | number | undefined
  > = {}
) {
  const url =
    new URL(
      `${BASE_URL}${path}`
    );

  for (
    const [key, value] of Object.entries(
      params
    )
  ) {
    if (
      value !== undefined &&
      value !== ""
    ) {
      url.searchParams.set(
        key,
        String(value)
      );
    }
  }

  const response =
    await fetch(url, {
      headers: {
        Authorization:
          `Token ${getKey()}`,
        Accept:
          "application/json"
      },
      cache:
        "no-store"
    });

  if (!response.ok) {
    throw new Error(
      `BSD API ${response.status}: ${await response.text()}`
    );
  }

  return response.json();
}

function responseArray(
  data: any
): any[] {
  if (
    Array.isArray(data)
  ) {
    return data;
  }

  if (
    Array.isArray(
      data?.results
    )
  ) {
    return data.results;
  }

  if (
    Array.isArray(
      data?.data
    )
  ) {
    return data.data;
  }

  if (
    Array.isArray(
      data?.events
    )
  ) {
    return data.events;
  }

  return [];
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

    const allEvents =
      await bsdGet(
        "/events/",
        {
          team_id:
            Number(team.id),
          limit:
            100
        }
      );

    const events =
      responseArray(
        allEvents
      );

    const simplified =
      events.map(
        (event: any) => ({
          id:
            event?.id ??
            event?.event_id ??
            null,

          status:
            event?.status ??
            event?.state ??
            event?.match_status ??
            event?.event_status ??
            null,

          date:
            event?.time?.kickoff_at ??
            event?.time?.start_time ??
            event?.kickoff_at ??
            event?.kickoff ??
            event?.event_date ??
            event?.date ??
            event?.start_time ??
            null,

          home:
            event?.home?.name ??
            event?.home_team?.name ??
            event?.home_team_name ??
            null,

          away:
            event?.away?.name ??
            event?.away_team?.name ??
            event?.away_team_name ??
            null,

          raw_status_keys:
            {
              status:
                event?.status ??
                null,

              state:
                event?.state ??
                null,

              match_status:
                event?.match_status ??
                null,

              event_status:
                event?.event_status ??
                null
            }
        })
      );

    return NextResponse.json(
      {
        ok: true,
        player:
          result.player,
        team:
          result.team,
        updated_at:
          result.updated_at,

        event_count:
          simplified.length,

        events:
          simplified
      }
    );
  } catch (error) {
    console.error(
      "Refresh diagnostic failed:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Refresh diagnostic failed"
      },
      {
        status: 500
      }
    );
  }
}
