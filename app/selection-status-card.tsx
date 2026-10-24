"use client";

import { useEffect, useState } from "react";

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
  reason: "The official lineup feed has not confirmed the team sheet yet. This page will keep checking."
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

  useEffect(() => {
    if (
      fixtureId === null ||
      kickoff === null ||
      !Number.isFinite(Date.parse(kickoff))
    ) return;

    // Explicit local types keep the async polling callback safely non-null.
    const activeFixtureId: number = fixtureId;
    const activeKickoff: string = kickoff;

    let active = true;

    async function checkLineup() {
      const minutesUntilKickoff = (Date.parse(activeKickoff) - Date.now()) / 60000;
      if (minutesUntilKickoff > 75 || minutesUntilKickoff < -120) return;

      setStatus(current =>
        isDefinitiveForFixture(current, activeFixtureId)
          ? current
          : { ...PENDING_STATUS, reason: minutesUntilKickoff < 0
              ? "Kick-off has passed, but the confirmed lineup has not been retrieved yet. Checking again."
              : PENDING_STATUS.reason }
      );

      try {
        const response = await fetch(
          `/api/lineup-status?event_id=${encodeURIComponent(String(activeFixtureId))}`,
          { cache: "no-store", headers: { Accept: "application/json" } }
        );
        const result = await response.json();
        if (!active) return;
        if (response.ok && result?.ok && result?.status) {
          setStatus(result as SelectionStatus);
        } else {
          setStatus(current =>
            isDefinitiveForFixture(current, activeFixtureId)
              ? current
              : { ...PENDING_STATUS, reason: result?.reason || "The lineup feed has not confirmed the starting XI. Retrying automatically." }
          );
        }
      } catch {
        if (!active) return;
        setStatus(current =>
          isDefinitiveForFixture(current, activeFixtureId)
            ? current
            : { ...PENDING_STATUS, reason: "Could not check the official lineup feed. Retrying automatically." }
        );
      }
    }

    void checkLineup();
    const interval = window.setInterval(() => void checkLineup(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
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
