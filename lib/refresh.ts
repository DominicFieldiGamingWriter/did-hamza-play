import {
  findPlayer,
  getFixturePlayerStats,
  getLineups,
  getSidelined,
  getTeamFixtures
} from "./api-football";
import { classifyPlayer } from "./status";
import { getSupabaseAdmin } from "./supabase";

export async function refreshPlayerPage() {
  const name = process.env.PLAYER_NAME || "Hamza Choudhury";
  let playerId = Number(process.env.PLAYER_ID || 0);

  if (!playerId) {
    const matches = await findPlayer(name);
    const exact = matches.find(m => m.player.name.toLowerCase() === name.toLowerCase());
    const chosen = exact ?? matches[0];
    if (!chosen) throw new Error(`Could not find player: ${name}`);
    playerId = chosen.player.id;
  }

  const playerMatches = await findPlayer(String(playerId));
  const player = playerMatches.find(m => m.player.id === playerId);
  const team = player?.statistics?.find(s => s.team?.id)?.team;
  if (!team?.id) throw new Error("Could not determine the player's current team.");

  const { last, next } = await getTeamFixtures(team.id);
  if (!last) throw new Error("Could not find a completed/latest fixture.");

  const [lineups, stats, sidelined] = await Promise.all([
    getLineups(last.fixture.id),
    getFixturePlayerStats(last.fixture.id, team.id),
    getSidelined(playerId)
  ]);

  const status = classifyPlayer(playerId, last, lineups, stats, sidelined);

  const supabase = getSupabaseAdmin();
  const payload = {
    id: 1,
    player_id: playerId,
    player_name: player?.player.name ?? name,
    team_id: team.id,
    team_name: team.name,
    team_logo: team.logo ?? null,
    player_photo: player?.player.photo ?? null,
    last_fixture: { ...last, player_status: status },
    next_fixtures: next,
    player_status: status,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("player_page").upsert(payload);
  if (error) throw new Error(`Supabase: ${error.message}`);

  return payload;
}
