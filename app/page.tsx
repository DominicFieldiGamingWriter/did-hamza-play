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
  fixture: any
) {
  const date =
    dateValue(fixture);

  if (!date) return null;

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
  lastFixture: any,
  latestStatus: any
) {
  return (
    lastFixture?.player_status
      ?.appearance ??
    latestStatus?.appearance ??
    null
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
          max-width: 920px;
          margin: 0 auto;
          padding: 54px 28px 80px;
        }

        .main-heading {
          margin: 0;
          color: #ffffff;
          font-size: clamp(
            52px,
            10vw,
            92px
          );
          line-height: 0.9;
          font-weight: 900;
          letter-spacing: -4px;
        }

        .answer-wrap {
          margin-top: 34px;
        }

        .answer {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 250px;
          min-height: 125px;
          padding: 26px 44px;
          border-radius: 999px;
          font-size: clamp(
            54px,
            10vw,
            84px
          );
          line-height: 0.9;
          font-weight: 900;
          letter-spacing: -3px;
          box-shadow:
            0 12px 28px
            rgba(
              0,
              0,
              0,
              0.12
            );
        }

        .answer.yes {
          background: #18a36d;
        }

        .answer.no {
          background: #e45757;
        }

        .card {
          margin-top: 44px;
          background: #ffffff;
          color: #090d13;
          border-radius: 32px;
          padding: 38px 40px;
        }

        .section-label {
          color: #7084a1;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 2.3px;
          text-transform: uppercase;
        }

        .last-match-title {
          margin: 12px 0 0;
          max-width: 760px;
          font-size: clamp(
            29px,
            5vw,
            45px
          );
          line-height: 1;
          letter-spacing: -1.8px;
          font-weight: 900;
        }

        .match-date {
          margin-top: 14px;
          color: #7084a1;
          font-size: 16px;
        }

        .times {
          display: flex;
          gap: 22px;
          flex-wrap: wrap;
          margin-top: 7px;
          color: #7084a1;
          font-size: 15px;
          font-weight: 700;
        }

        .score {
          margin-top: 20px;
          font-size: 34px;
          font-weight: 900;
          letter-spacing: -1px;
        }

        .details {
          margin-top: 24px;
          padding-top: 26px;
          border-top:
            1px solid
            #dfe4ea;
        }

        .details-main {
          margin-top: 10px;
          font-size: 28px;
          line-height: 1.12;
          font-weight: 900;
          letter-spacing: -0.7px;
        }

        .details-text {
          margin-top: 13px;
          color: #52647d;
          font-size: 17px;
          line-height: 1.5;
        }

        .details-grid {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          gap: 14px;
          margin-top: 22px;
        }

        .detail-stat {
          background: #f2f5f8;
          border-radius: 18px;
          padding: 18px;
        }

        .detail-stat-label {
          color: #7084a1;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1.3px;
          text-transform: uppercase;
        }

        .detail-stat-value {
          margin-top: 7px;
          font-size: 21px;
          font-weight: 900;
        }

        .next-section {
          margin-top: 24px;
          background: #111a29;
          border-radius: 32px;
          padding: 38px 40px;
        }

        .next-section .section-label {
          color: #8ea5c4;
        }

        .next-title {
          margin: 11px 0 0;
          max-width: 760px;
          font-size: clamp(
            31px,
            5vw,
            48px
          );
          line-height: 1;
          letter-spacing: -1.6px;
          font-weight: 900;
        }

        .availability {
          margin-top: 28px;
          background: #ffffff;
          color: #090d13;
          border-radius: 25px;
          padding: 28px;
        }

        .availability-status {
          margin-top: 9px;
          font-size: 32px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1px;
        }

        .availability-reason {
          margin-top: 13px;
          color: #52647d;
          font-size: 16px;
          line-height: 1.45;
        }

        .fixtures-card {
          margin-top: 24px;
          background: #ffffff;
          color: #090d13;
          border-radius: 32px;
          padding: 38px 40px;
        }

        .fixture-row {
          padding: 22px 0;
          border-top:
            1px solid
            #dfe4ea;
        }

        .fixture-row:first-child {
          margin-top: 12px;
        }

        .fixture-title {
          font-size: 24px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.5px;
        }

        .fixture-date {
          margin-top: 8px;
          color: #7084a1;
          font-size: 15px;
        }

        .updated {
          margin-top: 25px;
          text-align: center;
          color:
            rgba(
              255,
              255,
              255,
              0.72
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

        @media (max-width: 700px) {
          .page {
            padding: 34px 18px 55px;
          }

          .main-heading {
            letter-spacing: -2.5px;
          }

          .answer {
            min-width: 205px;
            min-height: 105px;
            font-size: 58px;
            padding: 23px 34px;
          }

          .card,
          .next-section,
          .fixtures-card {
            padding: 28px 23px;
            border-radius: 25px;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .last-match-title {
            font-size: 31px;
          }

          .next-title {
            font-size: 34px;
          }
        }
      `}</style>

      <main className="page">
        <h1 className="main-heading">
          DID HAMZA PLAY?
        </h1>

        <div className="answer-wrap">
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

        <section className="card">
          <div className="section-label">
            MOST RECENT MATCH
          </div>

          <h2 className="last-match-title">
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

          {latestHomeScore !== null &&
            latestAwayScore !== null && (
              <div className="score">
                {latestHomeScore}
                –
                {latestAwayScore}
              </div>
            )}

          <div className="details">
            <div className="section-label">
              DETAILS
            </div>

            <div className="details-main">
              {appearance?.summary ??
                (latestPlayed
                  ? "Played"
                  : "Did not feature.")}
            </div>

            {appearance && (
              <div className="details-grid">
                <div className="detail-stat">
                  <div className="detail-stat-label">
                    Minutes
                  </div>

                  <div className="detail-stat-value">
                    {appearance.minutes ??
                      "—"}
                  </div>
                </div>

                <div className="detail-stat">
                  <div className="detail-stat-label">
                    Started
                  </div>

                  <div className="detail-stat-value">
                    {appearance.started
                      ? "Yes"
                      : "No"}
                  </div>
                </div>

                <div className="detail-stat">
                  <div className="detail-stat-label">
                    Subbed off
                  </div>

                  <div className="detail-stat-value">
                    {appearance.subbed_off_minute !==
                    null
                      ? `${appearance.subbed_off_minute}'`
                      : "—"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="next-section">
          <div className="section-label">
            WILL HAMZA PLAY NEXT?
          </div>

          <h2 className="next-title">
            {next
              ? fixtureName(next)
              : "No upcoming fixture"}
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
        </section>

        <section className="fixtures-card">
          <div className="section-label">
            UPCOMING FIXTURES
          </div>

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
                    <div className="fixture-title">
                      {fixtureName(
                        fixture
                      )}
                    </div>

                    {date && (
                      <>
                        <div className="fixture-date">
                          {formatDate(
                            date
                          )}
                        </div>

                        <div className="times">
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
                      </>
                    )}
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
