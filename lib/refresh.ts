import {
  findPlayer,
  getPlayer,
  findTeam,
  getTeamSquad,
  getTeamFixtures,
  getLineups,
  getFixturePlayerStats
} from "./api-football";

import { getSupabaseAdmin } from "./supabase";

function playerPlayed(
  playerId: number,
  lineups: any[],
  playerStats: any[]
) {
  for (const lineup of lineups) {
    const starters =
      lineup.starting_xi ??
      lineup.startXI ??
      [];

    const substitutes =
      lineup.substitutes ??
      [];

    if (
      starters.some(
        (p: any) =>
          p.player?.id === playerId
      )
    ) {
      return {
        played: true,
        type: "started",
        label: "Started"
      };
    }

    if (
      substitutes.some(
        (p: any) =>
          p.player?.id === playerId
      )
    ) {
      return {
        played: true,
        type: "substitute",
        label: "Came on as substitute"
      };
    }
  }

  for (const entry of playerStats) {
    if (entry.player?.id !== playerId) {
      continue;
    }

    const stats =
      entry.statistics?.[0] ??
      entry.stats ??
      entry;

    const minutes =
      stats?.minutes ??
      stats?.games?.minutes ??
      0;

    if (Number(minutes) > 0) {
      return {
        played: true,
        type: "played",
        label: "Played"
      };
    }
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
      label: "Unavailable",
      reason: reason || "Injured"
    };
  }

  if (availability === "doubtful") {
    return {
      status: "doubtful",
      label: "Doubtful",
      reason: reason || "Listed as doubtful"
    };
  }

  if (availability === "suspended") {
    return {
      status: "unavailable",
      label: "Unavailable",
      reason: reason || "Suspended"
    };
  }

  return {
    status: "likely_available",
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

  const player = await getPlayer(playerId);

  if (!player) {
    throw new Error(
      `Could not find player ID ${playerId}.`
    );
  }

  // Find Sheffield United from BSD rather than
  // relying on the player profile to contain a team.
  const teams = await findTeam(
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
        Number(p.id ?? p.player?.id) ===
        playerId
    ) ?? null;

  const { last, next } =
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

    player_id: playerId,

    player_name:
      player?.name ??
      squadPlayer?.name ??
      playerName,

    team_id: team.id,

    team_name: team.name,

    team_logo:
      team.logo ??
      null,

    player_photo:
      player?.photo ??
      squadPlayer?.photo ??
      null,

    last_fixture: {
      ...last,
      player_status: lastStatus
    },

    next_fixtures: next,

    player_status: {
      latest_match: lastStatus,
      next_match: nextStatus
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
