export const dynamic = "force-dynamic";
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
        (UK)
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
      return "Didn't start. Subbed on.";
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
      `Started. Subbed off. Played ${
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

  const liveFixture =
    data.live_fixture ??
    null;

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
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            86px
            215px;
          align-items: center;
          column-gap: 8px;
          row-gap: 0;
        }

        .top-image-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
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
          .fixtures-card {
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

                  <div className="detail-stat-value">
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

                  <div className="detail-stat-value">
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
