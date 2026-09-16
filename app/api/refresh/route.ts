import { NextRequest } from "next/server";
import { refreshPlayerPage } from "@/lib/refresh";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!expected || auth !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshPlayerPage();
    return Response.json({
      ok: true,
      player: result.player_name,
      team: result.team_name,
      updated_at: result.updated_at
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
