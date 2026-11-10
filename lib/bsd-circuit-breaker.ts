import { getSupabaseAdmin } from "./supabase";
import {
  getBsdProviderCode,
  getBsdRateLimitRetryAt,
  isBsdCircuitOpen
} from "./bsd-circuit-breaker-policy";

const CACHE_TTL_MS = 5_000;

type CachedCircuitState = {
  checkedAt: number;
  blockedUntil: string | null;
  providerCode: string | null;
};

export class BsdApiCircuitOpenError extends Error {
  retryAt: string;
  providerCode: string | null;

  constructor(retryAt: string, providerCode: string | null = null) {
    super("BSD API rate-limit circuit is open until " + retryAt + ".");
    this.name = "BsdApiCircuitOpenError";
    this.retryAt = retryAt;
    this.providerCode = providerCode;
  }
}

let cachedState: CachedCircuitState | null = null;
let pendingRead: Promise<CachedCircuitState> | null = null;

async function readCircuitState(): Promise<CachedCircuitState> {
  const now = Date.now();
  if (cachedState && now - cachedState.checkedAt < CACHE_TTL_MS) {
    return cachedState;
  }
  if (pendingRead) return pendingRead;

  pendingRead = (async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("bsd_api_circuit_breaker")
      .select("blocked_until, provider_code")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      throw new Error("Could not read BSD API circuit-breaker state: " + error.message);
    }

    cachedState = {
      checkedAt: Date.now(),
      blockedUntil: typeof data?.blocked_until === "string" ? data.blocked_until : null,
      providerCode: typeof data?.provider_code === "string" ? data.provider_code : null
    };

    return cachedState;
  })();

  try {
    return await pendingRead;
  } finally {
    pendingRead = null;
  }
}

export async function assertBsdApiCircuitClosed(): Promise<void> {
  const state = await readCircuitState();
  if (isBsdCircuitOpen(state.blockedUntil) && state.blockedUntil) {
    throw new BsdApiCircuitOpenError(state.blockedUntil, state.providerCode);
  }
}

export async function recordBsdApiRateLimit(
  headers: Headers,
  responseBody: string
): Promise<BsdApiCircuitOpenError> {
  const now = Date.now();
  const retryAt = getBsdRateLimitRetryAt(headers, responseBody, now);
  const providerCode = getBsdProviderCode(responseBody);
  const reason = providerCode === "taster_exhausted"
    ? "Daily BSD API quota exhausted"
    : "BSD API returned a rate-limit response";
  const nowIso = new Date(now).toISOString();

  // Stop this warm serverless instance immediately, before the next request.
  cachedState = {
    checkedAt: now,
    blockedUntil: retryAt,
    providerCode
  };

  const { error } = await getSupabaseAdmin()
    .from("bsd_api_circuit_breaker")
    .upsert({
      id: 1,
      blocked_until: retryAt,
      last_triggered_at: nowIso,
      http_status: 429,
      provider_code: providerCode,
      reason,
      updated_at: nowIso
    }, { onConflict: "id" });

  if (error) {
    throw new Error("BSD API returned HTTP 429, but the cooldown could not be persisted: " + error.message);
  }

  return new BsdApiCircuitOpenError(retryAt, providerCode);
}
