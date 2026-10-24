export type PlayerStatus = {
  played: boolean;
  type: string;
  label: string;
  reason?: string;
};

export function classifyPlayer(
  playerId: number,
  fixture: any,
  lineups: any[],
  playerStats: any[],
  sidelined: any[]
): PlayerStatus {
  for (const lineup of lineups) {
    const starters =
      lineup.starting_xi ??
      lineup.startXI ??
      [];

    const substitutes =
      lineup.substitutes ??
      [];

    if (
      starters.some(
        (entry: any) =>
          entry.player?.id === playerId
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
        (entry: any) =>
          entry.player?.id === playerId
      )
    ) {
      return {
        played: true,
        type: "substitute",
        label: "Came on as substitute"
      };
    }
  }

  for (const group of playerStats) {
    const players = group.players ?? [];

    for (const entry of players) {
      if (entry.player?.id !== playerId) {
        continue;
      }

      const stats = entry.statistics?.[0];

      if (
        stats?.minutes?.number > 0 ||
        stats?.games?.minutes > 0 ||
        stats?.games?.appearences > 0
      ) {
        return {
          played: true,
          type: "played",
          label: "Played"
        };
      }
    }
  }

  const absence = sidelined?.[0];

  if (absence) {
    const status = String(
      absence.status ??
      absence.type ??
      ""
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


export type TeamSheetDecision = {
  status: "confirmed_start" | "confirmed_bench" | "confirmed_not_in_squad" | "lineup_pending";
  type: "confirmed_start" | "confirmed_bench" | "confirmed_not_in_squad" | "lineup_pending";
  phase: "team_news";
  tone: "positive" | "warning" | "negative";
  label: string;
  pillLabel: string;
  reason: string;
  lineup_fixture_id?: number;
  lineup_checked_at?: string;
};

function lineupPlayerId(value: any): number | null {
  const candidates = [value?.id, value?.player_id, value?.player?.id, value?.player?.player_id, value?.Player?.id, value?.PlayerID];
  for (const candidate of candidates) {
    const id = Number(candidate);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

function normalizedLineupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function keyMeansStartingXI(key: string): boolean {
  const normalized = normalizedLineupKey(key);
  return normalized.includes("startingxi") || normalized.includes("startxi") ||
    normalized.includes("startinglineup") || normalized.includes("startingplayers") ||
    normalized.includes("startingeleven");
}

function keyMeansSubstitutes(key: string): boolean {
  const normalized = normalizedLineupKey(key);
  return normalized.includes("substitute") || normalized.includes("bench") || normalized === "subs";
}

function collectCompleteStartingXIs(value: any): number[] {
  const counts: number[] = [];
  function walk(node: any, context: "starting" | "substitute" | "other" = "other") {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      if (context === "starting") {
        const players = node.filter(entry => lineupPlayerId(entry) !== null);
        if (players.length > 0) counts.push(players.length);
        return;
      }
      for (const item of node) walk(item, context);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (!child || typeof child !== "object") continue;
      const childContext = keyMeansStartingXI(key) ? "starting" :
        keyMeansSubstitutes(key) ? "substitute" : context;
      walk(child, childContext);
    }
  }
  walk(value);
  return counts.filter(count => count >= 11);
}

function lineupPlayerRole(value: any, playerId: number): "starting" | "substitute" | "unknown" {
  let role: "starting" | "substitute" | "unknown" = "unknown";
  function walk(node: any, context: "starting" | "substitute" | "other" = "other") {
    if (!node || typeof node !== "object" || role === "starting") return;
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, context);
      }
      return;
    }
    if (lineupPlayerId(node) === playerId) {
      const explicit = String(
        node.role ?? node.position_type ?? node.lineup_role ??
        node.selection_status ?? node.player_status ?? node.status_name ?? ""
      ).trim().toLowerCase();
      if (explicit.includes("start") || explicit === "xi" || explicit === "startingxi" || context === "starting") {
        role = "starting";
        return;
      }
      if (explicit.includes("sub") || explicit.includes("bench") || context === "substitute") {
        role = "substitute";
      }
      const starterFlags = [node.is_starter, node.starter, node.starting, node.in_starting_xi, node.starting_xi, node.is_starting];
      if (starterFlags.some(flag => flag === true || flag === 1 ||
        (typeof flag === "string" && ["true", "yes", "1", "starter", "starting"].includes(flag.trim().toLowerCase())))) {
        role = "starting";
        return;
      }
      const substituteFlags = [node.is_substitute, node.substitute, node.on_bench, node.bench, node.is_bench];
      if (substituteFlags.some(flag => flag === true || flag === 1 ||
        (typeof flag === "string" && ["true", "yes", "1", "substitute", "bench"].includes(flag.trim().toLowerCase())))) {
        role = "substitute";
      }
    }
    for (const [key, child] of Object.entries(node)) {
      if (!child || typeof child !== "object") continue;
      const childContext = keyMeansStartingXI(key) ? "starting" :
        keyMeansSubstitutes(key) ? "substitute" : context;
      walk(child, childContext);
    }
  }
  walk(value);
  return role;
}

function lineupContainsPlayer(value: any, playerId: number): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(item => lineupContainsPlayer(item, playerId));
  if (lineupPlayerId(value) === playerId) return true;
  return Object.values(value).some(child =>
    !!child && typeof child === "object" && lineupContainsPlayer(child, playerId)
  );
}

function pendingTeamSheet(reason = "The official lineup feed has not confirmed the team sheet yet. This page will keep checking."): TeamSheetDecision {
  return {
    status: "lineup_pending",
    type: "lineup_pending",
    phase: "team_news",
    tone: "warning",
    label: "Waiting for official team sheet",
    pillLabel: "Awaiting lineup",
    reason
  };
}

export function resolveTeamSheetStatus(playerId: number, lineupData: any): TeamSheetDecision {
  if (!lineupData || typeof lineupData !== "object") {
    return pendingTeamSheet("The official lineup feed could not be reached. This page will retry automatically.");
  }
  const lineups = Array.isArray(lineupData.lineups)
    ? lineupData.lineups
    : Array.isArray(lineupData) ? lineupData : [lineupData];
  const rawStatus = String(
    lineupData.status ?? lineupData.lineup_status ??
    lineups.find((item: any) => item && typeof item === "object")?.lineup_status ?? ""
  ).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const explicitlyConfirmed = [
    "confirmed", "official", "published", "complete", "completed", "finalized", "lineupsconfirmed"
  ].includes(rawStatus);
  const structurallyConfirmed = collectCompleteStartingXIs(lineups).length >= 2;
  const role = lineupPlayerRole(lineups, playerId);
  const playerIsListed = lineupContainsPlayer(lineups, playerId);
  const confirmed = explicitlyConfirmed || structurallyConfirmed;

  if (!confirmed) {
    return pendingTeamSheet(rawStatus === "predicted"
      ? "Only predicted team news is available. Waiting for the official starting XI."
      : "The feed has not provided a confirmed starting XI yet. This page will keep checking.");
  }
  if (role === "starting") {
    return {
      status: "confirmed_start", type: "confirmed_start", phase: "team_news", tone: "positive",
      label: "YES — HAMZA STARTS", pillLabel: "Starting",
      reason: "Hamza is named in the confirmed starting XI."
    };
  }
  if (role === "substitute") {
    return {
      status: "confirmed_bench", type: "confirmed_bench", phase: "team_news", tone: "warning",
      label: "NO — HAMZA IS ON THE BENCH", pillLabel: "Not starting",
      reason: "Hamza is named among the substitutes, not in the starting XI."
    };
  }
  if (!playerIsListed && structurallyConfirmed) {
    return {
      status: "confirmed_not_in_squad", type: "confirmed_not_in_squad", phase: "team_news", tone: "negative",
      label: "NO — HAMZA IS NOT IN THE SQUAD", pillLabel: "Not starting",
      reason: "He is absent from the confirmed team sheets and substitutes."
    };
  }
  return pendingTeamSheet("The feed reports team news, but the player list is incomplete. Waiting for a verifiable XI.");
}
