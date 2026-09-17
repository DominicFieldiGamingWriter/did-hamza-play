export const dynamic = "force-dynamic";
import { getSupabaseAdmin } from "../lib/supabase";
import { findTeam, getTeamFixtures } from "../lib/api-football";

function dateValue(value: any): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    return (
      value?.kickoff_at ??
      value?.kickoff ??
      value?.event_date ??
      value?.date ??
      value?.start_time ??
      value?.time?.kickoff_at ??
      null
    );
  }

  return null;
}

function rawTeamValue(
  fixture: any,
  side: "home" | "away"
) {
  return (
    fixture?.[side] ??
    fixture?.[`${side}_team`] ??
    fixture?.[`${side}Team`] ??
    fixture?.teams?.[side] ??
    fixture?.participants?.[side] ??
    null
  );
}

function teamName(
  fixture: any,
  side: "home" | "away"
): string {
  const team =
    rawTeamValue(
      fixture,
      side
    );

  const candidates = [
    team?.name,
    team?.team_name,
    team?.team?.name,
    fixture?.[`${side}_team_name`],
    fixture?.[`${side}_name`]
  ];

  for (const value of candidates) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "Unknown";
}

function fixtureName(
  fixture: any
): string {
  return (
    `${teamName(
      fixture,
      "home"
    )} vs ${teamName(
      fixture,
      "away"
    )}`
  );
}

function scoreValue(
  fixture: any,
  side: "home" | "away"
) {
  return (
    fixture?.[`${side}_score`] ??
    fixture?.score?.[side] ??
    fixture?.scores?.[side] ??
    null
  );
}

function formatDate(
  value: any
): string {
  const date =
    dateValue(value);

  if (!date) return "";

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone:
        "Europe/London"
    }
  ).format(parsed);
}

function formatUKTime(
  value: any
): string {
  const date =
    dateValue(value);

  if (!date) return "";

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone:
        "Europe/London"
    }
  ).format(parsed);
}

function formatBangladeshTime(
  value: any
): string {
  const date =
    dateValue(value);

  if (!date) return "";

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone:
        "Asia/Dhaka"
    }
  ).format(parsed);
}

function fixtureTimes(
  fixture: any,
  className = "times"
) {
  const date =
    dateValue(fixture);

  if (!date) return null;

  return (
    <div className={className}>
      <span>
        {formatUKTime(
          fixture
        )}{" "}
        (UK Time)
      </span>

      <span>
        {formatBangladeshTime(
          fixture
        )}{" "}
        (Bangladesh)
      </span>
    </div>
  );
}

function fixtureTimestamp(
  fixture: any
): number {
  const date =
    dateValue(fixture);

  if (!date) return 0;

  const timestamp =
    new Date(date).getTime();

  return Number.isNaN(
    timestamp
  )
    ? 0
    : timestamp;
}

function isFreshLiveFixture(
  fixture: any
): boolean {
  const timestamp =
    fixtureTimestamp(
      fixture
    );

  if (!timestamp) {
    return false;
  }

  const now =
    Date.now();

  const status =
    String(
      fixture?.status ??
        fixture?.time?.status ??
        ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        ""
      );

  const liveStatuses = new Set([
    "live",
    "inprogress",
    "inplay",
    "1sthalf",
    "halftime",
    "2ndhalf",
    "extratime",
    "penaltyshootout",
    "overtime"
  ]);

  if (
    !liveStatuses.has(
      status
    )
  ) {
    return false;
  }

  const maxAgeMs =
    6 * 60 * 60 * 1000;

  const maxFutureMs =
    2 * 60 * 60 * 1000;

  return (
    timestamp >=
      now - maxAgeMs &&
    timestamp <=
      now + maxFutureMs
  );
}

function sortUpcomingFixtures(
  fixtures: any[]
) {
  return [...fixtures]
    .filter(
      (fixture) =>
        fixtureTimestamp(
          fixture
        ) > 0
    )
    .sort(
      (a, b) =>
        fixtureTimestamp(a) -
        fixtureTimestamp(b)
    );
}

function getAppearance(
  fixture: any,
  status: any
) {
  return (
    fixture?.player_status
      ?.appearance ??
    status?.appearance ??
    null
  );
}

function surname(
  name: any
): string {
  if (
    typeof name !== "string" ||
    !name.trim()
  ) {
    return "Unknown";
  }

  const parts =
    name.trim().split(
      /\s+/
    );

  return (
    parts[
      parts.length - 1
    ]
  );
}

function formatMinute(
  minute: any
): string {
  const value =
    Number(minute);

  return Number.isFinite(
    value
  )
    ? `${value}'`
    : "";
}

function getIncidents(
  fixture: any
): any[] {
  return Array.isArray(
    fixture?.incidents
  )
    ? fixture.incidents
    : [];
}

function isOwnGoal(
  goal: any
): boolean {
  if (goal?.is_own_goal === true) {
    return true;
  }

  const values = [
    goal?.goal_type,
    goal?.goalType,
    goal?.goal?.type,
    goal?.goal?.goal_type,
    goal?.subtype,
    goal?.type_name
  ];

  return values.some(
    (value: any) =>
      String(
        value ??
        ""
      )
        .trim()
        .toLowerCase()
        .replace(
          /[-_ ]/g,
          ""
        )
        .includes("owngoal")
  );
}

function cleanScorerName(
  name: any
): string {
  if (
    typeof name !== "string" ||
    !name.trim()
  ) {
    return "Unknown";
  }

  const cleaned =
    name
      .replace(
        /\(\s*og\s*\)/gi,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return surname(
    cleaned
  );
}

function formatGoal(
  goal: any
): string {
  const scorer =
    cleanScorerName(
      goal?.player_name
    );

  const og =
    isOwnGoal(goal)
      ? " (OG)"
      : "";

  return `${scorer}${og} ${formatMinute(
    goal?.minute
  )}`;
}

function getMatchEvents(
  fixture: any
) {
  const incidents =
    getIncidents(
      fixture
    );

  const goals =
    incidents
      .filter(
        (incident) =>
          incident?.type ===
          "goal"
      )
      .sort(
        (a, b) =>
          Number(
            a?.minute ??
            9999
          ) -
          Number(
            b?.minute ??
            9999
          )
      );

  const assists =
    goals.filter(
      (goal) =>
        goal?.assist_name
    );

  const cards =
    incidents.filter(
      (incident) =>
        incident?.type ===
        "card"
    );

  const redCards =
    cards
      .filter(
        (card) => {
          const type =
            String(
              card?.card_type ??
              ""
            ).toLowerCase();

          return (
            type.includes(
              "red"
            ) ||
            type.includes(
              "second"
            )
          );
        }
      )
      .sort(
        (a, b) =>
          Number(
            a?.minute ??
            9999
          ) -
          Number(
            b?.minute ??
            9999
          )
      );

  return {
    goals,
    assists,
    redCards
  };
}

function normaliseToken(value: any): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function numericPrice(value: any): number | null {
  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : null;
}

function formatOddsPrice(value: any): string {
  const price = numericPrice(value);

  return price !== null
    ? price.toFixed(2)
    : "—";
}

function priceFromNode(node: any): number | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  const candidates = [
    node.price,
    node.decimal_odds,
    node.odds,
    node.value,
    node.current_price,
    node.current_odds
  ];

  for (const candidate of candidates) {
    const price = numericPrice(candidate);

    if (price !== null) {
      return price;
    }
  }

  return null;
}

function marketIs1X2(market: any): boolean {
  const values = [
    market?.market,
    market?.market_kind,
    market?.market_family,
    market?.market_name,
    market?.name,
    market?.kind,
    market?.type
  ].map(normaliseToken);

  return values.some(
    (value) =>
      value === "1x2" ||
      value === "winner" ||
      value === "matchwinner"
  );
}

function marketIsFirstGoalScorer(market: any): boolean {
  const values = [
    market?.market,
    market?.market_kind,
    market?.market_family,
    market?.market_name,
    market?.name,
    market?.kind,
    market?.type
  ].map((value) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
  );

  const serialised = JSON.stringify(
    market ?? {}
  ).toLowerCase();

  const hasFirst = (text: string) =>
    text.includes("first");

  const hasScorer = (text: string) =>
    text.includes("scor") ||
    text.includes("goal");

  const hasPlayer = (text: string) =>
    text.includes("player") ||
    text.includes("selection");

  const isFirstGoalMarket = (text: string) =>
    hasFirst(text) &&
    hasScorer(text) &&
    (
      text.includes("goal") ||
      hasPlayer(text)
    );

  return (
    values.some(
      (value) =>
        isFirstGoalMarket(value)
    ) ||
    isFirstGoalMarket(serialised)
  );
}

function nodeContainsPlayer(
  node: any,
  playerId: number,
  playerName: string
): boolean {
  if (node === null || node === undefined) {
    return false;
  }

  if (Array.isArray(node)) {
    return node.some((item) =>
      nodeContainsPlayer(
        item,
        playerId,
        playerName
      )
    );
  }

  if (typeof node !== "object") {
    return false;
  }

  const directIds = [
    node.player_id,
    node.player?.id,
    node.player?.player_id
  ];

  if (directIds.some(
    (value) => Number(value) === playerId
  )) {
    return true;
  }

  const targetName =
    normaliseToken(playerName);

  const targetSurname =
    normaliseToken(
      surname(playerName)
    );

  const names = [
    node.player_name,
    node.player?.name,
    node.player?.full_name,
    node.player?.short_name,
    node.name,
    node.label,
    node.selection_name,
    node.selection,
    node.participant_name,
    node.outcome_name,
    typeof node.outcome === "string"
      ? node.outcome
      : null
  ];

  if (names.some((value) => {
    const token =
      normaliseToken(value);

    return (
      (targetName &&
        token.includes(targetName)) ||
      (targetSurname &&
        token === targetSurname)
    );
  })) {
    return true;
  }

  for (const [key, child] of Object.entries(node)) {
    const keyToken =
      normaliseToken(key);

    if (
      keyToken === String(playerId) ||
      (targetSurname &&
        keyToken === targetSurname) ||
      (targetName &&
        keyToken === targetName)
    ) {
      return true;
    }

    if (child && typeof child === "object" &&
        nodeContainsPlayer(
          child,
          playerId,
          playerName
        )) {
      return true;
    }
  }

  return false;
}

function selectionPriceForPlayer(
  node: any,
  playerId: number,
  playerName: string
): number | null {
  if (node === null || node === undefined) {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const price =
        selectionPriceForPlayer(
          item,
          playerId,
          playerName
        );

      if (price !== null) {
        return price;
      }
    }

    return null;
  }

  if (typeof node !== "object") {
    return null;
  }

  const directIds = [
    node.player_id,
    node.player?.id,
    node.player?.player_id,
    node.selection_id,
    node.id
  ];

  const hasPlayerId = directIds.some(
    (value) => Number(value) === playerId
  );

  const targetName =
    normaliseToken(playerName);

  const targetSurname =
    normaliseToken(
      surname(playerName)
    );

  const names = [
    node.player_name,
    node.player?.name,
    node.player?.full_name,
    node.player?.short_name,
    node.name,
    node.label,
    node.selection_name,
    typeof node.selection === "string"
      ? node.selection
      : null,
    node.participant_name,
    node.outcome_name,
    typeof node.outcome === "string"
      ? node.outcome
      : null
  ];

  const hasPlayerName = names.some(
    (value) => {
      const token =
        normaliseToken(value);

      return (
        (targetName &&
          token.includes(targetName)) ||
        (targetSurname &&
          token === targetSurname)
      );
    }
  );

  const directPrice =
    priceFromNode(node);

  if (
    directPrice !== null &&
    (hasPlayerId || hasPlayerName)
  ) {
    return directPrice;
  }

  // Some BSD odds responses put the player's name/ID in a
  // nested selection object while keeping the price on its
  // parent row. If that happens, use the parent's price.
  if (
    directPrice !== null &&
    nodeContainsPlayer(
      node,
      playerId,
      playerName
    )
  ) {
    return directPrice;
  }

  for (const [key, child] of Object.entries(node)) {
    const keyToken =
      normaliseToken(key);

    if (
      keyToken === String(playerId) ||
      (targetSurname &&
        keyToken === targetSurname) ||
      (targetName &&
        keyToken === targetName)
    ) {
      const price =
        priceFromNode(child);

      if (price !== null) {
        return price;
      }
    }

    if (
      child &&
      typeof child === "object"
    ) {
      const price =
        selectionPriceForPlayer(
          child,
          playerId,
          playerName
        );

      if (price !== null) {
        return price;
      }
    }
  }

  return null;
}

function consensusBookmaker(
  payload: any,
  nestedBookmakers?: any[]
) {
  const books = Array.isArray(
    nestedBookmakers
  )
    ? nestedBookmakers
    : Array.isArray(payload?.bookmakers)
      ? payload.bookmakers
      : [];

  return (
    books.find(
      (bookmaker: any) =>
        normaliseToken(
          bookmaker?.bookmaker_slug ??
          bookmaker?.slug ??
          bookmaker?.bookmaker ??
          bookmaker?.name
        ) === "consensus"
    ) ?? null
  );
}

function oddsFromSelectionRows(
  rows: any[]
) {
  const result = {
    home: null as number | null,
    draw: null as number | null,
    away: null as number | null
  };

  for (const row of rows) {
    const outcome =
      normaliseToken(
        row?.outcome ??
        row?.selection ??
        row?.label ??
        row?.name
      );

    const price =
      priceFromNode(row) ??
      numericPrice(row?.decimal_odds);

    if (outcome === "home" || outcome === "1") {
      result.home ??= price;
    }

    if (outcome === "draw" || outcome === "x") {
      result.draw ??= price;
    }

    if (outcome === "away" || outcome === "2") {
      result.away ??= price;
    }
  }

  return result;
}

function getConsensus1X2(
  payload: any
) {
  const summary = payload?.odds;

  const summaryResult = {
    home: numericPrice(
      summary?.home_win ??
      summary?.match_winner?.home
    ),
    draw: numericPrice(
      summary?.draw ??
      summary?.match_winner?.draw
    ),
    away: numericPrice(
      summary?.away_win ??
      summary?.match_winner?.away
    )
  };

  if (
    summaryResult.home !== null ||
    summaryResult.draw !== null ||
    summaryResult.away !== null
  ) {
    return summaryResult;
  }

  const rootBookmaker =
    consensusBookmaker(payload);

  if (rootBookmaker) {
    const rootResult = {
      home:
        numericPrice(
          rootBookmaker?.odds_home ??
          rootBookmaker?.home ??
          rootBookmaker?.odds_1
        ),
      draw:
        numericPrice(
          rootBookmaker?.odds_draw ??
          rootBookmaker?.draw ??
          rootBookmaker?.odds_x
        ),
      away:
        numericPrice(
          rootBookmaker?.odds_away ??
          rootBookmaker?.away ??
          rootBookmaker?.odds_2
        )
    };

    if (
      rootResult.home !== null ||
      rootResult.draw !== null ||
      rootResult.away !== null
    ) {
      return rootResult;
    }
  }

  const directRows = Array.isArray(
    payload?.results
  )
    ? payload.results.filter(
        (row: any) =>
          normaliseToken(
            row?.bookmaker_slug ??
            row?.bookmaker
          ) === "consensus" &&
          normaliseToken(
            row?.market
          ) === "1x2"
      )
    : [];

  const fromRows =
    oddsFromSelectionRows(
      directRows
    );

  if (
    fromRows.home !== null ||
    fromRows.draw !== null ||
    fromRows.away !== null
  ) {
    return fromRows;
  }

  const markets =
    Array.isArray(payload?.markets)
      ? payload.markets
      : [];

  for (const market of markets) {
    if (
      !marketIs1X2(market)
    ) {
      continue;
    }

    const book =
      consensusBookmaker(
        payload,
        market?.bookmakers
      );

    if (!book) {
      continue;
    }

    const direct = {
      home:
        numericPrice(
          book?.odds_home ??
          book?.home ??
          book?.odds_1
        ),
      draw:
        numericPrice(
          book?.odds_draw ??
          book?.draw ??
          book?.odds_x
        ),
      away:
        numericPrice(
          book?.odds_away ??
          book?.away ??
          book?.odds_2
        )
    };

    const prices =
      book?.prices;

    if (
      prices &&
      typeof prices === "object"
    ) {
      direct.home ??=
        priceFromNode(
          prices.HOME ??
          prices.home ??
          prices["1"]
        );

      direct.draw ??=
        priceFromNode(
          prices.DRAW ??
          prices.draw ??
          prices["X"] ??
          prices["x"]
        );

      direct.away ??=
        priceFromNode(
          prices.AWAY ??
          prices.away ??
          prices["2"]
        );
    }

    if (
      direct.home !== null ||
      direct.draw !== null ||
      direct.away !== null
    ) {
      return direct;
    }

    const fromSelections =
      oddsFromSelectionRows(
        Array.isArray(
          book?.selections
        )
          ? book.selections
          : []
      );

    if (
      fromSelections.home !== null ||
      fromSelections.draw !== null ||
      fromSelections.away !== null
    ) {
      return fromSelections;
    }
  }

  return {
    home: null,
    draw: null,
    away: null
  };
}

function isFirstGoalScorerMarketText(value: any): boolean {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (!text) {
    return false;
  }

  if (text.includes("anytime")) {
    return false;
  }

  const hasFirst =
    text.includes("first goal") ||
    text.includes("first scorer") ||
    text.includes("firstgoalscorer") ||
    text.includes("firstscorer") ||
    text === "fgs" ||
    text.includes(" fgs ");

  const hasGoalOrScorer =
    text.includes("goal") ||
    text.includes("scor");

  return (
    hasFirst &&
    hasGoalOrScorer
  );
}

function isConsensusBookmakerValue(value: any): boolean {
  const token = normaliseToken(value);

  return (
    token === "consensus" ||
    token === "consensusavg" ||
    token === "consensusprice" ||
    token === "consensusodds"
  );
}

function marketTextFromNode(node: any): string {
  if (!node || typeof node !== "object") {
    return "";
  }

  const fields = [
    node.market,
    node.market_kind,
    node.market_family,
    node.market_name,
    node.market_title,
    node.name,
    node.label,
    node.kind,
    node.type,
    node.code,
    node.market_code,
    node.market_type,
    node.selection_type
  ];

  return fields
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value))
    .join(" ");
}

function getConsensusFirstGoalScorer(
  payload: any,
  playerId: number,
  playerName: string
): number | null {
  if (!payload) {
    return null;
  }

  /*
   * The Odds API attached to BSD is the authoritative source here.
   * Its event endpoint can return the bookmaker/market hierarchy rather
   * than the flat v2 `results` shape. Walk that hierarchy and only read
   * a player's price from an object explicitly identified as consensus.
   * Never choose a bookmaker price merely because it happens to be first.
   */
  const visited = new WeakSet<object>();

  function walk(
    node: any,
    consensusContext: boolean,
    firstGoalContext: boolean
  ): number | null {
    if (node === null || node === undefined) {
      return null;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const price = walk(
          item,
          consensusContext,
          firstGoalContext
        );

        if (price !== null) {
          return price;
        }
      }

      return null;
    }

    if (typeof node !== "object") {
      return null;
    }

    if (visited.has(node)) {
      return null;
    }

    visited.add(node);

    const bookmakerValue =
      node.bookmaker_slug ??
      node.bookmaker ??
      node.bookmaker_name ??
      node.source ??
      null;

    const nextConsensusContext =
      consensusContext ||
      isConsensusBookmakerValue(bookmakerValue);

    const nextFirstGoalContext =
      firstGoalContext ||
      isFirstGoalScorerMarketText(
        marketTextFromNode(node)
      );

    if (
      nextConsensusContext &&
      nextFirstGoalContext
    ) {
      const price =
        selectionPriceForPlayer(
          node,
          playerId,
          playerName
        );

      if (price !== null) {
        return price;
      }
    }

    /*
     * Some BSD responses put the consensus value in a dedicated object
     * rather than naming the bookmaker `consensus`. If the current node
     * itself contains explicit consensus wording and is a first-goal
     * market, inspect it too.
     */
    const nodeText = JSON.stringify(node).toLowerCase();
    const explicitConsensus =
      nodeText.includes("consensus") ||
      nodeText.includes("consensus avg") ||
      nodeText.includes("consensus price");

    if (
      explicitConsensus &&
      nextFirstGoalContext
    ) {
      const price =
        selectionPriceForPlayer(
          node,
          playerId,
          playerName
        );

      if (price !== null) {
        return price;
      }
    }

    for (const [key, child] of Object.entries(node)) {
      const price = walk(
        child,
        nextConsensusContext,
        nextFirstGoalContext
      );

      if (price !== null) {
        return price;
      }
    }

    return null;
  }

  return walk(
    payload,
    false,
    false
  );
}

function hasComplete1X2(
  odds: any
): boolean {
  return (
    numericPrice(odds?.home) !== null &&
    numericPrice(odds?.draw) !== null &&
    numericPrice(odds?.away) !== null
  );
}

async function getNextBangladeshFixture() {
  try {
    const teams = await findTeam("Bangladesh");

    const team =
      teams.find(
        (candidate: any) =>
          String(candidate?.name ?? "")
            .trim()
            .toLowerCase() === "bangladesh"
      ) ?? teams[0] ?? null;

    if (!team?.id) {
      return null;
    }

    const fixtures = await getTeamFixtures(
      Number(team.id)
    );

    return Array.isArray(fixtures?.next)
      ? fixtures.next[0] ?? null
      : null;
  } catch (error) {
    console.error(
      "Bangladesh fixture lookup failed:",
      error
    );
    return null;
  }
}

function betwayCandidateEventIds(fixture: any): number[] {
  const candidates = [
    fixture?.betway_event_id,
    fixture?.betwayEventId,
    fixture?.external_betway_event_id,
    fixture?.externalBetwayEventId,
    fixture?.betway?.event_id,
    fixture?.betway?.eventId,
    fixture?.external?.betway?.event_id,
    fixture?.external?.betway?.eventId,
    fixture?.id
  ];

  return Array.from(
    new Set(
      candidates
        .map((value) => Number(value))
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value > 0
        )
    )
  );
}

function looksLikeFirstGoalScorerText(value: any): boolean {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (!text) {
    return false;
  }

  if (text.includes("anytime")) {
    return false;
  }

  const first =
    text.includes("first goalscorer") ||
    text.includes("first goal scorer") ||
    text.includes("first scorer") ||
    text.includes("first to score") ||
    text.includes("first player to score") ||
    text.includes("first goal");

  return (
    first &&
    (
      text.includes("scor") ||
      text.includes("player") ||
      text.includes("goal")
    )
  );
}

function genericPlayerNameMatch(
  node: any,
  playerName: string
): boolean {
  const wanted = normaliseToken(playerName);
  const wantedSurname = normaliseToken(
    surname(playerName)
  );

  const names = [
    node?.player_name,
    node?.playerName,
    node?.player?.name,
    node?.player?.full_name,
    node?.player?.fullName,
    node?.name,
    node?.label,
    node?.selection_name,
    node?.selectionName,
    node?.selection,
    node?.outcome_name,
    node?.outcomeName,
    typeof node?.outcome === "string"
      ? node.outcome
      : null
  ];

  return names.some((value) => {
    const token = normaliseToken(value);

    if (!token) {
      return false;
    }

    if (wanted && token === wanted) {
      return true;
    }

    if (
      wantedSurname &&
      token === wantedSurname
    ) {
      return true;
    }

    return (
      wantedSurname.length >= 5 &&
      token.includes(wantedSurname)
    );
  });
}

function extractFirstGoalScorerPriceFromBetway(
  payload: any,
  playerId: number,
  playerName: string
): number | null {
  if (!payload) {
    return null;
  }

  const visited = new WeakSet<object>();

  function walk(
    node: any,
    firstGoalContext: boolean
  ): number | null {
    if (
      node === null ||
      node === undefined
    ) {
      return null;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const price = walk(
          item,
          firstGoalContext
        );

        if (price !== null) {
          return price;
        }
      }

      return null;
    }

    if (typeof node !== "object") {
      return null;
    }

    if (visited.has(node)) {
      return null;
    }

    visited.add(node);

    const nodeText = [
      node.market,
      node.marketName,
      node.market_name,
      node.marketTitle,
      node.market_title,
      node.name,
      node.label,
      node.cname,
      node.cName,
      node.type,
      node.code
    ]
      .filter((value) =>
        value !== null &&
        value !== undefined
      )
      .map((value) => String(value))
      .join(" ");

    const nextFirstGoalContext =
      firstGoalContext ||
      looksLikeFirstGoalScorerText(
        nodeText
      );

    const directPlayerId = [
      node.player_id,
      node.playerId,
      node.player?.id,
      node.player?.player_id,
      node.player?.playerId,
      node.selection?.player_id,
      node.selection?.playerId,
      node.selection?.player?.id
    ].some(
      (value) =>
        Number(value) === playerId
    );

    const playerMatch =
      directPlayerId ||
      genericPlayerNameMatch(
        node,
        playerName
      );

    if (
      nextFirstGoalContext &&
      playerMatch
    ) {
      const directPrice = priceFromNode(node);

      if (directPrice !== null) {
        return directPrice;
      }

      const nestedPriceKeys = [
        "price",
        "odds",
        "decimal_odds",
        "decimalOdds",
        "current_price",
        "currentPrice",
        "current_odds",
        "currentOdds"
      ];

      for (const key of nestedPriceKeys) {
        const value = node[key];

        if (
          value !== null &&
          value !== undefined
        ) {
          const price = numericPrice(value);

          if (price !== null) {
            return price;
          }
        }
      }
    }

    for (const child of Object.values(node)) {
      const price = walk(
        child,
        nextFirstGoalContext
      );

      if (price !== null) {
        return price;
      }
    }

    return null;
  }

  return walk(
    payload,
    false
  );
}

function betwayRequestPayload(
  fixtureId: number,
  marketCName: string,
  useExternalIds = false,
  jurisdictionId = 1
) {
  return {
    ...(useExternalIds
      ? {
          ExternalIds: [fixtureId]
        }
      : {
          EventId: fixtureId
        }),
    LanguageId: 1,
    ClientTypeId: 2,
    BrandId: 3,
    JurisdictionId: jurisdictionId,
    ClientIntegratorId: 1,
    MarketCName: marketCName,
    ScoreboardRequest: {
      ScoreboardType: 0,
      IncidentRequest: {}
    },
    BrowserId: 5,
    OsId: 3,
    ApplicationVersion: "",
    BrowserVersion: "131.0.0.0",
    OsVersion: "NT 10.0",
    SessionId: null,
    TerritoryId: 165,
    CorrelationId: crypto.randomUUID(),
    VisitId: crypto.randomUUID(),
    ViewName: "sports",
    JourneyId: crypto.randomUUID()
  };
}

async function fetchBetwayFirstGoalScorer(
  fixture: any,
  playerId: number,
  playerName: string
): Promise<number | null> {
  const candidateIds =
    betwayCandidateEventIds(
      fixture
    );

  if (!candidateIds.length) {
    return null;
  }

  /*
   * Betway's sportsbook is backed by a JSON endpoint used by its own
   * football pages. Public examples show the V2 GetEvents endpoint and
   * the EventId/MarketCName request shape. We try the same-origin and
   * sports-api hosts because Betway has used both forms, and we try the
   * common first-goalscorer market names used by the frontend.
   */
  const hosts = [
    "https://betway.com",
    "https://sportsapi.betway.com"
  ];

  const marketNames = [
    "first-goalscorer",
    "first-goal-scorer",
    "firstscorer",
    "first-scorer"
  ];

  const headers = {
    "Accept":
      "application/json, text/plain, */*",
    "Content-Type":
      "application/json; charset=UTF-8",
    "Accept-Language":
      "en-GB,en;q=0.9",
    "Origin":
      "https://betway.com",
    "Referer":
      "https://betway.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"
  };

  for (const host of hosts) {
    for (const fixtureId of candidateIds) {
      for (const marketCName of marketNames) {
        for (const useExternalIds of [
          false,
          true
        ]) {
          for (const jurisdictionId of [
            1,
            2
          ]) {
            try {
              const response =
                await fetch(
                  `${host}/api/Events/V2/GetEvents`,
                  {
                    method: "POST",
                    headers,
                    body: JSON.stringify(
                      betwayRequestPayload(
                        fixtureId,
                        marketCName,
                        useExternalIds,
                        jurisdictionId
                      )
                    ),
                    cache: "no-store"
                  }
                );

              if (!response.ok) {
                console.warn(
                  `Betway first-scorer request failed (${response.status}) host=${host} fixture=${fixtureId} market=${marketCName} external=${useExternalIds} jurisdiction=${jurisdictionId}`
                );
                continue;
              }

              const payload =
                await response.json();

              const price =
                extractFirstGoalScorerPriceFromBetway(
                  payload,
                  playerId,
                  playerName
                );

              if (price !== null) {
                console.info(
                  `Betway first-scorer price found: ${price} fixture=${fixtureId} market=${marketCName} external=${useExternalIds} jurisdiction=${jurisdictionId}`
                );
                return price;
              }
            } catch (error) {
              console.warn(
                "Betway first-scorer request error:",
                error
              );
            }
          }
        }
      }
    }
  }

  return null;
}

async function getNextBangladeshFixture() {
  try {
    const teams = await findTeam("Bangladesh");

    const team =
      teams.find(
        (candidate: any) =>
          String(candidate?.name ?? "")
            .trim()
            .toLowerCase() === "bangladesh"
      ) ?? teams[0] ?? null;

    if (!team?.id) {
      return null;
    }

    const fixtures = await getTeamFixtures(
      Number(team.id)
    );

    return Array.isArray(fixtures?.next)
      ? fixtures.next[0] ?? null
      : null;
  } catch (error) {
    console.error(
      "Bangladesh fixture lookup failed:",
      error
    );
    return null;
  }
}

async function getConsensusMatchOdds(
  fixture: any,
  playerId: number,
  playerName: string
) {
  const fixtureId =
    Number(fixture?.id);

  const apiKey =
    process.env.BSD_API_KEY;

  if (
    !Number.isFinite(fixtureId) ||
    fixtureId <= 0 ||
    !apiKey
  ) {
    return null;
  }

  try {
    const headers = {
      Authorization: `Token ${apiKey}`
    };

    const summaryResponse =
      await fetch(
        `https://sports.bzzoiro.com/api/v2/events/${fixtureId}/odds/`,
        {
          headers,
          next: {
            revalidate: 60
          }
        }
      );

    const summaryPayload =
      summaryResponse.ok
        ? await summaryResponse.json()
        : null;

    if (!summaryResponse.ok) {
      console.error(
        "Consensus odds summary request failed:",
        summaryResponse.status
      );
    }

    const betwayFirstGoalScorer =
      await fetchBetwayFirstGoalScorer(
        fixture,
        playerId,
        playerName
      );

    return {
      fixtureId,
      oneXTwo:
        getConsensus1X2(
          summaryPayload
        ),
      hamzaFirstGoalScorer:
        betwayFirstGoalScorer,
      updatedAt:
        summaryPayload?.last_update_at ??
        summaryPayload?.updated_at ??
        null
    };
  } catch (error) {
    console.error(
      "Consensus odds request failed:",
      error
    );

    return null;
  }
}

function appearanceSummary(
  appearance: any,
  latestStatus: any
): string {
  if (
    !latestStatus?.played
  ) {
    if (
      appearance?.summary ===
      "Not in the squad."
    ) {
      return "Not in the squad.";
    }

    if (
      appearance?.subbed_on_minute !==
        null &&
      appearance?.subbed_on_minute !==
        undefined
    ) {
      return "Didn't start. Sub in.";
    }

    return "Didn't start. Didn't come on.";
  }

  const started =
    appearance?.started ===
    true;

  const subbedOn =
    appearance
      ?.subbed_on_minute ??
    null;

  const subbedOff =
    appearance
      ?.subbed_off_minute ??
    null;

  const minutes =
    appearance?.minutes ??
    null;

  if (
    started &&
    subbedOff !== null
  ) {
    return (
      `Started. Sub out. Played ${
        minutes ??
        subbedOff
      } mins.`
    );
  }

  if (started) {
    return (
      minutes !== null
        ? `Started. Played ${minutes} mins.`
        : "Started. Played."
    );
  }

  if (
    subbedOn !== null
  ) {
    return (
      minutes !== null
        ? `Didn't start. Subbed on. Played ${minutes} mins.`
        : "Didn't start. Subbed on."
    );
  }

  return "Played.";
}

export default async function Home() {
  const supabase =
    getSupabaseAdmin();

  const {
    data,
    error
  } =
    await supabase
      .from("player_page")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

  if (
    error ||
    !data
  ) {
    return (
      <main className="page">
        <h1 className="main-heading">
          DID{" "}
          <span className="hamza-name">
            HAMZA
          </span>{" "}
          PLAY?
        </h1>

        <div className="error-card">
          Data unavailable.
        </div>
      </main>
    );
  }

  const storedLiveFixture =
    data.live_fixture ??
    null;

  const liveFixture =
    isFreshLiveFixture(
      storedLiveFixture
    )
      ? storedLiveFixture
      : null;

  const lastFixture =
    data.last_fixture ??
    null;

  const storedFixtures =
    Array.isArray(
      data.next_fixtures
    )
      ? data.next_fixtures
      : [];

  const nextFixtures =
    sortUpcomingFixtures(
      storedFixtures
    );

  const next =
    nextFixtures[0] ??
    null;

  const upcomingFixtures =
    next
      ? nextFixtures.slice(
          1,
          4
        )
      : nextFixtures.slice(
          0,
          3
        );

  const latestStatus =
    lastFixture?.player_status ??
    data.player_status
      ?.latest_match ??
    null;

  const nextStatus =
    data.player_status
      ?.next_match ??
    null;

  const latestPlayed =
    latestStatus?.played ===
    true;

  const appearance =
    getAppearance(
      lastFixture,
      latestStatus
    );

  const events =
    getMatchEvents(
      lastFixture
    );

  const hamzaPlayerId =
    Number(
      data.player_id
    );

  const hamzaScored =
    events.goals.some(
      (goal: any) =>
        Number(
          goal?.player_id
        ) === hamzaPlayerId &&
        !isOwnGoal(goal)
    );

  const hamzaAssisted =
    events.assists.some(
      (goal: any) =>
        Number(
          goal?.assist_id
        ) === hamzaPlayerId
    );

  const latestDate =
    dateValue(
      lastFixture
    );

  const latestHomeScore =
    scoreValue(
      lastFixture,
      "home"
    );

  const latestAwayScore =
    scoreValue(
      lastFixture,
      "away"
    );

  const nextDate =
    dateValue(next);

  const nextBangladeshFixture =
    await getNextBangladeshFixture();

  const nextOdds = next
    ? await getConsensusMatchOdds(
        next,
        hamzaPlayerId,
        data.player_name ??
          "Hamza Choudhury"
      )
    : null;

  const firstUpcomingFixture =
    upcomingFixtures[0] ??
    null;

  const firstUpcomingOdds =
    firstUpcomingFixture
      ? await getConsensusMatchOdds(
          firstUpcomingFixture,
          hamzaPlayerId,
          data.player_name ??
            "Hamza Choudhury"
        )
      : null;

  const bangladeshOdds =
    nextBangladeshFixture
      ? await getConsensusMatchOdds(
          nextBangladeshFixture,
          hamzaPlayerId,
          data.player_name ??
            "Hamza Choudhury"
        )
      : null;

  const appearanceSummaryText =
    appearanceSummary(
      appearance,
      latestStatus
    );

  const liveStatus =
    liveFixture
      ?.player_status
      ?.status ??
    null;

  const liveAnswer =
    liveStatus ===
    "playing"
      ? "YES"
      : liveStatus ===
        "substitute"
      ? "SUB"
      : liveStatus ===
        "not_playing"
      ? "NO"
      : null;

  const liveAnswerClass =
    liveStatus ===
    "playing"
      ? "answer yes live-answer"
      : liveStatus ===
        "substitute"
      ? "answer sub live-answer"
      : "answer no live-answer";

  const liveDate =
    dateValue(
      liveFixture
    );

  const liveHomeScore =
    scoreValue(
      liveFixture,
      "home"
    );

  const liveAwayScore =
    scoreValue(
      liveFixture,
      "away"
    );

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #006a4e;
          color: #ffffff;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        body {
          min-height: 100vh;
        }

        .page {
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
          padding: 48px 32px 72px;
        }

        .main-heading {
          margin: 0;
          font-size: clamp(
            42px,
            5.3vw,
            64px
          );
          line-height: 0.94;
          font-weight: 900;
          letter-spacing: -3px;
          white-space: nowrap;
        }

        .hamza-name {
          color: #f42a41;
        }

        .top-row {
          display: flex;
          align-items: center;
          gap: 28px;
        }

        .top-image-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
        }

        .top-image {
          width: 92px;
          height: 92px;
          display: block;
          object-fit: contain;
          object-position: center;
          border: 0;
          border-radius: 0;
          background: transparent;
          filter: drop-shadow(0 8px 14px rgba(0, 0, 0, .15));
        }

        .answer {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 225px;
          height: 108px;
          padding: 0 42px;
          border-radius: 999px;
          background: #ffffff;
          font-size: 65px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -3px;
        }

        .answer.yes {
          color: #00824f;
        }

        .answer.no {
          color: #d9303f;
        }

        .answer.sub {
          color: #52647d;
        }

        .live-section {
          margin-top: 30px;
        }

        .live-heading-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
          margin-bottom: 16px;
        }

        .live-heading {
          margin: 0;
          color: #ffffff;
          font-size: clamp(
            29px,
            4vw,
            43px
          );
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1.4px;
        }

        .live-answer {
          min-width: 148px;
          height: 70px;
          padding: 0 30px;
          font-size: 42px;
          letter-spacing: -2px;
        }

        .live-card {
          background: #111a29;
          border-radius: 30px;
          padding: 34px;
        }

        .live-card-inner {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(220px, 300px);
          gap: 30px;
          align-items: center;
        }

        .live-title {
          margin: 10px 0 0;
          color: #ffffff;
          font-size: clamp(
            30px,
            4.4vw,
            45px
          );
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1.5px;
        }

        .live-date {
          margin-top: 13px;
          color: #aab8cb;
          font-size: 15px;
        }

        .live-times {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 6px;
          color: #aab8cb;
          font-size: 15px;
          font-weight: 800;
        }

        .live-score {
          text-align: right;
          color: #ffffff;
          font-size: 58px;
          line-height: 0.9;
          font-weight: 900;
          letter-spacing: -2px;
        }

        .live-status {
          margin-top: 16px;
          display: inline-block;
          padding: 10px 15px;
          border-radius: 999px;
          background: #ffffff;
          color: #00824f;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .section-card {
          margin-top: 30px;
          background: #ffffff;
          color: #090d13;
          border-radius: 30px;
          padding: 34px;
        }

        .section-label {
          color: #7084a1;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 2.2px;
          text-transform: uppercase;
        }

        .recent-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1.3fr)
            minmax(400px, 1fr);
          gap: 34px;
          align-items: start;
        }

        .match-title {
          margin: 10px 0 0;
          font-size: clamp(
            28px,
            4vw,
            43px
          );
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1.7px;
        }

        .match-date {
          margin-top: 13px;
          color: #7084a1;
          font-size: 15px;
        }

        .times {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 6px;
          color: #7084a1;
          font-size: 15px;
          font-weight: 800;
        }

        .result-panel {
          margin-top: 25px;
          padding-top: 24px;
          border-top:
            1px solid
            #dfe4ea;
        }

        .score {
          font-size: 54px;
          line-height: 0.9;
          font-weight: 900;
          letter-spacing: -2px;
        }

        .event-list {
          margin-top: 20px;
        }

        .event-line {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 18px;
          padding: 11px 0;
          border-bottom:
            1px solid
            #edf0f3;
        }

        .event-line:last-child {
          border-bottom: 0;
        }

        .event-label {
          color: #7084a1;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
          flex: 0 0 auto;
        }

        .event-value {
          text-align: right;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.4;
        }

        .details-panel {
          padding-left: 28px;
          border-left:
            1px solid
            #dfe4ea;
          min-width: 0;
        }

        .details-main {
          margin-top: 10px;
          font-size: 24px;
          line-height: 1.16;
          font-weight: 900;
          letter-spacing: -0.7px;
          max-width: 100%;
        }

        .details-supporting {
          margin-top: 12px;
          color: #52647d;
          font-size: 15px;
          line-height: 1.5;
          max-width: 430px;
        }

        .detail-stats {
          display: grid;
          grid-template-columns:
            repeat(
              5,
              minmax(0, 1fr)
            );
          gap: 8px;
          margin-top: 20px;
        }

        .detail-stat {
          min-width: 0;
          min-height: 110px;
          background: #f3f6f8;
          border-radius: 16px;
          padding: 14px 11px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }

        .detail-stat-label {
          color: #7084a1;
          font-size: 8px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .65px;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: clip;
        }

        .detail-stat-value {
          margin-top: 8px;
          font-size: 19px;
          line-height: 1.05;
          font-weight: 900;
        }

        .detail-stat-value.yes {
          color: #006a4e;
        }

        .detail-stat-value.no {
          color: #f42a41;
        }

        .hamza-outcomes {
          margin-top: 14px;
          border-top:
            1px solid
            #dfe4ea;
        }

        .hamza-outcome {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 18px;
          padding: 11px 0;
          border-bottom:
            1px solid
            #edf0f3;
          font-size: 14px;
          font-weight: 800;
        }

        .hamza-outcome:last-child {
          border-bottom: 0;
        }

        .hamza-outcome-label {
          color: #7084a1;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .hamza-outcome-value {
          font-weight: 900;
        }

        .next-heading {
          margin: 42px 0 16px;
          color: #ffffff;
          font-size: clamp(
            29px,
            4vw,
            43px
          );
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1.4px;
        }

        .next-card {
          background: #111a29;
          border-radius: 30px;
          padding: 34px;
        }

        .next-title {
          margin: 0;
          font-size: clamp(
            30px,
            4.4vw,
            45px
          );
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1.5px;
        }

        .availability {
          margin-top: 26px;
          background: #ffffff;
          color: #090d13;
          border-radius: 23px;
          padding: 25px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .availability-status {
          margin-top: 8px;
          font-size: 29px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1px;
        }

        .availability-reason {
          margin-top: 10px;
          color: #52647d;
          font-size: 15px;
          line-height: 1.45;
        }

        .status-pill {
          flex: 0 0 auto;
          padding: 11px 16px;
          border-radius: 999px;
          background: #dff7e9;
          color: #00824f;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .8px;
          text-transform: uppercase;
        }

        .fixtures-card {
          margin-top: 24px;
          background: #ffffff;
          color: #090d13;
          border-radius: 30px;
          padding: 34px;
        }

        .fixture-row {
          display: grid;
          grid-template-columns:
            minmax(0, 1.5fr)
            180px
            135px
            180px;
          align-items: center;
          gap: 22px;
          padding: 22px 0;
          border-top:
            1px solid
            #dfe4ea;
        }

        .fixture-row:first-of-type {
          margin-top: 11px;
        }

        .fixture-title {
          font-size: 21px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -.4px;
        }

        .fixture-date {
          color: #7084a1;
          font-size: 14px;
          font-weight: 700;
        }

        .fixture-time {
          color: #52647d;
          font-size: 14px;
          font-weight: 800;
        }

        .fixture-odds {
          margin-top: 8px;
          color: #111a29;
          font-size: 14px;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: .2px;
        }

        .bio-card {
          margin-top: 24px;
          background: #ffffff;
          color: #090d13;
          border-radius: 30px;
          padding: 34px;
        }

        .bio-heading {
          margin: 0 0 22px;
          font-size: 30px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1px;
        }

        .bio-content {
          color: #263241;
          font-size: 16px;
          line-height: 1.65;
        }

        .bio-photo {
          float: right;
          width: 170px;
          height: 170px;
          object-fit: cover;
          object-position: center top;
          margin: 0 0 18px 28px;
          border-radius: 18px;
        }

        .bio-content p {
          margin: 0 0 16px;
        }

        .bio-content p:last-child {
          margin-bottom: 0;
        }

        .bio-caption {
          clear: both;
          margin-top: 8px;
          color: #7084a1;
          font-size: 12px;
          line-height: 1.4;
        }

        .odds-card {
          margin-top: 24px;
          background: #111a29;
          color: #ffffff;
          border-radius: 30px;
          padding: 34px;
        }

        .odds-heading {
          color: #aab8cb;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 2.2px;
          text-transform: uppercase;
        }

        .odds-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .odds-mini-card {
          background: #ffffff;
          color: #090d13;
          border-radius: 20px;
          padding: 22px;
          min-width: 0;
        }

        .odds-mini-title {
          margin: 0;
          font-size: 19px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -.5px;
        }

        .odds-mini-subtitle {
          margin-top: 7px;
          color: #7084a1;
          font-size: 13px;
          line-height: 1.4;
          font-weight: 700;
        }

        .odds-mini-match {
          margin-top: 15px;
          color: #52647d;
          font-size: 13px;
          line-height: 1.4;
          font-weight: 800;
        }

        .odds-mini-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-top: 1px solid #dfe4ea;
        }

        .odds-mini-row:first-of-type {
          margin-top: 14px;
          border-top: 0;
        }

        .odds-book {
          display: flex;
          align-items: center;
          min-width: 108px;
          flex: 0 0 108px;
        }

        .odds-brand {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 92px;
          height: 34px;
          padding: 0 10px;
          border: 1px solid #dfe4ea;
          border-radius: 8px;
          background: #ffffff;
          font-size: 16px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.8px;
          white-space: nowrap;
        }

        .odds-brand-1xbet {
          color: #1675d1;
          font-style: italic;
        }

        .odds-brand-betway {
          color: #111111;
          font-size: 17px;
          letter-spacing: -0.6px;
        }

        .odds-brand-consensus {
          color: #111111;
          font-size: 14px;
          letter-spacing: -0.3px;
        }

        .odds-prices {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
          font-size: 13px;
          font-weight: 900;
        }

        .odds-prices span {
          white-space: nowrap;
        }

        .odds-unavailable {
          margin-top: 16px;
          color: #52647d;
          font-size: 14px;
          line-height: 1.5;
        }

        .odds-note {
          margin-top: 16px;
          color: #aab8cb;
          font-size: 12px;
          line-height: 1.45;
        }

        .updated {
          margin-top: 23px;
          text-align: center;
          color:
            rgba(
              255,
              255,
              255,
              .76
            );
          font-size: 12px;
        }

        .error-card {
          margin-top: 28px;
          background: #ffffff;
          color: #090d13;
          border-radius: 24px;
          padding: 25px;
        }

        @media (max-width: 820px) {
          .page {
            padding: 30px 18px 55px;
          }

          .top-row {
            display: grid;
            grid-template-columns: 76px minmax(0, 1fr);
            column-gap: 10px;
            row-gap: 8px;
          }

          .top-row .main-heading {
            grid-column: 1 / -1;
          }

          .top-row .top-image-wrap {
            grid-column: 1;
            grid-row: 2;
            align-self: center;
          }

          .top-row > .answer {
            grid-column: 2;
            grid-row: 2;
            align-self: center;
          }

          .main-heading {
            font-size: 42px;
            letter-spacing: -2.3px;
          }

          .top-image-wrap {
            justify-content: flex-start;
            margin-left: 0;
          }

          .top-image {
            width: 76px;
            height: 76px;
          }

          .answer {
            margin-top: 0;
            min-width: 0;
            width: 100%;
            height: 88px;
            padding: 0 20px;
            font-size: 52px;
          }

          .live-heading-row {
            align-items: flex-start;
          }

          .live-heading {
            font-size: 31px;
          }

          .live-answer {
            margin-top: 0;
            min-width: 120px;
            height: 66px;
            padding: 0 22px;
            font-size: 34px;
          }

          .live-card,
          .section-card,
          .next-card,
          .fixtures-card,
          .odds-card {
            padding: 27px 22px;
            border-radius: 25px;
          }

          .bio-card {
            padding: 27px 22px;
            border-radius: 25px;
          }

          .bio-photo {
            width: 145px;
            height: 145px;
            margin-left: 22px;
          }

          .live-card-inner {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .live-score {
            text-align: left;
          }

          .recent-grid {
            grid-template-columns: 1fr;
            gap: 29px;
          }

          .details-panel {
            padding-left: 0;
            padding-top: 27px;
            border-left: 0;
            border-top:
              1px solid
              #dfe4ea;
          }

          .details-main {
            font-size: 28px;
          }

          .availability {
            display: block;
          }

          .status-pill {
            display: inline-block;
            margin-top: 16px;
          }

          .fixture-row {
            display: block;
          }

          .fixture-date {
            margin-top: 8px;
          }

          .fixture-time {
            margin-top: 5px;
          }
        }

        @media (max-width: 500px) {
          .main-heading {
            font-size: 38px;
            letter-spacing: -2px;
          }

          .top-image {
            width: 86px;
            height: 86px;
          }

          .answer {
            min-width: 0;
            width: 100%;
            height: 82px;
            font-size: 48px;
          }

          .live-heading-row {
            align-items: center;
            gap: 14px;
          }

          .live-heading {
            font-size: 29px;
          }

          .live-answer {
            min-width: 102px;
            height: 58px;
            padding: 0 18px;
            font-size: 30px;
          }

          .detail-stats {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }

          .event-line {
            display: block;
          }

          .event-value {
            margin-top: 5px;
            text-align: left;
          }

          .next-heading {
            font-size: 31px;
          }

          .next-title {
            font-size: 33px;
          }

          .score,
          .live-score {
            font-size: 48px;
          }

          .odds-grid {
            grid-template-columns: 1fr;
          }

          .odds-mini-card {
            padding: 20px;
          }

          .odds-prices {
            gap: 8px;
          }

          .bio-heading {
            font-size: 27px;
          }

          .bio-photo {
            float: none;
            display: block;
            width: 130px;
            height: 130px;
            margin: 0 0 18px;
          }

          .times,
          .live-times {
            gap: 14px;
          }
        }
      `}</style>

      <main className="page">
        <div className="top-row">
          <h1 className="main-heading">
            DID{" "}
            <span className="hamza-name">
              HAMZA
            </span>{" "}
            PLAY?
          </h1>

          <div className="top-image-wrap">
            <img
              className="top-image"
              src={
                latestPlayed
                  ? "/hamza-happy.png"
                  : "/hamza-serious.png"
              }
              alt={
                latestPlayed
                  ? "Happy Hamza Choudhury"
                  : "Serious Hamza Choudhury"
              }
            />
          </div>

          <div
            className={
              latestPlayed
                ? "answer yes"
                : "answer no"
            }
          >
            {latestPlayed
              ? "YES"
              : "NO"}
          </div>
        </div>

        <section className="section-card">
          <div className="recent-grid">
            <div>
              <div className="section-label">
                MOST RECENT MATCH
              </div>

              <h2 className="match-title">
                {fixtureName(
                  lastFixture
                )}
              </h2>

              {latestDate && (
                <>
                  <div className="match-date">
                    {formatDate(
                      latestDate
                    )}
                  </div>

                  {fixtureTimes(
                    lastFixture
                  )}
                </>
              )}

              <div className="result-panel">
                <div className="score">
                  {latestHomeScore ??
                    "—"}
                  –
                  {latestAwayScore ??
                    "—"}
                </div>

                <div className="event-list">
                  <div className="event-line">
                    <div className="event-label">
                      GOALSCORERS
                    </div>

                    <div className="event-value">
                      {events.goals.length ===
                      0
                        ? "None"
                        : events.goals
                            .map(
                              (
                                goal: any
                              ) =>
                                formatGoal(goal)
                            )
                            .join(
                              " · "
                            )}
                    </div>
                  </div>

                  <div className="event-line">
                    <div className="event-label">
                      ASSISTS
                    </div>

                    <div className="event-value">
                      {events.assists.length ===
                      0
                        ? "None"
                        : events.assists
                            .map(
                              (
                                goal: any
                              ) =>
                                `${surname(goal.assist_name)} ${formatMinute(goal.minute)}`
                            )
                            .join(
                              " · "
                            )}
                    </div>
                  </div>

                  <div className="event-line">
                    <div className="event-label">
                      RED CARDS
                    </div>

                    <div className="event-value">
                      {events.redCards.length ===
                      0
                        ? "None"
                        : events.redCards
                            .map(
                              (
                                card: any
                              ) =>
                                `${surname(card.player_name)} ${formatMinute(card.minute)}`
                            )
                            .join(
                              " · "
                            )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="details-panel">
              <div className="section-label">
                DETAILS
              </div>

              <div className="details-main">
                {appearanceSummaryText}
              </div>

              <div className="details-supporting">
                Appearance details, including
                starting status and substitutions.
              </div>

              <div className="detail-stats">
                <div className="detail-stat">
                  <div className="detail-stat-label">
                    Minutes
                  </div>

                  <div className="detail-stat-value">
                    {appearance?.minutes ??
                      "—"}
                  </div>
                </div>

                <div className="detail-stat">
                  <div className="detail-stat-label">
                    Started
                  </div>

                  <div
                    className={
                      appearance?.started === true
                        ? "detail-stat-value yes"
                        : "detail-stat-value no"
                    }
                  >
                    {appearance?.started ===
                    true
                      ? "Yes"
                      : "No"}
                  </div>
                </div>

                <div className="detail-stat">
                  <div className="detail-stat-label">
                    Bench
                  </div>

                  <div
                    className={
                      appearance?.bench === true
                        ? "detail-stat-value yes"
                        : "detail-stat-value no"
                    }
                  >
                    {appearance?.bench ===
                    true
                      ? "Yes"
                      : "No"}
                  </div>
                </div>

                <div className="detail-stat">
                  <div className="detail-stat-label">
                    Subbed on
                  </div>

                  <div className="detail-stat-value">
                    {appearance
                      ?.subbed_on_minute !==
                      null &&
                    appearance
                      ?.subbed_on_minute !==
                      undefined
                      ? `${appearance.subbed_on_minute}'`
                      : "—"}
                  </div>
                </div>

                <div className="detail-stat">
                  <div className="detail-stat-label">
                    Subbed off
                  </div>

                  <div className="detail-stat-value">
                    {appearance
                      ?.subbed_off_minute !==
                      null &&
                    appearance
                      ?.subbed_off_minute !==
                      undefined
                      ? `${appearance.subbed_off_minute}'`
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="hamza-outcomes">
                <div className="hamza-outcome">
                  <div className="hamza-outcome-label">
                    Did Hamza score?
                  </div>

                  <div className="hamza-outcome-value">
                    {hamzaScored ? "Yes" : "No"}
                  </div>
                </div>

                <div className="hamza-outcome">
                  <div className="hamza-outcome-label">
                    Did Hamza assist?
                  </div>

                  <div className="hamza-outcome-value">
                    {hamzaAssisted ? "Yes" : "No"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {liveFixture && (
          <section className="live-section">
            <div className="live-heading-row">
              <h2 className="live-heading">
                CURRENTLY PLAYING
              </h2>

              {liveAnswer && (
                <div
                  className={
                    liveAnswerClass
                  }
                >
                  {liveAnswer}
                </div>
              )}
            </div>

            <div className="live-card">
              <div className="live-card-inner">
                <div>
                  <div className="section-label">
                    LIVE MATCH
                  </div>

                  <h3 className="live-title">
                    {fixtureName(
                      liveFixture
                    )}
                  </h3>

                  {liveDate && (
                    <>
                      <div className="live-date">
                        {formatDate(
                          liveDate
                        )}
                      </div>

                      {fixtureTimes(
                        liveFixture,
                        "live-times"
                      )}
                    </>
                  )}

                  <div className="live-status">
                    LIVE
                  </div>
                </div>

                <div className="live-score">
                  {liveHomeScore ??
                    "—"}
                  –
                  {liveAwayScore ??
                    "—"}
                </div>
              </div>
            </div>
          </section>
        )}

        <h2 className="next-heading">
          WILL HAMZA PLAY NEXT?
        </h2>

        <section className="next-card">
          <h3 className="next-title">
            {next
              ? fixtureName(next)
              : "No upcoming fixture"}
          </h3>

          {nextDate && (
            <>
              <div className="match-date">
                {formatDate(
                  nextDate
                )}
              </div>

              {fixtureTimes(next)}
            </>
          )}

          <div className="availability">
            <div>
              <div className="section-label">
                AVAILABILITY
              </div>

              <div className="availability-status">
                {nextStatus?.label ??
                  "Likely available"}
              </div>

              <div className="availability-reason">
                {nextStatus?.reason ??
                  "No current injury, doubt or suspension is listed."}
              </div>
            </div>

            <div className="status-pill">
              {nextStatus?.label ??
                "LIKELY AVAILABLE"}
            </div>
          </div>
        </section>

        <section className="fixtures-card">
          <div className="section-label">
            UPCOMING FIXTURES
          </div>

          {upcomingFixtures.length ===
          0 ? (
            <div className="fixture-row">
              No upcoming fixtures found.
            </div>
          ) : (
            upcomingFixtures.map(
              (
                fixture: any,
                index: number
              ) => {
                const date =
                  dateValue(
                    fixture
                  );

                return (
                  <div
                    className="fixture-row"
                    key={
                      fixture?.id ??
                      `${fixtureTimestamp(fixture)}-${index}`
                    }
                  >
                    <div>
                      <div className="fixture-title">
                        {fixtureName(
                          fixture
                        )}
                      </div>

                      {index === 0 && (
                        <>
                          {hasComplete1X2(
                            firstUpcomingOdds?.oneXTwo
                          ) && (
                            <div className="fixture-odds">
                              (1){" "}{formatOddsPrice(
                                firstUpcomingOdds?.oneXTwo?.home
                              )}{" "}-{" "}(X){" "}{formatOddsPrice(
                                firstUpcomingOdds?.oneXTwo?.draw
                              )}{" "}-{" "}(2){" "}{formatOddsPrice(
                                firstUpcomingOdds?.oneXTwo?.away
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="fixture-date">
                      {date
                        ? formatDate(
                            date
                          )
                        : ""}
                    </div>

                    <div className="fixture-time">
                      {date
                        ? `${formatUKTime(fixture)} (UK Time)`
                        : ""}
                    </div>

                    <div className="fixture-time">
                      {date
                        ? `${formatBangladeshTime(fixture)} (Bangladesh)`
                        : ""}
                    </div>
                  </div>
                );
              }
            )
          )}
        </section>

        <section className="odds-card">
          <div className="odds-heading">MATCH ODDS</div>

          <div className="odds-grid">
            <div className="odds-mini-card">
              <h3 className="odds-mini-title">
                Next match odds
              </h3>
              <div className="odds-mini-subtitle">
                1X2
              </div>
              <div className="odds-mini-match">
                {next
                  ? fixtureName(next)
                  : "No upcoming fixture"}
              </div>

              {hasComplete1X2(
                nextOdds?.oneXTwo
              ) ? (
                <div className="odds-mini-row">
                  <div className="odds-prices">
                    <span>
                      (1) {formatOddsPrice(
                        nextOdds?.oneXTwo?.home
                      )}
                    </span>
                    <span>-</span>
                    <span>
                      (X) {formatOddsPrice(
                        nextOdds?.oneXTwo?.draw
                      )}
                    </span>
                    <span>-</span>
                    <span>
                      (2) {formatOddsPrice(
                        nextOdds?.oneXTwo?.away
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="odds-unavailable">
                  No odds yet
                </div>
              )}
            </div>

            <div className="odds-mini-card">
              <h3 className="odds-mini-title">
                Next match odds
              </h3>
              <div className="odds-mini-subtitle">
                Hamza to score first goal
              </div>
              <div className="odds-mini-match">
                {next
                  ? fixtureName(next)
                  : "No upcoming fixture"}
              </div>

              {numericPrice(
                nextOdds?.hamzaFirstGoalScorer
              ) !== null ? (
                <div className="odds-mini-row">
                  <div className="odds-prices">
                    <span>
                      {formatOddsPrice(
                        nextOdds?.hamzaFirstGoalScorer
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="odds-unavailable">
                  No odds yet
                </div>
              )}
            </div>

            <div className="odds-mini-card">
              <h3 className="odds-mini-title">
                Next Bangladesh match odds
              </h3>
              <div className="odds-mini-subtitle">
                1X2
              </div>
              <div className="odds-mini-match">
                {nextBangladeshFixture
                  ? fixtureName(
                      nextBangladeshFixture
                    )
                  : "No upcoming Bangladesh fixture"}
              </div>

              {hasComplete1X2(
                bangladeshOdds?.oneXTwo
              ) ? (
                <div className="odds-mini-row">
                  <div className="odds-prices">
                    <span>
                      (1) {formatOddsPrice(
                        bangladeshOdds?.oneXTwo?.home
                      )}
                    </span>
                    <span>-</span>
                    <span>
                      (X) {formatOddsPrice(
                        bangladeshOdds?.oneXTwo?.draw
                      )}
                    </span>
                    <span>-</span>
                    <span>
                      (2) {formatOddsPrice(
                        bangladeshOdds?.oneXTwo?.away
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="odds-unavailable">
                  No odds yet
                </div>
              )}
            </div>

            <div className="odds-mini-card">
              <h3 className="odds-mini-title">
                Next Bangladesh match odds
              </h3>
              <div className="odds-mini-subtitle">
                Hamza to score first goal
              </div>
              <div className="odds-mini-match">
                {nextBangladeshFixture
                  ? fixtureName(
                      nextBangladeshFixture
                    )
                  : "No upcoming Bangladesh fixture"}
              </div>

              {numericPrice(
                bangladeshOdds?.hamzaFirstGoalScorer
              ) !== null ? (
                <div className="odds-mini-row">
                  <div className="odds-prices">
                    <span>
                      {formatOddsPrice(
                        bangladeshOdds?.hamzaFirstGoalScorer
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="odds-unavailable">
                  No odds yet
                </div>
              )}
            </div>
          </div>

          <div className="odds-note">
            Decimal odds. Prices can change.
          </div>
        </section>

        <section className="bio-card">
          <h2 className="bio-heading">
            ABOUT HAMZA CHOUDHURY
          </h2>

          <div className="bio-content">
            <img
              className="bio-photo"
              src="/hamza-bio.jpg"
              alt="Hamza Choudhury"
            />

            <p>
              Hamza Dewan Choudhury is a professional footballer. Born in England to a Bangladeshi mother and a father from Grenada, he was raised in a traditional Bangladeshi Muslim household. His ancestral home is in Bahubal, Habiganj District, Sylhet.
            </p>

            <p>
              Born on 1 October 1997, Hamza began playing football at a very young age. He joined the Leicester City Academy at just seven years old, and by 2015, he had broken into the first-team squad. There, he attracted attention from several major European clubs.
            </p>

            <p>
              He made 123 league appearances for the Foxes and enjoyed successful loan spells at Burton Albion, Watford and Sheffield United. In 2026, he made his move to the Blades permanent, signing a one-year contract.
            </p>

            <p>
              Hamza was eligible to play for England and Grenada. In fact, he turned out for England’s under-21 side on no fewer than seven occasions. However, in August 2024, he obtained a Bangladeshi passport and switched his allegiance in December. Hamza then made his debut for the Tigers in March 2025, scoring his first goal in June of the same year in a 2–0 win over Bhutan.
            </p>
          </div>
        </section>

        <div className="updated">
          Data updated{" "}
          {data.updated_at
            ? `${new Intl.DateTimeFormat(
                "en-GB",
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone:
                    "Asia/Dhaka"
                }
              ).format(
                new Date(
                  data.updated_at
                )
              )} (Bangladesh Time)`
            : ""}
        </div>
      </main>
    </>
  );
}
