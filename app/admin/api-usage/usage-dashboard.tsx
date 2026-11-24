
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./usage-dashboard.module.css";

type SiteUsage = { site: string; requests?: number; success?: number; errors?: number; runs?: number; skipped?: number };
type Summary = {
  generated_at: string;
  quota_reference: number;
  today_start_utc: string;
  today: {
    requests: number; success: number; http_errors: number; network_errors: number; rate_limited: number;
    average_latency_ms: number | null; p95_latency_ms: number | null;
    provider_limit: number | null; provider_remaining: number | null; provider_reset_at: string | null;
    last_request_at: string | null; last_success_at: string | null;
    by_site: SiteUsage[]; top_endpoints: { endpoint: string; requests: number }[];
  };
  hourly: { hour: string; hour_start: string; requests: number; hamza: number; ben: number }[];
  daily: { day: string; requests: number; hamza: number; ben: number }[];
  refresh_today: { total: number; success: number; skipped: number; errors: number; by_site: SiteUsage[] };
  recent_requests: { requested_at: string; site: string; endpoint: string; http_status: number | null; latency_ms: number; outcome: string; provider_code: string | null; rate_limit_remaining: number | null }[];
  recent_refreshes: { started_at: string; finished_at: string; site: string; result: string; duration_ms: number; provider_code: string | null }[];
  retention_days: number;
};

function number(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB").format(value ?? 0);
}

function time(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false
  }).format(date) + " UTC";
}

function statusClass(value: string) {
  if (value === "success") return styles.statusSuccess;
  if (value === "skipped_rate_limited") return styles.statusSkip;
  return styles.statusError;
}

export default function UsageDashboard({ initialAuthenticated }: { initialAuthenticated: boolean }) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/api-usage", { cache: "no-store" });
      if (response.status === 401) {
        setAuthenticated(false);
        setSummary(null);
        return;
      }
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not load usage data.");
      setSummary(result.summary as Summary);
      setUpdatedAt(new Date().toISOString());
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load usage data.");
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [authenticated, load]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const response = await fetch("/api/admin/api-usage/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Login failed.");
      setPassword("");
      setAuthenticated(true);
      await load();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/api-usage/session", { method: "DELETE" });
    setAuthenticated(false);
    setSummary(null);
  }

  const today = summary?.today;
  const limit = summary?.quota_reference ?? 7500;
  const remaining = Math.max(0, limit - (today?.requests ?? 0));
  const percentage = limit > 0 ? Math.min(100, ((today?.requests ?? 0) / limit) * 100) : 0;
  const maxHour = useMemo(() => Math.max(1, ...(summary?.hourly.map((h) => h.requests) ?? [1])), [summary]);
  const maxEndpoint = useMemo(() => Math.max(1, ...(today?.top_endpoints.map((e) => e.requests) ?? [1])), [today]);

  if (!authenticated) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loginWrap}>
            <form className={styles.loginCard} onSubmit={login}>
              <div className={styles.eyebrow}>Private administration</div>
              <h1 className={styles.title}>BSD API usage</h1>
              <p className={styles.muted}>Enter the dashboard password to view combined usage for Hamza and Ben.</p>
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Dashboard password"
                autoComplete="current-password"
                required
              />
              {loginError ? <p className={styles.error}>{loginError}</p> : null}
              <button className={styles.button} style={{ width: "100%", marginTop: 15 }} disabled={busy}>
                {busy ? "Checking…" : "Open dashboard"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.topbar}>
          <div>
            <div className={styles.eyebrow}>Private administration · BSD account</div>
            <h1 className={styles.title}>API usage dashboard</h1>
            <p className={styles.muted}>Combined request tracking for Did Hamza Play and Did Ben Play. Quota accounting follows UTC.</p>
            <p className={styles.small}>Last refreshed: {time(updatedAt)} · Logs retained for {summary?.retention_days ?? 30} days</p>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} onClick={() => void load()}>Refresh</button>
            <button className={styles.button + " " + styles.buttonSecondary} onClick={() => void logout()}>Log out</button>
          </div>
        </header>

        {loadError ? <div className={styles.error}>{loadError}</div> : null}
        {!summary ? <section className={styles.section}><div className={styles.empty}>Loading usage data…</div></section> : (
          <>
            <section className={styles.grid}>
              <article className={styles.metric}>
                <div className={styles.metricLabel}>BSD requests today · UTC</div>
                <div className={styles.metricValue}>{number(today?.requests)}</div>
                <div className={styles.metricHint}>Outbound BSD requests recorded across both sites; cached lookups are excluded</div>
                <div className={styles.progress}><div className={styles.progressFill} style={{ width: percentage + "%" }} /></div>
                <div className={styles.metricHint}>{percentage.toFixed(1)}% of {number(limit)} daily reference allowance</div>
              </article>
              <article className={styles.metric}>
                <div className={styles.metricLabel}>Estimated remaining</div>
                <div className={styles.metricValue}>{number(remaining)}</div>
                <div className={styles.metricHint}>7,500/day reference less tracked outbound requests; not a provider-confirmed balance</div>
              </article>
              <article className={styles.metric}>
                <div className={styles.metricLabel}>Rate-limit responses</div>
                <div className={styles.metricValue}>{number(today?.rate_limited)}</div>
                <div className={styles.metricHint}>HTTP 429 responses recorded today</div>
              </article>
              <article className={styles.metric}>
                <div className={styles.metricLabel}>Successful requests</div>
                <div className={styles.metricValue}>{number(today?.success)}</div>
                <div className={styles.metricHint}>{number((today?.http_errors ?? 0) + (today?.network_errors ?? 0))} HTTP or network errors</div>
              </article>
            </section>

            <section className={styles.twoCol}>
              <div className={styles.section}>
                <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Usage by site</h2><span className={styles.small}>Today, UTC</span></div>
                <div className={styles.siteGrid}>
                  {["hamza", "ben"].map((site) => {
                    const item = today?.by_site.find((entry) => entry.site === site);
                    return <div className={styles.siteCard} key={site}>
                      <div className={styles.siteName}>Did {site === "hamza" ? "Hamza" : "Ben"} Play</div>
                      <div className={styles.siteCount}>{number(item?.requests)}</div>
                      <div className={styles.small}>{number(item?.success)} successful · {number(item?.errors)} errors</div>
                    </div>;
                  })}
                </div>
                <div className={styles.small} style={{ marginTop: 13 }}>Last successful BSD request: {time(today?.last_success_at)}</div>
                <div className={styles.small} style={{ marginTop: 5 }}>Latest provider reset header: {time(today?.provider_reset_at)}</div>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Response performance</h2><span className={styles.small}>Today, UTC</span></div>
                <div className={styles.siteGrid}>
                  <div className={styles.siteCard}><div className={styles.siteName}>Average response</div><div className={styles.siteCount}>{number(today?.average_latency_ms)}<span style={{ fontSize: 12 }}> ms</span></div></div>
                  <div className={styles.siteCard}><div className={styles.siteName}>95th percentile</div><div className={styles.siteCount}>{number(today?.p95_latency_ms)}<span style={{ fontSize: 12 }}> ms</span></div></div>
                </div>
                <div className={styles.small} style={{ marginTop: 13 }}>Latest request: {time(today?.last_request_at)}</div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Requests per hour</h2><span className={styles.small}>UTC today</span></div>
              {summary.hourly.length === 0 ? <div className={styles.empty}>No BSD requests recorded yet today.</div> : (
                <div className={styles.barList}>
                  {summary.hourly.map((hour) => <div className={styles.barRow} key={hour.hour_start}>
                    <span>{hour.hour}</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: (hour.requests / maxHour * 100) + "%" }} /></div>
                    <strong>{number(hour.requests)}</strong>
                  </div>)}
                </div>
              )}
            </section>

            <section className={styles.twoCol}>
              <div className={styles.section}>
                <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Most-used endpoints</h2><span className={styles.small}>Today, UTC</span></div>
                {today?.top_endpoints.length ? <div className={styles.barList}>
                  {today.top_endpoints.map((endpoint) => <div className={styles.barRow} key={endpoint.endpoint}>
                    <span title={endpoint.endpoint}>{endpoint.endpoint}</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: (endpoint.requests / maxEndpoint * 100) + "%" }} /></div>
                    <strong>{number(endpoint.requests)}</strong>
                  </div>)}
                </div> : <div className={styles.empty}>No endpoint data yet.</div>}
              </div>
              <div className={styles.section}>
                <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Refresh executions</h2><span className={styles.small}>Separate from BSD requests</span></div>
                <div className={styles.siteGrid}>
                  <div className={styles.siteCard}><div className={styles.siteName}>Refresh runs</div><div className={styles.siteCount}>{number(summary.refresh_today.total)}</div></div>
                  <div className={styles.siteCard}><div className={styles.siteName}>Circuit-breaker skips</div><div className={styles.siteCount}>{number(summary.refresh_today.skipped)}</div></div>
                  <div className={styles.siteCard}><div className={styles.siteName}>Successful refreshes</div><div className={styles.siteCount}>{number(summary.refresh_today.success)}</div></div>
                  <div className={styles.siteCard}><div className={styles.siteName}>Refresh errors</div><div className={styles.siteCount}>{number(summary.refresh_today.errors)}</div></div>
                </div>
                <div className={styles.small} style={{ marginTop: 12 }}>
                  {summary.refresh_today.by_site.map((site) => `${site.site}: ${number(site.runs)} runs`).join(" · ") || "No refreshes recorded yet."}
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Daily request totals</h2><span className={styles.small}>Last 14 days · UTC</span></div>
              <div className={styles.tableWrap}>
                <table className={styles.table}><thead><tr><th>Date</th><th>Total</th><th>Hamza</th><th>Ben</th></tr></thead>
                  <tbody>{summary.daily.map((day) => <tr key={day.day}><td>{day.day}</td><td>{number(day.requests)}</td><td>{number(day.hamza)}</td><td>{number(day.ben)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Recent BSD requests</h2><span className={styles.small}>Latest 30 tracked outbound requests</span></div>
              <div className={styles.tableWrap}>
                <table className={styles.table}><thead><tr><th>Time (UTC)</th><th>Site</th><th>Endpoint</th><th>HTTP</th><th>Duration</th><th>Outcome</th><th>Rate-limit header</th></tr></thead>
                  <tbody>{summary.recent_requests.map((event, index) => <tr key={event.requested_at + event.site + event.endpoint + index}>
                    <td>{time(event.requested_at)}</td><td>{event.site}</td><td>{event.endpoint}</td><td>{event.http_status ?? "No response"}</td><td>{number(event.latency_ms)} ms</td>
                    <td><span className={styles.pill + " " + statusClass(event.outcome)}>{event.outcome.replaceAll("_", " ")}</span></td><td>{event.rate_limit_remaining === null ? "—" : number(event.rate_limit_remaining)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
