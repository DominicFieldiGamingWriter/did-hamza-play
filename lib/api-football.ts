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

  if (
    Array.isArray(
      data?.incidents
    )
  ) {
    return data.incidents;
  }

  return [];
}

function responseObject(
  data: any
): any {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  if (
    data?.data &&
    typeof data.data ===
      "object" &&
    !Array.isArray(
      data.data
    )
  ) {
    return data.data;
  }

  if (
    Array.isArray(
      data?.results
    ) &&
    data.results.length
  ) {
    return data.results[0];
  }

  if (
    Array.isArray(
      data?.data
    ) &&
    data.data.length
  ) {
    return data.data[0];
  }

  return data;
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

  for (
    const candidate of candidates
  ) {
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
    typeof value !==
      "object"
  ) {
    return "Unknown";
  }

  const candidates = [
    value.name,
    value.team_name,
    value.full_name,
    value.short_name,
    value.team?.name,
    value.team?.team_name,
    value.data?.name,
    value.data?.team_name
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

function getFixtureTeamName(
  fixture: any,
  side: "home" | "away"
): string {
  const nested =
    getNestedTeam(
      fixture,
      side
    );

  let name =
    getTeamName(nested);

  if (
    name !== "Unknown"
  ) {
    return name;
  }

  const candidates = [
    fixture?.[
      `${side}_team_name`
    ],
    fixture?.[
      `${side}_name`
    ],
    fixture?.teams?.[
      `${side}_name`
    ]
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
  id: number
) {
  if (
    !Number.isFinite(id) ||
    id <= 0
  ) {
    return null;
  }

  try {
    const data =
      await bsdGet<any>(
        `/teams/${id}/`
      );

    return responseObject(
      data
    );
  } catch {
    return null;
  }
}

async function getEventById(
  id: number
) {
  if (
    !Number.isFinite(id) ||
    id <= 0
  ) {
    return null;
  }

  try {
    const data =
      await bsdGet<any>(
        `/events/${id}/`
      );

    return responseObject(
      data
    );
  } catch {
    return null;
  }
}

async function resolveFixture(
  fixture: any
) {
  let event =
    fixture;

  const eventId =
    Number(
      fixture?.id ??
      fixture?.event_id
    );

  if (
    Number.isFinite(eventId) &&
    eventId > 0
  ) {
    const detailed =
      await getEventById(
        eventId
      );

    if (detailed) {
      event = {
        ...fixture,
        ...detailed
      };
    }
  }

  const homeId =
    getTeamId(
      event,
      "home"
    );

  const awayId =
    getTeamId(
      event,
      "away"
    );

  let homeName =
    getFixtureTeamName(
      event,
      "home"
    );

  let awayName =
    getFixtureTeamName(
      event,
      "away"
    );

  if (
    homeName === "Unknown" &&
    homeId > 0
  ) {
    homeName =
      getTeamName(
        await getTeamById(
          homeId
        )
      );
  }

  if (
    awayName === "Unknown" &&
    awayId > 0
  ) {
    awayName =
      getTeamName(
        await getTeamById(
          awayId
        )
      );
  }

  if (
    homeName === "Unknown"
  ) {
    homeName =
      event?.home_team_name ??
      event?.home_name ??
      "Unknown";
  }

  if (
    awayName === "Unknown"
  ) {
    awayName =
      event?.away_team_name ??
      event?.away_name ??
      "Unknown";
  }

  return {
    ...event,

    id:
      event?.id ??
      fixture?.id ??
      fixture?.event_id ??
      null,

    date:
      fixtureDate(event),

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

    home_team_id:
      homeId,

    away_team_id:
      awayId,

    home_team_name:
      homeName,

    away_team_name:
      awayName,

    home: {
      id:
        homeId,
      name:
        homeName
    },

    away: {
      id:
        awayId,
      name:
        awayName
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
  const [
    finishedData,
    upcomingData
  ] = await Promise.all([
    bsdGet<any>(
      "/events/",
      {
        team_id:
          teamId,
        status:
          "finished",
        limit:
          100
      }
    ),

    bsdGet<any>(
      "/events/",
      {
        team_id:
          teamId,
        status:
          "notstarted",
        limit:
          100
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

  if (
    upcoming.length === 0
  ) {
    const fallback =
      await bsdGet<any>(
        "/events/",
        {
          team_id:
            teamId,
          status:
            "upcoming",
          limit:
            100
        }
      );

    upcoming =
      responseArray(
        fallback
      );
  }

  const now =
    Date.now();

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
          resolveFixture(
            fixture
          )
      )
    );

  const last =
    finished[0]
      ? resolved[0] ??
        null
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

    lineups: [
      data
    ]
  };
}

export async function getFixturePlayerStats(
  eventId: number
) {
  const data =
    await bsdGet<any>(
      `/events/${eventId}/player-stats/`
    );

  return [
    data
  ];
}

export async function getFixtureIncidents(
  eventId: number
) {
  const data =
    await bsdGet<any>(
      `/events/${eventId}/incidents/`
    );

  return responseArray(
    data
  );
}
