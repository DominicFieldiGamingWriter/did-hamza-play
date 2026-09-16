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

function responseArray(data: any): any[] {
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

function fixtureDate(fixture: any) {
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

function teamId(value: any): number {
  const candidates = [
    value?.id,
    value?.team_id,
    value?.team?.id,
    value?.team?.team_id
  ];

  for (const candidate of candidates) {
    const id = Number(candidate);

    if (
      Number.isFinite(id) &&
      id > 0
    ) {
      return id;
    }
  }

  return 0;
}

function teamName(value: any): string {
  const candidates = [
    value?.name,
    value?.team_name,
    value?.team?.name,
    value?.team?.team_name,
    value?.full_name,
    value?.short_name
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

function extractHomeAway(
  fixture: any
) {
  const home =
    fixture?.home ??
    fixture?.home_team ??
    fixture?.homeTeam ??
    fixture?.teams?.home ??
    fixture?.teams?.home_team ??
    fixture?.participants?.home ??
    fixture?.participants?.home_team ??
    null;

  const away =
    fixture?.away ??
    fixture?.away_team ??
    fixture?.awayTeam ??
    fixture?.teams?.away ??
    fixture?.teams?.away_team ??
    fixture?.participants?.away ??
    fixture?.participants?.away_team ??
    null;

  return {
    homeId:
      teamId(home) ||
      Number(
        fixture?.home_team_id ??
        fixture?.home_id ??
        0
      ),

    awayId:
      teamId(away) ||
      Number(
        fixture?.away_team_id ??
        fixture?.away_id ??
        0
      ),

    homeName:
      teamName(home) !== "Unknown"
        ? teamName(home)
        : (
            fixture?.home_team_name ??
            fixture?.home_name ??
            "Unknown"
          ),

    awayName:
      teamName(away) !== "Unknown"
        ? teamName(away)
        : (
            fixture?.away_team_name ??
            fixture?.away_name ??
            "Unknown"
          )
  };
}

async function getEvent(
  eventId: number
) {
  return bsdGet<any>(
    `/events/${eventId}/`
  );
}

async function enrichFixture(
  fixture: any
) {
  const eventId =
    Number(
      fixture?.id ??
      fixture?.event_id
    );

  if (
    !Number.isFinite(eventId) ||
    eventId <= 0
  ) {
    return fixture;
  }

  try {
    const event =
      await getEvent(eventId);

    /*
     * BSD's event detail contains the
     * authoritative home/away team data.
     */
    return {
      ...fixture,
      ...event,

      /*
       * Preserve the original fixture ID.
       */
      id: event?.id ?? eventId
    };
  } catch {
    /*
     * If enrichment fails, retain the
     * original fixture rather than breaking
     * the entire refresh.
     */
    return fixture;
  }
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
   * BSD's team fixtures endpoint contains
   * every fixture and result, including
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
   * Enrich the fixtures with BSD's event
   * detail endpoint. This is the important
   * part: the event detail has the actual
   * home and away team names.
   */
  const upcomingEnriched =
    await Promise.all(
      upcoming
        .slice(0, 6)
        .map(
          (fixture) =>
            enrichFixture(
              fixture
            )
        )
    );

  const lastEnriched =
    finished[0]
      ? await enrichFixture(
          finished[0]
        )
      : null;

  return {
    last:
      lastEnriched,

    next:
      upcomingEnriched
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
