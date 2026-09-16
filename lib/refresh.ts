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

function getTeamInfo(
  value: any
): {
  id: number;
  name: string;
} {
  if (
    typeof value === "string"
  ) {
    return {
      id: 0,
      name: value.trim() || "Unknown"
    };
  }

  if (
    typeof value !== "object" ||
    value === null
  ) {
    return {
      id: 0,
      name: "Unknown"
    };
  }

  const idCandidates = [
    value.id,
    value.team_id,
    value.team?.id
  ];

  let id = 0;

  for (
    const candidate of idCandidates
  ) {
    const numberId =
      Number(candidate);

    if (
      Number.isFinite(numberId) &&
      numberId > 0
    ) {
      id = numberId;
      break;
    }
  }

  const nameCandidates = [
    value.name,
    value.team_name,
    value.team?.name,
    value.full_name,
    value.short_name
  ];

  for (
    const candidate of nameCandidates
  ) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return {
        id,
        name: candidate.trim()
      };
    }
  }

  return {
    id,
    name: "Unknown"
  };
}

function normaliseFixture(
  fixture: any,
  teamId: number
) {
  /*
   * BSD can expose the two teams through
   * slightly different fields depending on
   * the fixture endpoint/version.
   *
   * Try all known shapes.
   */
  const rawHome =
    fixture?.home ??
    fixture?.home_team ??
    fixture?.homeTeam ??
    fixture?.teams?.home ??
    fixture?.teams?.home_team ??
    fixture?.participants?.home ??
    fixture?.participants?.home_team ??
    fixture?.homeTeamData ??
    null;

  const rawAway =
    fixture?.away ??
    fixture?.away_team ??
    fixture?.awayTeam ??
    fixture?.teams?.away ??
    fixture?.teams?.away_team ??
    fixture?.participants?.away ??
    fixture?.participants?.away_team ??
    fixture?.awayTeamData ??
    null;

  const homeInfo =
    getTeamInfo(rawHome);

  const awayInfo =
    getTeamInfo(rawAway);

  /*
   * Also support flat BSD fields.
   */
  const homeId =
    homeInfo.id ||
    Number(
      fixture?.home_team_id ??
      fixture?.home_id ??
      0
    );

  const awayId =
    awayInfo.id ||
    Number(
      fixture?.away_team_id ??
      fixture?.away_id ??
      0
    );

  const homeName =
    homeInfo.name !== "Unknown"
      ? homeInfo.name
      : (
          fixture?.home_team_name ??
          fixture?.home_name ??
          "Unknown"
        );

  const awayName =
    awayInfo.name !== "Unknown"
      ? awayInfo.name
      : (
          fixture?.away_team_name ??
          fixture?.away_name ??
          "Unknown"
        );

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
    fixture?.time?.kickoff_at ??
    fixture?.kickoff_at ??
    fixture?.kickoff ??
    fixture?.event_date ??
    fixture?.date ??
    fixture?.start_time ??
    null;

  const isHome =
    homeId === teamId;

  const isAway =
    awayId === teamId;

  let opponentName = "Unknown";
  let opponentId: number | null = null;

  if (isHome) {
    opponentName = awayName;
    opponentId =
      awayId || null;
  } else if (isAway) {
    opponentName = homeName;
    opponentId =
      homeId || null;
  }

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

    home_score:
      scoreHome,

    away_score:
      scoreAway,

    opponent_name:
      opponentName,

    opponent_id:
      opponentId
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
