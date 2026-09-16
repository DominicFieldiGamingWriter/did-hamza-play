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

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

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

export type Player = {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  photo?: string;
  team?: {
    id: number;
    name: string;
    logo?: string;
  };
};

export type Fixture = {
  id: number;
  date: string;
  status?: string;
  home_team?: {
    id: number;
    name: string;
    logo?: string;
  };
  away_team?: {
    id: number;
    name: string;
    logo?: string;
  };
  home_score?: number | null;
  away_score?: number | null;
  competition?: {
    id: number;
    name: string;
  };
};

export type PlayerAvailability = {
  status?: string;
  reason?: string;
};

export async function findPlayer(name: string) {
  return bsdGet<Player[]>("/players/", {
    search: name
  });
}

export async function getPlayer(playerId: number) {
  return bsdGet<Player>(`/players/${playerId}/`);
}

export async function getTeamFixtures(teamId: number) {
  const fixtures = await bsdGet<Fixture[]>("/fixtures/", {
    team: teamId
  });

  const now = Date.now();

  const sorted = [...fixtures].sort(
    (a, b) =>
      new Date(a.date).getTime() -
      new Date(b.date).getTime()
  );

  const completed = sorted.filter(
    fixture =>
      new Date(fixture.date).getTime() <= now
  );

  const upcoming = sorted.filter(
    fixture =>
      new Date(fixture.date).getTime() > now
  );

  return {
    last: completed[completed.length - 1] ?? null,
    next: upcoming.slice(0, 3)
  };
}

export async function getLineups(fixtureId: number) {
  return bsdGet<unknown[]>(`/fixtures/${fixtureId}/lineups/`);
}

export async function getFixturePlayerStats(
  fixtureId: number,
  teamId: number
) {
  return bsdGet<unknown[]>(
    `/fixtures/${fixtureId}/player-stats/`,
    { team: teamId }
  );
}

export async function getSidelined(playerId: number) {
  return bsdGet<PlayerAvailability[]>(
    `/players/${playerId}/availability/`
  );
}
