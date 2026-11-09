import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compactFixture(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const fixture = value as AnyRecord;
  const home = fixture.home_team ?? fixture.home ?? fixture.teams?.home ?? null;
  const away = fixture.away_team ?? fixture.away ?? fixture.teams?.away ?? null;
  const incidents = Array.isArray(fixture.incidents)
    ? fixture.incidents.map((item: AnyRecord) => ({
        type: item.type ?? null,
        minute: item.minute ?? null,
        added_time: item.added_time ?? null,
        player_id: item.player_id ?? null,
        player_name: item.player_name ?? null,
        card_type: item.card_type ?? null,
        is_red_card: item.is_red_card ?? false,
        goal_type: item.goal_type ?? null,
        player_in_id: item.player_in_id ?? null,
        player_out_id: item.player_out_id ?? null,
        player_in_name: item.player_in_name ?? null,
        player_out_name: item.player_out_name ?? null
      }))
    : [];

  return {
    id: fixture.id ?? null,
    date: fixture.date ?? fixture.event_date ?? null,
    status: fixture.status ?? fixture.time?.status ?? null,
    period: fixture.period ?? fixture.time?.period ?? null,
    current_minute: fixture.current_minute ?? fixture.time?.minute ?? null,
    home: text(home?.name ?? fixture.home_team_name ?? fixture.home_name),
    away: text(away?.name ?? fixture.away_team_name ?? fixture.away_name),
    home_score: fixture.home_score ?? fixture.score?.home ?? null,
    away_score: fixture.away_score ?? fixture.score?.away ?? null,
    home_score_ht: fixture.home_score_ht ?? null,
    away_score_ht: fixture.away_score_ht ?? null,
    incidents
  };
}

function compactNextStatus(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const status = value as AnyRecord;
  return {
    type: status.type ?? status.status ?? null,
    label: status.label ?? null,
    phase: status.phase ?? null,
    reason: status.reason ?? null
  };
}

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("player_page")
      .select("player_name, team_name, updated_at, last_fixture, live_fixture, next_fixtures, player_status")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json({ ok: false, error: "Player page row is missing." }, {
        status: 503,
        headers: { "Cache-Control": "no-store" }
      });
    }

    const status = (data.player_status ?? {}) as AnyRecord;
    const nextFixtures = Array.isArray(data.next_fixtures) ? data.next_fixtures : [];
    const nextMatchStatus = status.next_match ?? null;
    const latestStatus = status.latest_match ?? status;

    return Response.json({
      ok: true,
      sport: "football",
      player: data.player_name,
      trackedTeam: data.team_name,
      dataUpdatedAt: data.updated_at,
      latestMatch: compactFixture(data.last_fixture),
      liveMatch: compactFixture(data.live_fixture),
      nextFixtures: nextFixtures.slice(0, 5).map(compactFixture),
      appearance: latestStatus?.appearance ?? data.last_fixture?.player_status?.appearance ?? null,
      latestPlayerStatus: {
        type: latestStatus?.type ?? null,
        label: latestStatus?.label ?? null,
        played: latestStatus?.played ?? null
      },
      nextMatchStatus: compactNextStatus(nextMatchStatus)
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  }
}
