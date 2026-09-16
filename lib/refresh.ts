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
      return name.trim().toLowerCase();
    }
  }

  return "";
}

function findPlayerRecord(
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
    for (const entry of value) {
      const found =
        findPlayerRecord(
          entry,
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
    getName(value);

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
    return value;
  }

  for (const child of Object.values(value)) {
    if (
      child &&
      typeof child === "object"
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

function hasMinutes(
  value: any
): boolean {
  if (
    !value ||
    typeof value !== "object"
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
    value.statistics?.[0]?.minutes,
    value.statistics?.[0]?.games?.minutes
  ];

  return candidates.some(
    (minutes) => {
      const number =
        Number(minutes);

      return (
        Number.isFinite(number) &&
        number > 0
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
    return value.some(
      (entry) =>
        findPlayerWithMinutes(
          entry,
          playerId,
          playerName
        )
    );
  }

  const id =
    getId(value);

  const name =
    getName(value);

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
    return value.some(
      (entry) =>
        findPlayerAnywhere(
          entry,
          playerId,
          playerName
        )
    );
  }

  const id =
    getId(value);

  const name =
    getName(value);

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

function findNumber(
  value: any,
  keys: string[]
): number | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  for (const key of keys) {
    const candidate =
      value?.[key];

    const number =
      Number(candidate);

    if (
      Number.isFinite(number) &&
      number >= 0
    ) {
      return number;
    }
  }

  return null;
}

function findText(
  value: any,
  keys: string[]
): string {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return "";
  }

  for (const key of keys) {
    const candidate =
      value?.[key];

    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return "";
}

function getSubstitutionDetails(
  value: any,
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

  function visit(
    current: any
  ) {
    if (
      !current ||
      typeof current !== "object"
    ) {
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(
        visit
      );
      return;
    }

    const text =
      (() => {
        try {
          return JSON.stringify(
            current
          ).toLowerCase();
        } catch {
          return "";
        }
      })();

    const directPlayerIn =
      current?.player_in ??
      current?.playerIn ??
      current?.substitute_in ??
      current?.substitution?.player_in ??
      current?.in_player ??
      null;

    const directPlayerOut =
      current?.player_out ??
      current?.playerOut ??
      current?.substitute_out ??
      current?.substitution?.player_out ??
      current?.out_player ??
      null;

    const inId =
      getId(
        directPlayerIn
      );

    const outId =
      getId(
        directPlayerOut
      );

    const inName =
      getName(
        directPlayerIn
      );

    const outName =
      getName(
        directPlayerOut
      );

    const playerNameLower =
      playerName.toLowerCase();

    const currentPlayerId =
      getId(current);

    const currentPlayerName =
      getName(current);

    const playerIsIn =
      inId === playerId ||
      inName.includes(
        playerNameLower
      );

    const playerIsOut =
      outId === playerId ||
      outName.includes(
        playerNameLower
      );

    const currentIsPlayer =
      currentPlayerId ===
        playerId ||
      currentPlayerName ===
        playerNameLower;

    const minute =
      findNumber(
        current,
        [
          "minute",
          "min",
          "event_minute",
          "minute_value"
        ]
      ) ??
      findNumber(
        current?.time,
        [
          "minute",
          "min"
        ]
      );

    const substitutionText =
      text.includes(
        "substitution"
      ) ||
      text.includes(
        "substituted"
      ) ||
      text.includes(
        "player_in"
      ) ||
      text.includes(
        "player_out"
      );

    if (
      minute !== null &&
      substitutionText &&
      (
        playerIsIn ||
        currentIsPlayer &&
        (
          text.includes(
            "in"
          ) ||
          text.includes(
            "sub on"
          )
        )
      )
    ) {
      if (
        playerIsIn ||
        (
          currentIsPlayer &&
          !text.includes(
            "out"
          )
        )
      ) {
        subbedOn = minute;

        if (
          directPlayerOut
        ) {
          replacedPlayer =
            getPlayerDisplayName(
              directPlayerOut
            );
        }
      }
    }

    if (
      minute !== null &&
      substitutionText &&
      (
        playerIsOut ||
        currentIsPlayer &&
        (
          text.includes(
            "out"
          ) ||
          text.includes(
            "sub off"
          ) ||
          text.includes(
            "replace"
          )
        )
      )
    ) {
      if (
        playerIsOut ||
        currentIsPlayer
      ) {
        subbedOff = minute;

        if (
          directPlayerIn
        ) {
          replacedPlayer =
            getPlayerDisplayName(
              directPlayerIn
            );
        }
      }
    }

    for (const child of Object.values(
      current
    )) {
      if (
        child &&
        typeof child === "object"
      ) {
        visit(child);
      }
    }
  }

  visit(value);

  return {
    subbedOn,
    subbedOff,
    replacedPlayer
  };
}

function getPlayerDisplayName(
  value: any
): string | null {
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

  return null;
}

function buildAppearanceDetails(
  playerId: number,
  playerName: string,
  lastFixture: any,
  lineupData: any,
  playerStats: any[],
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

  const combined = {
    fixture:
      lastFixture,

    lineup:
      lineupData,

    player_stats:
      playerStats
  };

  const playerRecord =
    findPlayerRecord(
      combined,
      playerId,
      playerName
    );

  const substitutions =
    getSubstitutionDetails(
      combined,
      playerId,
      playerName
    );

  /*
   * The player's stat-feed minute total
   * can incorrectly show 90 after a player
   * has been substituted.
   *
   * A recorded substitution-off minute
   * takes priority.
   */
  let minutes =
    substitutions.subbedOff !== null
      ? substitutions.subbedOff
      : findNumber(
          playerRecord,
          [
            "minutes",
            "minutes_played",
            "played_minutes",
            "min"
          ]
        );

  if (
    minutes === null &&
    findPlayerWithMinutes(
      playerStats,
      playerId,
      playerName
    )
  ) {
    const record =
      findPlayerRecord(
        playerStats,
        playerId,
        playerName
      );

    minutes =
      findNumber(
        record,
        [
          "minutes",
          "minutes_played",
          "played_minutes",
          "min"
        ]
      );
  }

  /*
   * Hamza was in the starting XI unless
   * we can positively establish that he
   * came on as a substitute.
   */
  const started =
    substitutions.subbedOn === null;

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
    substitutions.subbedOn !== null
  ) {
    parts.push(
      substitutions.replacedPlayer
        ? `Came on for ${substitutions.replacedPlayer} in the ${substitutions.subbedOn}th minute`
        : `Came on in the ${substitutions.subbedOn}th minute`
    );
  }

  if (
    substitutions.subbedOff !== null
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
        reason || "Injured"
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
      name: "Unknown"
    };
  }

  const ids = [
    value.id,
    value.team_id,
    value.team?.id
  ];

  let id = 0;

  for (const candidate of ids) {
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

  for (const candidate of names) {
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
    playerStats
  ] = await Promise.all([
    getLineups(
      last.id
    ),
    getFixturePlayerStats(
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
