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
  const ids = [
    value?.id,
    value?.player_id,
    value?.player?.id,
    value?.player?.player_id
  ];

  for (const id of ids) {
    const numberId = Number(id);

    if (Number.isFinite(numberId)) {
      return numberId;
    }
  }

  return null;
}

function getPlayerName(value: any): string {
  const names = [
    value?.name,
    value?.player_name,
    value?.full_name,
    value?.player?.name,
    value?.player?.full_name
  ];

  for (const name of names) {
    if (typeof name === "string" && name.trim()) {
      return name.trim().toLowerCase();
    }
  }

  return "";
}

function hasMinutes(value: any): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const values = [
    value.minutes,
    value.minutes_played,
    value.played_minutes,
    value.min,
    value.played,
    value.games?.minutes,
    value.stats?.minutes,
    value.statistics?.minutes,
    value.statistics?.[0]?.minutes,
    value.statistics?.[0]?.games?.minutes
  ];

  for (const value of values) {
    const minutes = Number(value);

    if (Number.isFinite(minutes) && minutes > 0) {
      return true;
    }
  }

  return false;
}

function findPlayerRecord(
  value: any,
  playerId: number,
  playerName: string
): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((entry) =>
      findPlayerRecord(
        entry,
        playerId,
        playerName
      )
    );
  }

  const id = getPlayerId(value);
  const name = getPlayerName(value);

  const idMatches =
    id !== null &&
    id === playerId;

  const nameMatches =
    name === playerName ||
    name.includes(playerName) ||
    playerName.includes(name);

  if (
    (idMatches || nameMatches) &&
    hasMinutes(value)
  ) {
    return true;
  }

  for (const child of Object.values(value)) {
    if (
      child &&
      typeof child === "object" &&
      findPlayerRecord(
        child,
        playerId,
        playerName
      )
    ) {
      return true;
    }
  }

  return false;
}

function playerPlayed(
  playerId: number,
  playerName: string,
  lineups: any[],
  playerStats: any[]
) {
  const normalizedName =
    playerName.trim().toLowerCase();

  if (
    findPlayerRecord(
      playerStats,
      playerId,
      normalizedName
    )
  ) {
    return {
      played: true,
      type: "played",
      label: "Played"
    };
  }

  if (
    findPlayerRecord(
      lineups,
      playerId,
      normalizedName
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
    squadPlayer?.injury_type ?? "";

  if (availability === "injured") {
    return {
      status: "unavailable",
      type: "injured",
      label: "Unavailable",
      reason: reason || "Injured"
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
    await findTeam("Sheffield United");

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
    await getTeamFixtures(team.id);

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

  const actualPlayerName =
    player?.name ??
    squadPlayer?.name ??
    playerName;

  const lastStatus =
    playerPlayed(
      playerId,
      actualPlayerName,
      lineupData.lineups,
      playerStats
    );

  const nextStatus =
    getAvailabilityStatus(
      squadPlayer
    );

  const payload = {
    id: 1,

    player_id: playerId,

    player_name:
      actualPlayerName,

    team_id: team.id,

    team_name:
      team.name,

    team_logo:
      team.logo ?? null,

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
