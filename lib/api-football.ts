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

function fixtureStatus(
  fixture: any
): string {
  const value =
    fixture?.status ??
    fixture?.match_status ??
    fixture?.state ??
    fixture?.time?.status ??
    "";

  if (
    typeof value === "object" &&
    value !== null
  ) {
    return String(
      value?.name ??
      value?.type ??
      value?.status ??
      ""
    ).toLowerCase();
  }

  return String(value)
    .toLowerCase();
}

function isCancelledOrPostponed(
  fixture: any
): boolean {
  const status =
    fixtureStatus(fixture);

  return (
    status.includes("cancel") ||
    status.includes("postpon") ||
    status.includes("abandon")
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
   * BSD's team fixtures endpoint contains
   * every fixture and result for the team,
   * including cup matches.
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
        ) > 0 &&
        !isCancelledOrPostponed(
          fixture
        )
    );

  /*
   * Completed fixtures:
   *
   * Use the fixture date rather than relying
   * exclusively on BSD's status naming.
   *
   * This makes the latest completed match
   * reliable even if BSD uses a different
   * status label.
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
   * Upcoming fixtures:
   *
   * Every future fixture is retained,
   * regardless of competition.
   *
   * This is what brings cup matches such
   * as Fleetwood Town into the feed.
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

  return {
    last:
      finished[0] ?? null,

    next:
      upcoming.slice(0, 6),
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

    lineups: [data],
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
