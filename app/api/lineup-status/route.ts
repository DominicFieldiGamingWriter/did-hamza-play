import { NextResponse } from "next/server";
import { getLineups } from "../../../lib/api-football";
import { resolveTeamSheetStatus } from "../../../lib/status";
import { getSupabaseAdmin } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fixtureKickoff(fixture: any): string | null {
  const value =
    fixture?.time?.kickoff_at ??
    fixture?.time?.start_time ??
    fixture?.kickoff_at ??
    fixture?.kickoff ??
    fixture?.event_date ??
    fixture?.date ??
    fixture?.start_time ??
    null;
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

function isDefinitive(status: any) {
  return ["confirmed_start", "confirmed_bench", "confirmed_not_in_squad"].includes(
    String(status?.status ?? status?.type ?? "")
  );
}

export async function GET(request: Request) {
  const requestedId = Number(new URL(request.url).searchParams.get("event_id"));
  if (!Number.isSafeInteger(requestedId) || requestedId <= 0) {
    return json({ ok: false, error: "Invalid event id." }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("player_page")
      .select("player_id, team_id, next_fixtures, player_status")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    if (!data || !Number.isFinite(Number(data.player_id))) {
      return json({ ok: false, error: "Player data is unavailable." }, 503);
    }

    const fixtures = Array.isArray(data.next_fixtures) ? data.next_fixtures : [];
    const fixture = fixtures.find((item: any) =>
      Number(item?.id ?? item?.event_id) === requestedId
    );
    if (!fixture) {
      return json({ ok: false, error: "This event is not in the current fixture list." }, 404);
    }

    const kickoff = fixtureKickoff(fixture);
    if (!kickoff) {
      return json({ ok: false, error: "The fixture kick-off time is unavailable." }, 422);
    }

    const storedPlayerStatus =
      data.player_status && typeof data.player_status === "object"
        ? data.player_status
        : {};
    const storedNextStatus =
      storedPlayerStatus.next_match && typeof storedPlayerStatus.next_match === "object"
        ? storedPlayerStatus.next_match
        : {};
    const now = Date.now();
    const minutesUntilKickoff = (Date.parse(kickoff) - now) / 60000;
    const cacheMatchesFixture = Number(storedNextStatus.lineup_fixture_id) === requestedId;

    if (cacheMatchesFixture && isDefinitive(storedNextStatus)) {
      return json({ ok: true, ...storedNextStatus });
    }
    if (
      cacheMatchesFixture &&
      storedNextStatus.lineup_checked_at &&
      now - Date.parse(String(storedNextStatus.lineup_checked_at)) < 45_000
    ) {
      return json({ ok: true, ...storedNextStatus });
    }

    // Check from 75 minutes before kick-off to two hours after. This is not
    // dependent on the delayed GitHub scheduled workflow.
    if (minutesUntilKickoff > 75 || minutesUntilKickoff < -120) {
      return json({ ok: false, outside_window: true, reason: "Lineup checking is outside the match window." }, 425);
    }

    let lineupData: any = null;
    let feedError = false;
    try {
      lineupData = await getLineups(requestedId);
    } catch (error) {
      feedError = true;
      console.error("Lineup feed request failed:", error);
    }

    const checkedAt = new Date().toISOString();
    const decision = resolveTeamSheetStatus(Number(data.player_id), lineupData);
    const result = {
      ...decision,
      reason: feedError
        ? "The official lineup feed could not be reached. This page will retry automatically."
        : decision.reason,
      lineup_fixture_id: requestedId,
      lineup_checked_at: checkedAt,
      fixture_kickoff: kickoff
    };
    const updatedPlayerStatus = { ...storedPlayerStatus, next_match: result };
    const { error: updateError } = await supabase
      .from("player_page")
      .update({ player_status: updatedPlayerStatus, updated_at: checkedAt })
      .eq("id", 1);

    if (updateError) console.error("Could not persist lineup status:", updateError.message);
    return json({ ok: true, ...result });
  } catch (error) {
    console.error("Lineup-status route failed:", error);
    return json({ ok: false, error: "Could not verify the official team sheet." }, 500);
  }
}
