import type { Fixture, Lineup, PlayerFixtureStat, Sidelined } from "./api-football";

export type PlayerStatus = {
  played: boolean;
  label: string;
  detail: string;
  reason?: string;
  minutes?: number;
  started?: boolean;
};

export function classifyPlayer(
  playerId: number,
  fixture: Fixture,
  lineups: Lineup[],
  stats: PlayerFixtureStat[],
  sidelined: Sidelined[]
): PlayerStatus {
  const team = fixture.teams.home.id === (lineups.find(l => l.team.id === fixture.teams.home.id)?.team.id)
    ? fixture.teams.home
    : fixture.teams.away;

  const lineup = lineups.find(l => l.team.id === team.id);
  const inStart = lineup?.startXI.some(x => x.player.id === playerId) ?? false;
  const inSubs = lineup?.substitutes.some(x => x.player.id === playerId) ?? false;

  const statRecord = stats.flatMap(s => s.players ?? []).find(p => p.player.id === playerId);
  const stat = statRecord?.statistics?.[0];
  const minutes = stat?.games?.minutes ?? stat?.minutes?.number ?? 0;

  if (minutes > 0) {
    return {
      played: true,
      label: inStart ? "Started" : "Substitute",
      detail: `${minutes} min`,
      minutes,
      started: inStart
    };
  }

  if (inStart || inSubs) {
    return {
      played: false,
      label: "No",
      detail: "Unused substitute",
      minutes: 0,
      started: inStart
    };
  }

  const now = new Date(fixture.fixture.date);
  const active = sidelined.find(s => {
    const start = s.start ? new Date(s.start) : null;
    const end = s.end ? new Date(s.end) : null;
    return start && start <= now && (!end || end >= now);
  });

  if (active) {
    const raw = `${active.type ?? ""} ${active.reason ?? ""}`.toLowerCase();
    const reason = raw.includes("susp") ? "Suspended" : "Injured";
    return { played: false, label: "No", detail: reason, reason: active.reason };
  }

  return {
    played: false,
    label: "No",
    detail: "Not selected"
  };
}
