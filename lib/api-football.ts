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

  return [];
}

function asArray(value: any): any[] {
  if (Array.isArray(value)) {
    return value;
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
      bsdGet<any>("/events/", {
        team_id: teamId,
        status: "finished",
        limit: 20
      }),

      bsdGet<any>("/events/", {
        team_id: teamId,
        status: "notstarted",
        limit: 20
      })
    ]);

  const finished = responseArray(finishedData);
  const upcoming = responseArray(upcomingData);

  function getDate(event: any) {
    return (
      event?.kickoff ??
      event?.event_date ??
      event?.date ??
      event?.start_time ??
      event?.datetime ??
      null
    );
  }

  finished.sort(
    (a, b) =>
      new Date(getDate(b)).getTime() -
      new Date(getDate(a)).getTime()
  );

  upcoming.sort(
    (a, b) =>
      new Date(getDate(a)).getTime() -
      new Date(getDate(b)).getTime()
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

  const raw = data?.lineups;

  /*
   * BSD can return lineups in several shapes.
   * Keep the actual team lineup objects intact so
   * refresh.ts can inspect starting XI and substitutes.
   */

  if (Array.isArray(raw)) {
    return {
      status:
        data?.lineup_status ??
        "unavailable",
      lineups: raw
    };
  }

  if (raw?.home || raw?.away) {
    const lineups: any[] = [];

    if (raw.home) {
      lineups.push(raw.home);
    }

    if (raw.away) {
      lineups.push(raw.away);
    }

    return {
      status:
        data?.lineup_status ??
        "unavailable",
      lineups
    };
  }

  if (raw?.home_team || raw?.away_team) {
    const lineups: any[] = [];

    if (raw.home_team) {
      lineups.push(raw.home_team);
    }

    if (raw.away_team) {
      lineups.push(raw.away_team);
    }

    return {
      status:
        data?.lineup_status ??
        "unavailable",
      lineups
    };
  }

  return {
    status:
      data?.lineup_status ??
      "unavailable",
    lineups: []
  };
}

export async function getFixturePlayerStats(
  eventId: number
) {
  const data = await bsdGet<any>(
    `/events/${eventId}/player-stats/`
  );

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.players)) {
    return data.players;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}
