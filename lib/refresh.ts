import {
  findTeam,
  getPlayer,
  getTeamSquad,
  getTeamFixtures,
  getLineups,
  getFixturePlayerStats
} from "./api-football";

import { getSupabaseAdmin } from "./supabase";

function getId(value: any): number | null {
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

function getName(value: any): string {
  const names = [
    value?.name,
    value?.player_name,
    value?.full_name,
    value?.player?.name,
    value?.player?.full_name
  ];

  for (const name of names) {
    if (
      typeof name === "string" &&
      name.trim()
    ) {
      return name
        .trim()
        .toLowerCase();
    }
  }

  return "";
}

function hasMinutes(value: any): boolean {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const minuteValues = [
    value.minutes,
    value.minutes_played,
    value.played_minutes,
    value.min,
    value.games?.minutes,
    value.stats?.minutes,
    value.statistics?.minutes,
    value.statistics?.[0]?.minutes,
    value.statistics?.[0]?.games?.minutes
  ];

  return minuteValues.some(
    (minutes) => {
      const numberMinutes =
        Number(minutes);

      return (
        Number.isFinite(numberMinutes) &&
        numberMinutes > 0
      );
    }
  );
}

function findPlayerWithMinutes(
  value: any,
  playerId: number,
  playerName: string
): boolean {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((entry) =>
      findPlayerWithMinutes(
        entry,
        playerId,
        playerName
      )
    );
  }

  const id = getId(value);
  const name = getName(value);

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

  return Object.values(value).some(
    (child) =>
      child &&
      typeof child === "object" &&
      findPlayerWithMinutes(
        child,
        playerId,
        playerName
      )
  );
}

function findPlayerAnywhere(
  value: any,
  playerId: number,
  playerName: string
): boolean {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((entry) =>
      findPlayerAnywhere(
        entry,
        playerId,
        playerName
      )
    );
  }

  const id = getId(value);
  const name = getName(value);

  const idMatches =
    id !== null &&
    id === playerId;

  const nameMatches =
    name === playerName ||
    name.includes(playerName) ||
    playerName.includes(name);

  if (
    idMatches ||
    nameMatches
  ) {
    return true;
  }

  return Object.values(value).some(
    (child) =>
      child &&
      typeof child === "object" &&
      findPlayerAnywhere(
        child,
        playerId,
        playerName
      )
  );
}

function playerPlayed(
  playerId: number,
  playerName: string,
  lineups: any[],
  playerStats: any[]
) {
  /*
   * First choice: an actual player-stat record
   * containing minutes.
   */
  if (
    findPlayerWithMinutes(
      playerStats,
      playerId,
      playerName
    )
  ) {
    return {
      played: true,
      type: "played",
      label: "Played"
    };
  }

  /*
   * Second choice: player appears anywhere in
   * the official lineup response.
   */
  if (
    findPlayerAnywhere(
      lineups,
      playerId,
      playerName
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

  if (
    availability === "injured"
  ) {
    return {
      status: "unavailable",
      type: "injured",
      label: "Unavailable",
      reason:
        reason || "Injured"
    };
  }

  if (
    availability === "doubtful"
  ) {
    return {
      status: "doubtful",
      type: "doubtful",
      label: "Doubtful",
      reason:
        reason ||
        "Listed as doubtful"
    };
  }

  if (
    availability === "suspended"
  ) {
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

function normaliseFixture(
  fixture: any,
  teamId: number
) {
  const home =
    fixture?.home ??
    fixture?.home_team ??
    fixture?.homeTeam ??
    null;

  const away =
    fixture?.away ??
    fixture?.away_team ??
    fixture?.awayTeam ??
    null;

  const homeId =
    Number(
      home?.id ??
      fixture?.home_team_id ??
      fixture?.home_id ??
      0
    );

  const awayId =
    Number(
      away?.id ??
      fixture?.away_team_id ??
      fixture?.away_id ??
      0
    );

  const homeName =
    home?.name ??
    fixture?.home_team_name ??
    "Unknown";

  const awayName =
    away?.name ??
    fixture?.away_team_name ??
    "Unknown";

  const scoreHome =
    fixture?.score?.home ??
    fixture?.home_score ??
    fixture?.home_team_score ??
    null;

  const scoreAway =
    fixture?.score?.away ??
    fixture?.away_score ??
    fixture?.away_team_score ??
    null;

  const date =
    fixture?.kickoff ??
    fixture?.time?.kickoff_at ??
    fixture?.event_date ??
    fixture?.date ??
    fixture?.start_time ??
    null;

  return {
    ...fixture,

    date,

    home_team: {
      id: homeId,
      name: homeName
    },

    away_team: {
      id: awayId,
      name: awayName
    },

    home_score: scoreHome,
    away_score: scoreAway,

    opponent_name:
      homeId === teamId
        ? awayName
        : awayName === "Unknown"
        ? homeName
        : homeName,

    opponent_id:
      homeId === teamId
        ? awayId
        : awayId === teamId
        ? homeId
        : null
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
        String(t.name)
          .toLowerCase() ===
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

  const normalisedLast =
    normaliseFixture(
      last,
      team.id
    );

  const normalisedNext =
    next.map(
      (fixture: any) =>
        normaliseFixture(
          fixture,
          team.id
        )
    );

  const payload = {
    id: 1,

    player_id:
      playerId,

    player_name:
      actualPlayerName,

    team_id:
      team.id,

    team_name:
      team.name,

    team_logo:
      team.logo ?? null,

    player_photo:
      player?.photo ??
      squadPlayer?.photo ??
      null,

    last_fixture: {
      ...normalisedLast,

      player_status:
        lastStatus
    },

    next_fixtures:
      normalisedNext,

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
