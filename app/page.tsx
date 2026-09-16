import { getSupabaseAdmin } from "@/lib/supabase";

function formatDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getOpponent(fixture: any, teamId: number) {
  if (!fixture) return "Opponent unavailable";

  if (fixture.home_team?.id === teamId) {
    return (
      fixture.away_team?.name ??
      fixture.away_team_name ??
      "Opponent unavailable"
    );
  }

  if (fixture.away_team?.id === teamId) {
    return (
      fixture.home_team?.name ??
      fixture.home_team_name ??
      "Opponent unavailable"
    );
  }

  return (
    fixture.opponent?.name ??
    fixture.opponent_name ??
    "Opponent unavailable"
  );
}

function getScore(fixture: any) {
  if (!fixture) return "";

  const home =
    fixture.home_score ??
    fixture.home_team_score ??
    fixture.score?.home;

  const away =
    fixture.away_score ??
    fixture.away_team_score ??
    fixture.score?.away;

  if (home === undefined || away === undefined) {
    return "";
  }

  return `${home}–${away}`;
}

function availabilityStyle(type: string) {
  if (type === "injured" || type === "suspended") {
    return {
      badge: "bg-red-100 text-red-700",
      dot: "bg-red-500"
    };
  }

  if (type === "doubtful") {
    return {
      badge: "bg-amber-100 text-amber-700",
      dot: "bg-amber-500"
    };
  }

  return {
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500"
  };
}

export default async function Home() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("player_page")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">
              DID HAMZA PLAY?
            </p>
            <h1 className="mt-4 text-3xl font-bold">
              Waiting for match data
            </h1>
            <p className="mt-3 text-slate-400">
              The site will populate after the next data refresh.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const last = data.last_fixture ?? {};
  const nextFixtures = Array.isArray(data.next_fixtures)
    ? data.next_fixtures
    : [];

  const lastStatus = last.player_status ?? {};
  const nextStatus = data.player_status?.next_match ?? {};

  const played = Boolean(lastStatus.played);

  const nextFixture = nextFixtures[0] ?? null;

  const opponent = getOpponent(
    last,
    Number(data.team_id)
  );

  const nextOpponent = getOpponent(
    nextFixture,
    Number(data.team_id)
  );

  const availability = availabilityStyle(
    nextStatus.type ?? "likely_available"
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">

        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Hamza Choudhury
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
            DID HAMZA PLAY?
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            A simple answer to whether Hamza Choudhury featured for
            Sheffield United in the latest match.
          </p>
        </header>

        {/* Latest match */}
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white">
          <div className="px-6 py-8 text-slate-950 sm:px-10 sm:py-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                  Latest match
                </p>

                <h2 className="mt-3 text-2xl font-bold">
                  Sheffield United vs {opponent}
                </h2>

                <p className="mt-2 text-slate-500">
                  {formatDate(last.date ?? last.start_time)}
                  {formatTime(last.date ?? last.start_time)
                    ? ` · ${formatTime(last.date ?? last.start_time)}`
                    : ""}
                </p>

                {getScore(last) && (
                  <p className="mt-3 text-lg font-semibold">
                    {getScore(last)}
                  </p>
                )}
              </div>

              <div
                className={`flex h-36 w-36 shrink-0 items-center justify-center rounded-full ${
                  played
                    ? "bg-emerald-500"
                    : "bg-slate-900"
                }`}
              >
                <span className="text-4xl font-black text-white">
                  {played ? "YES" : "NO"}
                </span>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-slate-500">
                Why?
              </p>

              <p className="mt-2 text-xl font-semibold">
                {lastStatus.label ?? "Status unavailable"}
              </p>
            </div>
          </div>
        </section>

        {/* Next match */}
        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Will Hamza play next?
          </p>

          {nextFixture ? (
            <>
              <div className="mt-5">
                <h2 className="text-3xl font-black">
                  Sheffield United vs {nextOpponent}
                </h2>

                <p className="mt-2 text-slate-400">
                  {formatDate(
                    nextFixture.date ??
                    nextFixture.start_time
                  )}
                  {formatTime(
                    nextFixture.date ??
                    nextFixture.start_time
                  )
                    ? ` · ${formatTime(
                        nextFixture.date ??
                        nextFixture.start_time
                      )}`
                    : ""}
                </p>
              </div>

              <div className="mt-8 rounded-2xl bg-white p-5 text-slate-950">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.15em] text-slate-500">
                      Availability
                    </p>

                    <div className="mt-2 flex items-center gap-3">
                      <span
                        className={`h-3 w-3 rounded-full ${availability.dot}`}
                      />

                      <span className="text-2xl font-black">
                        {nextStatus.label ??
                          "Status unavailable"}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-bold ${availability.badge}`}
                  >
                    {nextStatus.type === "injured"
                      ? "INJURED"
                      : nextStatus.type === "suspended"
                      ? "SUSPENDED"
                      : nextStatus.type === "doubtful"
                      ? "DOUBTFUL"
                      : "AVAILABLE"}
                  </div>
                </div>

                {nextStatus.reason && (
                  <p className="mt-4 border-t border-slate-200 pt-4 text-slate-600">
                    {nextStatus.reason}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-5 text-slate-400">
              No upcoming fixture is currently available.
            </p>
          )}
        </section>

        {/* Fixtures */}
        <section className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Next 3 fixtures
          </p>

          <div className="mt-4 grid gap-4">
            {nextFixtures.map((fixture: any, index: number) => (
              <div
                key={fixture.id ?? index}
                className="rounded-2xl border border-white/10 bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold">
                      Sheffield United vs{" "}
                      {getOpponent(
                        fixture,
                        Number(data.team_id)
                      )}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {formatDate(
                        fixture.date ??
                        fixture.start_time
                      )}
                    </p>
                  </div>

                  <span className="text-sm font-bold text-slate-500">
                    {index === 0
                      ? "NEXT"
                      : `#${index + 1}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-white/10 pt-6 text-sm text-slate-500">
          Data updated{" "}
          {formatDate(data.updated_at)} at{" "}
          {formatTime(data.updated_at)}
        </footer>
      </div>
    </main>
  );
}
