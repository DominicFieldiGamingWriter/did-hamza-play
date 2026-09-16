const BASE_URL =
  "https://sports.bzzoiro.com/api/v2";

function getKey() {
  const key = process.env.BSD_API_KEY;

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

  for (const [key, value] of Object.entries(
    params
  )) {
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

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${getKey()}`,
      Accept: "application/json",
    },
    cache: "no-store",
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

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

function getNestedTeam(
  fixture: any,
  side: "home" | "away"
) {
  const candidates = [
    fixture?.[side],
    fixture?.[`${side}_team`],
    fixture?.[`${side}Team`],
    fixture?.teams?.[side],
    fixture?.teams?.[
      `${side}_team`
    ],
    fixture?.participants?.[side],
    fixture?.participants?.[
      `${side}_team`
    ]
  ];

  for (const candidate of candidates) {
    if (
      candidate !== undefined &&
      candidate !== null
    ) {
      return candidate;
    }
  }

  return null;
}

function getTeamId(
  fixture: any,
  side: "home" | "away"
): number {
  const nested =
    getNestedTeam(
      fixture,
      side
    );

  const candidates = [
    fixture?.[
      `${side}_team_id`
    ],
    fixture?.[
      `${side}_id`
    ],
    nested?.id,
    nested?.team_id,
    nested?.team?.id,
    nested?.team?.team_id
  ];

  for (const value of candidates) {
    const id =
      Number(value);

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
  value: any
): string {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return "Unknown";
  }

  const candidates = [
    value.name,
    value.team_name,
    value.full_name,
    value.short_name,
    value.team?.name,
    value.team?.team_name
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return "Unknown";
}

function getFixtureTeamName(
  fixture: any,
  side: "home" | "away"
): string {
  const nested =
    getNestedTeam(
      fixture,
      side
    );

  const nestedName =
    getTeamName(nested);

  if (
    nestedName !== "Unknown"
  ) {
    return nestedName;
  }

  const candidates = [
    fixture?.[
      `${side}_team_name`
    ],
    fixture?.[
      `${side}_name`
    ]
  ];

  for (const candidate of candidates) {
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

  return bsdGet<any>(
    `/teams/${teamId}/`
  );
}

async function resolveFixtureTeams(
  fixture: any
) {
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

  /*
   * First use whatever names BSD has
   * already supplied.
   */
  let homeName =
    getFixtureTeamName(
      fixture,
      "home"
    );

  let awayName =
    getFixtureTeamName(
      fixture,
      "away"
    );

  /*
   * If either name is missing, resolve
   * it directly from the BSD team ID.
   */
  const needsHome =
    homeName === "Unknown" &&
    homeId > 0;

  const needsAway =
    awayName === "Unknown" &&
    awayId > 0;

  const [
    homeTeam,
    awayTeam
  ] = await Promise.all([
    needsHome
      ? getTeamById(homeId)
      : Promise.resolve(null),

    needsAway
      ? getTeamById(awayId)
      : Promise.resolve(null)
  ]);

  if (
    homeName === "Unknown"
  ) {
    homeName =
      getTeamName(homeTeam);
  }

  if (
    awayName === "Unknown"
  ) {
    awayName =
      getTeamName(awayTeam);
  }

  /*
   * Return a canonical fixture shape.
   *
   * We deliberately populate BOTH:
   *   home / away
   *   home_team / away_team
   *
   * so the refresh normaliser can consume
   * the data regardless of which field it
   * checks first.
   */
  return {
    ...fixture,

    home: {
      id: homeId,
      name: homeName
    },

    away: {
      id: awayId,
      name: awayName
    },

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
      awayName
  };
}

async function enrichFixture(
  fixture: any
) {
  /*
   * Get the authoritative event detail
   * first, when an event ID exists.
   */
  const eventId =
    Number(
      fixture?.id ??
      fixture?.event_id
    );

  let combined =
    fixture;

  if (
    Number.isFinite(eventId) &&
    eventId > 0
  ) {
    try {
      const event =
        await bsdGet<any>(
          `/events/${eventId}/`
        );

      combined = {
        ...fixture,
        ...event,
        id:
          event?.id ??
          eventId
      };
    } catch {
      /*
       * Keep the fixture feed data if
       * event-detail lookup fails.
       */
      combined = fixture;
    }
  }

  return resolveFixtureTeams(
    combined
  );
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
   * This endpoint contains Sheffield
   * United's full fixture list, including
   * cup competitions.
   */
  const data =
    await bsdGet<any>(
      `/teams/${teamId}/fixtures/`
    );

  const fixtures =
    responseArray(data);

  const now =
    Date.now();

  const validFixtures =
    fixtures.filter(
      (fixture) =>
        fixtureTimestamp(
          fixture
        ) > 0
    );

  /*
   * Latest completed fixture.
   */
  const finished =
    validFixtures
      .filter(
        (fixture) =>
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
   * All future fixtures, regardless
   * of competition.
   */
  const upcoming =
    validFixtures
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
   * Resolve the latest fixture and the
   * next six fixtures individually.
   *
   * Six gives the page enough data for:
   *   - Will Hamza play next?
   *   - three fixtures after that
   */
  const fixturesToResolve = [
    ...(finished[0]
      ? [finished[0]]
      : []),
    ...upcoming.slice(0, 6)
  ];

  const resolved =
    await Promise.all(
      fixturesToResolve.map(
        (fixture) =>
          enrichFixture(
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
