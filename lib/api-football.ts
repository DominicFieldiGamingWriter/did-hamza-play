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
   * Use the BSD team-fixtures endpoint rather
   * than filtering /events/ by status.
   *
   * This keeps cup games and league games
   * together.
   */
  const data = await bsdGet<any>(
    `/teams/${teamId}/fixtures/`
  );

  const fixtures =
    responseArray(data);

  function eventDate(event: any) {
    return (
      event?.kickoff ??
      event?.time?.kickoff_at ??
      event?.event_date ??
      event?.date ??
      event?.start_time ??
      null
    );
  }

  function eventStatus(event: any) {
    return String(
      event?.status ??
        event?.match_status ??
        ""
    ).toLowerCase();
  }

  const now = Date.now();

  const finished =
    fixtures
      .filter((fixture) => {
        const status =
          eventStatus(fixture);

        return (
          status === "finished" ||
          status === "ft" ||
          status === "completed"
        );
      })
      .sort(
        (a, b) =>
          new Date(
            eventDate(b)
          ).getTime() -
          new Date(
            eventDate(a)
          ).getTime()
      );

  const upcoming =
    fixtures
      .filter((fixture) => {
        const status =
          eventStatus(fixture);

        if (
          status === "cancelled" ||
          status === "postponed"
        ) {
          return false;
        }

        if (
          status === "finished" ||
          status === "ft" ||
          status === "completed" ||
          status === "live" ||
          status === "inprogress"
        ) {
          return false;
        }

        const date =
          eventDate(fixture);

        if (!date) {
          return false;
        }

        return (
          new Date(date).getTime() >=
          now
        );
      })
      .sort(
        (a, b) =>
          new Date(
            eventDate(a)
          ).getTime() -
          new Date(
            eventDate(b)
          ).getTime()
      );

  return {
    last:
      finished[0] ?? null,

    /*
     * Store enough upcoming fixtures so the
     * homepage can use:
     *
     * #1 = Will Hamza Play Next?
     * #2-#4 = Upcoming Fixtures
     */
    next: upcoming.slice(0, 6),
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
