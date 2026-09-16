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

function teamId(
  fixture: any,
  side: "home" | "away"
): number {
  const team = rawTeamValue(
    fixture,
    side
  );

  const candidates = [
    team?.id,
    team?.team_id,
    team?.team?.id,
    fixture?.[`${side}_team_id`],
    fixture?.[`${side}_id`]
  ];

  for (const value of candidates) {
    const id = Number(value);

    if (
      Number.isFinite(id) &&
      id > 0
    ) {
      return id;
    }
  }

  return 0;
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
    team?.team?.team_name,
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
  const home =
    teamName(fixture, "home");

  const away =
    teamName(fixture, "away");

  return `${home} vs ${away}`;
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

  if (Number.isNaN(
    parsed.getTime()
  )) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London"
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

  if (Number.isNaN(
    parsed.getTime()
  )) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/London"
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

  if (Number.isNaN(
    parsed.getTime()
  )) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Dhaka"
    }
  ).format(parsed);
}

function fixtureTimes(
  fixture: any
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
    <div className="times">
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

  return Number.isNaN(timestamp)
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

function playerAppears(
  fixture: any
): boolean {
  const status =
    fixture?.player_status;

  return Boolean(
    status?.played === true
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
        <div className="card">
          <div className="label">
            DID HAMZA PLAY?
          </div>

          <h1>
            Data unavailable
          </h1>

          <p>
            The football data has not
            been loaded yet.
          </p>
        </div>
      </main>
    );
  }

  const lastFixture =
    data.last_fixture ?? null;

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
    nextFixtures[0] ?? null;

  /*
   * IMPORTANT:
   *
   * The first upcoming fixture is
   * displayed in "WILL HAMZA PLAY NEXT?"
   *
   * Therefore the fixture list below
   * starts at index 1 so the next match
   * is NOT repeated.
   */
  const upcomingFixtures =
    next
      ? nextFixtures.slice(1, 4)
      : nextFixtures.slice(0, 3);

  const latestStatus =
    lastFixture?.player_status ??
    data.player_status?.latest_match ??
    null;

  const nextStatus =
    data.player_status?.next_match ??
    null;

  const latestPlayed =
    latestStatus?.played === true;

  const latestHomeName =
    lastFixture
      ? teamName(
          lastFixture,
          "home"
        )
      : "Unknown";

  const latestAwayName =
    lastFixture
      ? teamName(
          lastFixture,
          "away"
        )
      : "Unknown";

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

  const latestDate =
    lastFixture
      ? dateValue(lastFixture)
      : null;

  const latestFixtureTitle =
    lastFixture
      ? `${latestHomeName} vs ${latestAwayName}`
      : "No recent match";

  const nextFixtureTitle =
    next
      ? fixtureName(next)
      : "No upcoming fixture";

  const nextDate =
    next
      ? dateValue(next)
      : null;

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
          background: #080d14;
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
          max-width: 900px;
          margin: 0 auto;
          padding: 42px 32px 70px;
        }

        .header {
          margin-bottom: 26px;
        }

        .brand {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 2.5px;
          color: #91a5c2;
          text-transform: uppercase;
        }

        .title {
          margin: 8px 0 0;
          font-size: clamp(42px, 8vw, 72px);
          line-height: 0.95;
          letter-spacing: -3px;
          font-weight: 900;
        }

        .subtitle {
          margin-top: 14px;
          color: #91a5c2;
          font-size: 16px;
          line-height: 1.5;
        }

        .card {
          background: #ffffff;
          color: #090d13;
          border-radius: 34px;
          padding: 44px;
          margin-bottom: 24px;
        }

        .hero {
          position: relative;
          min-height: 370px;
        }

        .label {
          color: #7084a1;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 2.2px;
          text-transform: uppercase;
        }

        .match-title {
          max-width: 650px;
          margin: 14px 0 10px;
          font-size: clamp(34px, 6vw, 52px);
          line-height: 1.02;
          letter-spacing: -2px;
          font-weight: 900;
        }

        .match-date {
          color: #7084a1;
          font-size: 17px;
          margin-top: 16px;
        }

        .times {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          margin-top: 8px;
          color: #7084a1;
          font-size: 16px;
          font-weight: 700;
        }

        .answer {
          position: absolute;
          right: 0;
          top: 0;
          width: 182px;
          height: 182px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 46px;
          font-weight: 900;
        }

        .answer.yes {
          background: #18a36d;
          color: #ffffff;
        }

        .answer.no {
          background: #e45757;
          color: #ffffff;
        }

        .score {
          margin-top: 28px;
          font-size: 38px;
          font-weight: 900;
          letter-spacing: -1px;
        }

        .divider {
          height: 1px;
          background: #dfe4ea;
          margin: 44px 0 34px;
        }

        .why-title {
          margin-top: 16px;
          font-size: 28px;
          font-weight: 900;
        }

        .dark-card {
          background: #111a29;
          border-radius: 34px;
          padding: 46px 44px;
          margin-bottom: 24px;
        }

        .dark-card .match-title {
          color: #ffffff;
        }

        .availability {
          background: #ffffff;
          color: #090d13;
          border-radius: 26px;
          padding: 32px;
          margin-top: 34px;
          position: relative;
        }

        .availability-label {
          color: #7084a1;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .availability-status {
          margin-top: 14px;
          font-size: 36px;
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -1.5px;
          padding-right: 170px;
        }

        .availability-reason {
          margin-top: 18px;
          color: #7084a1;
          font-size: 18px;
          line-height: 1.45;
          padding-right: 80px;
        }

        .status-pill {
          position: absolute;
          right: 28px;
          top: 76px;
          padding: 11px 18px;
          border-radius: 999px;
          background: #d9f8e8;
          color: #087c51;
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .fixtures {
          background: #ffffff;
          color: #090d13;
          border-radius: 34px;
          padding: 44px;
        }

        .fixture-list {
          margin-top: 26px;
        }

        .fixture-row {
          padding: 24px 0;
          border-top: 1px solid #dfe4ea;
        }

        .fixture-row:first-child {
          border-top: 0;
        }

        .fixture-opponent {
          font-size: 25px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.5px;
        }

        .fixture-date {
          margin-top: 9px;
          color: #7084a1;
          font-size: 15px;
        }

        .fixture-times {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 6px;
          color: #7084a1;
          font-size: 14px;
          font-weight: 700;
        }

        .updated {
          text-align: center;
          margin-top: 28px;
          color: #7084a1;
          font-size: 13px;
        }

        @media (max-width: 700px) {
          .page {
            padding: 24px 16px 50px;
          }

          .card,
          .dark-card,
          .fixtures {
            padding: 30px 24px;
            border-radius: 26px;
          }

          .hero {
            min-height: 0;
          }

          .answer {
            position: relative;
            right: auto;
            top: auto;
            margin: 28px 0 0;
            width: 145px;
            height: 145px;
            font-size: 38px;
          }

          .availability-status {
            padding-right: 0;
          }

          .availability-reason {
            padding-right: 0;
          }

          .status-pill {
            position: static;
            display: inline-block;
            margin-top: 18px;
          }
        }
      `}</style>

      <main className="page">
        <header className="header">
          <div className="brand">
            DID HAMZA PLAY?
          </div>

          <h1 className="title">
            Match tracker
          </h1>

          <div className="subtitle">
            Sheffield United · Hamza Choudhury
          </div>
        </header>

        <section className="card hero">
          <div className="label">
            LATEST MATCH
          </div>

          <h2 className="match-title">
            {latestFixtureTitle}
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

          {latestHomeScore !== null &&
            latestAwayScore !== null && (
              <div className="score">
                {latestHomeScore}
                –
                {latestAwayScore}
              </div>
            )}

          <div className="divider" />

          <div className="label">
            WHY?
          </div>

          <div className="why-title">
            {latestStatus?.label ??
              (latestPlayed
                ? "Played"
                : "Did not play")}
          </div>
        </section>

        <section className="dark-card">
          <div className="label">
            WILL HAMZA PLAY NEXT?
          </div>

          <h2 className="match-title">
            {nextFixtureTitle}
          </h2>

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
            <div className="availability-label">
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

            <div className="status-pill">
              {nextStatus?.label ??
                "LIKELY AVAILABLE"}
            </div>
          </div>
        </section>

        <section className="fixtures">
          <div className="label">
            UPCOMING FIXTURES
          </div>

          <div className="fixture-list">
            {upcomingFixtures.length === 0 ? (
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
                        `${fixtureTimestamp(
                          fixture
                        )}-${index}`
                      }
                    >
                      <div className="fixture-opponent">
                        {fixtureName(
                          fixture
                        )}
                      </div>

                      {date && (
                        <div className="fixture-date">
                          {formatDate(date)}
                        </div>
                      )}

                      <div className="fixture-times">
                        {date && (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </section>

        <div className="updated">
          Data updated{" "}
          {data.updated_at
            ? formatDate(
                data.updated_at
              )
            : ""}
        </div>
      </main>
    </>
  );
}
