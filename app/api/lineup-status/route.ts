import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET(request: Request) {
  const eventId = Number(new URL(request.url).searchParams.get("event_id"));
  if (!Number.isSafeInteger(eventId) || eventId <= 0) return NextResponse.json({ ok: false, error: "Invalid event id." }, { status: 400 });
  try {
    const { data, error } = await getSupabaseAdmin().from("player_page").select("player_status").eq("id", 1).maybeSingle();
    if (error) throw error;
    const status = data?.player_status?.next_match;
    if (!status || Number(status.lineup_fixture_id) !== eventId) return NextResponse.json({ ok: true, status: {
      status: "lineup_pending", type: "lineup_pending", phase: "team_news", tone: "warning",
      label: "Waiting for official team sheet", pillLabel: "Awaiting lineup", reason: "The official lineup has not been checked yet.",
      lineup_fixture_id: eventId
    } }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    return NextResponse.json({ ok: true, status }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Lineup status read failed:", error);
    return NextResponse.json({ ok: false, error: "Could not retrieve stored team-sheet status." }, { status: 500 });
  }
}
