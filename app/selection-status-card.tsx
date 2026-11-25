"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type SelectionStatus = {
  status?: string;
  type?: string;
  phase?: string;
  tone?: string;
  label?: string;
  pillLabel?: string;
  reason?: string;
  lineup_fixture_id?: number;
  lineup_checked_at?: string;
};

type Props = {
  fixtureId: number | null;
  kickoff: string | null;
  initialStatus: SelectionStatus | null;
  selectionWindowActive: boolean;
};

const FALLBACK_STATUS: SelectionStatus = {
  status: "likely_available",
  type: "likely_available",
  phase: "availability",
  tone: "positive",
  label: "Likely available",
  pillLabel: "Likely available",
  reason: "No current injury, doubt or suspension is listed."
};

const PENDING_STATUS: SelectionStatus = {
  status: "lineup_pending",
  type: "lineup_pending",
  phase: "team_news",
  tone: "warning",
  label: "Waiting for official team sheet",
  pillLabel: "Awaiting lineup",
  reason: "The official lineup feed has not confirmed the team sheet yet. This status updates automatically when new information is received."
};

const DEFINITIVE_STATUSES = new Set([
  "confirmed_start",
  "confirmed_bench",
  "confirmed_not_in_squad"
]);

function isDefinitiveForFixture(status: SelectionStatus | null, fixtureId: number) {
  return Boolean(
    status &&
    DEFINITIVE_STATUSES.has(String(status.status ?? status.type ?? "")) &&
    Number(status.lineup_fixture_id) === fixtureId
  );
}

export default function SelectionStatusCard({
  fixtureId,
  kickoff,
  initialStatus,
  selectionWindowActive
}: Props) {
  const initialIsForFixture = fixtureId !== null && isDefinitiveForFixture(initialStatus, fixtureId);
  const [status, setStatus] = useState<SelectionStatus>(
    selectionWindowActive && !initialIsForFixture
      ? PENDING_STATUS
      : initialStatus ?? FALLBACK_STATUS
  );
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (
      fixtureId === null ||
      kickoff === null ||
      !Number.isFinite(Date.parse(kickoff))
    ) return;

    const activeFixtureId = fixtureId;
    const activeKickoff = kickoff;
    let disposed = false;
    let startTimer: number | undefined;
    let endTimer: number | undefined;
    let channel: RealtimeChannel | null = null;

    const supabase = getSupabaseBrowserClient();

    function setPending(reason?: string) {
      setStatus(current =>
        isDefinitiveForFixture(current, activeFixtureId)
          ? current
          : { ...PENDING_STATUS, reason: reason ?? PENDING_STATUS.reason }
      );
    }

    function applyStatus(value: unknown) {
      const nextStatus =
        value && typeof value === "object" && !Array.isArray(value)
          ? value as SelectionStatus
          : null;

      if (!nextStatus || Number(nextStatus.lineup_fixture_id) !== activeFixtureId) {
        setPending();
        return;
      }

      setStatus(current =>
        isDefinitiveForFixture(current, activeFixtureId)
          ? current
          : nextStatus
      );
    }

    async function loadLatestStatus() {
      if (!supabase || disposed) return;

      const { data, error } = await supabase
        .from("player_lineup_status")
        .select("status")
        .eq("id", 1)
        .maybeSingle();

      if (disposed) return;

      if (error) {
        setPending("The live connection is active, but the latest status could not be loaded. It will update when the next lineup check completes.");
        return;
      }

      applyStatus(data?.status);
    }

    function onVisibilityChange() {
      if (!document.hidden && channel) {
        void loadLatestStatus();
      }
    }

    function stopSubscription() {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (channel && supabase) {
        const currentChannel = channel;
        channel = null;
        void supabase.removeChannel(currentChannel);
      }
    }

    function startSubscription() {
      if (disposed || channel) return;

      const minutesUntilKickoff = (Date.parse(activeKickoff) - Date.now()) / 60000;
      if (minutesUntilKickoff > 65 || minutesUntilKickoff < -120) return;
      if (isDefinitiveForFixture(statusRef.current, activeFixtureId)) return;

      setPending(
        minutesUntilKickoff < 0
          ? "Kick-off has passed, but the confirmed lineup has not been retrieved yet. Waiting for the next update."
          : PENDING_STATUS.reason
      );

      if (!supabase) {
        setPending("Live lineup updates could not be connected. Reload the page to retrieve the latest status.");
        return;
      }

      channel = supabase
        .channel(`lineup-status-${activeFixtureId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "player_lineup_status",
            filter: "id=eq.1"
          },
          payload => {
            const updatedRow = payload.new as { status?: unknown };
            applyStatus(updatedRow.status);
          }
        )
        .subscribe((subscriptionStatus, error) => {
          if (disposed) return;

          if (subscriptionStatus === "SUBSCRIBED") {
            void loadLatestStatus();
          } else if (
            subscriptionStatus === "CHANNEL_ERROR" ||
            subscriptionStatus === "TIMED_OUT"
          ) {
            setPending("The live lineup connection was interrupted. It will retry automatically.");
            if (error) console.error("Lineup Realtime subscription failed:", error.message);
          }
        });

      document.addEventListener("visibilitychange", onVisibilityChange);

      const millisecondsUntilWindowEnds =
        Date.parse(activeKickoff) + 120 * 60_000 - Date.now();

      endTimer = window.setTimeout(
        stopSubscription,
        Math.max(0, millisecondsUntilWindowEnds)
      );
    }

    function scheduleSubscriptionStart() {
      if (disposed) return;

      const millisecondsUntilWindowStarts =
        Date.parse(activeKickoff) - Date.now() - 65 * 60_000;

      if (millisecondsUntilWindowStarts > 0) {
        startTimer = window.setTimeout(
          scheduleSubscriptionStart,
          Math.min(millisecondsUntilWindowStarts, 2_147_483_647)
        );
        return;
      }

      startSubscription();
    }

    scheduleSubscriptionStart();

    return () => {
      disposed = true;
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      if (endTimer !== undefined) window.clearTimeout(endTimer);
      stopSubscription();
    };
  }, [fixtureId, kickoff]);

  const showTeamSheet = status.phase === "team_news" || selectionWindowActive;
  const label = status.label ?? "Lineup not confirmed";
  const tone = status.tone ?? "warning";

  return (
    <div className="availability">
      <div>
        <div className="section-label">
          {showTeamSheet ? "TEAM SHEET" : "AVAILABILITY"}
        </div>
        <div className={`availability-status ${tone}`}>
          {label}
        </div>
        <div className="availability-reason">
          {status.reason ?? "Waiting for team news."}
          {status.lineup_checked_at && (
            <span className="lineup-checked-at">
              {" "}Checked {new Date(status.lineup_checked_at).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
                timeZoneName: "short"
              })}
            </span>
          )}
        </div>
      </div>
      <div className={`status-pill ${tone}`}>
        {status.pillLabel ?? label}
      </div>
    </div>
  );
}
