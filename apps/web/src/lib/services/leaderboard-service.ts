import { supabase } from '@lib/supabase';
import type { LeaderboardEntry } from '@curious/shared';

/** Fetch top leaderboard entries from Supabase. */
export async function fetchLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('player_name, score, waves_cleared, time_survived, created_at')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch leaderboard:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    playerName: row.player_name,
    score: row.score,
    wavesCleared: row.waves_cleared,
    timeSurvived: row.time_survived,
    date: new Date(row.created_at).toISOString().slice(0, 10),
  }));
}

/** Submit a score to the Supabase leaderboard. */
export async function submitLeaderboardScore(entry: {
  playerName: string;
  score: number;
  wavesCleared: number;
  timeSurvived: number;
  enemiesKilled: number;
  gameMode: string;
}): Promise<boolean> {
  const { error } = await supabase.from('leaderboard').insert({
    player_name: entry.playerName,
    score: entry.score,
    waves_cleared: entry.wavesCleared,
    time_survived: entry.timeSurvived,
    enemies_killed: entry.enemiesKilled,
    game_mode: entry.gameMode,
  });

  if (error) {
    console.error('Failed to submit score:', error.message);
    return false;
  }
  return true;
}
