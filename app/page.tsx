import { getSupabaseAdmin } from "@/lib/supabase";

function dateValue(fixture: any) {
  return (
    fixture?.time?.kickoff_at ??
    fixture?.kickoff_at ??
    fixture?.kickoff ??
    fixture?.event_date ??
    fixture?.date ??
    fixture?.start_time ??
    null
  );
}

function rawTeamValue(
  fixture: any,
  side: "home" | "away"
) {
  const candidates = [
    fixture?.[side],
    fixture?.[`${side}_team`],
    fixture?.[`${side}_club`],
    fixture?.teams?.[side],
    fixture?.team?.[side],
  ];

  for (const value of candidates) {
    if (value != null) {
      return value;
    }
  }

  return null;
}

function teamId(team: any) {
  if (team == null) return 0;

  if (typeof team === "number") {
    return team;
  }

  if (typeof team === "string") {
    return 0;
  }

  return Number(
    team?.id ??
      team?.team_id ??
      team?.club_id ??
      team?.team?.id ??
      0
  );
}

function teamName(team: any) {
  if (team == null) {
    return "Unknown";
  }

  if (typeof team === "string") {
    return team;
  }

  return (
    team?.name ??
    team?.team_name ??
    team?.club_name ??
    team?.team?.name ??
    team?.club?.name ??
    "Unknown"
  );
}

function fixtureTeamName(
  fixture: any,
  side: "home" | "away"
) {
  const directName =
    fixture?.[`${side}_team_name`] ??
    fixture?.[`${side}_name`] ??
    fixture?.[side === "home" ? "home_name" : "away_name"];

  if (directName) {
    return directName;
  }

  return teamName(
    rawTeamValue(fixture, side)
  );
}

function fixtureName(
  fixture: any,
  currentTeamId: number,
  currentTeamName: string
) {
  const home = rawTeamValue(
    fixture,
    "home"
  );

  const away = rawTeamValue(
    fixture,
    "away"
  );

  const homeId = teamId(home);
  const awayId = teamId(away);

  const homeName = fixtureTeamName(
    fixture,
    "home"
  );

  const awayName = fixtureTeamName(
    fixture,
    "away"
  );

  if (homeId === currentTeamId) {
    return `${currentTeamName} vs ${awayName}`;
  }

  if (awayId === currentTeamId) {
    return `${homeName} vs ${currentTeamName}`;
  }

  if (
    homeName !== "Unknown" &&
    awayName !== "Unknown"
  ) {
    return `${homeName} vs ${awayName}`;
  }

  const fallbackHome =
    fixture?.home_team_name ??
    fixture?.home_name ??
    fixture?.home_team;

  const fallbackAway =
    fixture?.away_team_name ??
    fixture?.away_name ??
    fixture?.away_team;

  if (fallbackHome && fallbackAway) {
    return `${fallbackHome} vs ${fallbackAway}`;
  }

  return "Fixture";
}

function scoreValue(fixture: any) {
  const score =
    fixture?.score ??
    fixture?.scores ??
    {};

  const home =
    score?.home ??
    score?.home_score ??
    score?.home_team ??
    fixture?.home_score ??
    fixture?.home_team_score;

  const away =
    score?.away ??
    score?.away_score ??
    score?.away_team ??
    fixture?.away_score ??
    fixture?.away_team_score;

  if (
    home == null ||
    away == null
  ) {
    return null;
  }

  return `${home}–${away}`;
}

function validDate(value: any) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(value: any) {
  const date = validDate(value);

  if (!date) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Europe/London",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatUKTime(value: any) {
  const date = validDate(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}

function formatBangladeshTime(
  value: any
) {
  const date = validDate(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}

function fixtureTimes(value: any) {
  const uk = formatUKTime(value);
  const bangladesh =
    formatBangladeshTime(value);

  if (!uk && !bangladesh) {
    return null;
  }

  return (
    <div className="times">
      <span>{uk} (UK)</span>
      <span>
        {bangladesh} (Bangladesh)
      </span>
    </div>
  );
}

function playerAppears(value: any): boolean {
  if (!value) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) =>
      playerAppears(item)
    );
  }

  if (
    typeof value !== "object"
  ) {
    return false;
  }

  const ids = [
    value?.id,
    value?.player_id,
    value?.player?.id,
    value?.player?.player_id,
  ];

  if (
    ids.some(
      (id: any) =>
        Number(id) === 6135
    )
  ) {
    return true;
  }

  const names = [
    value?.name,
    value?.player_name,
    value?.full_name,
    value?.player?.name,
    value?.player?.full_name,
  ];

  if (
    names.some((name: any) =>
      String(name ?? "")
        .toLowerCase()
        .includes("choudhury")
    )
  ) {
    return true;
  }

  return Object.values(value).some(
    (child: any) =>
      child &&
      typeof child === "object" &&
      playerAppears(child)
  );
}

function playedFromStoredData(
  data: any
) {
  const status =
    data?.last_fixture
      ?.player_status ??
    data?.player_status
      ?.latest_match;

  if (status?.played === true) {
    return {
      played: true,
      text:
        status.label ??
        "Played",
      reason:
        status.label ??
        "Played",
    };
  }

  return {
    played: false,
    text: "NO",
    reason:
      status?.label ??
      "Did not play",
  };
}

function sortUpcomingFixtures(
  fixtures: any[]
) {
  return [...fixtures]
    .filter((fixture) =>
      validDate(
        dateValue(fixture)
      )
    )
    .sort(
      (a, b) =>
        new Date(
          dateValue(a)
        ).getTime() -
        new Date(
          dateValue(b)
        ).getTime()
    );
}

export default async function Home() {
  const supabase =
    getSupabaseAdmin();

  const { data } =
    await supabase
      .from("player_page")
      .select("*")
      .eq("id", 1)
      .single();

  if (!data) {
    return (
      <main className="page">
        <div className="container">
          <div className="eyebrow">
            HAMZA CHOUDHURY
          </div>

          <h1>
            DID HAMZA PLAY?
          </h1>

          <p className="muted">
            Waiting for football
            data.
          </p>
        </div>
      </main>
    );
  }

  const currentTeamId =
    Number(data.team_id);

  const currentTeamName =
    data.team_name ??
    "Sheffield United";

  const last =
    data.last_fixture ?? {};

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

  const storedStatus =
    playedFromStoredData(data);

  const nextStatus =
    data?.player_status
      ?.next_match ?? {};

  return (
    <main className="page">
      <div className="container">

        <header className="header">
          <div className="eyebrow">
            <span className="dot" />
            HAMZA CHOUDHURY
          </div>

          <h1>
            DID HAMZA PLAY?
          </h1>

          <p className="intro">
            A simple answer to
            whether Hamza Choudhury
            featured for Sheffield
            United in the latest
            match.
          </p>
        </header>

        <section className="latest">

          <div className="latest-info">

            <div className="label">
              LATEST MATCH
            </div>

            <h2>
              {fixtureName(
                last,
                currentTeamId,
                currentTeamName
              )}
            </h2>

            <p className="date">
              {formatDate(
                dateValue(last)
              )}
            </p>

            {fixtureTimes(
              dateValue(last)
            )}

            {scoreValue(last) && (
              <div className="score">
                {scoreValue(last)}
              </div>
            )}

          </div>

          <div
            className={
              storedStatus.played
                ? "answer yes"
                : "answer no"
            }
          >
            {storedStatus.played
              ? "YES"
              : "NO"}
          </div>

          <div className="why">

            <div className="label">
              WHY?
            </div>

            <div className="reason">
              {storedStatus.reason}
            </div>

          </div>

        </section>

        <section className="next">

          <div className="label">
            WILL HAMZA PLAY NEXT?
          </div>

          {next ? (
            <>
              <h2>
                {fixtureName(
                  next,
                  currentTeamId,
                  currentTeamName
                )}
              </h2>

              <p className="date">
                {formatDate(
                  dateValue(next)
                )}
              </p>

              {fixtureTimes(
                dateValue(next)
              )}

              <div className="availability">

                <div>

                  <div className="small-label">
                    AVAILABILITY
                  </div>

                  <div className="availability-title">
                    {nextStatus.label ??
                      "Likely available"}
                  </div>

                  <p>
                    {nextStatus.reason ??
                      "No current injury, doubt or suspension is listed."}
                  </p>

                </div>

                <div className="badge">
                  {String(
                    nextStatus.type ??
                      "likely_available"
                  )
                    .replaceAll(
                      "_",
                      " "
                    )
                    .toUpperCase()}
                </div>

              </div>
            </>
          ) : (
            <p className="muted">
              No upcoming fixture
              is currently
              available.
            </p>
          )}

        </section>

        <section className="fixtures">

          <div className="label">
            NEXT 3 FIXTURES
          </div>

          {nextFixtures
            .slice(0, 3)
            .map(
              (
                fixture: any,
                index: number
              ) => (
                <div
                  className="fixture"
                  key={
                    fixture?.id ??
                    index
                  }
                >

                  <div>

                    <strong>
                      {fixtureName(
                        fixture,
                        currentTeamId,
                        currentTeamName
                      )}
                    </strong>

                    <div className="date">
                      {formatDate(
                        dateValue(
                          fixture
                        )
                      )}
                    </div>

                    {fixtureTimes(
                      dateValue(
                        fixture
                      )
                    )}

                  </div>

                  <span>
                    {index === 0
                      ? "NEXT"
                      : `#${index + 1}`}
                  </span>

                </div>
              )
            )}

        </section>

        <footer>
          Data updated{" "}
          {formatDate(
            data.updated_at
          )}
          {" · "}
          Live football data
        </footer>

      </div>

      <style>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #070b12;
          color: #fff;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        .page {
          min-height: 100vh;
          padding:
            50px
            20px
            80px;
          background:
            radial-gradient(
              circle at 90% 0%,
              #17233a 0,
              #070b12 42%
            );
        }

        .container {
          max-width: 1050px;
          margin: auto;
        }

        .header {
          margin-bottom: 35px;
        }

        .eyebrow {
          color: #8995a8;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .16em;
        }

        .dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          margin-right: 9px;
          border-radius: 50%;
          background: #35d399;
        }

        h1 {
          margin: 15px 0;
          font-size:
            clamp(
              58px,
              10vw,
              120px
            );
          line-height: .9;
          letter-spacing: -.07em;
        }

        h2 {
          margin:
            8px
            0
            0;
          font-size:
            clamp(
              26px,
              4vw,
              40px
            );
          line-height: 1.1;
          letter-spacing: -.03em;
        }

        .intro {
          max-width: 650px;
          color: #8995a8;
          font-size: 17px;
          line-height: 1.6;
        }

        .latest {
          position: relative;
          padding: 35px;
          border-radius: 28px;
          background: #fff;
          color: #0b1018;
        }

        .latest-info {
          padding-right: 190px;
        }

        .label {
          color: #7b8797;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .16em;
        }

        .date {
          margin:
            9px
            0
            0;
          color: #718096;
          font-size: 14px;
        }

        .times {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 18px;
          margin-top: 7px;
          color: #718096;
          font-size: 14px;
          font-weight: 700;
        }

        .score {
          margin-top: 18px;
          font-size: 30px;
          font-weight: 900;
        }

        .answer {
          position: absolute;
          top: 35px;
          right: 35px;
          width: 145px;
          height: 145px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #fff;
          font-size: 34px;
          font-weight: 950;
        }

        .yes {
          background: #16a36b;
        }

        .no {
          background: #111827;
        }

        .why {
          margin-top: 30px;
          padding-top: 25px;
          border-top:
            1px solid
            #e5e7eb;
        }

        .reason {
          margin-top: 8px;
          font-size: 21px;
          font-weight: 800;
        }

        .next {
          margin-top: 20px;
          padding: 35px;
          border-radius: 28px;
          background: #111927;
        }

        .next h2 {
          color: #fff;
        }

        .next .date,
        .next .times {
          color: #8995a8;
        }

        .availability {
          margin-top: 28px;
          padding: 24px;
          border-radius: 20px;
          background: #fff;
          color: #0b1018;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
        }

        .small-label {
          color: #718096;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .14em;
        }

        .availability-title {
          margin-top: 7px;
          font-size: 28px;
          font-weight: 900;
        }

        .availability p {
          color: #667085;
        }

        .badge {
          padding:
            9px
            14px;
          border-radius: 999px;
          background: #dcfce7;
          color: #08734b;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .fixtures {
          margin-top: 38px;
        }

        .fixture {
          margin-top: 10px;
          padding: 21px;
          border:
            1px solid
            #1d2838;
          border-radius: 18px;
          background: #111927;
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }

        .fixture strong {
          font-size: 17px;
        }

        .fixture .times {
          color: #8995a8;
        }

        .fixture span {
          color: #7f8a9b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .1em;
        }

        .muted {
          color: #8995a8;
        }

        footer {
          margin-top: 35px;
          padding-top: 20px;
          border-top:
            1px solid
            #1d2838;
          color: #657184;
          font-size: 12px;
        }

        @media (max-width: 700px) {

          .page {
            padding:
              30px
              14px
              50px;
          }

          .latest,
          .next {
            padding: 24px;
            border-radius: 22px;
          }

          .latest-info {
            padding-right: 0;
          }

          .answer {
            position: static;
            margin-top: 25px;
            width: 120px;
            height: 120px;
          }

          .availability {
            align-items: flex-start;
            flex-direction: column;
          }

          .times {
            flex-direction: column;
            gap: 4px;
          }

          .fixture {
            align-items: flex-start;
          }

        }

      `}</style>
    </main>
  );
}
