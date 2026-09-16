import { NextResponse } from "next/server";
import { refreshPlayerPage } from "../../../lib/refresh";
import { getSupabaseAdmin } from "../../../lib/supabase";

function getId(
  value: any
): number | null {
  const candidates = [
    value?.id,
    value?.player_id,
    value?.player?.id,
    value?.player?.player_id,
    value?.player_in?.id,
    value?.player_out?.id,
    value?.playerIn?.id,
    value?.playerOut?.id
  ];

  for (const candidate of candidates) {
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

function getName(
  value: any
): string | null {
  const candidates = [
    value?.name,
    value?.player_name,
    value?.full_name,
    value?.player?.name,
    value?.player?.full_name,
    value?.player_in?.name,
    value?.player_out?.name,
    value?.playerIn?.name,
    value?.playerOut?.name,
    value?.team?.name,
    value?.team_name
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return null;
}

function getMinute(
  value: any
): number | null {
  const candidates = [
    value?.minute,
    value?.min,
    value?.event_minute,
    value?.minute_value,
    value?.time?.minute
  ];

  for (const candidate of candidates) {
    const number =
      Number(candidate);

    if (
      Number.isFinite(number) &&
      number >= 0
    ) {
      return number;
    }
  }

  return null;
}

function getType(
  value: any
): string {
  const candidates = [
    value?.type,
    value?.event_type,
    value?.incident_type,
    value?.action_type,
    value?.kind,
    value?.event
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return "UNKNOWN";
}

function objectKeys(
  value: any
): string[] {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return [];
  }

  return Object.keys(value);
}

function inspectIncident(
  incident: any
) {
  return {
    type:
      getType(incident),

    minute:
      getMinute(incident),

    player:
      getName(
        incident?.player
      ) ??
      incident?.player_name ??
      null,

    player_id:
      getId(
        incident?.player
      ) ??
      incident?.player_id ??
      null,

    player_on:
      getName(
        incident?.player_on
      ) ??
      getName(
        incident?.player_in
      ) ??
      null,

    player_on_id:
      getId(
        incident?.player_on
      ) ??
      getId(
        incident?.player_in
      ) ??
      null,

    player_off:
      getName(
        incident?.player_off
      ) ??
      getName(
        incident?.player_out
      ) ??
      null,

    player_off_id:
      getId(
        incident?.player_off
      ) ??
      getId(
        incident?.player_out
      ) ??
      null,

    team:
      getName(
        incident?.team
      ) ??
      incident?.team_name ??
      null,

    assist:
      getName(
        incident?.assist
      ) ??
      getName(
        incident?.assistant
      ) ??
      getName(
        incident?.assist_player
      ) ??
      null,

    top_level_keys:
      objectKeys(
        incident
      ),

    nested_player_keys:
      objectKeys(
        incident?.player
      ),

    nested_player_on_keys:
      objectKeys(
        incident?.player_on ??
        incident?.player_in
      ),

    nested_player_off_keys:
      objectKeys(
        incident?.player_off ??
        incident?.player_out
      )
  };
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

    const supabase =
      getSupabaseAdmin();

    const {
      data,
      error
    } = await supabase
      .from("player_page")
      .select(
        "last_fixture"
      )
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Could not read refreshed data: ${error.message}`
      );
    }

    const incidents =
      Array.isArray(
        data?.last_fixture?.incidents
      )
        ? data.last_fixture.incidents
        : [];

    return NextResponse.json({
      ok: true,

      player:
        result.player,

      team:
        result.team,

      updated_at:
        result.updated_at,

      incident_count:
        incidents.length,

      incident_types:
        Array.from(
          new Set(
            incidents.map(
              getType
            )
          )
        ),

      /*
       * Diagnostic only:
       * expose the actual shape of each
       * incident without dumping the entire
       * raw payload.
       */
      incident_debug:
        incidents.map(
          inspectIncident
        )
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
