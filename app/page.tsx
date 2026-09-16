import { getSupabaseAdmin } from "../lib/supabase";

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
    `${teamName(fixture, "home")} vs ` +
    `${teamName(fixture, "away")}`
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

  if (!date) {
    return "";
  }

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

  if (!date) {
    return "";
  }

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

  if (!date) {
    return "";
  }

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

  if (!date) {
    return null;
  }

  const uk =
    formatUKTime(fixture);

  const bangladesh =
    formatBangladeshTime(
      fixture
    );

  if (!uk || !bangladesh) {
    return null;
  }

  return (
    <div className={className}>
      <span>
        {uk} (UK)
      </span>

      <span>
        {bangladesh} (Bangladesh)
      </span>
    </div>
  );
}

function fixtureTimestamp(
  fixture: any
): number {
  const date =
    dateValue(fixture);

  if (!date) {
    return 0;
  }

  const timestamp =
    new Date(date).getTime();

  return Number.isNaN(
    timestamp
  )
    ? 0
    : timestamp;
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

function collectEventObjects(
  value: any,
  results: any[] = [],
  depth = 0
): any[] {
  if (
    !value ||
    typeof value !== "object" ||
    depth > 7
  ) {
    return results;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectEventObjects(
        item,
        results,
        depth + 1
      );
    }

    return results;
  }

  for (const [
    key,
    child
  ] of Object.entries(value)) {
    const keyLower =
      key.toLowerCase();

    if (
      child &&
      typeof child === "object" &&
      (
        keyLower.includes("event") ||
        keyLower.includes("incident") ||
        keyLower.includes("timeline") ||
        keyLower.includes("goal") ||
        keyLower.includes("card")
      )
    ) {
      if (Array.isArray(child)) {
        results.push(
          ...child
        );
      } else {
        results.push(
          child
        );
      }
    }

    if (
      child &&
      typeof child === "object"
    ) {
      collectEventObjects(
        child,
        results,
        depth + 1
      );
    }
  }

  return results;
}

function eventMinute(
  event: any
): number | null {
  const candidates = [
    event?.minute,
    event?.min,
    event?.event_minute,
    event?.time?.minute,
    event?.timestamp?.minute
  ];

  for (const value of candidates) {
    const number =
      Number(value);

    if (
      Number.isFinite(number) &&
      number >= 0
    ) {
      return number;
    }
  }

  return null;
}

function eventText(
  event: any
): string {
  try {
    return JSON.stringify(
      event
    ).toLowerCase();
  } catch {
    return "";
  }
}

function eventPlayerName(
  event: any
): string {
  const candidates = [
    event?.player?.name,
    event?.player_name,
    event?.name,
    event?.scorer?.name,
    event?.goal?.player?.name,
    event?.card?.player?.name
  ];

  for (const value of candidates) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

function eventAssistName(
  event: any
): string {
  const candidates = [
    event?.assist?.name,
    event?.assist_player?.name,
    event?.assistant?.name,
    event?.goal?.assist?.name
  ];

  for (const value of candidates) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

function eventTeamName(
  event: any
): string {
  const candidates = [
    event?.team?.name,
    event?.team_name
  ];

  for (const value of candidates) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

function extractMatchEvents(
  fixture: any
) {
  const events =
    collectEventObjects(
      fixture
    );

  const goals: any[] = [];
  const yellowCards: any[] = [];
  const redCards: any[] = [];

  const seen =
    new Set<string>();

  for (const event of events) {
    const text =
      eventText(event);

    const minute =
      eventMinute(event);

    const player =
      eventPlayerName(event);

    const team =
      eventTeamName(event);

    const assist =
      eventAssistName(event);

    const isGoal =
      (
        text.includes("goal") ||
        text.includes("scored")
      ) &&
      !text.includes(
        "no goal"
      ) &&
      !text.includes(
        "disallowed"
      );

    const isYellow =
      text.includes(
        "yellow card"
      ) ||
      text.includes(
        "yellow_card"
      );

    const isRed =
      text.includes(
        "red card"
      ) ||
      text.includes(
        "red_card"
      ) ||
      text.includes(
        "sent off"
      ) ||
      text.includes(
        "sending off"
      );

    if (isGoal) {
      const key =
        `G-${minute}-${player}-${team}`;

      if (!seen.has(key)) {
        seen.add(key);

        goals.push({
          minute,
          player,
          team,
          assist
        });
      }
    }

    if (
      isYellow &&
      !isRed
    ) {
      const key =
        `Y-${minute}-${player}-${team}`;

      if (!seen.has(key)) {
        seen.add(key);

        yellowCards.push({
          minute,
          player,
          team
        });
      }
    }

    if (isRed) {
      const key =
        `R-${minute}-${player}-${team}`;

      if (!seen.has(key)) {
        seen.add(key);

        redCards.push({
          minute,
          player,
          team
        });
      }
    }
  }

  goals.sort(
    (a, b) =>
      (a.minute ?? 999) -
      (b.minute ?? 999)
  );

  yellowCards.sort(
    (a, b) =>
      (a.minute ?? 999) -
      (b.minute ?? 999)
  );

  redCards.sort(
    (a, b) =>
      (a.minute ?? 999) -
      (b.minute ?? 999)
  );

  return {
    goals,
    yellowCards,
    redCards
  };
}

function formatEventMinute(
  minute: number | null
) {
  return minute === null
    ? ""
    : `${minute}'`;
}

function appearanceSummary(
  appearance: any,
  latestStatus: any
) {
  if (
    latestStatus?.played !== true
  ) {
    return (
      latestStatus?.label ??
      "Did not play."
    );
  }

  const minutes =
    appearance?.minutes ??
    latestStatus?.minutes ??
    null;

  const started =
    appearance?.started === true;

  const subbedOn =
    appearance
      ?.subbed_on_minute ??
    null;

  const subbedOff =
    appearance
      ?.subbed_off_minute ??
    null;

  const replacedPlayer =
    appearance
      ?.replaced_player ??
    null;

  const parts: string[] = [];

  if (
    minutes !== null &&
    Number.isFinite(
      Number(minutes)
    )
  ) {
    parts.push(
      `Played ${minutes} mins`
    );
  } else {
    parts.push(
      "Played"
    );
  }

  if (started) {
    parts.push(
      "Started"
    );
  }

  if (
    subbedOn !== null
  ) {
    parts.push(
      replacedPlayer
        ? `Came on for ${replacedPlayer} in the ${subbedOn}th minute`
        : `Came on in the ${subbedOn}th minute`
    );
  }

  if (
    subbedOff !== null
  ) {
    parts.push(
      replacedPlayer
        ? `Subbed off for ${replacedPlayer} in the ${subbedOff}th minute`
        : `Subbed off in the ${subbedOff}th minute`
    );
  }

  return (
    parts.join(". ") +
    "."
  );
}

export default async function Home() {
  const supabase =
    getSupabaseAdmin();

  const {
    data,
    error
  } = await supabase
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
          DID HAMZA PLAY?
        </h1>

        <div className="error-card">
          Data unavailable.
        </div>
      </main>
    );
  }

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

  const matchEvents =
    extractMatchEvents(
      lastFixture
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
            6vw,
            74px
          );
          line-height: 0.92;
          font-weight: 900;
          letter-spacing: -3px;
          white-space: nowrap;
        }

        .top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
        }

        .answer {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 230px;
          height: 112px;
          padding: 0 42px;
          border-radius: 999px;
          background: #ffffff;
          font-size: 68px;
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
            minmax(0, 1.45fr)
            minmax(320px, 0.85fr);
          gap: 38px;
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
          margin-top: 26px;
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
          display: grid;
          gap: 10px;
        }

        .event-line {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: baseline;
          padding-bottom: 10px;
          border-bottom:
            1px solid
            #edf0f3;
          font-size: 14px;
          line-height: 1.35;
        }

        .event-line:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .event-label {
          color: #7084a1;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .event-value {
          text-align: right;
          font-weight: 800;
        }

        .details-panel {
          padding-left: 34px;
          border-left:
            1px solid
            #dfe4ea;
        }

        .details-main {
          margin-top: 10px;
          font-size: 27px;
          line-height: 1.12;
          font-weight: 900;
          letter-spacing: -0.8px;
        }

        .details-supporting {
          margin-top: 12px;
          color: #52647d;
          font-size: 15px;
          line-height: 1.5;
        }

        .detail-stats {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          gap: 10px;
          margin-top: 20px;
        }

        .detail-stat {
          background: #f3f6f8;
          border-radius: 16px;
          padding: 15px;
        }

        .detail-stat-label {
          color: #7084a1;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .detail-stat-value {
          margin-top: 6px;
          font-size: 19px;
          line-height: 1.1;
          font-weight: 900;
        }

        .next-heading {
          margin: 42px 0 17px;
          color: #ffffff;
          font-size: clamp(
            28px,
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
            4.5vw,
            46px
          );
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1.5px;
        }

        .availability {
          margin-top: 27px;
          background: #ffffff;
          color: #090d13;
          border-radius: 23px;
          padding: 25px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
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
          letter-spacing: 0.8px;
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
            minmax(0, 1.6fr)
            190px
            150px
            190px;
          align-items: center;
          gap: 22px;
          padding: 23px 0;
          border-top:
            1px solid
            #dfe4ea;
        }

        .fixture-row:first-of-type {
          margin-top: 12px;
        }

        .fixture-title {
          font-size: 22px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.4px;
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

        .updated {
          margin-top: 24px;
          text-align: center;
          color:
            rgba(
              255,
              255,
              255,
              0.78
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
            display: block;
          }

          .main-heading {
            font-size: 42px;
            letter-spacing: -2.3px;
          }

          .answer {
            margin-top: 25px;
            min-width: 210px;
            height: 106px;
            font-size: 58px;
          }

          .section-card,
          .next-card,
          .fixtures-card {
            padding: 27px 22px;
            border-radius: 25px;
          }

          .recent-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .details-panel {
            padding-left: 0;
            padding-top: 27px;
            border-left: 0;
            border-top:
              1px solid
              #dfe4ea;
          }

          .detail-stats {
            grid-template-columns:
              repeat(
                3,
                minmax(0, 1fr)
              );
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

          .fixture-title {
            font-size: 22px;
          }

          .fixture-date {
            margin-top: 9px;
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

          .answer {
            min-width: 195px;
            height: 98px;
            padding: 0 34px;
            font-size: 54px;
          }

          .match-title {
            font-size: 31px;
          }

          .detail-stats {
            grid-template-columns: 1fr;
          }

          .next-heading {
            font-size: 31px;
          }

          .next-title {
            font-size: 33px;
          }

          .score {
            font-size: 48px;
          }

          .times {
            gap: 14px;
          }
        }
      `}</style>

      <main className="page">
        <div className="top-row">
          <h1 className="main-heading">
            DID HAMZA PLAY?
          </h1>

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
                      {matchEvents.goals.length ===
                      0
                        ? "None"
                        : matchEvents.goals
                            .map(
                              (
                                goal: any
                              ) =>
                                `${goal.player || "Unknown"} ${formatEventMinute(goal.minute)}`
                            )
                            .join(
                              " · "
                            )}
                    </div>
                  </div>

                  <div className="event-line">
                    <div className="event-label">
                      YELLOW CARDS
                    </div>

                    <div className="event-value">
                      {matchEvents.yellowCards.length ===
                      0
                        ? "None"
                        : matchEvents.yellowCards
                            .map(
                              (
                                card: any
                              ) =>
                                `${card.player || "Unknown"} ${formatEventMinute(card.minute)}`
                            )
                            .join(
                              " · "
                            )}
                    </div>
                  </div>

                  <div className="event-line">
                    <div className="event-label">
                      SENDINGS OFF
                    </div>

                    <div className="event-value">
                      {matchEvents.redCards.length ===
                      0
                        ? "None"
                        : matchEvents.redCards
                            .map(
                              (
                                card: any
                              ) =>
                                `${card.player || "Unknown"} ${formatEventMinute(card.minute)}`
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
                {appearanceSummary(
                  appearance,
                  latestStatus
                )}
              </div>

              <div className="details-supporting">
                Match appearance details,
                including starting status
                and substitutions where
                available.
              </div>

              <div className="detail-stats">
                <div className="detail-stat">
                  <div className="detail-stat-label">
                    Minutes
                  </div>

                  <div className="detail-stat-value">
                    {appearance?.minutes ??
                      latestStatus?.minutes ??
                      "—"}
                  </div>
                </div>

                <div className="detail-stat">
                  <div className="detail-stat-label">
                    Started
                  </div>

                  <div className="detail-stat-value">
                    {appearance?.started ===
                    true
                      ? "Yes"
                      : appearance
                          ?.subbed_on_minute !==
                        null
                      ? "No"
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
                    null
                      ? `${appearance.subbed_off_minute}'`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

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
                    <div className="fixture-title">
                      {fixtureName(
                        fixture
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
                        ? `${formatUKTime(fixture)} (UK)`
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

        <div className="updated">
          Data updated{" "}
          {data.updated_at
            ? new Intl.DateTimeFormat(
                "en-GB",
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone:
                    "Europe/London"
                }
              ).format(
                new Date(
                  data.updated_at
                )
              )
            : ""}
        </div>
      </main>
    </>
  );
}
