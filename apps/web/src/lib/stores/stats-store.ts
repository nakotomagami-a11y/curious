import { create } from 'zustand';
import type { CombatStats, LeaderboardEntry } from '@curious/shared';
import { createCombatStats, processStatsEvent, calculateScore } from '@curious/game-logic';
import { fetchLeaderboard, submitLeaderboardScore } from '@lib/services/leaderboard-service';

const MAX_ENTRIES = 10;

type StatsStore = {
  currentStats: CombatStats;
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  resetStats: () => void;
  updateTimeSurvived: (dt: number) => void;
  getScore: () => number;
  submitScore: (playerName: string, gameMode?: string) => void;
  processEvent: (event: any) => void;
  loadLeaderboard: () => void;
};

export const useStatsStore = create<StatsStore>((set, get) => ({
  currentStats: createCombatStats(),
  leaderboard: [],
  leaderboardLoading: false,

  resetStats: () => {
    set({ currentStats: createCombatStats() });
  },

  updateTimeSurvived: (dt: number) => {
    const stats = get().currentStats;
    stats.timeSurvived += dt;
  },

  getScore: () => {
    return calculateScore(get().currentStats);
  },

  submitScore: (playerName: string, gameMode = 'survival') => {
    const stats = get().currentStats;
    const score = Math.round(calculateScore(stats));

    // Submit to Supabase
    submitLeaderboardScore({
      playerName,
      score,
      wavesCleared: stats.wavesCleared,
      timeSurvived: stats.timeSurvived,
      enemiesKilled: stats.enemiesKilled,
      gameMode,
    }).then((success) => {
      if (success) {
        // Reload leaderboard after submission
        get().loadLeaderboard();
      }
    });

    // Also update local state immediately for responsiveness
    const entry: LeaderboardEntry = {
      playerName,
      score,
      wavesCleared: stats.wavesCleared,
      timeSurvived: stats.timeSurvived,
      date: new Date().toISOString().slice(0, 10),
    };
    const leaderboard = [...get().leaderboard, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
    set({ leaderboard });
  },

  processEvent: (event: any) => {
    const stats = get().currentStats;
    processStatsEvent(stats, event);
  },

  loadLeaderboard: () => {
    set({ leaderboardLoading: true });
    fetchLeaderboard(MAX_ENTRIES).then((entries) => {
      set({ leaderboard: entries, leaderboardLoading: false });
    });
  },
}));
