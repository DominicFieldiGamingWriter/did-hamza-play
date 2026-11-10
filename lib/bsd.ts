import { assertBsdApiCircuitClosed, BsdApiCircuitOpenError, recordBsdApiRateLimit } from "./bsd-circuit-breaker";

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
  await assertBsdApiCircuitClosed();

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
    const responseBody = await response.text();

    if (response.status === 429) {
      throw await recordBsdApiRateLimit(response.headers, responseBody);
    }

    throw new Error(
      "BSD API " + response.status + ": " + responseBody
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
    typeof data !==
      "object"
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

function primitiveId(
  value: any
): number | null {
  if (
    typeof value ===
    "number"
  ) {
    return (
      Number.isFinite(
        value
      ) &&
      value > 0
        ? value
        : null
    );
  }

  if (
    typeof value ===
      "string" &&
    value.trim()
  ) {
    const id =
      Number(
        value
      );

    return (
      Number.isFinite(
        id
      ) &&
      id > 0
        ? id
        : null
    );
  }

  return null;
}

function getNestedTeam(
  fixture: any,
  side:
    | "home"
    | "away"
) {
  const candidates = [
    fixture?.[side],
    fixture?.[
      `${side}_team`
    ],
    fixture?.[
      `${side}Team`
    ],
    fixture?.teams?.[
      side
    ],
    fixture?.teams?.[
      `${side}_team`
    ],
    fixture?.participants?.[
      side
    ],
    fixture?.participants?.[
      `${side}_team`
    ]
  ];

  for (
    const candidate of candidates
  ) {
    if (
      candidate !==
        undefined &&
      candidate !== null
    ) {
      return candidate;
    }
  }

  return null;
}

function getTeamId(
  fixture: any,
  side:
    | "home"
    | "away"
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
    nested?.team?.id
  ];

  for (
    const candidate of candidates
  ) {
    const id =
      primitiveId(
        candidate
      );

    if (
      id !== null
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
    typeof value ===
      "string" &&
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
      typeof candidate ===
        "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return "Unknown";
}

function getFixtureTeamName(
  fixture: any,
  side:
    | "home"
    | "away"
): string {
  const nested =
    getNestedTeam(
      fixture,
      side
    );

  const nestedName =
    getTeamName(
      nested
    );

  if (
    nestedName !==
    "Unknown"
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

  for (
    const candidate of candidates
  ) {
    if (
      typeof candidate ===
        "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return "Unknown";
}

export async function getTeamById(
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
  } catch (error) {
    if (error instanceof BsdApiCircuitOpenError) throw error;
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
  } catch (error) {
    if (error instanceof BsdApiCircuitOpenError) throw error;
    return null;
  }
}

async function resolveFixture(
  fixture: any
) {
  let event =
    fixture;

  const eventId =
    primitiveId(
      fixture?.id ??
        fixture?.event_id
    );

  if (
    eventId !== null
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
    homeName ===
      "Unknown" &&
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
    awayName ===
      "Unknown" &&
    awayId > 0
  ) {
    awayName =
      getTeamName(
        await getTeamById(
          awayId
        )
      );
  }

  return {
    ...event,

    id:
      event?.id ??
      fixture?.id ??
      fixture?.event_id ??
      null,

    date:
      fixtureDate(
        event
      ),

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
  const data =
    await bsdGet<any>(
      `/players/${playerId}/`
    );

  return responseObject(
    data
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

  return responseArray(
    data
  );
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

  return responseArray(
    data
  );
}

export async function getTeamSquad(
  teamId: number
) {
  const data =
    await bsdGet<any>(
      `/teams/${teamId}/squad/`
    );

  return responseArray(
    data
  );
}

function isTerminalStatus(
  fixture: any
): boolean {
  const status =
    String(
      fixture?.status ??
        ""
    )
      .trim()
      .toLowerCase();

  return (
    status ===
      "finished" ||
    status ===
      "cancelled" ||
    status ===
      "postponed" ||
    status ===
      "unresolved"
  );
}

function isCurrentlyLive(
  fixture: any
): boolean {
  if (
    !fixture ||
    isTerminalStatus(
      fixture
    )
  ) {
    return false;
  }

  const status =
    String(
      fixture?.status ??
        fixture?.time?.status ??
        ""
    )
      .trim()
      .toLowerCase();

  /*
   * BSD documents `live` as a match that
   * is currently in progress. The feed can
   * also expose more granular in-play states,
   * so recognise those explicitly.
   */
  const liveStatuses = new Set([
    "live",
    "inprogress",
    "inplay",
    "1sthalf",
    "halftime",
    "2ndhalf",
    "extratime",
    "penaltyshootout",
    "overtime"
  ]);

  const normalisedStatus =
    status.replace(
      /[^a-z0-9]+/g,
      ""
    );

  return liveStatuses.has(
    normalisedStatus
  );
}

function fixtureBelongsToTeam(
  fixture: any,
  teamId: number
): boolean {
  const targetId =
    Number(teamId);

  const homeId =
    Number(
      fixture?.home_team?.id ??
        fixture?.home?.id ??
        fixture?.home_team_id ??
        fixture?.home_id ??
        NaN
    );

  const awayId =
    Number(
      fixture?.away_team?.id ??
        fixture?.away?.id ??
        fixture?.away_team_id ??
        fixture?.away_id ??
        NaN
    );

  return (
    homeId === targetId ||
    awayId === targetId
  );
}

function normaliseTeamName(value: any): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function fixtureBelongsToTeamName(
  fixture: any,
  teamName: string
): boolean {
  const targetName =
    normaliseTeamName(teamName);

  return (
    normaliseTeamName(
      getFixtureTeamName(fixture, "home")
    ) === targetName ||
    normaliseTeamName(
      getFixtureTeamName(fixture, "away")
    ) === targetName
  );
}

function isFreshLiveFixture(
  fixture: any
): boolean {
  const timestamp =
    fixtureTimestamp(
      fixture
    );

  if (!timestamp) {
    return false;
  }

  const now =
    Date.now();

  /*
   * A genuinely live football match should
   * have kicked off recently. This is an
   * additional guard against stale/corrupt
   * records carrying a live-like status.
   */
  const maxAgeMs =
    6 * 60 * 60 * 1000;

  const maxFutureMs =
    2 * 60 * 60 * 1000;

  return (
    timestamp >=
      now - maxAgeMs &&
    timestamp <=
      now + maxFutureMs
  );
}

function fixtureDiagnosticSummary(fixture: any) {
  return {
    id: fixture?.id ?? fixture?.event_id ?? null,
    date: fixtureDate(fixture),
    status: fixture?.status ?? fixture?.time?.status ?? null,
    home: getFixtureTeamName(fixture, "home"),
    away: getFixtureTeamName(fixture, "away"),
    home_id: getTeamId(fixture, "home"),
    away_id: getTeamId(fixture, "away")
  };
}

function responseDiagnosticSummary(data: any) {
  if (Array.isArray(data)) {
    return {
      shape: "array",
      count: data.length
    };
  }

  if (!data || typeof data !== "object") {
    return {
      shape: typeof data,
      count: 0
    };
  }

  return {
    shape: "object",
    keys: Object.keys(data).slice(0, 20),
    count: responseArray(data).length,
    total: data.count ?? data.total ?? data.total_count ?? null,
    has_next_page: Boolean(data.next)
  };
}

async function getTeamFixturesForTeam(
  teamFilter: Record<string, string | number>,
  teamMatches: (fixture: any) => boolean
) {
  const queryNowMs = Date.now();
  const todayUtc = new Date(queryNowMs).toISOString().slice(0, 10);
  const finishedFrom = new Date(queryNowMs - 3 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const upcomingTo = new Date(queryNowMs + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const liveFrom = new Date(queryNowMs - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const liveTo = new Date(queryNowMs + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const isNamedLookup =
    typeof teamFilter.team_name === "string";

  let finishedData: any;
  let liveData: any;
  let upcomingData: any;

  try {
    [
      finishedData,
      liveData,
      upcomingData
    ] = await Promise.all([
      bsdGet<any>(
        "/events/",
        {
          ...teamFilter,
          date_from: finishedFrom,
          date_to: todayUtc,
          status: "finished",
          limit: 100
        }
      ),

      bsdGet<any>(
        "/events/live/",
        {
          limit: 200
        }
      ),

      bsdGet<any>(
        "/events/",
        {
          ...teamFilter,
          date_from: todayUtc,
          date_to: upcomingTo,
          status: "upcoming",
          limit: 100
        }
      )
    ]);
  } catch (error) {
    if (isNamedLookup) {
      console.error(
        "BSD_NATIONAL_FIXTURE_LOOKUP_ERROR",
        JSON.stringify({
          team_filter: teamFilter,
          stage: "initial_requests",
          error: error instanceof Error ? error.message : String(error)
        })
      );
    }

    throw error;
  }

  const finishedRaw = responseArray(finishedData);
  const liveRaw = responseArray(liveData);
  const upcomingRaw = responseArray(upcomingData);

  let finished = finishedRaw.filter(teamMatches);

  let live = liveRaw.filter(
    (fixture) =>
      teamMatches(fixture) &&
      isCurrentlyLive(fixture) &&
      isFreshLiveFixture(fixture)
  );

  let upcoming = upcomingRaw.filter(teamMatches);

  let liveFallbackCount: number | null = null;
  let upcomingFallbackRaw: any[] | null = null;

  /*
   * Keep a team-scoped fallback for feeds
   * where /events/live/ is temporarily empty
   * or does not include a granular in-play status.
   */
  if (live.length === 0) {
    try {
      const allEventsData = await bsdGet<any>(
        "/events/",
        {
          ...teamFilter,
          date_from: liveFrom,
          date_to: liveTo,
          limit: 100
        }
      );

      const allEvents = responseArray(allEventsData);
      liveFallbackCount = allEvents.length;

      live = allEvents.filter(
        (fixture) =>
          teamMatches(fixture) &&
          isCurrentlyLive(fixture) &&
          isFreshLiveFixture(fixture)
      );
    } catch (error) {
      if (isNamedLookup) {
        console.error(
          "BSD_NATIONAL_FIXTURE_LOOKUP_ERROR",
          JSON.stringify({
            team_filter: teamFilter,
            stage: "live_fallback",
            error: error instanceof Error ? error.message : String(error)
          })
        );
      }

      throw error;
    }
  }

  /*
   * Some provider responses omit the upcoming
   * status filter. Retry without it, then apply
   * the date check below ourselves.
   */
  if (upcoming.length === 0) {
    try {
      const fallback = await bsdGet<any>(
        "/events/",
        {
          ...teamFilter,
          date_from: todayUtc,
          date_to: upcomingTo,
          limit: 100
        }
      );

      upcomingFallbackRaw = responseArray(fallback);
      upcoming = upcomingFallbackRaw.filter(teamMatches);
    } catch (error) {
      if (isNamedLookup) {
        console.error(
          "BSD_NATIONAL_FIXTURE_LOOKUP_ERROR",
          JSON.stringify({
            team_filter: teamFilter,
            stage: "upcoming_fallback",
            error: error instanceof Error ? error.message : String(error)
          })
        );
      }

      throw error;
    }
  }

  const now = Date.now();
  const matchedUpcomingBeforeDateFilter = upcoming.length;
  const matchedUpcomingWithDates = upcoming.filter(
    (fixture) => fixtureTimestamp(fixture) > 0
  ).length;

  finished = finished
    .filter(
      (fixture) =>
        fixtureTimestamp(fixture) > 0 &&
        fixtureTimestamp(fixture) <= now
    )
    .sort(
      (a, b) =>
        fixtureTimestamp(b) -
        fixtureTimestamp(a)
    );

  live = live
    .filter(
      (fixture) =>
        isCurrentlyLive(fixture) &&
        isFreshLiveFixture(fixture)
    )
    .sort(
      (a, b) =>
        fixtureTimestamp(a) -
        fixtureTimestamp(b)
    );

  upcoming = upcoming
    .filter(
      (fixture) =>
        fixtureTimestamp(fixture) > now
    )
    .sort(
      (a, b) =>
        fixtureTimestamp(a) -
        fixtureTimestamp(b)
    );

  if (isNamedLookup) {
    console.info(
      "BSD_NATIONAL_FIXTURE_DIAGNOSTIC",
      JSON.stringify({
        team_filter: teamFilter,
        finished_response: responseDiagnosticSummary(finishedData),
        live_response: responseDiagnosticSummary(liveData),
        live_fallback_response_count: liveFallbackCount,
        upcoming_status_response: responseDiagnosticSummary(upcomingData),
        upcoming_status_match_count: upcomingRaw.filter(teamMatches).length,
        upcoming_fallback_used: upcomingFallbackRaw !== null,
        upcoming_fallback_response_count: upcomingFallbackRaw?.length ?? null,
        upcoming_fallback_match_count:
          upcomingFallbackRaw?.filter(teamMatches).length ?? null,
        matched_upcoming_before_date_filter: matchedUpcomingBeforeDateFilter,
        matched_upcoming_with_valid_dates: matchedUpcomingWithDates,
        matched_upcoming_after_date_filter: upcoming.length,
        status_response_sample: upcomingRaw
          .slice(0, 10)
          .map(fixtureDiagnosticSummary),
        fallback_response_sample: upcomingFallbackRaw
          ?.slice(0, 10)
          .map(fixtureDiagnosticSummary) ?? null,
        matched_future_sample: upcoming
          .slice(0, 10)
          .map(fixtureDiagnosticSummary)
      })
    );
  }

  const resolvedLive =
    live[0]
      ? await resolveFixture(live[0])
      : null;

  const last =
    finished[0]
      ? await resolveFixture(finished[0])
      : null;

  const next =
    await Promise.all(
      upcoming
        .slice(0, 6)
        .map(
          (fixture) =>
            resolveFixture(fixture)
        )
    );

  return {
    live: resolvedLive,
    last,
    next
  };
}

export async function getTeamFixtures(
  teamId: number
) {
  if (!Number.isFinite(teamId) || teamId <= 0) {
    throw new Error("A valid team ID is required.");
  }

  return getTeamFixturesForTeam(
    { team_id: teamId },
    (fixture) =>
      fixtureBelongsToTeam(fixture, teamId)
  );
}

export async function getTeamFixturesByName(
  teamName: string
) {
  const name = teamName.trim();

  if (!name) {
    throw new Error("A team name is required for fixture lookup.");
  }

  console.info(
    "BSD_NATIONAL_FIXTURE_LOOKUP_START",
    JSON.stringify({ team_name: name })
  );

  return getTeamFixturesForTeam(
    { team_name: name },
    (fixture) =>
      fixtureBelongsToTeamName(fixture, name)
  );
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
