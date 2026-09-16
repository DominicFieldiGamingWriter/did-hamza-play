const BASE_URL = "https://sports.bzzoiro.com/api/v2";

function getKey() {
  const key = process.env.BSD_API_KEY;

  if (!key) {
    throw new Error("BSD_API_KEY is not configured.");
  }

  return key;
}

async function bsdGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${getKey()}`,
      Accept: "application/json"
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

function asArray(value: any): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function responseArray(data: any): any[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

export async function getPlayer(playerId: number) {
  return bsdGet<any>(`/players/${playerId}/`);
}

export async function findPlayer(name: string) {
  const data = await bsdGet<any>("/players/", {
    name,
    limit: 20
  });

  return responseArray(data);
}

export async function findTeam(name: string) {
  const data = await bsdGet<any>("/teams/", {
    name,
    limit: 20
  });

  return responseArray(data);
}

export async function getTeamSquad(teamId: number) {
  const data = await bsdGet<any>(
    `/teams/${teamId}/squad/`
  );

  return responseArray(data);
}

export async function getTeamFixtures(teamId: number) {
  const [finishedData, upcomingData] =
    await Promise.all([
      bsdGet<any>(
        `/teams/${teamId}/fixtures/`,
        {
          status: "finished",
          limit: 10
        }
      ),

      bsdGet<any>(
        `/teams/${teamId}/fixtures/`,
        {
          status: "upcoming",
          limit: 10
        }
      )
    ]);

  const finished =
    responseArray(finishedData);

  const upcoming =
    responseArray(upcomingData);

  finished.sort(
    (a, b) =>
      new Date(b.date).getTime() -
      new Date(a.date).getTime()
  );

  upcoming.sort(
    (a, b) =>
      new Date(a.date).getTime() -
      new Date(b.date).getTime()
  );

  return {
    last: finished[0] ?? null,
    next: upcoming.slice(0, 3)
  };
}

export async function getLineups(eventId: number) {
  const data = await bsdGet<any>(
    `/events/${eventId}/lineups/`
  );

  return {
    status:
      data?.lineup_status ??
      "unavailable",

    lineups:
      asArray(data?.lineups)
  };
}

export async function getFixturePlayerStats(
  eventId: number
) {
  const data = await bsdGet<any>(
    `/events/${eventId}/player-stats/`
  );

  return asArray(data?.players);
}
