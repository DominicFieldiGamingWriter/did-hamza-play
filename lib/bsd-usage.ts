import { after } from "next/server";
import { getSupabaseAdmin } from "./supabase";

type ApiUsageRecord = {
  requested_at: string;
  endpoint: string;
  http_status: number | null;
  latency_ms: number;
  outcome: "success" | "http_error" | "network_error";
  provider_code: string | null;
  rate_limit_limit: number | null;
  rate_limit_remaining: number | null;
  rate_limit_reset_at: string | null;
};

type RefreshUsageRecord = {
  started_at: string;
  finished_at: string;
  result: "success" | "skipped_rate_limited" | "error";
  duration_ms: number;
  provider_code: string | null;
};

type UsagePayload =
  | { kind: "api_request"; record: ApiUsageRecord & { site: "hamza" | "ben" } }
  | { kind: "refresh_run"; record: RefreshUsageRecord & { site: "hamza" | "ben" } };

const SITE: "hamza" | "ben" = "hamza";

function scheduleUsageWrite(payload: UsagePayload) {
  try {
    after(async () => {
      try {
        if (SITE === "hamza") {
          const admin = getSupabaseAdmin();
          if (payload.kind === "api_request") {
            const { error } = await admin
              .from("bsd_api_usage_events")
              .insert(payload.record);
            if (error) throw error;
          } else {
            const { error } = await admin
              .from("bsd_api_refresh_runs")
              .insert(payload.record);
            if (error) throw error;
          }
          return;
        }

        const secret = process.env.BSD_USAGE_INGEST_SECRET;
        if (!secret) {
          throw new Error("BSD_USAGE_INGEST_SECRET is not configured.");
        }

        const response = await fetch(
          "https://www.didhamzaplay.com/api/admin/bsd-usage-ingest",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secret}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(`Usage ingestion returned HTTP ${response.status}.`);
        }
      } catch (error) {
        console.error("BSD_USAGE_WRITE_FAILED", error);
      }
    });
  } catch (error) {
    console.error("BSD_USAGE_SCHEDULING_FAILED", error);
  }
}

export function trackBsdApiRequest(record: ApiUsageRecord) {
  scheduleUsageWrite({
    kind: "api_request",
    record: { ...record, site: SITE }
  });
}

export function trackBsdRefreshRun(record: RefreshUsageRecord) {
  scheduleUsageWrite({
    kind: "refresh_run",
    record: { ...record, site: SITE }
  });
}
