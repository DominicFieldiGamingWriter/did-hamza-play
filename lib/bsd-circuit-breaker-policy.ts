export const DEFAULT_BSD_RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000;

function futureTimestampFromHeader(
  value: string | null,
  nowMs: number,
  smallNumberIsDelay: boolean
): number | null {
  if (!value) return null;

  const numeric = Number(value.trim());
  if (Number.isFinite(numeric)) {
    let timestamp: number;

    if (numeric > 1_000_000_000_000) {
      timestamp = numeric;
    } else if (numeric > 1_000_000_000) {
      timestamp = numeric * 1000;
    } else if (smallNumberIsDelay && numeric >= 0) {
      timestamp = nowMs + numeric * 1000;
    } else {
      timestamp = Number.NaN;
    }

    if (Number.isFinite(timestamp) && timestamp > nowMs) {
      return timestamp;
    }
  }

  const parsedDate = Date.parse(value);
  return Number.isFinite(parsedDate) && parsedDate > nowMs
    ? parsedDate
    : null;
}

export function getBsdProviderCode(responseBody: string): string | null {
  try {
    const payload = JSON.parse(responseBody) as {
      code?: unknown;
      error_code?: unknown;
      error?: { code?: unknown } | string;
    };
    const candidate =
      payload.code ??
      payload.error_code ??
      (typeof payload.error === "object" ? payload.error?.code : null);

    return typeof candidate === "string" && candidate.trim()
      ? candidate.trim().toLowerCase().slice(0, 80)
      : null;
  } catch {
    return null;
  }
}

export function getBsdRateLimitRetryAt(
  headers: Headers,
  responseBody: string,
  nowMs = Date.now()
): string {
  const retryAfter = futureTimestampFromHeader(
    headers.get("retry-after"),
    nowMs,
    true
  );
  if (retryAfter !== null) {
    return new Date(retryAfter).toISOString();
  }

  for (const headerName of [
    "x-ratelimit-reset",
    "ratelimit-reset",
    "x-rate-limit-reset"
  ]) {
    const resetAt = futureTimestampFromHeader(
      headers.get(headerName),
      nowMs,
      true
    );
    if (resetAt !== null) {
      return new Date(resetAt).toISOString();
    }
  }

  const providerCode = getBsdProviderCode(responseBody);
  const dailyQuotaReached =
    providerCode === "taster_exhausted" ||
    /taster[_ -]exhausted/i.test(responseBody) ||
    /daily.{0,100}(?:rate|request).{0,100}(?:limit|quota).{0,100}(?:reached|exceeded)/i.test(responseBody) ||
    /resets?\s+at\s+midnight\s+UTC/i.test(responseBody);

  if (dailyQuotaReached) {
    const now = new Date(nowMs);
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    )).toISOString();
  }

  return new Date(nowMs + DEFAULT_BSD_RATE_LIMIT_BACKOFF_MS).toISOString();
}

export function isBsdCircuitOpen(
  blockedUntil: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!blockedUntil) return false;
  const timestamp = Date.parse(blockedUntil);
  return Number.isFinite(timestamp) && timestamp > nowMs;
}
