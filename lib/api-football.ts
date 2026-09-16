type ApiResponse<T> = {
  get?: string;
  errors?: unknown;
  results?: number;
  response?: T[];
};

const BASE_URL = "https://v3.football.api-sports.io";

function key() {
  const value = process.env.API_FOOTBALL_KEY;
  if (!value) throw new Error("API_FOOTBALL_KEY is not configured.");
  return value;
}

export async function footballGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T[]> {
  const url = new URL(BASE_URL + path);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    headers: { "x-apisports-key": key() },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as ApiResponse<T>;

  if (data.errors && Object.keys(data.errors as object).length) {
    throw new Error(
      `API-Football error: ${JSON.stringify(data.errors)}`
    );
  }

  return data.response ?? [];
}

export type PlayerSearch = {
  player: {
    id: number;
    name: string;
    firstname?: string;
    lastname?: string;
    age?: number;
    birth?: {
      date?: string;
      place?: string;
      country?: string;
    };
    nationality?: string;
    photo?: string;
  };
  statistics?: Array<{
    team?: {
      id: number;
      name: string;
      logo?: string;
    };
    league?: {
      id: number;
      name: string;
      season: number;
    };
  }>;
};

export type Fixture = {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
      long?: string;
    };
    venue?: {
      name?: string;
      city?: string;
    };
  };
  league: {
    id: number;
    name: string;
    logo?: string;
    season: number;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo?: string;
      winner?: boolean;
    };
    away: {
      id: number;
      name: string;
      logo?: string;
      winner?: boolean;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

export type Lineup = {
  team: {
    id: number;
    name: string;
  };
  startXI: Array<{
    player: {
      id: number;
      name: string;
      number?: number;
      pos?: string;
    };
  }>;
  substitutes: Array<{
    player: {
      id: number;
      name: string;
      number?: number;
      pos?: string;
    };
  }>;
};

export type PlayerFixtureStat = {
  team?: {
    id: number;
    name: string;
  };
  players?: Array<{
    player: {
      id: number;
      name: string;
    };
    statistics?: Array<{
      minutes?: {
        number?: number;
        position?: string;
        substitute?: boolean;
      };
      games?: {
        appearences?: number;
        lineups?: number;
        minutes?: number;
        substitute?: boolean;
      };
    }>;
  }>;
};

export type Sidelined = {
  player?: {
    id: number;
    name: string;
  };
  type?: string;
  start?: string;
  end?: string;
  reason?: string;
};

export async function findPlayer(name: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const season = now.getUTCMonth() >= 6 ? year : year - 1;

  const [championship, leagueOne] = await Promise.all([
    footballGet<PlayerSearch>("/players", {
      search: name,
      league: 40,
      season
    }),
    footballGet<PlayerSearch>("/players", {
      search: name,
      league: 41,
      season
    })
  ]);

  return [...championship, ...leagueOne];
}

export async function getPlayer(playerId: number, season: number) {
  return footballGet<PlayerSearch>("/players", {
    id: playerId,
    season
  });
}

export async function getTeamFixtures(teamId: number) {
  const [last, next] = await Promise.all([
    footballGet<Fixture>("/fixtures", {
      team: teamId,
      last: 1
    }),
    footballGet<Fixture>("/fixtures", {
      team: teamId,
      next: 3
    })
  ]);

  return {
    last: last[0] ?? null,
    next
  };
}

export async function getLineups(fixtureId: number) {
  return footballGet<Lineup>("/fixtures/lineups", {
    fixture: fixtureId
  });
}

export async function getFixturePlayerStats(
  fixtureId: number,
  teamId: number
) {
  return footballGet<PlayerFixtureStat>("/fixtures/players", {
    fixture: fixtureId,
    team: teamId
  });
}

export async function getSidelined(playerId: number) {
  return footballGet<Sidelined>("/sidelined", {
    player: playerId
  });
}
