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

  return [];
}

function fixtureDate(fixture: any) {
  return (
    fixture?.time?.kickoff_at ??
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
  const data = await bsdGet<any>(
    "/players/",
    {
      name,
      limit: 20,
    }
  );

  return responseArray(data);
}

export async function findTeam(
  name: string
) {
  const data = await bsdGet<any>(
    "/teams/",
    {
      name,
      limit: 20,
    }
  );

  return responseArray(data);
}

export async function getTeamSquad(
  teamId: number
) {
  const data = await bsdGet<any>(
    `/teams/${teamId}/squad/`
  );

  return responseArray(data);
}

export async function getTeamFixtures(
  teamId: number
) {
  /*
   * Keep the return shape expected by
   * lib/refresh.ts:
   *
   * {
   *   last: latest completed fixture,
   *   next: upcoming fixtures
   * }
   *
   * We query the football events endpoint
   * by team rather than using a league-only
   * fixture source. This includes cup matches.
   */

  const finishedData =
    await bsdGet<any>(
      "/events/",
      {
        team_id: teamId,
        status: "finished",
        limit: 100,
      }
    );

  const upcomingData =
    await bsdGet<any>(
      "/events/",
      {
        team_id: teamId,
        status: "notstarted",
        limit: 100,
      }
    );

  let finished =
    responseArray(
      finishedData
    );

  let upcoming =
    responseArray(
      upcomingData
    );

  /*
   * Some BSD endpoints/documentation use
   * "upcoming" rather than "notstarted".
   * If notstarted returns nothing, try the
   * current upcoming status as a fallback.
   */
  if (upcoming.length === 0) {
    const fallbackData =
      await bsdGet<any>(
        "/events/",
        {
          team_id: teamId,
          status: "upcoming",
          limit: 100,
        }
      );

    upcoming =
      responseArray(
        fallbackData
      );
  }

  finished = finished
    .filter(
      (fixture) =>
        fixtureTimestamp(
          fixture
        ) > 0
    )
    .sort(
      (a, b) =>
        fixtureTimestamp(b) -
        fixtureTimestamp(a)
    );

  const now = Date.now();

  upcoming = upcoming
    .filter(
      (fixture) =>
        fixtureTimestamp(
          fixture
        ) >= now
    )
    .sort(
      (a, b) =>
        fixtureTimestamp(a) -
        fixtureTimestamp(b)
    );

  return {
    last:
      finished[0] ?? null,

    /*
     * Keep several upcoming fixtures so the
     * refresh layer can store enough data for:
     *
     * WILL HAMZA PLAY NEXT?
     * +
     * UPCOMING FIXTURES #1-#3
     */
    next:
      upcoming.slice(0, 6),
  };
}

export async function getLineups(
  eventId: number
) {
  const data = await bsdGet<any>(
    `/events/${eventId}/lineups/`
  );

  return {
    status:
      data?.lineup_status ??
      "unavailable",

    lineups: [data],
  };
}

export async function getFixturePlayerStats(
  eventId: number
) {
  const data = await bsdGet<any>(
    `/events/${eventId}/player-stats/`
  );

  return [data];
}
