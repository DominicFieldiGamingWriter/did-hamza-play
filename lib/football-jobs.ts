import { revalidatePath, revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import { getEvent, getFixtureIncidents, getFixturePlayerStats, getLineups, getUpcomingFixturesForTeam } from "./bsd";
import { buildLivePlayerStatus, normaliseIncidents, refreshPlayerPage } from "./refresh";
import { resolveTeamSheetStatus } from "./status";
import { trackBsdRefreshRun, withBsdUsageContext } from "./bsd-usage";
const PAGE_TAG = "hamza-player-page";
const IDLE_REFRESH_MS = 6 * 60 * 60 * 1000;
const DISCOVERY_MS = 3 * 60 * 60 * 1000;
const LIVE_MS = 5 * 60 * 1000;
const STATS_MS = 15 * 60 * 1000;
const POST_START_MS = 105 * 60 * 1000;
const POST_RETRY_MS = 10 * 60 * 1000;
const obj = (v: any): any => v && typeof v === "object" && !Array.isArray(v) ? v : {};
const idOf = (v: any): number => { const n = Number(v?.id ?? v?.event_id); return Number.isSafeInteger(n) && n > 0 ? n : 0; };
const kickoffOf = (v: any): string | null => { const d = v?.time?.kickoff_at ?? v?.time?.start_time ?? v?.kickoff_at ?? v?.kickoff ?? v?.event_date ?? v?.date ?? v?.start_time; return typeof d === "string" && Number.isFinite(Date.parse(d)) ? d : null; };
const statusOf = (v: any): string => String(v?.status ?? v?.time?.status ?? v?.event_status ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
function isFinal(v: any, id: number): boolean {
  const home = Number(v?.home_score ?? v?.score?.home ?? v?.scores?.home ?? v?.home_team_score);
  const away = Number(v?.away_score ?? v?.score?.away ?? v?.scores?.away ?? v?.away_team_score);
  return idOf(v) === id && ["finished","complete","completed","fulltime","afterextratime","afterpenalties"].includes(statusOf(v)) &&
    Number.isFinite(home) && home >= 0 && Number.isFinite(away) && away >= 0;
}
function isLive(v: any): boolean {
  return ["live","inprogress","inplay","1sthalf","halftime","2ndhalf","extratime","penaltyshootout","overtime"].includes(statusOf(v));
}
function isDefinitive(v: any, id: number): boolean {
  return Number(v?.lineup_fixture_id) === id && ["confirmed_start","confirmed_bench","confirmed_not_in_squad"].includes(String(v?.status ?? v?.type ?? ""));
}
async function claim(key: string, seconds: number): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin().rpc("claim_bsd_worker_lock", { p_job_key: key, p_lease_seconds: seconds });
  if (error) throw new Error("Worker lock claim failed: " + error.message);
  return data === true;
}
async function release(key: string, failure: string | null = null) {
  const { error } = await getSupabaseAdmin().from("bsd_worker_locks").update({
    lease_until: new Date(0).toISOString(), last_completed_at: new Date().toISOString(),
    last_error: failure, updated_at: new Date().toISOString()
  }).eq("job_key", key);
  if (error) console.error("BSD_WORKER_LOCK_RELEASE_FAILED", key, error.message);
}
async function readPage() {
  const { data, error } = await getSupabaseAdmin().from("player_page")
    .select("id, player_id, player_name, team_id, team_name, live_fixture, last_fixture, next_fixtures, player_status, updated_at, last_full_refresh_at, last_fixture_discovery_at")
    .eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Player page row is missing.");
  return data;
}
async function savePage(snapshot: any, patch: Record<string, any>) {
  const { data, error } = await getSupabaseAdmin().from("player_page").update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1).eq("updated_at", snapshot.updated_at).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
async function refreshView() { revalidateTag(PAGE_TAG, { expire: 0 }); revalidatePath("/"); }
function due(value: any, interval: number) {
  const t = typeof value === "string" ? Date.parse(value) : NaN;
  return !Number.isFinite(t) || Date.now() - t >= interval;
}
async function discoverFixtures(snapshot: any) {
  const teamId = Number(snapshot.team_id);
  if (!Number.isSafeInteger(teamId) || teamId <= 0) return { action: "missing_team_id" };
  const national = obj(obj(snapshot.player_status).national_team_reference);
  const nationalId = Number(national.id);
  const tasks = [withBsdUsageContext({ job_type: "fixture_discovery" }, () => getUpcomingFixturesForTeam(teamId))];
  if (Number.isSafeInteger(nationalId) && nationalId > 0 && nationalId !== teamId) {
    tasks.push(withBsdUsageContext({ job_type: "fixture_discovery" }, () => getUpcomingFixturesForTeam(nationalId)));
  }
  const [club, country = []] = await Promise.all(tasks);
  const now = Date.now();
  const newFixtures = [
    ...club.map((f: any) => ({ ...f, tracked_team_id: teamId, tracked_team_name: snapshot.team_name, tracked_team_type: "club", fixture_source: "bsd" })),
    ...country.map((f: any) => ({ ...f, tracked_team_id: nationalId, tracked_team_name: national.name ?? "", tracked_team_type: "national", fixture_source: "bsd" }))
  ].filter((f: any) => idOf(f) && kickoffOf(f) && Date.parse(kickoffOf(f)!) > now);
  const byId = new Map<number, any>();
  for (const f of Array.isArray(snapshot.next_fixtures) ? snapshot.next_fixtures : []) {
    const id = idOf(f), date = kickoffOf(f);
    if (id && date && Date.parse(date) > now) byId.set(id, f);
  }
  for (const f of newFixtures) byId.set(idOf(f), { ...(byId.get(idOf(f)) ?? {}), ...f });
  const upcoming = [...byId.values()].sort((a,b) => Date.parse(kickoffOf(a)!) - Date.parse(kickoffOf(b)!)).slice(0,12);
  const saved = await savePage(snapshot, { next_fixtures: upcoming, last_fixture_discovery_at: new Date().toISOString() });
  if (saved) await refreshView();
  return { action: saved ? "fixtures_discovered" : "write_conflict", fixture_count: upcoming.length };
}
async function updateLive(snapshot: any, fixture: any, eventId: number, kickoff: string, knownEvent?: any) {
  if (!due(fixture?.targeted_checked_at, LIVE_MS - 5000)) return { action: "live_not_due" };
  const event = knownEvent ?? await withBsdUsageContext({ job_type: "live_match_status", fixture_id: eventId }, () => getEvent(eventId));
  if (!event) throw new Error("BSD did not return the tracked match.");
  const now = Date.now(), checkedAt = new Date(now).toISOString();
  const pageStatus = obj(snapshot.player_status), monitor = obj(pageStatus.post_match_refresh);
  if (isFinal(event, eventId) && now < Date.parse(kickoff) + POST_START_MS) {
    const updated = { ...fixture, ...event, id: eventId, date: kickoff, targeted_checked_at: checkedAt };
    const nextMonitor = { ...monitor, active: true, completed: false, fixture_id: eventId, kickoff_at: kickoff, fixture: updated, started_at: monitor.started_at ?? checkedAt, next_check_at: new Date(Date.parse(kickoff) + POST_START_MS).toISOString() };
    const saved = await savePage(snapshot, { live_fixture: updated, player_status: { ...pageStatus, post_match_refresh: nextMonitor } });
    if (saved) await refreshView();
    return { action: saved ? "full_time_waiting_for_post_match_window" : "write_conflict" };
  }
  const refreshStats = due(fixture?.player_stats_checked_at, STATS_MS);
  const [rawIncidents, stats] = await Promise.all([
    withBsdUsageContext({ job_type: "live_match_incidents", fixture_id: eventId }, () => getFixtureIncidents(eventId)),
    refreshStats ? withBsdUsageContext({ job_type: "live_player_stats", fixture_id: eventId }, () => getFixturePlayerStats(eventId)) : Promise.resolve(fixture?.player_stats ?? [])
  ]);
  const incidents = await withBsdUsageContext({ job_type: "live_match_incidents", fixture_id: eventId }, () => normaliseIncidents(rawIncidents));
  const playerStats = Array.isArray(stats) ? stats : [];
  const base = { ...fixture, ...event, id: eventId, date: kickoff, incidents, player_stats: playerStats,
    targeted_checked_at: checkedAt, player_stats_checked_at: refreshStats ? checkedAt : fixture?.player_stats_checked_at ?? null };
  const liveStatus = await withBsdUsageContext({ job_type: "live_player_status", fixture_id: eventId },
    () => buildLivePlayerStatus(Number(snapshot.player_id), String(snapshot.player_name ?? ""), base, { incidents: rawIncidents, playerStats }));
  const updated = { ...base, player_status: liveStatus };
  const nextMonitor = { ...monitor, active: true, completed: false, fixture_id: eventId, kickoff_at: kickoff, fixture: updated,
    started_at: monitor.started_at ?? checkedAt, last_checked_at: checkedAt, next_check_at: new Date(Date.parse(kickoff) + POST_START_MS).toISOString() };
  const saved = await savePage(snapshot, { live_fixture: updated, player_status: { ...pageStatus, post_match_refresh: nextMonitor } });
  if (saved) await refreshView();
  return { action: saved ? "live_updated" : "write_conflict", fixture_id: eventId };
}
async function postMatchCheck(snapshot: any, fixture: any, eventId: number, kickoff: string, knownEvent?: any) {
  const pageStatus = obj(snapshot.player_status), monitor = obj(pageStatus.post_match_refresh);
  if (Date.now() < Date.parse(kickoff) + POST_START_MS) return { action: "post_match_not_due" };
  if (!due(monitor.last_checked_at, POST_RETRY_MS - 5000)) return { action: "post_match_retry_not_due" };
  const event = knownEvent ?? await withBsdUsageContext({ job_type: "post_match_status", fixture_id: eventId }, () => getEvent(eventId));
  if (!event) throw new Error("BSD did not return the tracked post-match event.");
  const checkedAt = new Date().toISOString();
  if (!isFinal(event, eventId)) {
    const nextMonitor = { ...monitor, active: true, completed: false, fixture_id: eventId, kickoff_at: kickoff,
      fixture: { ...fixture, ...event }, started_at: monitor.started_at ?? checkedAt, last_checked_at: checkedAt,
      attempts: Number(monitor.attempts ?? 0) + 1, last_error: null };
    const saved = await savePage(snapshot, { live_fixture: { ...fixture, ...event, targeted_checked_at: checkedAt }, player_status: { ...pageStatus, post_match_refresh: nextMonitor } });
    if (saved) await refreshView();
    return { action: saved ? "waiting_for_final_status" : "write_conflict", fixture_id: eventId };
  }
  const startedAt = Date.now();
  try {
    await withBsdUsageContext({ job_type: "post_match_reconciliation", fixture_id: eventId }, () => refreshPlayerPage());
    const refreshed = await readPage();
    if (idOf(refreshed.last_fixture) !== eventId || !isFinal(refreshed.last_fixture, eventId)) throw new Error("Full reconciliation did not confirm this fixture as the latest finished match.");
    const rs = obj(refreshed.player_status), rm = obj(rs.post_match_refresh), completedAt = new Date().toISOString();
    const saved = await savePage(refreshed, { player_status: { ...rs, post_match_refresh: {
      ...rm, active: false, completed: true, fixture_id: eventId, kickoff_at: kickoff,
      completed_at: completedAt, last_checked_at: completedAt, fixture: null, last_error: null
    } } });
    if (!saved) throw new Error("Concurrent update prevented saving post-match completion.");
    trackBsdRefreshRun({ started_at: new Date(startedAt).toISOString(), finished_at: completedAt, duration_ms: Date.now() - startedAt, result: "success", provider_code: null });
    await refreshView();
    return { action: "post_match_reconciled", fixture_id: eventId };
  } catch (error) {
    const latest = await readPage().catch(() => snapshot), ls = obj(latest.player_status), lm = obj(ls.post_match_refresh);
    const message = error instanceof Error ? error.message.slice(0,300) : "Post-match reconciliation failed.";
    await savePage(latest, { player_status: { ...ls, post_match_refresh: { ...lm, active: true, completed: false, fixture_id: eventId, kickoff_at: kickoff, fixture, last_checked_at: new Date().toISOString(), last_error: message } } });
    trackBsdRefreshRun({ started_at: new Date(startedAt).toISOString(), finished_at: new Date().toISOString(), duration_ms: Date.now() - startedAt, result: "error", provider_code: null });
    throw error;
  }
}
export async function runFootballScheduler() {
  const key = "main-scheduler";
  if (!(await claim(key, 270))) return { ok: true, skipped: true, reason: "already_running" };
  let failure: string | null = null;
  try {
    const snapshot = await readPage(), now = Date.now(), monitor = obj(obj(snapshot.player_status).post_match_refresh);
    const live = snapshot.live_fixture;
    const tracked = live && idOf(live) ? live : (idOf(monitor.fixture) === Number(monitor.fixture_id) ? monitor.fixture : null);
    const eventId = idOf(tracked), kickoff = kickoffOf(tracked);
    if (eventId && kickoff) {
      if (now >= Date.parse(kickoff) + POST_START_MS) return { ok: true, ...(await postMatchCheck(snapshot, tracked, eventId, kickoff)) };
      if (live && idOf(live) === eventId) return { ok: true, ...(await updateLive(snapshot, live, eventId, kickoff)) };
    }
    // A full refresh is not needed to discover that one of the known upcoming fixtures has kicked off.
    if (!live) {
      const started = (Array.isArray(snapshot.next_fixtures) ? snapshot.next_fixtures : [])
        .filter((f: any) => f?.fixture_source !== "fotmob" && idOf(f) && kickoffOf(f))
        .filter((f: any) => Date.parse(kickoffOf(f)!) <= now && Date.parse(kickoffOf(f)!) >= now - 6 * 60 * 60 * 1000)
        .sort((a: any,b: any) => Date.parse(kickoffOf(b)!) - Date.parse(kickoffOf(a)!));
      const candidate = started[0];
      if (candidate) {
        const candidateId = idOf(candidate), candidateKickoff = kickoffOf(candidate)!;
        if (now >= Date.parse(candidateKickoff) + POST_START_MS && due(monitor.last_checked_at, POST_RETRY_MS - 5000)) {
          const event = await withBsdUsageContext({ job_type: "post_match_status", fixture_id: candidateId }, () => getEvent(candidateId));
          if (event && (isFinal(event,candidateId) || isLive(event))) return { ok: true, ...(await postMatchCheck(snapshot,candidate,candidateId,candidateKickoff,event)) };
        } else {
          const event = await withBsdUsageContext({ job_type: "live_fixture_detection", fixture_id: candidateId }, () => getEvent(candidateId));
          if (event && (isLive(event) || isFinal(event,candidateId))) return { ok: true, ...(await updateLive(snapshot,candidate,candidateId,candidateKickoff,event)) };
        }
      }
    }
    if (due(snapshot.last_fixture_discovery_at, DISCOVERY_MS)) return { ok: true, ...(await discoverFixtures(snapshot)) };
    if (due(snapshot.last_full_refresh_at, IDLE_REFRESH_MS)) {
      const fixtures = Array.isArray(snapshot.next_fixtures) ? snapshot.next_fixtures : [];
      const lineupWindow = fixtures.some((f: any) => {
        const date = kickoffOf(f); if (!date || f?.fixture_source === "fotmob") return false;
        const minutes = (Date.parse(date) - now) / 60000; return minutes <= 65 && minutes >= -120;
      });
      if (!lineupWindow) {
        const startedAt = Date.now();
        await withBsdUsageContext({ job_type: "idle_full_refresh" }, () => refreshPlayerPage());
        trackBsdRefreshRun({ started_at: new Date(startedAt).toISOString(), finished_at: new Date().toISOString(), duration_ms: Date.now() - startedAt, result: "success", provider_code: null });
        await refreshView();
        return { ok: true, action: "idle_full_refresh" };
      }
    }
    return { ok: true, action: "nothing_due" };
  } catch (error) {
    failure = error instanceof Error ? error.message.slice(0,300) : "Scheduler failed.";
    throw error;
  } finally { await release(key, failure); }
}
export async function runLineupWorker() {
  const snapshot = await readPage();
  const candidates = (Array.isArray(snapshot.next_fixtures) ? snapshot.next_fixtures : [])
    .filter((f: any) => f && f.fixture_source !== "fotmob" && idOf(f) > 0 && kickoffOf(f))
    .sort((a: any,b: any) => Date.parse(kickoffOf(a)!) - Date.parse(kickoffOf(b)!));
  const fixture = candidates[0];
  if (!fixture) return { ok: true, action: "no_bsd_fixture" };
  const eventId = idOf(fixture), kickoff = kickoffOf(fixture)!;
  const minutes = (Date.parse(kickoff) - Date.now()) / 60000;
  if (minutes > 65 || minutes < -120) return { ok: true, action: "outside_lineup_window" };
  const status = obj(snapshot.player_status), existing = obj(status.next_match);
  if (isDefinitive(existing, eventId)) return { ok: true, action: "already_confirmed", status: existing.status };
  if (!due(existing.lineup_checked_at, 115000)) return { ok: true, action: "lineup_check_not_due" };
  const key = "lineup-" + eventId;
  if (!(await claim(key, 100))) return { ok: true, skipped: true, reason: "already_running" };
  let failure: string | null = null;
  try {
    let decision: any;
    try {
      const data = await withBsdUsageContext({ job_type: "lineup", fixture_id: eventId }, () => getLineups(eventId));
      decision = resolveTeamSheetStatus(Number(snapshot.player_id), data);
    } catch (error) {
      failure = error instanceof Error ? error.message.slice(0,300) : "Lineup request failed.";
      decision = resolveTeamSheetStatus(Number(snapshot.player_id), null);
      decision.reason = "The official lineup feed could not be reached. The scheduled checker will retry.";
    }
    const checkedAt = new Date().toISOString();
    const result = { ...decision, lineup_fixture_id: eventId, lineup_checked_at: checkedAt, fixture_kickoff: kickoff };
    const saved = await savePage(snapshot, { player_status: { ...status, next_match: result } });
    if (saved) await refreshView();
    return { ok: true, action: saved ? "lineup_checked" : "write_conflict", fixture_id: eventId, status: result.status };
  } finally { await release(key, failure); }
}
