"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = { eventId: number | null; kickoff: string | null; active: boolean };
const FIRST_CHECK_MINUTES = 105;
const RETRY_MS = 60_000;

export default function PostMatchRefresh({ eventId, kickoff, active }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!active || eventId === null || !kickoff || !Number.isFinite(Date.parse(kickoff))) return;

    const id = eventId;
    const firstCheckAt = Date.parse(kickoff) + FIRST_CHECK_MINUTES * 60_000;
    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof window.setTimeout> | null = null;

    async function check() {
      if (stopped || inFlight) return;
      const delay = firstCheckAt - Date.now();
      if (delay > 0) {
        timer = window.setTimeout(check, delay);
        return;
      }

      inFlight = true;
      try {
        const response = await fetch("/api/post-match-refresh", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ event_id: id })
        });
        const result = await response.json();
        if (stopped) return;
        if (response.ok && result?.ok) {
          router.refresh();
          if (result.completed === true) {
            stopped = true;
            return;
          }
        }
      } catch {
        // Retry transient network/provider failures at the next interval.
      } finally {
        inFlight = false;
      }
      if (!stopped) timer = window.setTimeout(check, RETRY_MS);
    }

    timer = window.setTimeout(check, Math.max(0, firstCheckAt - Date.now()));
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [active, eventId, kickoff, router]);

  return null;
}
