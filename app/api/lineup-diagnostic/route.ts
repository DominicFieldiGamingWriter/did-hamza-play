import { NextResponse } from "next/server";
import { getLineups } from "../../../lib/bsd";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function inspectPayload(value: any) {
  const arrays: Array<{ path: string; length: number; sampleKeys: string[] }> = [];
  const matchingPlayers: any[] = [];
  let visited = 0;

  function walk(node: any, path: string, depth: number) {
    if (!node || typeof node !== "object" || depth > 8 || visited >= 1500) return;
    visited += 1;
    if (Array.isArray(node)) {
      arrays.push({
        path,
        length: node.length,
        sampleKeys: node.slice(0, 2).map((item: any) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? Object.keys(item).slice(0, 30).join(",")
            : typeof item
        )
      });
      node.forEach((item: any, index: number) => walk(item, path + "[" + index + "]", depth + 1));
      return;
    }

    const ids = [
      node.id, node.player_id, node.playerId, node.PlayerID,
      node.player?.id, node.player?.player_id
    ].map((item: any) => Number(item)).filter((item: number) => Number.isFinite(item));
    const name = String(node.name ?? node.player_name ?? node.full_name ?? node.player?.name ?? node.player?.full_name ?? "");
    if (ids.some(id => id === 6135 || id === 6230) || /Hamza Choudhury|Ben Brereton/i.test(name)) {
      matchingPlayers.push({
        path,
        ids,
        name,
        keys: Object.keys(node),
        roleFields: {
          role: node.role,
          type: node.type,
          type_id: node.type_id,
          position: node.position,
          position_type: node.position_type,
          lineup_role: node.lineup_role,
          selection_status: node.selection_status,
          player_status: node.player_status,
          status: node.status,
          is_starter: node.is_starter,
          starter: node.starter,
          starting: node.starting,
          is_substitute: node.is_substitute,
          substitute: node.substitute,
          on_bench: node.on_bench,
          bench: node.bench,
          captain: node.captain
        }
      });
    }

    for (const [key, child] of Object.entries(node)) {
      if (child && typeof child === "object") walk(child, path ? path + "." + key : key, depth + 1);
    }
  }

  walk(value, "root", 0);
  return { rootKeys: value && typeof value === "object" ? Object.keys(value) : [], arrays, matchingPlayers, visited };
}

export async function GET(request: Request) {
  const eventId = Number(new URL(request.url).searchParams.get("event_id"));
  if (eventId !== 214124) {
    return NextResponse.json({ ok: false, error: "Diagnostic restricted to the inspected event." }, { status: 404 });
  }

  try {
    const adapterResult = await getLineups(eventId);
    const raw = Array.isArray(adapterResult?.lineups)
      ? adapterResult.lineups[0]
      : adapterResult;
    return NextResponse.json({
      ok: true,
      event_id: eventId,
      adapterKeys: Object.keys(adapterResult ?? {}),
      adapterStatus: adapterResult?.status,
      rawLineupStatus: raw?.lineup_status,
      rawBeta: raw?.beta,
      rawKeys: raw && typeof raw === "object" ? Object.keys(raw) : [],
      lineupValueType: raw?.lineups === null ? "null" : Array.isArray(raw?.lineups) ? "array" : typeof raw?.lineups,
      lineupValueKeys: raw?.lineups && typeof raw.lineups === "object" && !Array.isArray(raw.lineups) ? Object.keys(raw.lineups) : [],
      structure: inspectPayload(raw)
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Lineup request failed" }, { status: 502 });
  }
}
