import { getSupabaseAdmin } from "@/lib/supabase";

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(date));
}

function fixtureLabel(f: any) {
  const home = f.teams.home;
  const away = f.teams.away;
  return `${home.name} ${home.winner === true ? "✓" : ""} ${f.goals.home ?? "-"}–${f.goals.away ?? "-"} ${away.name} ${away.winner === true ? "✓" : ""}`;
}

export default async function Home() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("player_page").select("*").eq("id", 1).maybeSingle();

  if (!data) {
    return (
      <main className="page">
        <section className="hero">
          <p className="eyebrow">DID HAMZA PLAY?</p>
          <h1>Waiting for the first data refresh.</h1>
          <p className="muted">Set your API key and run the refresh endpoint once.</p>
        </section>
      </main>
    );
  }

  const status = data.player_status ?? {};
  const last = data.last_fixture;
  const next = data.next_fixtures ?? [];

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">DID HAMZA PLAY?</p>
        <h1 className={status.played ? "yes" : "no"}>{status.played ? "YES" : "NO"}</h1>
        <p className="status-detail">
          {status.label}{status.minutes !== undefined ? ` · ${status.minutes} min` : ""}
          {!status.played && status.detail ? ` · ${status.detail}` : ""}
        </p>
        <p className="updated">
          Updated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updated_at))}
        </p>
      </section>

      <section className="card">
        <div className="section-title">LAST MATCH</div>
        <div className="fixture-result">
          <div>{last.teams.home.name}</div>
          <strong>{last.goals.home ?? "-"} – {last.goals.away ?? "-"}</strong>
          <div>{last.teams.away.name}</div>
        </div>
        <div className="meta">{dateLabel(last.fixture.date)} · {status.played ? `${status.label} · ${status.minutes ?? 0} min` : status.detail}</div>
      </section>

      <section className="card">
        <div className="section-title">NEXT THREE</div>
        <div className="fixtures">
          {next.map((f: any) => {
            const home = f.teams.home.id === data.team_id;
            return (
              <div className="fixture-row" key={f.fixture.id}>
                <span>{dateLabel(f.fixture.date)}</span>
                <strong>{home ? "vs" : "at"} {home ? f.teams.away.name : f.teams.home.name}</strong>
                <span>{f.league.name}</span>
              </div>
            );
          })}
        </div>
      </section>

      <footer>
        Data supplied by API-Football. <span>Last refresh: {new Date(data.updated_at).toISOString()}</span>
      </footer>
    </main>
  );
}
