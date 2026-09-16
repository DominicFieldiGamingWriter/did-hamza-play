import {
  findTeam,
  getPlayer,
  getTeamSquad,
  getTeamFixtures,
  getLineups,
  getFixturePlayerStats
} from "./api-football";

import { getSupabaseAdmin } from "./supabase";

function getPlayerId(value: any): number | null {
  const possibleIds = [
    value?.id,
    value?.player_id,
    value?.player?.id,
    value?.player?.player_id
  ];

  for (const id of possibleIds) {
    const numberId = Number(id);

    if (Number.isFinite(numberId)) {
      return numberId;
    }
  }

  return null;
}

function hasMinutes(value: any): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const minuteValues = [
    value.minutes,
    value.minutes_played,
    value.played_minutes,
    value.games?.minutes,
    value.stats?.minutes,
    value.statistics?.minutes,
    value.statistics?.[0]?.minutes,
    value.statistics?.[0]?.games?.minutes
  ];

  for (const minutes of minuteValues) {
    const numberMinutes = Number(minutes);

    if (
      Number.isFinite(numberMinutes) &&
      numberMinutes > 0
    ) {
      return true;
    }
  }

  return false;
}

function findPlayerInObject(
  value: any,
  playerId: number
): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((entry) =>
      findPlayerInObject(entry, playerId)
    );
  }

  const id = getPlayerId(value);

  if (
    id === playerId &&
    hasMinutes(value)
  ) {
    return true;
  }

  for (const child of Object.values(value)) {
    if (
      child &&
      typeof child === "object" &&
      findPlayerInObject(child, playerId)
    ) {
      return true;
    }
  }

  return false;
}

function playerPlayed(
  playerId: number,
  lineups: any[],
  playerStats: any[]
) {
  if (
    findPlayerInObject(
      playerStats,
      playerId
    )
  ) {
    return {
      played: true,
      type: "played",
      label: "Played"
    };
  }

  if (
    findPlayerInObject(
      lineups,
      playerId
    )
  ) {
    return {
      played: true,
      type: "played",
      label: "Played"
    };
  }

  return {
    played: false,
    type: "not_selected",
    label: "Did not play"
  };
}

function getAvailabilityStatus(
  squadPlayer: any
) {
  const availability =
    String(
      squadPlayer?.availability ?? ""
    ).toLowerCase();

  const reason =
    squadPlayer?.injury_type ??
    "";

  if (availability === "injured") {
    return {
      status: "unavailable",
      type: "injured",
      label: "Unavailable",
      reason:
        reason || "Injured"
    };
  }

  if (availability === "doubtful") {
    return {
      status: "doubtful",
      type: "doubtful",
      label: "Doubtful",
      reason:
        reason || "Listed as doubtful"
    };
  }

  if (availability === "suspended") {
    return {
      status: "unavailable",
      type: "suspended",
      label: "Unavailable",
      reason:
        reason || "Suspended"
    };
  }

  return {
    status: "likely_available",
    type: "likely_available",
    label: "Likely available",
    reason:
      "No current injury, doubt or suspension is listed."
  };
}

export async function refreshPlayerPage() {
  const playerName =
    process.env.PLAYER_NAME ||
    "Hamza Choudhury";

  const playerId = Number(
    process.env.PLAYER_ID || 6135
  );

  const player =
    await getPlayer(playerId);

  if (!player) {
    throw new Error(
      `Could not find player ID ${playerId}.`
    );
  }

  const teams =
    await findTeam(
      "Sheffield United"
    );

  const team =
    teams.find(
      (t: any) =>
        String(t.name).toLowerCase() ===
        "sheffield united"
    ) ??
    teams[0];

  if (!team?.id) {
    throw new Error(
      "Could not find Sheffield United in BSD."
    );
  }

  const squad =
    await getTeamSquad(team.id);

  const squadPlayer =
    squad.find(
      (p: any) =>
        Number(
          p.id ??
          p.player?.id
        ) === playerId
    ) ?? null;

  const {
    last,
    next
  } =
    await getTeamFixtures(
      team.id
    );

  if (!last) {
    throw new Error(
      "Could not find Sheffield United's latest completed match."
    );
  }

  const [
    lineupData,
    playerStats
  ] = await Promise.all([
    getLineups(last.id),
    getFixturePlayerStats(last.id)
  ]);

  const lastStatus =
    playerPlayed(
      playerId,
      lineupData.lineups,
      playerStats
    );

  const nextStatus =
    getAvailabilityStatus(
      squadPlayer
    );

  const payload = {
    id: 1,

    player_id:
      playerId,

    player_name:
      player?.name ??
      squadPlayer?.name ??
      playerName,

    team_id:
      team.id,

    team_name:
      team.name,

    team_logo:
      team.logo ??
      null,

    player_photo:
      player?.photo ??
      squadPlayer?.photo ??
      null,

    last_fixture: {
      ...last,

      player_status:
        lastStatus
    },

    next_fixtures:
      next,

    player_status: {
      latest_match:
        lastStatus,

      next_match:
        nextStatus
    },

    updated_at:
      new Date().toISOString()
  };

  const supabase =
    getSupabaseAdmin();

  const { error } =
    await supabase
      .from("player_page")
      .upsert(payload);

  if (error) {
    throw new Error(
      `Supabase error: ${error.message}`
    );
  }

  return payload;
}
