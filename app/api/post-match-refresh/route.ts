import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { refreshPlayerPage } from "../../../lib/refresh";
import { getSupabaseAdmin } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const START_AFTER_MS = 105 * 60_000;
const COOLDOWN_MS = 55_000;

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}
function getId(value: any): number {
  const id = Number(value?.id ?? value?.event_id);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}
function getKickoff(value: any): string | null {
  const date = value?.time?.kickoff_at ?? value?.time?.start_time ?? value?.kickoff_at ?? value?.kickoff ?? value?.event_date ?? value?.date ?? value?.start_time ?? null;
  return typeof date === "string" && Number.isFinite(Date.parse(date)) ? date : null;
}
function getScore(fixture: any, side: "home" | "away"): number | null {
  const raw = fixture?.[side === "home" ? "home_score" : "away_score"] ?? fixture?.score?.[side] ?? fixture?.scores?.[side] ?? fixture?.[side === "home" ? "home_team_score" : "away_team_score"] ?? null;
  if (raw === null || raw === undefined || raw === "") return null;
  const score = Number(raw);
  return Number.isFinite(score) && score >= 0 ? score : null;
}
function isFinal(fixture: any, eventId: number): boolean {
  const status = String(fixture?.status ?? fixture?.time?.status ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return getId(fixture) === eventId && ["finished", "complete", "completed", "fulltime"].includes(status) && getScore(fixture, "home") !== null && getScore(fixture, "away") !== null;
}
async function invalidatePage() {
  revalidateTag("hamza-player-page", { expire: 0 });
  revalidatePath("/");
}

export async function POST(request: Request) {
  let eventId = 0;
  try { eventId = Number((await request.json())?.event_id); }
  catch { return json({ ok: false, error: "A valid event_id is required." }, 400); }
  if (!Number.isSafeInteger(eventId) || eventId <= 0) return json({ ok: false, error: "A valid event_id is required." }, 400);

  const supabase = getSupabaseAdmin();
  try {
    const { data, error } = await supabase.from("player_page").select("live_fixture, last_fixture, player_status, updated_at").eq("id", 1).maybeSingle();
    if (error) throw error;
    if (!data) return json({ ok: false, error: "Player data is unavailable." }, 503);
    const playerStatus = data.player_status && typeof data.player_status === "object" ? data.player_status : {};
    const monitor = playerStatus.post_match_refresh && typeof playerStatus.post_match_refresh === "object" ? playerStatus.post_match_refresh : {};
    if (Number(monitor.fixture_id) === eventId && monitor.completed === true && monitor.active === false) return json({ ok: true, completed: true, already_completed: true });

    const liveFixture = getId(data.live_fixture) === eventId ? data.live_fixture : null;
    const monitorFixture = getId(monitor.fixture) === eventId ? monitor.fixture : null;
    if (getId(data.last_fixture) === eventId && isFinal(data.last_fixture, eventId)) {
      const completedAt = new Date().toISOString();
      const { error: doneError } = await supabase.from("player_page").update({
        player_status: { ...playerStatus, post_match_refresh: { ...monitor, active: false, completed: true, fixture_id: eventId, completed_at: completedAt, last_checked_at: completedAt, fixture: null } },
        updated_at: completedAt
      }).eq("id", 1);
      if (doneError) throw doneError;
      await invalidatePage();
      return json({ ok: true, completed: true, already_completed: true });
    }
    if (!liveFixture && !monitorFixture) return json({ ok: false, error: "This event is not the current live match or an active post-match check." }, 404);

    const kickoff = (typeof monitor.kickoff_at === "string" && Number.isFinite(Date.parse(monitor.kickoff_at)) ? monitor.kickoff_at : null) ?? getKickoff(liveFixture ?? monitorFixture);
    if (!kickoff) return json({ ok: false, error: "The match kick-off time is unavailable." }, 422);
    const firstCheckAt = Date.parse(kickoff) + START_AFTER_MS;
    const now = Date.now();
    if (now < firstCheckAt) return json({ ok: true, completed: false, not_started: true, first_check_at: new Date(firstCheckAt).toISOString() });
    const lastCheckedAt = typeof monitor.last_checked_at === "string" ? Date.parse(monitor.last_checked_at) : NaN;
    if (Number.isFinite(lastCheckedAt) && now - lastCheckedAt < COOLDOWN_MS) return json({ ok: true, completed: false, skipped: true, last_checked_at: monitor.last_checked_at });
    if (!data.updated_at) return json({ ok: false, error: "The page update timestamp is unavailable." }, 503);

    const checkedAt = new Date(now).toISOString();
    const sourceFixture = liveFixture ?? monitorFixture;
    const claimedMonitor = { ...monitor, active: true, completed: false, fixture_id: eventId, kickoff_at: kickoff, fixture: sourceFixture, started_at: monitor.started_at ?? checkedAt, last_checked_at: checkedAt, attempts: Number(monitor.attempts ?? 0) + 1 };
    // Compare-and-set on updated_at prevents multiple visitors making duplicate BSD requests.
    const { data: claim, error: claimError } = await supabase.from("player_page").update({ player_status: { ...playerStatus, post_match_refresh: claimedMonitor }, updated_at: checkedAt }).eq("id", 1).eq("updated_at", data.updated_at).select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claim) return json({ ok: true, completed: false, skipped: true });

    try { await refreshPlayerPage(); }
    catch (refreshError) {
      console.error("Post-match refresh failed:", refreshError);
      const { data: failedRow } = await supabase.from("player_page").select("player_status").eq("id", 1).maybeSingle();
      const failedStatus = failedRow?.player_status && typeof failedRow.player_status === "object" ? failedRow.player_status : playerStatus;
      await supabase.from("player_page").update({ player_status: { ...failedStatus, post_match_refresh: { ...claimedMonitor, active: true, completed: false, last_error: "The provider refresh failed; the next check will retry." } } }).eq("id", 1);
      return json({ ok: true, completed: false, refreshed: false });
    }

    const { data: refreshed, error: readError } = await supabase.from("player_page").select("live_fixture, last_fixture, player_status").eq("id", 1).maybeSingle();
    if (readError) throw readError;
    if (!refreshed) throw new Error("The refreshed page record could not be read.");
    const refreshedStatus = refreshed.player_status && typeof refreshed.player_status === "object" ? refreshed.player_status : {};
    const refreshedMonitor = refreshedStatus.post_match_refresh && typeof refreshedStatus.post_match_refresh === "object" ? refreshedStatus.post_match_refresh : claimedMonitor;
    const completed = isFinal(refreshed.last_fixture, eventId);
    const latestLiveFixture = getId(refreshed.live_fixture) === eventId ? refreshed.live_fixture : null;
    const finalMonitor = completed
      ? { ...refreshedMonitor, active: false, completed: true, fixture_id: eventId, kickoff_at: kickoff, completed_at: checkedAt, last_checked_at: checkedAt, fixture: null, last_error: null }
      : { ...refreshedMonitor, active: true, completed: false, fixture_id: eventId, kickoff_at: kickoff, fixture: latestLiveFixture ?? refreshedMonitor.fixture ?? sourceFixture, last_checked_at: checkedAt, last_error: null };
    const { error: saveError } = await supabase.from("player_page").update({ player_status: { ...refreshedStatus, post_match_refresh: finalMonitor }, updated_at: checkedAt }).eq("id", 1);
    if (saveError) throw saveError;
    await invalidatePage();
    return json({ ok: true, completed, refreshed: true, fixture_id: eventId, last_checked_at: checkedAt });
  } catch (error) {
    console.error("Post-match refresh route failed:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Post-match refresh failed." }, 500);
  }
}
