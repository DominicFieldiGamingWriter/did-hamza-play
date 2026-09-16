const BASE_URL =
  "https://sports.bzzoiro.com/api/v2";

function getKey() {
  const key =
    process.env.BSD_API_KEY;

  if (!key) {
    throw new Error(
      "BSD_API_KEY is not configured."
    );
  }

  return key;
}

async function bsdGet<T>(
  path: string,
  params: Record<
    string,
    string | number | undefined
  > = {}
): Promise<T> {
  const url = new URL(
    `${BASE_URL}${path}`
  );

  for (
    const [key, value] of Object.entries(
      params
    )
  ) {
    if (
      value !== undefined &&
      value !== ""
    ) {
      url.searchParams.set(
        key,
        String(value)
      );
    }
  }

  const response =
    await fetch(url, {
      headers: {
        Authorization:
          `Token ${getKey()}`,
        Accept:
          "application/json"
      },
      cache: "no-store"
    });

  if (!response.ok) {
    throw new Error(
      `BSD API ${response.status}: ${await response.text()}`
    );
  }

  return response.json() as Promise<T>;
}

function responseArray(
  data: any
): any[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (
    Array.isArray(
      data?.results
    )
  ) {
    return data.results;
  }

  if (
    Array.isArray(
      data?.data
    )
  ) {
    return data.data;
  }

  if (
    Array.isArray(
      data?.fixtures
    )
  ) {
    return data.fixtures;
  }

  if (
    Array.isArray(
      data?.events
    )
  ) {
    return data.events;
  }

  return [];
}

function fixtureDate(
  fixture: any
) {
  return (
    fixture?.time?.kickoff_at ??
    fixture?.time?.start_time ??
    fixture?.kickoff_at ??
    fixture?.kickoff ??
    fixture?.event_date ??
    fixture?.date ??
    fixture?.start_time ??
    null
  );
}

function fixtureTimestamp(
  fixture: any
) {
  const value =
    fixtureDate(fixture);

  if (!value) {
    return 0;
  }

  const timestamp =
    new Date(value).getTime();

  return Number.isNaN(
    timestamp
  )
    ? 0
    : timestamp;
}

function getTeamId(
  fixture: any,
  side: "home" | "away"
): number {
  const direct =
    fixture?.[
      `${side}_team_id`
    ];

  const nested =
    fixture?.[
      `${side}_team`
    ] ??
    fixture?.[
      side
    ] ??
    fixture?.teams?.[
      side
    ] ??
    fixture?.participants?.[
      side
    ];

  const candidates = [
    direct,
    fixture?.[
      `${side}_id`
    ],
    nested?.id,
    nested?.team_id,
    nested?.team?.id
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

  return 0;
}

function getTeamName(
  data: any
): string {
  if (
    typeof data === "string" &&
    data.trim()
  ) {
    return data.trim();
  }

  if (
    !data ||
    typeof data !== "object"
  ) {
    return "Unknown";
  }

  const candidates = [
    data.name,
    data.team_name,
    data.full_name,
    data.short_name,
    data.team?.name,
    data.team?.team_name
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

  return "Unknown";
}

async function getTeamById(
  teamId: number
) {
  if (
    !Number.isFinite(teamId) ||
    teamId <= 0
  ) {
    return null;
  }

  try {
    return await bsdGet<any>(
      `/teams/${teamId}/`
    );
  } catch {
    return null;
  }
}

async function normaliseEvent(
  fixture: any
) {
  /*
   * BSD event responses expose
   * home_team_id / away_team_id.
   *
   * Resolve those IDs directly to
   * team records. This avoids relying
   * on optional nested name fields.
   */

  const homeId =
    getTeamId(
      fixture,
      "home"
    );

  const awayId =
    getTeamId(
      fixture,
      "away"
    );

  let homeName =
    getTeamName(
      fixture?.home_team
    );

  let awayName =
    getTeamName(
      fixture?.away_team
    );

  /*
   * Some BSD responses use "home"/"away".
   */
  if (
    homeName === "Unknown"
  ) {
    homeName =
      getTeamName(
        fixture?.home
      );
  }

  if (
    awayName === "Unknown"
  ) {
    awayName =
      getTeamName(
        fixture?.away
      );
  }

  /*
   * Always resolve by ID when the name
   * is still missing.
   */
  const [
    homeTeam,
    awayTeam
  ] = await Promise.all([
    homeName === "Unknown"
      ? getTeamById(homeId)
      : Promise.resolve(null),

    awayName === "Unknown"
      ? getTeamById(awayId)
      : Promise.resolve(null)
  ]);

  if (
    homeName === "Unknown"
  ) {
    homeName =
      getTeamName(
        homeTeam
      );
  }

  if (
    awayName === "Unknown"
  ) {
    awayName =
      getTeamName(
        awayTeam
      );
  }

  /*
   * Final fallback to flat BSD fields.
   */
  if (
    homeName === "Unknown"
  ) {
    homeName =
      fixture?.home_team_name ??
      fixture?.home_name ??
      "Unknown";
  }

  if (
    awayName === "Unknown"
  ) {
    awayName =
      fixture?.away_team_name ??
      fixture?.away_name ??
      "Unknown";
  }

  return {
    ...fixture,

    home_team: {
      id: homeId,
      name: homeName
    },

    away_team: {
      id: awayId,
      name: awayName
    },

    home_team_id:
      homeId,

    away_team_id:
      awayId,

    home_team_name:
      homeName,

    away_team_name:
      awayName,

    home: {
      id: homeId,
      name: homeName
    },

    away: {
      id: awayId,
      name: awayName
    }
  };
}

export async function getPlayer(
  playerId: number
) {
  return bsdGet<any>(
    `/players/${playerId}/`
  );
}

export async function findPlayer(
  name: string
) {
  const data =
    await bsdGet<any>(
      "/players/",
      {
        name,
        limit: 20
      }
    );

  return responseArray(data);
}

export async function findTeam(
  name: string
) {
  const data =
    await bsdGet<any>(
      "/teams/",
      {
        name,
        limit: 20
      }
    );

  return responseArray(data);
}

export async function getTeamSquad(
  teamId: number
) {
  const data =
    await bsdGet<any>(
      `/teams/${teamId}/squad/`
    );

  return responseArray(data);
}

export async function getTeamFixtures(
  teamId: number
) {
  /*
   * Keep using BSD's events endpoint.
   *
   * This is the source that already
   * returned the correct:
   *
   * Sheffield United vs Wolves
   * Fleetwood Town vs Sheffield United
   *
   * It also includes cup fixtures.
   */

  const [
    finishedData,
    upcomingData
  ] = await Promise.all([
    bsdGet<any>(
      "/events/",
      {
        team_id: teamId,
        status: "finished",
        limit: 100
      }
    ),

    bsdGet<any>(
      "/events/",
      {
        team_id: teamId,
        status: "notstarted",
        limit: 100
      }
    )
  ]);

  let finished =
    responseArray(
      finishedData
    );

  let upcoming =
    responseArray(
      upcomingData
    );

  /*
   * If notstarted is empty, keep the
   * fallback that BSD documents for
   * upcoming fixtures.
   */
  if (
    upcoming.length === 0
  ) {
    const fallbackData =
      await bsdGet<any>(
        "/events/",
        {
          team_id: teamId,
          status: "upcoming",
          limit: 100
        }
      );

    upcoming =
      responseArray(
        fallbackData
      );
  }

  const now =
    Date.now();

  /*
   * Finished fixtures.
   */
  finished =
    finished
      .filter(
        (fixture) =>
          fixtureTimestamp(
            fixture
          ) > 0 &&
          fixtureTimestamp(
            fixture
          ) <= now
      )
      .sort(
        (a, b) =>
          fixtureTimestamp(b) -
          fixtureTimestamp(a)
      );

  /*
   * Upcoming fixtures.
   */
  upcoming =
    upcoming
      .filter(
        (fixture) =>
          fixtureTimestamp(
            fixture
          ) > now
      )
      .sort(
        (a, b) =>
          fixtureTimestamp(a) -
          fixtureTimestamp(b)
      );

  /*
   * Resolve the latest match and the
   * next six fixtures.
   */
  const rawFixtures = [
    ...(finished[0]
      ? [finished[0]]
      : []),

    ...upcoming.slice(
      0,
      6
    )
  ];

  const resolved =
    await Promise.all(
      rawFixtures.map(
        (fixture) =>
          normaliseEvent(
            fixture
          )
      )
    );

  const last =
    finished[0]
      ? resolved[0] ?? null
      : null;

  const next =
    finished[0]
      ? resolved.slice(1)
      : resolved;

  return {
    last,
    next
  };
}

export async function getLineups(
  eventId: number
) {
  const data =
    await bsdGet<any>(
      `/events/${eventId}/lineups/`
    );

  return {
    status:
      data?.lineup_status ??
      "unavailable",

    lineups: [data]
  };
}

export async function getFixturePlayerStats(
  eventId: number
) {
  const data =
    await bsdGet<any>(
      `/events/${eventId}/player-stats/`
    );

  return [data];
}
