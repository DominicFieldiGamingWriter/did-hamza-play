import {
  findPlayer,
  getPlayer,
  getTeamFixtures,
  getLineups,
  getFixturePlayerStats,
  getSidelined
} from "./api-football";
import { getSupabaseAdmin } from "./supabase";

function getPlayerStatus(
  playerId: number,
  lineups: any[],
  playerStats: any[],
  sidelined: any[]
) {
  // Check whether the player appeared in the match.
  for (const lineup of lineups) {
    const starters = lineup.starting_xi ?? lineup.startXI ?? [];
    const substitutes = lineup.substitutes ?? [];

    if (
      starters.some((p: any) => p.player?.id === playerId)
    ) {
      return {
        played: true,
        type: "started",
        label: "Started"
      };
    }

    if (
      substitutes.some((p: any) => p.player?.id === playerId)
    ) {
      return {
        played: true,
        type: "substitute",
        label: "Came on as substitute"
      };
    }
  }

  // Check player statistics as a second confirmation.
  for (const group of playerStats) {
    const players = group.players ?? [];

    for (const entry of players) {
      if (entry.player?.id === playerId) {
        const stats = entry.statistics?.[0];

        if (
          stats?.minutes ||
          stats?.games?.minutes > 0 ||
          stats?.games?.appearences > 0
        ) {
          return {
            played: true,
            type: "played",
            label: "Played"
          };
        }
      }
    }
  }

  // If he did not play, look for an absence reason.
  const absence = sidelined?.[0];

  if (absence) {
    const status = String(
      absence.status ?? absence.type ?? ""
    ).toLowerCase();

    const reason = absence.reason ?? "";

    if (status.includes("suspend")) {
      return {
        played: false,
        type: "suspended",
        label: "Suspended",
        reason
      };
    }

    if (status.includes("injur")) {
      return {
        played: false,
        type: "injured",
        label: "Injured",
        reason
      };
    }

    if (status.includes("doubt")) {
      return {
        played: false,
        type: "doubtful",
        label: "Doubtful",
        reason
      };
    }
  }

  return {
    played: false,
    type: "not_selected",
    label: "Not selected"
  };
}

function getNextMatchStatus(sidelined: any[]) {
  const absence = sidelined?.[0];

  if (!absence) {
    return {
      status: "likely_available",
      label: "Likely available",
      reason: "No current injury or suspension is listed."
    };
  }

  const status = String(
    absence.status ?? absence.type ?? ""
  ).toLowerCase();

  const reason = absence.reason ?? "";

  if (status.includes("suspend")) {
    return {
      status: "unavailable",
      label: "Unavailable",
      reason: reason || "Suspended."
    };
  }

  if (status.includes("injur")) {
    return {
      status: "unavailable",
      label: "Unavailable",
      reason: reason || "Injured."
    };
  }

  if (status.includes("doubt")) {
    return {
      status: "doubtful",
      label: "Doubtful",
      reason: reason || "Listed as doubtful."
    };
  }

  return {
    status: "likely_available",
    label: "Likely available",
    reason: reason || "No current absence is listed."
  };
}

export async function refreshPlayerPage() {
  const playerName =
    process.env.PLAYER_NAME || "Hamza Choudhury";

  const configuredPlayerId = Number(
    process.env.PLAYER_ID || 6135
  );

  let player;

  if (configuredPlayerId) {
    player = await getPlayer(configuredPlayerId);
  } else {
    const results = await findPlayer(playerName);

    if (!results.length) {
      throw new Error(
        `Could not find player: ${playerName}`
      );
    }

    player = results[0];
  }

  const playerId = player.id;
  const team = player.team;

  if (!team?.id) {
    throw new Error(
      "Could not determine Hamza's current team."
    );
  }

  const { last, next } = await getTeamFixtures(team.id);

  if (!last) {
    throw new Error(
      "Could not find the latest completed fixture."
    );
  }

  const [
    lineups,
    playerStats,
    sidelined
  ] = await Promise.all([
    getLineups(last.id),
    getFixturePlayerStats(last.id, team.id),
    getSidelined(playerId)
  ]);

  const lastStatus = getPlayerStatus(
    playerId,
    lineups,
    playerStats,
    sidelined
  );

  const nextStatus = getNextMatchStatus(sidelined);

  const payload = {
    id: 1,
    player_id: playerId,
    player_name: player.name,
    team_id: team.id,
    team_name: team.name,
    team_logo: team.logo ?? null,
    player_photo: player.photo ?? null,

    last_fixture: {
      ...last,
      player_status: lastStatus
    },

    next_fixtures: next,

    player_status: {
      latest_match: lastStatus,
      next_match: nextStatus
    },

    updated_at: new Date().toISOString()
  };

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("player_page")
    .upsert(payload);

  if (error) {
    throw new Error(
      `Supabase error: ${error.message}`
    );
  }

  return payload;
}
