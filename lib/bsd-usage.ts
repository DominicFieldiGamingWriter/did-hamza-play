import { after } from "next/server";
import { AsyncLocalStorage } from "node:async_hooks";
import { getSupabaseAdmin } from "./supabase";
type UsageContext = { job_type: string; fixture_id?: number | null };
const context = new AsyncLocalStorage<UsageContext>();
export function withBsdUsageContext<T>(value: UsageContext, work: () => Promise<T>): Promise<T> { return context.run(value, work); }
type ApiRecord = {
  requested_at: string; endpoint: string; http_status: number | null; latency_ms: number;
  outcome: "success" | "http_error" | "network_error"; provider_code: string | null;
  rate_limit_limit: number | null; rate_limit_remaining: number | null; rate_limit_reset_at: string | null;
};
type RunRecord = { started_at: string; finished_at: string; result: "success" | "skipped_rate_limited" | "error"; duration_ms: number; provider_code: string | null };
function enrich(record: any) { const c = context.getStore(); return { ...record, site: "hamza", job_type: c?.job_type ?? "full_refresh", fixture_id: c?.fixture_id ?? null }; }
async function send(kind: "api_request" | "refresh_run", record: any) {
  const table = kind === "api_request" ? "bsd_api_usage_events" : "bsd_api_refresh_runs";
  const { error } = await getSupabaseAdmin().from(table).insert(record);
  if (error) throw error;
}
export async function trackBsdApiRequest(record: ApiRecord) {
  try { await send("api_request", enrich(record)); } catch (error) { console.error("BSD_USAGE_WRITE_FAILED", error); }
}
export function trackBsdRefreshRun(record: RunRecord) {
  try { after(async () => { try { await send("refresh_run", enrich(record)); } catch (error) { console.error("BSD_USAGE_WRITE_FAILED", error); } }); }
  catch (error) { console.error("BSD_USAGE_SCHEDULING_FAILED", error); }
}
