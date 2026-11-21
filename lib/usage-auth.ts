
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const USAGE_SESSION_COOKIE = "bsd_api_usage_session";
const SESSION_SECONDS = 14 * 24 * 60 * 60;

function dashboardPassword() {
  return process.env.BSD_USAGE_DASHBOARD_PASSWORD ?? "";
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyUsagePassword(candidate: string) {
  const expected = dashboardPassword();
  return Boolean(expected) && safeEqual(candidate, expected);
}

export function createUsageSessionToken() {
  const password = dashboardPassword();
  if (!password) throw new Error("BSD_USAGE_DASHBOARD_PASSWORD is not configured.");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const signature = createHmac("sha256", password).update(String(expiresAt)).digest("hex");
  return `${expiresAt}.${signature}`;
}

function isValidUsageSessionToken(token: string) {
  const password = dashboardPassword();
  const [expiryValue, suppliedSignature] = token.split(".");
  const expiresAt = Number(expiryValue);
  if (!password || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expectedSignature = createHmac("sha256", password).update(String(expiresAt)).digest("hex");
  return safeEqual(suppliedSignature ?? "", expectedSignature);
}

export async function hasUsageDashboardSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USAGE_SESSION_COOKIE)?.value ?? "";
  return isValidUsageSessionToken(token);
}

export const USAGE_SESSION_SECONDS = SESSION_SECONDS;
