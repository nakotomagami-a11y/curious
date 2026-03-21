import { create } from 'zustand';
import type { CombatStats, LeaderboardEntry } from '@curious/shared';
import { createCombatStats, processStatsEvent, calculateScore } from '@curious/game-logic';

const LEADERBOARD_KEY = 'curious_leaderboard';
const MAX_ENTRIES = 10;

function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (raw) {
      return JSON.parse(raw) as LeaderboardEntry[];
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage errors
  }
}

type StatsStore = {
  currentStats: CombatStats;
  leaderboard: LeaderboardEntry[];
  resetStats: () => void;
  updateTimeSurvived: (dt: number) => void;
  getScore: () => number;
  submitScore: (playerName: string) => void;
  processEvent: (event: any) => void;
};

export const useStatsStore = create<StatsStore>((set, get) => ({
  currentStats: createCombatStats(),
  leaderboard: loadLeaderboard(),

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

  submitScore: (playerName: string) => {
    const stats = get().currentStats;
    const score = calculateScore(stats);
    const entry: LeaderboardEntry = {
      playerName,
      score: Math.round(score),
      wavesCleared: stats.wavesCleared,
      timeSurvived: stats.timeSurvived,
      date: new Date().toISOString().slice(0, 10),
    };
    const leaderboard = [...get().leaderboard, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
    saveLeaderboard(leaderboard);
    set({ leaderboard });
  },

  processEvent: (event: any) => {
    const stats = get().currentStats;
    processStatsEvent(stats, event);
  },
}));
