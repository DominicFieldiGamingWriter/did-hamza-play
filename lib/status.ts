import type {
  Fixture,
  Lineup,
  PlayerFixtureStat,
  Sidelined
} from "./api-football";

export type PlayerStatus = {
  played: boolean;
  type: string;
  label: string;
  reason?: string;
};

export function classifyPlayer(
  playerId: number,
  fixture: Fixture,
  lineups: Lineup[],
  playerStats: PlayerFixtureStat[],
  sidelined: Sidelined[]
): PlayerStatus {
  // Check lineups first.
  for (const lineup of lineups) {
    const starters = lineup.starting_xi ?? [];
    const substitutes = lineup.substitutes ?? [];

    if (
      starters.some(
        (entry: any) => entry.player?.id === playerId
      )
    ) {
      return {
        played: true,
        type: "started",
        label: "Started"
      };
    }

    if (
      substitutes.some(
        (entry: any) => entry.player?.id === playerId
      )
    ) {
      return {
        played: true,
        type: "substitute",
        label: "Came on as substitute"
      };
    }
  }

  // Check player statistics.
  for (const group of playerStats) {
    const players = group.players ?? [];

    for (const entry of players) {
      if (entry.player?.id !== playerId) continue;

      const stats = entry.statistics?.[0];

      if (
        stats?.minutes?.number &&
        stats.minutes.number > 0
      ) {
        return {
          played: true,
          type: "played",
          label: "Played"
        };
      }

      if (
        stats?.games?.minutes &&
        stats.games.minutes > 0
      ) {
        return {
          played: true,
          type: "played",
          label: "Played"
        };
      }

      if (
        stats?.games?.appearences &&
        stats.games.appearences > 0
      ) {
        return {
          played: true,
          type: "played",
          label: "Played"
        };
      }
    }
  }

  // No appearance found. Check for an absence reason.
  const absence = sidelined?.[0];

  if (absence) {
    const status = String(
      absence.status ?? absence.type ?? ""
    ).toLowerCase();

    const reason = absence.reason ?? "";

    if (status.includes("suspend")) {
      return {
        played: false,
        type: "suspended",
        label: "Suspended",
        reason
      };
    }

    if (status.includes("injur")) {
      return {
        played: false,
        type: "injured",
        label: "Injured",
        reason
      };
    }

    if (status.includes("doubt")) {
      return {
        played: false,
        type: "doubtful",
        label: "Doubtful",
        reason
      };
    }
  }

  return {
    played: false,
    type: "not_selected",
    label: "Not selected"
  };
}
