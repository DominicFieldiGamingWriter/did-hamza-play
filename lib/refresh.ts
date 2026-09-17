import {
  findTeam,
  getPlayer,
  getTeamById,
  getTeamSquad,
  getTeamFixtures,
  getLineups,
  getFixturePlayerStats,
  getFixtureIncidents
} from "./api-football";

import {
  getSupabaseAdmin
} from "./supabase";

function responseArray(
  data: any
): any[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.fixtures)) {
    return data.fixtures;
  }

  if (Array.isArray(data?.events)) {
    return data.events;
  }

  if (Array.isArray(data?.incidents)) {
    return data.incidents;
  }

  return [];
}

function getId(
  value: any
): number | null {
  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value) &&
      value > 0
      ? value
      : null;
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const id =
      Number(value);

    return Number.isFinite(id) &&
      id > 0
      ? id
      : null;
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const candidates = [
    value.id,
    value.player_id,
    value.player?.id,
    value.player?.player_id
  ];

  for (
    const candidate of candidates
  ) {
    const id =
      Number(candidate);

    if (
      Number.isFinite(id) &&
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
    typeof value === "string"
  ) {
    return value.trim();
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return "";
  }

  const candidates = [
    value.name,
    value.player_name,
    value.full_name,
    value.player?.name,
    value.player?.full_name
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

function playerMatchesId(
  value: any,
  playerId: number
): boolean {
  return (
    getId(value) ===
    playerId
  );
}

function findPlayerRecord(
  value: any,
  playerId: number
): any | null {
  if (
    !value ||
    typeof value !== "object"
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
      typeof child === "object"
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

function lineupRoleFromValue(
  value: any,
  playerId: number,
  context = ""
):
  | "starting"
  | "substitute"
  | "unknown" {
  if (
    value === null ||
    value === undefined
  ) {
    return "unknown";
  }

  if (Array.isArray(value)) {
    for (
      const item of value
    ) {
      const role =
        lineupRoleFromValue(
          item,
          playerId,
          context
        );

      if (
        role === "starting" ||
        role === "substitute"
      ) {
        return role;
      }
    }

    return "unknown";
  }

  if (
    typeof value !== "object"
  ) {
    return "unknown";
  }

  const directId =
    getId(value);

  if (
    directId === playerId
  ) {
    const explicitRole =
      String(
        value.role ??
        value.position_type ??
        value.lineup_role ??
        value.selection_status ??
        ""
      )
        .trim()
        .toLowerCase();

    if (
      explicitRole.includes(
        "sub"
      ) ||
      explicitRole.includes(
        "bench"
      )
    ) {
      return "substitute";
    }

    if (
      explicitRole.includes(
        "start"
      ) ||
      explicitRole ===
        "xi"
    ) {
      return "starting";
    }

    if (
      value.is_substitute === true ||
      value.substitute === true ||
      value.on_bench === true ||
      value.bench === true
    ) {
      return "substitute";
    }

    if (
      value.is_starter === true ||
      value.starter === true ||
      value.starting === true
    ) {
      return "starting";
    }
  }

  for (
    const [
      key,
      child
    ] of Object.entries(
      value
    )
  ) {
    if (
      !child ||
      typeof child !== "object"
    ) {
      continue;
    }

    const lowerKey =
      key
        .toLowerCase()
        .replace(
          /[-_ ]/g,
          ""
        );

    let childContext =
      context;

    if (
      lowerKey.includes(
        "substitute"
      ) ||
      lowerKey.includes(
        "bench"
      )
    ) {
      childContext =
        "substitute";
    }

    if (
      lowerKey.includes(
        "starter"
      ) ||
      lowerKey.includes(
        "starting"
      ) ||
      lowerKey ===
        "xi"
    ) {
      childContext =
        "starting";
    }

    const role =
      lineupRoleFromValue(
        child,
        playerId,
        childContext
      );

    if (
      role === "starting" ||
      role === "substitute"
    ) {
      return role;
    }
  }

  if (
    context === "substitute" &&
    hasPlayer(
      value,
      playerId
    )
  ) {
    return "substitute";
  }

  if (
    context === "starting" &&
    hasPlayer(
      value,
      playerId
    )
  ) {
    return "starting";
  }

  return "unknown";
}

function playerStatsMinutes(
  playerId: number,
  playerStats: any[]
): number | null {
  const playerRecord =
    findPlayerRecord(
      playerStats,
      playerId
    );

  if (!playerRecord) {
    return null;
  }

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

  return null;
}

function playerPlayed(
  playerId: number,
  playerName: string,
  lineups: any[],
  playerStats: any[],
  incidents: any[]
) {
  const lineupRole =
    lineupRoleFromValue(
      lineups,
      playerId
    );

  const subbedOn =
    incidents.some(
      (incident: any) =>
        getIncidentType(
          incident
        ) === "substitution" &&
        resolveIncidentPlayerId(
          incident,
          "player_in"
        ) === playerId
    );

  if (
    subbedOn ||
    lineupRole === "starting"
  ) {
    return {
      played: true,
      type: "played",
      label: "Played"
    };
  }

  if (
    lineupRole === "substitute"
  ) {
    return {
      played: false,
      type: "unused_substitute",
      label: "Did not play"
    };
  }

  const minutes =
    playerStatsMinutes(
      playerId,
      playerStats
    );

  if (
    minutes !== null &&
    minutes > 0
  ) {
    return {
      played: true,
      type: "played",
      label: "Played"
    };
  }

  const target =
    playerName
      .trim()
      .toLowerCase();

  const text =
    JSON.stringify(
      lineups ?? []
    ).toLowerCase();

  if (
    target &&
    text.includes(target)
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

  return getId(
    incident?.[
      `${field}_id`
    ]
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

  const looksLikeOwnGoalMarker =
    /\(\s*og\s*\)/i.test(
      directName
    );

  if (
    directName &&
    !looksLikeOwnGoalMarker
  ) {
    return directName;
  }

  if (
    playerId === null
  ) {
    return "";
  }

  if (
    cache.has(playerId)
  ) {
    return (
      cache.get(
        playerId
      ) ??
      ""
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

    if (name) {
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

function isOwnGoal(
  incident: any
): boolean {
  const values = [
    incident?.goal_type,
    incident?.goalType,
    incident?.goal?.type,
    incident?.goal?.goal_type,
    incident?.subtype,
    incident?.type_name
  ];

  return values.some(
    (value: any) =>
      String(
        value ??
        ""
      )
        .trim()
        .toLowerCase()
        .replace(
          /[-_ ]/g,
          ""
        )
        .includes("owngoal")
  );
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
          ] =
            await Promise.all([
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

            is_own_goal:
              isOwnGoal(
                incident
              ),

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

  normalised.sort(
    (
      a,
      b
    ) =>
      (a.minute ?? 9999) -
      (b.minute ?? 9999)
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
  lastStatus: any,
  inSquad: boolean,
  bench: boolean
) {
  if (
    !lastStatus?.played
  ) {
    if (
      lastStatus?.type ===
      "unused_substitute"
    ) {
      return {
        minutes: null,
        bench,
        started: false,
        subbed_on_minute: null,
        subbed_off_minute: null,
        came_on_for: null,
        came_on_for_id: null,
        went_off_for: null,
        went_off_for_id: null,
        summary:
          "Didn't start. Didn't come on."
      };
    }

    if (
      !inSquad
    ) {
      return {
        minutes: null,
        bench,
        started: false,
        subbed_on_minute: null,
        subbed_off_minute: null,
        came_on_for: null,
        came_on_for_id: null,
        went_off_for: null,
        went_off_for_id: null,
        summary:
          "Not in the squad."
      };
    }

    const subbedOn =
      incidents.find(
        (
          incident
        ) =>
          incident.type ===
            "substitution" &&
          incident.player_in_id ===
            playerId
      ) ?? null;

    if (
      subbedOn
    ) {
      return {
        minutes: null,
        bench,
        started: false,
        subbed_on_minute:
          subbedOn.minute,
        subbed_off_minute:
          null,
        came_on_for:
          subbedOn.player_out_name ??
          null,
        came_on_for_id:
          subbedOn.player_out_id ??
          null,
        went_off_for:
          null,
        went_off_for_id:
          null,
        summary:
          "Didn't start. Subbed on."
      };
    }

    return {
      minutes: null,
      bench,
      started: false,
      subbed_on_minute:
        null,
      subbed_off_minute:
        null,
      came_on_for:
        null,
      came_on_for_id:
        null,
      went_off_for:
        null,
      went_off_for_id:
        null,
      summary:
        "Didn't start. Didn't come on."
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

  if (
    started &&
    subbedOff !== null
  ) {
    minutes =
      subbedOff;
  }

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
        Number(candidate);

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

  if (
    minutes === null &&
    started
  ) {
    minutes =
      finalMinute(
        incidents
      );
  }

  let summary =
    "Played.";

  if (
    started &&
    subbedOff !== null
  ) {
    summary =
      `Started. Subbed off. Played ${minutes ?? subbedOff} mins.`;
  } else if (
    started
  ) {
    summary =
      `Started. Played ${minutes ?? finalMinute(incidents)} mins.`;
  } else if (
    subbedOn !== null
  ) {
    summary =
      minutes !== null
        ? `Didn't start. Subbed on. Played ${minutes} mins.`
        : "Didn't start. Subbed on.";
  }

  return {
    minutes,
    bench,
    started,
    subbed_on_minute:
      subbedOn,
    subbed_off_minute:
      subbedOff,
    came_on_for:
      subbedOnIncident
        ?.player_out_name ??
      null,
    came_on_for_id:
      subbedOnIncident
        ?.player_out_id ??
      null,
    went_off_for:
      subbedOffIncident
        ?.player_in_name ??
      null,
    went_off_for_id:
      subbedOffIncident
        ?.player_in_id ??
      null,
    summary
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
    fixture?.time?.start_time ??
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
        ? awayId ||
          null
        : isAway
        ? homeId ||
          null
        : null
  };
}

async function buildLivePlayerStatus(
  playerId: number,
  live: any
) {
  if (
    !live?.id
  ) {
    return null;
  }

  try {
    const [
      lineupData,
      rawIncidents
    ] = await Promise.all([
      getLineups(
        Number(
          live.id
        )
      ),

      getFixtureIncidents(
        Number(
          live.id
        )
      )
    ]);

    const lineupRole =
      lineupRoleFromValue(
        lineupData,
        playerId
      );

    const incidents =
      responseArray(
        rawIncidents
      );

    const subbedOn =
      incidents.some(
        (incident: any) =>
          getIncidentType(
            incident
          ) === "substitution" &&
          resolveIncidentPlayerId(
            incident,
            "player_in"
          ) === playerId
      );

    const subbedOff =
      incidents.some(
        (incident: any) =>
          getIncidentType(
            incident
          ) === "substitution" &&
          resolveIncidentPlayerId(
            incident,
            "player_out"
          ) === playerId
      );

    if (
      subbedOff
    ) {
      return {
        status:
          "not_playing",
        role:
          "not_playing",
        lineup_status:
          lineupData?.status ??
          "unavailable"
      };
    }

    if (
      subbedOn
    ) {
      return {
        status:
          "playing",
        role:
          "playing",
        lineup_status:
          lineupData?.status ??
          "unavailable"
      };
    }

    if (
      lineupRole ===
      "starting"
    ) {
      return {
        status:
          "playing",
        role:
          "starting",
        lineup_status:
          lineupData?.status ??
          "unavailable"
      };
    }

    if (
      lineupRole ===
      "substitute"
    ) {
      return {
        status:
          "substitute",
        role:
          "substitute",
        lineup_status:
          lineupData?.status ??
          "unavailable"
      };
    }

    if (
      lineupData?.status ===
      "confirmed"
    ) {
      return {
        status:
          "not_playing",
        role:
          "not_selected",
        lineup_status:
          "confirmed"
      };
    }

    return {
      status:
        "unknown",
      role:
        "unknown",
      lineup_status:
        lineupData?.status ??
        "unavailable"
    };
  } catch {
    return null;
  }
}


function playerTeamId(
  player: any
): number {
  const candidates = [
    player?.team_id,
    player?.team?.id,
    player?.current_team_id,
    player?.current_team?.id,
    player?.club_id,
    player?.club?.id
  ];

  for (const candidate of candidates) {
    const number = Number(candidate);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      return number;
    }
  }

  return 0;
}

function playerTeamName(
  player: any
): string {
  const candidates = [
    player?.team?.name,
    player?.team_name,
    player?.current_team?.name,
    player?.current_team_name,
    player?.club?.name,
    player?.club_name
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

function playerNationalTeamId(
  player: any
): number {
  const candidates = [
    player?.national_team_id,
    player?.nationalTeamId,
    player?.national_team?.id,
    player?.nationalTeam?.id,
    player?.international_team_id,
    player?.internationalTeamId,
    player?.international_team?.id,
    player?.internationalTeam?.id
  ];

  for (const candidate of candidates) {
    const number = Number(candidate);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      return number;
    }
  }

  return 0;
}

function playerNationalTeamName(
  player: any
): string {
  const candidates = [
    player?.national_team?.name,
    player?.nationalTeam?.name,
    player?.national_team_name,
    player?.nationalTeamName,
    player?.international_team?.name,
    player?.internationalTeam?.name,
    player?.international_team_name,
    player?.internationalTeamName,
    player?.nationality?.name,
    player?.country?.name,
    player?.nationality,
    player?.country
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }

    if (
      candidate &&
      typeof candidate === "object"
    ) {
      const name =
        candidate?.name ??
        candidate?.country_name ??
        candidate?.country;

      if (
        typeof name === "string" &&
        name.trim()
      ) {
        return name.trim();
      }
    }
  }

  return "";
}

function isNationalTeam(
  team: any
): boolean {
  const flags = [
    team?.is_national_team,
    team?.national_team,
    team?.is_national
  ];

  if (
    flags.some(
      (value: any) =>
        value === true ||
        String(value).toLowerCase() === "true"
    )
  ) {
    return true;
  }

  const types = [
    team?.type,
    team?.team_type,
    team?.category,
    team?.kind
  ]
    .map(
      (value: any) =>
        String(value ?? "").toLowerCase()
    );

  return types.some(
    (value: string) =>
      value.includes("national")
  );
}

async function resolvePlayerTeam(
  player: any
) {
  const directId =
    playerTeamId(player);

  if (directId > 0) {
    const directTeam =
      await getTeamById(directId);

    if (directTeam?.id) {
      return directTeam;
    }
  }

  const name =
    playerTeamName(player);

  if (name) {
    const teams =
      await findTeam(name);

    const exact =
      teams.find(
        (candidate: any) =>
          String(
            candidate?.name ?? ""
          )
            .trim()
            .toLowerCase() ===
          name.toLowerCase()
      ) ?? teams[0];

    if (exact?.id) {
      return exact;
    }
  }

  return null;
}

function playerIdForFallback(
  player: any
): number {
  return Number(
    player?.id ??
    player?.player_id ??
    0
  );
}

async function resolvePlayerNationalTeam(
  player: any
) {
  const directId =
    playerNationalTeamId(player);

  if (directId > 0) {
    const directTeam =
      await getTeamById(directId);

    if (directTeam?.id) {
      return directTeam;
    }
  }

  const discoveredName =
    playerNationalTeamName(player);

  /*
   * BSD may expose Bangladesh as the player's
   * nationality/country rather than as an explicit
   * national_team field. For Hamza (player 6135),
   * Bangladesh is therefore a deliberate fallback.
   * We still require the returned team to look like a
   * national side before using it.
   */
  const names = [
    discoveredName,
    playerIdForFallback(player) === 6135
      ? "Bangladesh"
      : ""
  ].filter(
    (value, index, array) =>
      value &&
      array.indexOf(value) === index
  );

  for (const name of names) {
    const teams =
      await findTeam(name);

    const national =
      teams.find(
        (candidate: any) =>
          isNationalTeam(candidate)
      );

    if (national?.id) {
      return national;
    }

    const exact =
      teams.find(
        (candidate: any) =>
          String(
            candidate?.name ?? ""
          )
            .trim()
            .toLowerCase() ===
          name.toLowerCase()
      );

    if (exact?.id && isNationalTeam(exact)) {
      return exact;
    }
  }

  return null;
}

function fixtureTimestamp(
  fixture: any
): number {
  const candidates = [
    fixture?.date,
    fixture?.time?.kickoff_at,
    fixture?.time?.start_time,
    fixture?.kickoff_at,
    fixture?.kickoff,
    fixture?.event_date,
    fixture?.start_time
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const timestamp =
      new Date(candidate).getTime();

    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

function tagFixture(
  fixture: any,
  trackedTeam: any,
  teamType: "club" | "national"
) {
  if (!fixture) {
    return null;
  }

  const normalised =
    normaliseFixture(
      fixture,
      Number(trackedTeam.id)
    );

  return {
    ...normalised,
    tracked_team_id:
      Number(trackedTeam.id),
    tracked_team_name:
      trackedTeam.name ??
      "Unknown",
    tracked_team_type:
      teamType
  };
}


const BANGLADESH_FALLBACK_FIXTURES = [
  {
    id: "bd-asean-2026-09-25",
    date: "2026-09-25T09:00:00+00:00",
    event_date: "2026-09-25T09:00:00+00:00",
    status: "notstarted",
    home_team: { id: 0, name: "Bangladesh" },
    away_team: { id: 0, name: "Malaysia" },
    home_score: null,
    away_score: null,
    opponent_name: "Malaysia",
    opponent_id: null,
    stage_name: "FIFA ASEAN Cup 2026",
    round_label: "Group A",
    league_name: "FIFA ASEAN Cup 2026",
    is_fallback_fixture: true
  },
  {
    id: "bd-asean-2026-09-28",
    date: "2026-09-28T09:00:00+00:00",
    event_date: "2026-09-28T09:00:00+00:00",
    status: "notstarted",
    home_team: { id: 0, name: "Singapore" },
    away_team: { id: 0, name: "Bangladesh" },
    home_score: null,
    away_score: null,
    opponent_name: "Singapore",
    opponent_id: null,
    stage_name: "FIFA ASEAN Cup 2026",
    round_label: "Group A",
    league_name: "FIFA ASEAN Cup 2026",
    is_fallback_fixture: true
  },
  {
    id: "bd-asean-2026-10-01",
    date: "2026-10-01T12:30:00+00:00",
    event_date: "2026-10-01T12:30:00+00:00",
    status: "notstarted",
    home_team: { id: 0, name: "Indonesia" },
    away_team: { id: 0, name: "Bangladesh" },
    home_score: null,
    away_score: null,
    opponent_name: "Indonesia",
    opponent_id: null,
    stage_name: "FIFA ASEAN Cup 2026",
    round_label: "Group A",
    league_name: "FIFA ASEAN Cup 2026",
    is_fallback_fixture: true
  }
];

function fallbackNationalFixturesIfNeeded(
  fixtures: any[],
  nationalTeam: any
): any[] {
  if (fixtures.length > 0 || !nationalTeam?.id) {
    return fixtures;
  }

  return BANGLADESH_FALLBACK_FIXTURES.map(
    (fixture) => ({
      ...fixture,
      tracked_team_id: Number(nationalTeam.id),
      tracked_team_name:
        nationalTeam.name ??
        "Bangladesh",
      tracked_team_type: "national"
    })
  );
}

function mergeUpcomingFixtures(
  clubFixtures: any[],
  nationalFixtures: any[]
): any[] {
  return [
    ...clubFixtures,
    ...nationalFixtures
  ]
    .filter(
      (fixture) =>
        fixture &&
        fixtureTimestamp(fixture) > Date.now()
    )
    .sort(
      (a, b) =>
        fixtureTimestamp(a) -
        fixtureTimestamp(b)
    )
    .slice(0, 6);
}

function chooseLatestFinishedFixture(
  clubLast: any,
  nationalLast: any
) {
  const candidates =
    [
      {
        fixture: clubLast,
        teamType: "club" as const
      },
      {
        fixture: nationalLast,
        teamType: "national" as const
      }
    ]
      .filter(
        (entry) =>
          entry.fixture &&
          fixtureTimestamp(
            entry.fixture
          ) > 0
      )
      .sort(
        (a, b) =>
          fixtureTimestamp(
            b.fixture
          ) -
          fixtureTimestamp(
            a.fixture
          )
      );

  return candidates[0] ?? null;
}

function chooseLiveFixture(
  clubLive: any,
  nationalLive: any
) {
  const candidates =
    [
      {
        fixture: clubLive,
        teamType: "club" as const
      },
      {
        fixture: nationalLive,
        teamType: "national" as const
      }
    ]
      .filter(
        (entry) =>
          entry.fixture
      )
      .sort(
        (a, b) =>
          fixtureTimestamp(
            a.fixture
          ) -
          fixtureTimestamp(
            b.fixture
          )
      );

  return candidates[0] ?? null;
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

  /*
   * Start with the player ID. We prefer
   * the team references returned on that
   * player record rather than relying on
   * the player's name.
   */
  const team =
    await resolvePlayerTeam(
      player
    );

  if (!team?.id) {
    throw new Error(
      `Could not determine the current club for player ID ${playerId}.`
    );
  }

  /*
   * Resolve the player's national team
   * from the player record where possible.
   * If BSD only exposes nationality on the
   * player record, use that as a discovery
   * key and prefer a team marked as national.
   */
  const nationalTeam =
    await resolvePlayerNationalTeam(
      player
    );

  const [
    squad,
    clubFixtures,
    nationalSquad,
    nationalFixtures
  ] = await Promise.all([
    getTeamSquad(
      team.id
    ),
    getTeamFixtures(
      team.id
    ),
    nationalTeam?.id
      ? getTeamSquad(
          Number(
            nationalTeam.id
          )
        )
      : Promise.resolve([]),
    nationalTeam?.id
      ? getTeamFixtures(
          Number(
            nationalTeam.id
          )
        )
      : Promise.resolve({
          live: null,
          last: null,
          next: []
        })
  ]);

  const squadPlayer =
    squad.find(
      (p: any) =>
        Number(
          p.id ??
          p.player?.id
        ) ===
        playerId
    ) ?? null;

  const nationalSquadPlayer =
    nationalSquad.find(
      (p: any) =>
        Number(
          p.id ??
          p.player?.id
        ) ===
        playerId
    ) ?? null;

  const latestFinished =
    chooseLatestFinishedFixture(
      clubFixtures.last,
      nationalFixtures.last
    );

  if (!latestFinished?.fixture) {
    throw new Error(
      "Could not find a latest completed club or national-team match."
    );
  }

  const latestLast =
    latestFinished.fixture;

  const lastTeam =
    latestFinished.teamType ===
    "national"
      ? nationalTeam
      : team;

  if (!lastTeam?.id) {
    throw new Error(
      "Could not determine the team associated with the latest match."
    );
  }

  const lastSquadPlayer =
    latestFinished.teamType ===
    "national"
      ? nationalSquadPlayer
      : squadPlayer;

  const [
    lineupData,
    playerStats,
    rawIncidents
  ] =
    await Promise.all([
      getLineups(
        latestLast.id
      ),
      getFixturePlayerStats(
        latestLast.id
      ),
      getFixtureIncidents(
        latestLast.id
      )
    ]);

  const incidents =
    await normaliseIncidents(
      responseArray(
        rawIncidents
      )
    );

  const actualPlayerName =
    player?.name ??
    squadPlayer?.name ??
    nationalSquadPlayer?.name ??
    playerName;

  const lastStatus =
    playerPlayed(
      playerId,
      actualPlayerName,
      lineupData.lineups,
      playerStats,
      incidents
    );

  const lineupRole =
    lineupRoleFromValue(
      lineupData.lineups,
      playerId
    );

  const bench =
    lineupRole ===
      "substitute" ||
    lastStatus?.type ===
      "unused_substitute" ||
    incidents.some(
      (incident: any) =>
        incident.type ===
          "substitution" &&
        incident.player_in_id ===
          playerId
    );

  const appearanceDetails =
    buildAppearanceDetails(
      playerId,
      playerStats,
      incidents,
      lastStatus,
      Boolean(
        lastSquadPlayer
      ),
      bench
    );

  const clubUpcoming =
    [
      ...(
        Array.isArray(
          clubFixtures.next
        )
          ? clubFixtures.next
          : []
      ).map(
        (fixture: any) =>
          tagFixture(
            fixture,
            team,
            "club"
          )
      )
    ];

  const nationalUpcomingFromBsd =
    [
      ...(
        Array.isArray(
          nationalFixtures.next
        )
          ? nationalFixtures.next
          : []
      ).map(
        (fixture: any) =>
          tagFixture(
            fixture,
            nationalTeam,
            "national"
          )
      )
    ];

  const nationalUpcoming =
    fallbackNationalFixturesIfNeeded(
      nationalUpcomingFromBsd,
      nationalTeam
    );

  const mergedUpcoming =
    mergeUpcomingFixtures(
      clubUpcoming,
      nationalUpcoming
    );

  const nextFixture =
    mergedUpcoming[0] ??
    null;

  const nextSquadPlayer =
    nextFixture?.tracked_team_type ===
      "national"
      ? nationalSquadPlayer
      : squadPlayer;

  const nextStatus =
    getAvailabilityStatus(
      nextSquadPlayer
    );

  const liveChoice =
    chooseLiveFixture(
      clubFixtures.live,
      nationalFixtures.live
    );

  const normalisedLiveBase =
    liveChoice?.fixture
      ? tagFixture(
          liveChoice.fixture,
          liveChoice.teamType ===
            "national"
            ? nationalTeam
            : team,
          liveChoice.teamType
        )
      : null;

  const livePlayerStatus =
    liveChoice?.fixture
      ? await buildLivePlayerStatus(
          playerId,
          liveChoice.fixture
        )
      : null;

  const normalisedLive =
    normalisedLiveBase
      ? {
          ...normalisedLiveBase,
          player_status:
            livePlayerStatus
        }
      : null;

  const normalisedLast =
    tagFixture(
      latestLast,
      lastTeam,
      latestFinished.teamType
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
      nationalSquadPlayer?.photo ??
      null,

    live_fixture:
      normalisedLive,

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
      mergedUpcoming,

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

    national_team:
      nationalTeam?.name ??
      null,

    national_fixture_source:
      nationalUpcomingFromBsd.length > 0
        ? "bsd"
        : nationalUpcoming.length > 0
          ? "fallback"
          : "none",

    latest_match_type:
      latestFinished.teamType,

    upcoming_match_count:
      mergedUpcoming.length,

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
