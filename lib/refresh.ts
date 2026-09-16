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

function getId(value: any): number | null {
  const candidates = [
    value?.id,
    value?.player_id,
    value?.player?.id,
    value?.player?.player_id
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

function getName(value: any): string {
  const candidates = [
    value?.name,
    value?.player_name,
    value?.full_name,
    value?.player?.name,
    value?.player?.full_name
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return "";
}

function getMinute(value: any): number | null {
  const candidates = [
    value?.minute,
    value?.min,
    value?.event_minute,
    value?.minute_value,
    value?.time?.minute,
    value?.time?.min
  ];

  for (const candidate of candidates) {
    const minute =
      Number(candidate);

    if (
      Number.isFinite(minute) &&
      minute >= 0
    ) {
      return minute;
    }
  }

  return null;
}

function getArray(
  value: any
): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    Array.isArray(value?.results)
  ) {
    return value.results;
  }

  if (
    Array.isArray(value?.data)
  ) {
    return value.data;
  }

  if (
    Array.isArray(value?.incidents)
  ) {
    return value.incidents;
  }

  if (
    Array.isArray(value?.events)
  ) {
    return value.events;
  }

  return [];
}

function playerMatches(
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

  const id =
    getId(value);

  if (
    id !== null &&
    id === playerId
  ) {
    return true;
  }

  const target =
    playerName
      .trim()
      .toLowerCase();

  const names = [
    getName(value),
    getName(value?.player),
    getName(value?.player_in),
    getName(value?.player_out),
    getName(value?.playerIn),
    getName(value?.playerOut)
  ]
    .filter(Boolean)
    .map(
      (name) =>
        name.toLowerCase()
    );

  return names.some(
    (name) =>
      name === target ||
      name.includes(target) ||
      target.includes(name)
  );
}

function firstPlayerObject(
  value: any,
  playerId: number,
  playerName: string
): any | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found =
        firstPlayerObject(
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

  if (
    playerMatches(
      value,
      playerId,
      playerName
    )
  ) {
    return value;
  }

  for (
    const child of Object.values(value)
  ) {
    if (
      child &&
      typeof child === "object"
    ) {
      const found =
        firstPlayerObject(
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

function hasPlayerMinutes(
  value: any,
  playerId: number,
  playerName: string
): boolean {
  const record =
    firstPlayerObject(
      value,
      playerId,
      playerName
    );

  if (!record) {
    return false;
  }

  const candidates = [
    record.minutes,
    record.minutes_played,
    record.played_minutes,
    record.min,
    record.games?.minutes,
    record.stats?.minutes,
    record.statistics?.minutes,
    record.statistics?.[0]?.minutes
  ];

  return candidates.some(
    (candidate) => {
      const minute =
        Number(candidate);

      return (
        Number.isFinite(minute) &&
        minute > 0
      );
    }
  );
}

function playerPlayed(
  playerId: number,
  playerName: string,
  lineups: any[],
  playerStats: any[]
) {
  if (
    hasPlayerMinutes(
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
    firstPlayerObject(
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

function eventType(
  event: any
): string {
  const values = [
    event?.type,
    event?.event_type,
    event?.incident_type,
    event?.kind,
    event?.event,
    event?.substitution_type
  ];

  for (const value of values) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value
        .trim()
        .toLowerCase();
    }
  }

  return "";
}

function isSubstitution(
  event: any
): boolean {
  const type =
    eventType(event);

  const text =
    (() => {
      try {
        return JSON.stringify(
          event
        ).toLowerCase();
      } catch {
        return "";
      }
    })();

  return (
    type.includes(
      "substitution"
    ) ||
    type.includes(
      "substitute"
    ) ||
    text.includes(
      "player_in"
    ) ||
    text.includes(
      "player_out"
    ) ||
    text.includes(
      "substitution"
    ) ||
    text.includes(
      "substituted"
    )
  );
}

function getInPlayer(
  event: any
): any {
  return (
    event?.player_in ??
    event?.playerIn ??
    event?.substitute_in ??
    event?.substituteIn ??
    event?.in_player ??
    event?.inPlayer ??
    event?.substitution?.player_in ??
    event?.substitution?.playerIn ??
    null
  );
}

function getOutPlayer(
  event: any
): any {
  return (
    event?.player_out ??
    event?.playerOut ??
    event?.substitute_out ??
    event?.substituteOut ??
    event?.out_player ??
    event?.outPlayer ??
    event?.substitution?.player_out ??
    event?.substitution?.playerOut ??
    null
  );
}

function getPlayerDisplayName(
  value: any
): string | null {
  const name =
    getName(value);

  if (name) {
    return name;
  }

  return null;
}

function extractSubstitutionDetails(
  incidents: any[],
  playerId: number,
  playerName: string
) {
  let subbedOn:
    | number
    | null = null;

  let subbedOff:
    | number
    | null = null;

  let replacedPlayer:
    | string
    | null = null;

  for (const incident of incidents) {
    if (
      !isSubstitution(
        incident
      )
    ) {
      continue;
    }

    const minute =
      getMinute(incident);

    if (
      minute === null
    ) {
      continue;
    }

    const playerIn =
      getInPlayer(
        incident
      );

    const playerOut =
      getOutPlayer(
        incident
      );

    /*
     * Primary method:
     * explicit player_in / player_out.
     */
    if (
      playerMatches(
        playerIn,
        playerId,
        playerName
      )
    ) {
      subbedOn =
        minute;

      replacedPlayer =
        getPlayerDisplayName(
          playerOut
        );
    }

    if (
      playerMatches(
        playerOut,
        playerId,
        playerName
      )
    ) {
      subbedOff =
        minute;

      if (
        !replacedPlayer
      ) {
        replacedPlayer =
          getPlayerDisplayName(
            playerIn
          );
      }
    }

    /*
     * Secondary method:
     * Some BSD incident records expose
     * the player directly on the incident
     * instead of player_in/player_out.
     */
    if (
      !playerIn &&
      !playerOut &&
      playerMatches(
        incident,
        playerId,
        playerName
      )
    ) {
      const text =
        (() => {
          try {
            return JSON.stringify(
              incident
            ).toLowerCase();
          } catch {
            return "";
          }
        })();

      if (
        text.includes(
          "sub off"
        ) ||
        text.includes(
          "subbed off"
        ) ||
        text.includes(
          "player out"
        ) ||
        text.includes(
          "\"out\""
        )
      ) {
        subbedOff =
          minute;
      }

      if (
        text.includes(
          "sub on"
        ) ||
        text.includes(
          "subbed on"
        ) ||
        text.includes(
          "player in"
        ) ||
        text.includes(
          "\"in\""
        )
      ) {
        subbedOn =
          minute;
      }
    }
  }

  return {
    subbedOn,
    subbedOff,
    replacedPlayer
  };
}

function getActualMinutes(
  playerRecord: any,
  substitution: {
    subbedOn: number | null;
    subbedOff: number | null;
  }
): number | null {
  /*
   * Never confuse substitution-on minute
   * with minutes played.
   *
   * If BSD gives an explicit minutes-played
   * value, use it.
   */
  const candidates = [
    playerRecord?.minutes,
    playerRecord?.minutes_played,
    playerRecord?.played_minutes,
    playerRecord?.min,
    playerRecord?.games?.minutes,
    playerRecord?.stats?.minutes,
    playerRecord?.statistics?.minutes
  ];

  for (const candidate of candidates) {
    const minutes =
      Number(candidate);

    if (
      Number.isFinite(minutes) &&
      minutes > 0 &&
      minutes <= 130
    ) {
      return minutes;
    }
  }

  /*
   * If the player started and has a
   * substitution-off minute, that gives
   * us the played minutes.
   */
  if (
    substitution.subbedOn ===
      null &&
    substitution.subbedOff !==
      null
  ) {
    return substitution.subbedOff;
  }

  /*
   * If we know he came on but have no
   * explicit minutes-played field, do NOT
   * invent a number.
   */
  return null;
}

function buildAppearanceDetails(
  playerId: number,
  playerName: string,
  lastFixture: any,
  lineupData: any,
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
      replaced_player: null,
      summary:
        "Did not feature."
    };
  }

  const playerRecord =
    firstPlayerObject(
      playerStats,
      playerId,
      playerName
    );

  const substitutions =
    extractSubstitutionDetails(
      incidents,
      playerId,
      playerName
    );

  const minutes =
    getActualMinutes(
      playerRecord,
      substitutions
    );

  const started =
    substitutions.subbedOn ===
    null;

  const parts: string[] = [];

  if (started) {
    parts.push(
      "Started"
    );
  }

  if (minutes !== null) {
    parts.push(
      `Played ${minutes} mins`
    );
  } else {
    parts.push(
      "Played"
    );
  }

  if (
    substitutions.subbedOn !==
    null
  ) {
    if (
      substitutions.replacedPlayer
    ) {
      parts.push(
        `Came on for ${substitutions.replacedPlayer} in the ${substitutions.subbedOn}th minute`
      );
    } else {
      parts.push(
        `Came on in the ${substitutions.subbedOn}th minute`
      );
    }
  }

  if (
    substitutions.subbedOff !==
    null
  ) {
    parts.push(
      `Subbed off in the ${substitutions.subbedOff}th minute`
    );
  }

  return {
    minutes,
    started,
    subbed_on_minute:
      substitutions.subbedOn,
    subbed_off_minute:
      substitutions.subbedOff,
    replaced_player:
      substitutions.replacedPlayer,
    summary:
      parts.join(". ") +
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
      actualPlayerName,
      last,
      lineupData,
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

  return payload;
}
