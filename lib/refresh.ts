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
  if (
    typeof value ===
      "number"
  ) {
    return Number.isFinite(
      value
    ) &&
      value > 0
      ? value
      : null;
  }

  if (
    typeof value ===
      "string"
  ) {
    const id =
      Number(
        value
      );

    return Number.isFinite(
      id
    ) &&
      id > 0
      ? id
      : null;
  }

  const candidates = [
    value?.id,
    value?.player_id,
    value?.player?.id,
    value?.player?.player_id
  ];

  for (
    const candidate of candidates
  ) {
    const id =
      Number(
        candidate
      );

    if (
      Number.isFinite(
        id
      ) &&
      id > 0
    ) {
      return id;
    }
  }

  return null;
}

function getName(
  value: any
): string {
  if (
    typeof value ===
      "string"
  ) {
    return value.trim();
  }

  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return "";
  }

  const names = [
    value.name,
    value.player_name,
    value.full_name,
    value.player?.name,
    value.player?.full_name
  ];

  for (
    const name of names
  ) {
    if (
      typeof name ===
        "string" &&
      name.trim()
    ) {
      return name.trim();
    }
  }

  return "";
}

function playerMatchesId(
  value: any,
  playerId: number
): boolean {
  const id =
    getId(value);

  return (
    id !== null &&
    id === playerId
  );
}

function findPlayerRecord(
  value: any,
  playerId: number
): any | null {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
      const found =
        findPlayerRecord(
          item,
          playerId
        );

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (
    playerMatchesId(
      value,
      playerId
    )
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
          playerId
        );

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function hasPlayer(
  value: any,
  playerId: number
): boolean {
  return Boolean(
    findPlayerRecord(
      value,
      playerId
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
    hasPlayer(
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
    hasPlayer(
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

  /*
   * Keep the name check as a fallback
   * for providers that omit player IDs
   * in lineup data.
   */
  const target =
    playerName
      .trim()
      .toLowerCase();

  const text =
    JSON.stringify(
      lineups ??
      []
    ).toLowerCase();

  if (
    target &&
    text.includes(
      target
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

  for (
    const candidate of candidates
  ) {
    const minute =
      Number(
        candidate
      );

    if (
      Number.isFinite(
        minute
      ) &&
      minute >= 0
    ) {
      return minute;
    }
  }

  return null;
}

function getIncidentType(
  value: any
): string {
  return String(
    value?.type ??
    value?.event_type ??
    value?.incident_type ??
    value?.action_type ??
    value?.kind ??
    value?.event ??
    ""
  )
    .trim()
    .toLowerCase();
}

function resolveIncidentPlayerId(
  incident: any,
  field: string
): number | null {
  const direct =
    getId(
      incident?.[field]
    );

  if (
    direct !== null
  ) {
    return direct;
  }

  const idField =
    `${field}_id`;

  return getId(
    incident?.[idField]
  );
}

function getAssistId(
  incident: any
): number | null {
  const candidates = [
    incident?.assist_id,
    incident?.assist_player_id,
    incident?.assistant_id,
    incident?.assist?.id,
    incident?.assist,
    incident?.assistant
  ];

  for (
    const candidate of candidates
  ) {
    const id =
      getId(candidate);

    if (
      id !== null
    ) {
      return id;
    }
  }

  return null;
}

async function resolvePlayerName(
  playerId: number | null,
  directValue: any,
  cache: Map<number, string>
): Promise<string> {
  const directName =
    getName(
      directValue
    );

  if (
    directName
  ) {
    return directName;
  }

  if (
    playerId === null
  ) {
    return "";
  }

  if (
    cache.has(
      playerId
    )
  ) {
    return (
      cache.get(
        playerId
      ) ?? ""
    );
  }

  try {
    const player =
      await getPlayer(
        playerId
      );

    const name =
      getName(
        player
      );

    if (
      name
    ) {
      cache.set(
        playerId,
        name
      );
    }

    return name;
  } catch {
    return "";
  }
}

async function normaliseIncidents(
  incidents: any[]
) {
  const cache =
    new Map<
      number,
      string
    >();

  const normalised =
    await Promise.all(
      incidents.map(
        async (
          incident
        ) => {
          const type =
            getIncidentType(
              incident
            );

          const minute =
            getMinute(
              incident
            );

          const playerId =
            resolveIncidentPlayerId(
              incident,
              "player"
            );

          const playerInId =
            resolveIncidentPlayerId(
              incident,
              "player_in"
            );

          const playerOutId =
            resolveIncidentPlayerId(
              incident,
              "player_out"
            );

          const assistId =
            getAssistId(
              incident
            );

          const [
            playerName,
            playerInName,
            playerOutName,
            assistName
          ] = await Promise.all([
            resolvePlayerName(
              playerId,
              incident?.player,
              cache
            ),

            resolvePlayerName(
              playerInId,
              incident?.player_in,
              cache
            ),

            resolvePlayerName(
              playerOutId,
              incident?.player_out,
              cache
            ),

            resolvePlayerName(
              assistId,
              incident?.assist ??
              incident?.assistant,
              cache
            )
          ]);

          return {
            type,

            minute,

            player_id:
              playerId,

            player_name:
              playerName,

            assist_id:
              assistId,

            assist_name:
              assistName,

            player_in_id:
              playerInId,

            player_in_name:
              playerInName,

            player_out_id:
              playerOutId,

            player_out_name:
              playerOutName,

            is_home:
              incident?.is_home ??
              null,

            card_type:
              incident?.card_type ??
              null,

            goal_type:
              incident?.goal_type ??
              null,

            added_time:
              incident?.added_time ??
              null,

            length:
              incident?.length ??
              null
          };
        }
      )
    );

  return normalised;
}

function finalMinute(
  incidents: any[]
): number {
  const periods =
    incidents
      .filter(
        (
          incident
        ) =>
          incident.type ===
          "period"
      )
      .map(
        (
          incident
        ) =>
          Number(
            incident.minute
          )
      )
      .filter(
        (
          minute
        ) =>
          Number.isFinite(
            minute
          )
      );

  if (
    periods.length
  ) {
    return Math.max(
      ...periods
    );
  }

  return 90;
}

function buildAppearanceDetails(
  playerId: number,
  playerStats: any[],
  incidents: any[],
  lastStatus: any
) {
  if (
    !lastStatus?.played
  ) {
    return {
      minutes: null,
      started: false,
      subbed_on_minute: null,
      subbed_off_minute: null,
      came_on_for: null,
      came_on_for_id: null,
      went_off_for: null,
      went_off_for_id: null,
      summary:
        "Did not feature."
    };
  }

  const substitutions =
    incidents.filter(
      (
        incident
      ) =>
        incident.type ===
        "substitution"
    );

  /*
   * BSD gives us the actual player
   * IDs on substitution records.
   */
  const subbedOnIncident =
    substitutions.find(
      (
        incident
      ) =>
        incident.player_in_id ===
        playerId
    ) ?? null;

  const subbedOffIncident =
    substitutions.find(
      (
        incident
      ) =>
        incident.player_out_id ===
        playerId
    ) ?? null;

  const subbedOn =
    subbedOnIncident?.minute ??
    null;

  const subbedOff =
    subbedOffIncident?.minute ??
    null;

  const started =
    subbedOn === null;

  let minutes:
    | number
    | null = null;

  /*
   * Started -> substituted off:
   * minutes played equal the off minute.
   */
  if (
    started &&
    subbedOff !== null
  ) {
    minutes =
      subbedOff;
  }

  /*
   * Substitute -> substituted off:
   * minutes played equal off minus on.
   */
  if (
    subbedOn !== null &&
    subbedOff !== null
  ) {
    minutes =
      Math.max(
        0,
        subbedOff -
          subbedOn
      );
  }

  /*
   * Substitute -> full time:
   * calculate from final match minute.
   */
  if (
    subbedOn !== null &&
    subbedOff === null
  ) {
    minutes =
      Math.max(
        0,
        finalMinute(
          incidents
        ) -
          subbedOn
      );
  }

  /*
   * If BSD supplies a trustworthy
   * minutes-played statistic and we
   * still don't have a minute figure,
   * use that.
   */
  if (
    minutes === null
  ) {
    const playerRecord =
      findPlayerRecord(
        playerStats,
        playerId
      );

    const candidates = [
      playerRecord?.minutes,
      playerRecord?.minutes_played,
      playerRecord?.played_minutes,
      playerRecord?.min,
      playerRecord?.games?.minutes,
      playerRecord?.stats?.minutes,
      playerRecord?.statistics?.minutes,
      playerRecord?.statistics?.[0]?.minutes
    ];

    for (
      const candidate of candidates
    ) {
      const number =
        Number(
          candidate
        );

      if (
        Number.isFinite(
          number
        ) &&
        number > 0 &&
        number <= 130
      ) {
        minutes =
          number;
        break;
      }
    }
  }

  const cameOnFor =
    subbedOnIncident
      ?.player_out_name ||
    null;

  const cameOnForId =
    subbedOnIncident
      ?.player_out_id ??
    null;

  const wentOffFor =
    subbedOffIncident
      ?.player_in_name ||
    null;

  const wentOffForId =
    subbedOffIncident
      ?.player_in_id ??
    null;

  const parts: string[] =
    [];

  if (
    started
  ) {
    parts.push(
      "Started"
    );
  } else {
    parts.push(
      cameOnFor
        ? `Came on for ${cameOnFor} in the ${subbedOn}th minute`
        : `Came on in the ${subbedOn}th minute`
    );
  }

  if (
    minutes !== null
  ) {
    parts.push(
      `Played ${minutes} mins`
    );
  } else {
    parts.push(
      "Played"
    );
  }

  if (
    subbedOff !== null
  ) {
    parts.push(
      wentOffFor
        ? `Subbed off for ${wentOffFor} in the ${subbedOff}th minute`
        : `Subbed off in the ${subbedOff}th minute`
    );
  }

  return {
    minutes,

    started,

    subbed_on_minute:
      subbedOn,

    subbed_off_minute:
      subbedOff,

    came_on_for:
      cameOnFor,

    came_on_for_id:
      cameOnForId,

    went_off_for:
      wentOffFor,

    went_off_for_id:
      wentOffForId,

    summary:
      parts.join(
        ". "
      ) +
      "."
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
      Number(
        candidate
      );

    if (
      Number.isFinite(
        number
      ) &&
      number > 0
    ) {
      id =
        number;
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
      typeof candidate ===
        "string" &&
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
    getTeamInfo(
      home
    );

  const awayInfo =
    getTeamInfo(
      away
    );

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
      id:
        homeId,
      name:
        homeName
    },

    away_team: {
      id:
        awayId,
      name:
        awayName
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
        ) ===
        playerId
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
    rawIncidents
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

  const incidents =
    await normaliseIncidents(
      rawIncidents
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

  const appearanceDetails =
    buildAppearanceDetails(
      playerId,
      playerStats,
      incidents,
      lastStatus
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
      (
        fixture: any
      ) =>
        normaliseFixture(
          fixture,
          team.id
        )
    );

  const payload = {
    id:
      1,

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
      Array.from(
        new Set(
          incidents.map(
            (
              incident
            ) =>
              incident.type
          )
        )
      )
  };
}
