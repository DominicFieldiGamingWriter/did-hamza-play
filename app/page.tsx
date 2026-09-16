import { getSupabaseAdmin } from "@/lib/supabase";

const BSD_BASE_URL = "https://sports.bzzoiro.com/api/v2";
const PLAYER_ID = 6135;
const PLAYER_NAME = "Hamza Choudhury";

async function bsdGet(path: string) {
  const key = process.env.BSD_API_KEY;

  if (!key) {
    throw new Error("BSD_API_KEY is not configured.");
  }

  const response = await fetch(
    `${BSD_BASE_URL}${path}`,
    {
      headers: {
        Authorization: `Token ${key}`,
        Accept: "application/json"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      `BSD API ${response.status}`
    );
  }

  return response.json();
}

function arrayFrom(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function getDate(fixture: any) {
  return (
    fixture?.time?.kickoff_at ??
    fixture?.kickoff ??
    fixture?.event_date ??
    fixture?.date ??
    fixture?.start_time ??
    fixture?.datetime ??
    null
  );
}

function getTeamId(team: any) {
  return Number(
    team?.id ??
    team?.team_id ??
    0
  );
}

function getTeamName(team: any) {
  return (
    team?.name ??
    team?.team_name ??
    "Unknown"
  );
}

function getHome(fixture: any) {
  return (
    fixture?.home ??
    fixture?.home_team ??
    fixture?.teams?.home ??
    {}
  );
}

function getAway(fixture: any) {
  return (
    fixture?.away ??
    fixture?.away_team ??
    fixture?.teams?.away ??
    {}
  );
}

function getScore(fixture: any) {
  const score = fixture?.score ?? {};

  const home =
    score.home ??
    fixture?.home_score ??
    fixture?.home_team_score;

  const away =
    score.away ??
    fixture?.away_score ??
    fixture?.away_team_score;

  if (
    home === undefined ||
    away === undefined ||
    home === null ||
    away === null
  ) {
    return null;
  }

  return `${home}–${away}`;
}

function getOpponent(
  fixture: any,
  teamId: number
) {
  const home = getHome(fixture);
  const away = getAway(fixture);

  const homeId = getTeamId(home);
  const awayId = getTeamId(away);

  if (homeId === teamId) {
    return getTeamName(away);
  }

  if (awayId === teamId) {
    return getTeamName(home);
  }

  return (
    fixture?.opponent?.name ??
    fixture?.opponent_name ??
    getTeamName(away) !== "Unknown"
      ? getTeamName(away)
      : getTeamName(home)
  );
}

function normaliseName(value: any) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function playerMatches(value: any) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const ids = [
    value?.id,
    value?.player_id,
    value?.player?.id,
    value?.player?.player_id
  ];

  if (
    ids.some(
      (id) =>
        Number(id) === PLAYER_ID
    )
  ) {
    return true;
  }

  const names = [
    value?.name,
    value?.player_name,
    value?.full_name,
    value?.player?.name,
    value?.player?.full_name
  ];

  return names.some((name) => {
    const normalised =
      normaliseName(name);

    return (
      normalised.includes("hamzachoudhury") ||
      normalised === "choudhury"
    );
  });
}

function hasMinutes(value: any) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const values = [
    value.minutes,
    value.minutes_played,
    value.played_minutes,
    value.min,
    value.games?.minutes,
    value.statistics?.minutes,
    value.statistics?.[0]?.minutes,
    value.statistics?.[0]?.games?.minutes
  ];

  return values.some((value) => {
    const number =
      Number(value);

    return (
      Number.isFinite(number) &&
      number > 0
    );
  });
}

function findPlayerInStats(
  value: any
): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(
      findPlayerInStats
    );
  }

  if (
    playerMatches(value) &&
    hasMinutes(value)
  ) {
    return true;
  }

  return Object.values(value).some(
    (child) =>
      child &&
      typeof child === "object" &&
      findPlayerInStats(child)
  );
}

function findPlayerInLineup(
  value: any
): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(
      findPlayerInLineup
    );
  }

  if (playerMatches(value)) {
    return true;
  }

  return Object.values(value).some(
    (child) =>
      child &&
      typeof child === "object" &&
      findPlayerInLineup(child)
  );
}

function findPlayerStatus(
  value: any
): {
  played: boolean;
  label: string;
  detail: string;
} {
  if (
    findPlayerInStats(value)
  ) {
    return {
      played: true,
      label: "YES",
      detail: "Played in the match."
    };
  }

  if (
    findPlayerInLineup(value)
  ) {
    return {
      played: true,
      label: "YES",
      detail: "Named in the match lineup."
    };
  }

  return {
    played: false,
    label: "NO",
    detail: "Did not play."
  };
}

function formatDate(value: any) {
  if (!value) {
    return "Date unavailable";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  ).format(date);
}

function formatTime(value: any) {
  if (!value) return "";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}

function fixtureLabel(
  fixture: any,
  teamId: number
) {
  const home = getHome(fixture);
  const away = getAway(fixture);

  const homeId = getTeamId(home);
  const awayId = getTeamId(away);

  const homeName =
    getTeamName(home);

  const awayName =
    getTeamName(away);

  if (homeId === teamId) {
    return `Sheffield United vs ${awayName}`;
  }

  if (awayId === teamId) {
    return `${homeName} vs Sheffield United`;
  }

  return `${homeName} vs ${awayName}`;
}

function availability(
  squadPlayer: any
) {
  const text =
    JSON.stringify(
      squadPlayer ?? {}
    ).toLowerCase();

  if (
    text.includes("suspend")
  ) {
    return {
      label: "Suspended",
      reason: "Suspension is listed.",
      className:
        "status status-red"
    };
  }

  if (
    text.includes("injur")
  ) {
    return {
      label: "Injured",
      reason: "An injury is listed.",
      className:
        "status status-red"
    };
  }

  if (
    text.includes("doubt")
  ) {
    return {
      label: "Doubtful",
      reason: "Listed as doubtful.",
      className:
        "status status-amber"
    };
  }

  return {
    label: "Likely available",
    reason:
      "No current injury, doubt or suspension is listed.",
    className:
      "status status-green"
  };
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
          <h1>DID HAMZA PLAY?</h1>
          <p>
            Waiting for football data.
          </p>
        </div>
      </main>
    );
  }

  const teamId =
    Number(data.team_id);

  let fixtures: any[] = [];
  let squadPlayer: any = null;
  let liveStatus = {
    played: false,
    label: "NO",
    detail: "Status unavailable."
  };

  try {
    const eventsResponse =
      await bsdGet(
        `/events/?team_id=${teamId}&status=finished&limit=20`
      );

    fixtures =
      arrayFrom(eventsResponse);

    fixtures.sort(
      (a, b) =>
        new Date(
          getDate(b)
        ).getTime() -
        new Date(
          getDate(a)
        ).getTime()
    );

    const latest =
      fixtures[0];

    if (latest?.id) {
      const [
        lineupResponse,
        statsResponse
      ] = await Promise.all([
        bsdGet(
          `/events/${latest.id}/lineups/`
        ),
        bsdGet(
          `/events/${latest.id}/player-stats/`
        )
      ]);

      liveStatus =
        findPlayerStatus({
          lineups: lineupResponse,
          playerStats: statsResponse
        });
    }

    const squadResponse =
      await bsdGet(
        `/teams/${teamId}/squad/`
      );

    const squad =
      arrayFrom(squadResponse);

    squadPlayer =
      squad.find(
        (player) =>
          Number(
            player?.id ??
            player?.player?.id
          ) === PLAYER_ID
      ) ?? null;
  } catch {
    liveStatus =
      data.last_fixture?.player_status ??
      liveStatus;
  }

  const last =
    fixtures[0] ??
    data.last_fixture ??
    {};

  const nextFixtures =
    fixtures.length > 0
      ? []
      : Array.isArray(
          data.next_fixtures
        )
      ? data.next_fixtures
      : [];

  let upcoming: any[] =
    Array.isArray(
      data.next_fixtures
    )
      ? data.next_fixtures
      : [];

  try {
    const upcomingResponse =
      await bsdGet(
        `/events/?team_id=${teamId}&status=notstarted&limit=10`
      );

    upcoming =
      arrayFrom(upcomingResponse);

    upcoming.sort(
      (a, b) =>
        new Date(
          getDate(a)
        ).getTime() -
        new Date(
          getDate(b)
        ).getTime()
    );
  } catch {
    // Use Supabase fallback.
  }

  const next =
    upcoming[0] ??
    null;

  const nextThree =
    upcoming.length > 0
      ? upcoming.slice(0, 3)
      : nextFixtures.slice(0, 3);

  const nextAvailability =
    availability(
      squadPlayer
    );

  const lastScore =
    getScore(last);

  return (
    <main className="page">
      <div className="container">

        <header className="header">
          <div className="eyebrow">
            <span className="live-dot" />
            HAMZA CHOUDHURY
          </div>

          <h1>
            DID HAMZA PLAY?
          </h1>

          <p className="intro">
            The simple answer to whether
            Hamza Choudhury featured for
            Sheffield United in their
            latest match.
          </p>
        </header>

        <section className="hero-card">
          <div className="match-info">

            <div className="section-label">
              LATEST MATCH
            </div>

            <h2>
              {fixtureLabel(
                last,
                teamId
              )}
            </h2>

            <div className="date">
              {formatDate(
                getDate(last)
              )}

              {formatTime(
                getDate(last)
              )
                ? ` · ${formatTime(
                    getDate(last)
                  )}`
                : ""}
            </div>

            {lastScore && (
              <div className="score">
                {lastScore}
              </div>
            )}

          </div>

          <div
            className={
              liveStatus.played
                ? "answer answer-yes"
                : "answer answer-no"
            }
          >
            {liveStatus.label}
          </div>

          <div className="why">
            <div className="section-label">
              WHY?
            </div>

            <div className="why-text">
              {liveStatus.detail}
            </div>
          </div>
        </section>

        <section className="next-card">

          <div className="section-label">
            WILL HAMZA PLAY NEXT?
          </div>

          {next ? (
            <>
              <h2>
                {fixtureLabel(
                  next,
                  teamId
                )}
              </h2>

              <div className="date">
                {formatDate(
                  getDate(next)
                )}

                {formatTime(
                  getDate(next)
                )
                  ? ` · ${formatTime(
                      getDate(next)
                    )}`
                  : ""}
              </div>

              <div className="availability-card">

                <div>
                  <div className="section-label dark">
                    AVAILABILITY
                  </div>

                  <div className="availability-title">
                    {nextAvailability.label}
                  </div>

                  <div className="availability-reason">
                    {nextAvailability.reason}
                  </div>
                </div>

                <div
                  className={
                    nextAvailability.className
                  }
                >
                  {nextAvailability.label.toUpperCase()}
                </div>

              </div>
            </>
          ) : (
            <p className="muted">
              No upcoming fixture is currently
              available.
            </p>
          )}

        </section>

        <section className="fixtures-section">

          <div className="section-label">
            NEXT 3 FIXTURES
          </div>

          <div className="fixtures">

            {nextThree.map(
              (
                fixture,
                index
              ) => (
                <div
                  className="fixture"
                  key={
                    fixture.id ??
                    index
                  }
                >
                  <div>
                    <div className="fixture-title">
                      {fixtureLabel(
                        fixture,
                        teamId
                      )}
                    </div>

                    <div className="date">
                      {formatDate(
                        getDate(
                          fixture
                        )
                      )}
                    </div>
                  </div>

                  <div className="fixture-number">
                    {index === 0
                      ? "NEXT"
                      : `#${index + 1}`}
                  </div>
                </div>
              )
            )}

          </div>
        </section>

        <footer>
          Data updated{" "}
          {formatDate(
            new Date()
          )}{" "}
          · Live BSD football data
        </footer>

      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #070b12;
          color: white;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at top right,
              #172033 0,
              #070b12 45%
            );
          padding: 48px 20px 70px;
        }

        .container {
          width: 100%;
          max-width: 1050px;
          margin: 0 auto;
        }

        .header {
          margin-bottom: 35px;
        }

        .eyebrow,
        .section-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.18em;
          color: #8d99aa;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .live-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #35d399;
          box-shadow:
            0 0 15px rgba(
              53,
              211,
              153,
              0.7
            );
        }

        h1 {
          margin: 14px 0 0;
          font-size: clamp(
            56px,
            11vw,
            120px
          );
          line-height: 0.9;
          letter-spacing: -0.07em;
          font-weight: 950;
        }

        .intro {
          max-width: 650px;
          margin: 22px 0 0;
          color: #8d99aa;
          font-size: 17px;
          line-height: 1.6;
        }

        .hero-card {
          overflow: hidden;
          background: white;
          color: #0b1018;
          border-radius: 28px;
          padding: 34px;
          box-shadow:
            0 30px 80px rgba(
              0,
              0,
              0,
              0.28
            );
        }

        .match-info {
          position: relative;
          padding-right: 200px;
        }

        .section-label {
          color: #7b8797;
        }

        .hero-card h2,
        .next-card h2 {
          margin: 9px 0 0;
          font-size: clamp(
            25px,
            4vw,
            38px
          );
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

        .date {
          margin-top: 8px;
          color: #718096;
          font-size: 14px;
        }

        .score {
          margin-top: 18px;
          font-size: 30px;
          font-weight: 900;
        }

        .answer {
          position: absolute;
          right: 34px;
          top: 34px;
          width: 145px;
          height: 145px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 32px;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .answer-yes {
          background: #16a36b;
        }

        .answer-no {
          background: #101722;
        }

        .why {
          margin-top: 30px;
          padding-top: 25px;
          border-top: 1px solid #e6e9ee;
        }

        .why-text {
          margin-top: 7px;
          font-size: 21px;
          font-weight: 800;
        }

        .next-card {
          margin-top: 20px;
          padding: 34px;
          border-radius: 28px;
          background: #111927;
          box-shadow:
            0 20px 60px rgba(
              0,
              0,
              0,
              0.2
            );
        }

        .next-card h2 {
          color: white;
        }

        .next-card .date {
          color: #8d99aa;
        }

        .availability-card {
          margin-top: 28px;
          padding: 24px;
          border-radius: 20px;
          background: white;
          color: #0b1018;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .dark {
          color: #718096;
        }

        .availability-title {
          margin-top: 7px;
          font-size: 28px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .availability-reason {
          margin-top: 7px;
          color: #667085;
          line-height: 1.5;
        }

        .status {
          padding: 9px 14px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        .status-green {
          background: #dff8ed;
          color: #08734b;
        }

        .status-amber {
          background: #fff0c7;
          color: #9a6500;
        }

        .status-red {
          background: #ffe1e1;
          color: #a52222;
        }

        .fixtures-section {
          margin-top: 38px;
        }

        .fixtures {
          display: grid;
          gap: 10px;
          margin-top: 13px;
        }

        .fixture {
          padding: 21px 23px;
          border-radius: 18px;
          background: #111927;
          border: 1px solid #1d2838;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .fixture-title {
          font-size: 17px;
          font-weight: 800;
        }

        .fixture-number {
          color: #7f8a9b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          white-space: nowrap;
        }

        .muted {
          color: #8d99aa;
          margin-top: 15px;
        }

        footer {
          margin-top: 35px;
          padding-top: 20px;
          border-top: 1px solid #1d2838;
          color: #657184;
          font-size: 12px;
        }

        @media (max-width: 700px) {
          .page {
            padding: 30px 14px 50px;
          }

          .hero-card,
          .next-card {
            padding: 24px;
            border-radius: 22px;
          }

          .match-info {
            padding-right: 0;
          }

          .answer {
            position: static;
            margin-top: 25px;
            width: 120px;
            height: 120px;
          }

          .availability-card {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
