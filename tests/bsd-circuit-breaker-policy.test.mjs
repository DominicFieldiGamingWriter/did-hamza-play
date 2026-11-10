import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BSD_RATE_LIMIT_BACKOFF_MS,
  getBsdProviderCode,
  getBsdRateLimitRetryAt,
  isBsdCircuitOpen
} from "../lib/bsd-circuit-breaker-policy.ts";

const NOW = Date.parse("2026-11-10T18:30:00.000Z");

test("Retry-After seconds are honoured", () => {
  const retryAt = getBsdRateLimitRetryAt(
    new Headers({ "retry-after": "120" }),
    "{}",
    NOW
  );

  assert.equal(rertyAt, "2026-11-10T18:32:00.000Z");
});

test("Retry-After HTTP dates are honoured", () => {
  const retryAt = getBsdRateLimitRetryAt(
    new Headers({ "retry-after": "Tue, 10 Nov 2026 19:00:00 GMT" }),
    "{}",
    NOW
  );

  assert.equal(retryAt, "2026-11-10T19:00:00.000Z");
});

test("daily taster quota errors cool down until the next UTC midnight", () => {
  const body = JSON.stringify({
    code: "taster_exhausted",
    detail: "Your daily request limit has been reached. Resets at midnight UTC."
  });

  assert.equal(getBsdProviderCode(body), "taster_exhausted");
  assert.equal(
    getBsdRateLimitRetryAt(new Headers(), body, NOW),
    "2026-11-11T00:00:00.000Z"
  );
});

test("taster quota code is detected in non-JSON response text", () => {
  assert.equal(
    getBsdRateLimitRetryAt(new Headers(), "BSD error: taster_exhausted", NOW),
    "2026-11-11T00:00:00.000Z"
  );
});

test("generic 429 responses use a bounded fallback cooldown", () => {
  const retryAt = getBsdRateLimitRetryAt(new Headers(), "Too many requests", NOW);

  assert.equal(
    Date.parse(retryAt),
    NOW + DEFAULT_BSD_RATE_LIMIT_BACKOFF_MS
  );
});

test("expired cooldowns do not keep the circuit open", () => {
  assert.equal(isBsdCircuitOpen("2026-11-10T19:00:00.000Z", NOW), true);
  assert.equal(isBsdCircuitOpen("2026-11-10T18:00:00.000Z", NOW), false);
  assert.equal(isBsdCircuitOpen(null, NOW), false);
});