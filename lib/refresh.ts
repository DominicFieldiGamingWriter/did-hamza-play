import {
  findTeam,
  getPlayer,
  getTeamSquad,
  getTeamFixtures,
  getLineups,
  getFixturePlayerStats,
  getFixtureIncidents
} from "./api-football";

import {
  getSupabaseAdmin
} from "./supabase";

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

function getName(
  value: any
): string {
  const candidates = [
    value?.name,
    value?.player_name,
    value?.full_name,
    value?.player?.name,
    value?.player?.full_name
  ];

  for (
    const candidate of candidates
  ) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return "";
}

function hasMinutes(
  value: any
): boolean {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return false;
  }

  const candidates = [
    value.minutes,
    value.minutes_played,
    value.played_minutes,
    value.min,
    value.games?.minutes,
    value.stats?.minutes,
    value.statistics?.minutes,
    value.statistics?.[0]?.minutes
  ];

  return candidates.some(
    (candidate) => {
      const number =
        Number(candidate);

      return (
        Number.isFinite(number) &&
        number > 0
      );
    }
  );
}

function findPlayerRecord(
  value: any,
  playerId: number,
  playerName: string
): any | null {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  if (Array.isArray(value)) {
    for (
      const item of value
    ) {
      const found =
        findPlayerRecord(
          item,
          playerId,
          playerName
        );

      if (found) {
        return found;
      }
    }

    return null;
  }

  const id =
    getId(value);

  const name =
    getName(value)
      .toLowerCase();

  const target =
    playerName
      .toLowerCase();

  if (
    (
      id !== null &&
      id === playerId
    ) ||
    name === target ||
    name.includes(target) ||
    target.includes(name)
  ) {
    return value;
  }

  for (
    const child of Object.values(
      value
    )
  ) {
    if (
      child &&
      typeof child ===
        "object"
    ) {
      const found =
        findPlayerRecord(
          child,
          playerId,
          playerName
        );

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function playerPlayed(
  playerId: number,
  playerName: string,
  lineups: any[],
  playerStats: any[]
) {
  if (
    findPlayerRecord(
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
    findPlayerRecord(
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

function getTeamInfo(
  value: any
) {
  if (
    typeof value ===
      "string"
  ) {
    return {
      id: 0,
      name:
        value.trim() ||
        "Unknown"
    };
  }

  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {
      id: 0,
      name:
        "Unknown"
    };
  }

  const ids = [
    value.id,
    value.team_id,
    value.team?.id
  ];

  let id = 0;

  for (
    const candidate of ids
  ) {
    const number =
      Number(candidate);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      id = number;
      break;
    }
  }

  const names = [
    value.name,
    value.team_name,
    value.full_name,
    value.short_name,
    value.team?.name
  ];

  for (
    const candidate of names
  ) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return {
        id,
        name:
          candidate.trim()
      };
    }
  }

  return {
    id,
    name:
      "Unknown"
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
    fixture?.teams?.home ??
    fixture?.participants?.home ??
    null;

  const away =
    fixture?.away ??
    fixture?.away_team ??
    fixture?.awayTeam ??
    fixture?.teams?.away ??
    fixture?.participants?.away ??
    null;

  const homeInfo =
    getTeamInfo(home);

  const awayInfo =
    getTeamInfo(away);

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
    homeInfo.name !==
      "Unknown"
      ? homeInfo.name
      : (
          fixture?.home_team_name ??
          fixture?.home_name ??
          "Unknown"
        );

  const awayName =
    awayInfo.name !==
      "Unknown"
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
      isHome
        ? awayName
        : isAway
        ? homeName
        : "Unknown",

    opponent_id:
      isHome
        ? awayId || null
        : isAway
        ? homeId || null
        : null
  };
}

function getIncidentType(
  incident: any
): string {
  const candidates = [
    incident?.type,
    incident?.event_type,
    incident?.incident_type,
    incident?.action_type,
    incident?.kind,
    incident?.event
  ];

  for (
    const candidate of candidates
  ) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return "UNKNOWN";
}

function sanitiseIncident(
  incident: any
) {
  /*
   * Keep the raw BSD structure, but
   * expose the useful identifying fields
   * in the GitHub Action output.
   */
  return {
    type:
      getIncidentType(
        incident
      ),

    minute:
      incident?.minute ??
      incident?.min ??
      incident?.time?.minute ??
      null,

    player:
      getName(
        incident?.player
      ) ||
      incident?.player_name ||
      null,

    player_id:
      getId(
        incident?.player
      ),

    player_on:
      getName(
        incident?.player_on
      ) ||
      getName(
        incident?.player_in
      ) ||
      null,

    player_on_id:
      getId(
        incident?.player_on
      ) ??
      getId(
        incident?.player_in
      ),

    player_off:
      getName(
        incident?.player_off
      ) ||
      getName(
        incident?.player_out
      ) ||
      null,

    player_off_id:
      getId(
        incident?.player_off
      ) ??
      getId(
        incident?.player_out
      ),

    team:
      getName(
        incident?.team
      ) ||
      incident?.team_name ||
      null,

    assist:
      getName(
        incident?.assist
      ) ||
      getName(
        incident?.assistant
      ) ||
      getName(
        incident?.assist_player
      ) ||
      null,

    raw:
      incident
  };
}

function inspectIncidents(
  incidents: any[]
) {
  const types =
    incidents.map(
      getIncidentType
    );

  const uniqueTypes =
    Array.from(
      new Set(types)
    );

  const samples =
    incidents
      .slice(0, 12)
      .map(
        sanitiseIncident
      );

  return {
    count:
      incidents.length,

    types:
      uniqueTypes,

    samples
  };
}

function getAvailabilityStatus(
  squadPlayer: any
) {
  const availability =
    String(
      squadPlayer?.availability ??
      ""
    ).toLowerCase();

  const reason =
    squadPlayer?.injury_type ??
    "";

  if (
    availability ===
    "injured"
  ) {
    return {
      status:
        "unavailable",
      type:
        "injured",
      label:
        "Unavailable",
      reason:
        reason ||
        "Injured"
    };
  }

  if (
    availability ===
    "doubtful"
  ) {
    return {
      status:
        "doubtful",
      type:
        "doubtful",
      label:
        "Doubtful",
      reason:
        reason ||
        "Listed as doubtful"
    };
  }

  if (
    availability ===
    "suspended"
  ) {
    return {
      status:
        "unavailable",
      type:
        "suspended",
      label:
        "Unavailable",
      reason:
        reason ||
        "Suspended"
    };
  }

  return {
    status:
      "likely_available",
    type:
      "likely_available",
    label:
      "Likely available",
    reason:
      "No current injury, doubt or suspension is listed."
  };
}

export async function refreshPlayerPage() {
  const playerName =
    process.env.PLAYER_NAME ||
    "Hamza Choudhury";

  const playerId =
    Number(
      process.env.PLAYER_ID ||
      6135
    );

  const player =
    await getPlayer(
      playerId
    );

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
        String(
          t.name
        ).toLowerCase() ===
        "sheffield united"
    ) ??
    teams[0];

  if (!team?.id) {
    throw new Error(
      "Could not find Sheffield United in BSD."
    );
  }

  const squad =
    await getTeamSquad(
      team.id
    );

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
    playerStats,
    incidents
  ] = await Promise.all([
    getLineups(
      last.id
    ),
    getFixturePlayerStats(
      last.id
    ),
    getFixtureIncidents(
      last.id
    )
  ]);

  const incidentInspection =
    inspectIncidents(
      incidents
    );

  console.log(
    "BSD INCIDENT DEBUG",
    JSON.stringify(
      incidentInspection,
      null,
      2
    )
  );

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

  /*
   * Keep appearance detection deliberately
   * conservative until we know the exact
   * BSD incident structure.
   *
   * We will not invent minutes or
   * substitution times here.
   */
  const playerRecord =
    findPlayerRecord(
      playerStats,
      playerId,
      actualPlayerName
    );

  const statMinutes =
    (() => {
      const candidates = [
        playerRecord?.minutes,
        playerRecord?.minutes_played,
        playerRecord?.played_minutes,
        playerRecord?.min,
        playerRecord?.games?.minutes,
        playerRecord?.stats?.minutes,
        playerRecord?.statistics?.minutes
      ];

      for (
        const candidate of candidates
      ) {
        const number =
          Number(candidate);

        if (
          Number.isFinite(number) &&
          number > 0 &&
          number <= 130
        ) {
          return number;
        }
      }

      return null;
    })();

  const appearanceDetails = {
    minutes:
      statMinutes,

    started:
      lastStatus.played === true,

    subbed_on_minute:
      null,

    subbed_off_minute:
      null,

    replaced_player:
      null,

    summary:
      lastStatus.played
        ? (
            statMinutes !== null
              ? `Played ${statMinutes} mins. Started.`
              : "Played. Started."
          )
        : "Did not feature."
  };

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
      team.logo ??
      null,

    player_photo:
      player?.photo ??
      squadPlayer?.photo ??
      null,

    last_fixture: {
      ...normalisedLast,

      /*
       * Store the raw BSD incident response.
       * No hard-coded event data.
       */
      incidents,

      player_status: {
        ...lastStatus,

        appearance:
          appearanceDetails
      }
    },

    next_fixtures:
      normalisedNext,

    player_status: {
      latest_match: {
        ...lastStatus,

        appearance:
          appearanceDetails
      },

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
      .upsert(
        payload
      );

  if (error) {
    throw new Error(
      `Supabase error: ${error.message}`
    );
  }

  return {
    ok: true,

    player:
      actualPlayerName,

    team:
      team.name,

    updated_at:
      payload.updated_at,

    incident_count:
      incidents.length,

    incident_types:
      incidentInspection.types
  };
}
