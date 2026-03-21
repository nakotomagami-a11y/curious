import { create } from 'zustand';
import type { AchievementDef, CombatStats } from '@curious/shared';
import { ACHIEVEMENTS } from '@curious/shared';

const STORAGE_KEY = 'curious_achievements';

function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      return new Set(arr);
    }
  } catch {
    // ignore parse errors
  }
  return new Set();
}

function saveUnlocked(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore storage errors
  }
}

type AchievementStore = {
  unlockedIds: Set<string>;
  pendingPopups: AchievementDef[];
  unlock: (id: string) => void;
  dismissPopup: () => void;
  isUnlocked: (id: string) => boolean;
  checkAchievements: (stats: CombatStats) => void;
};

export const useAchievementStore = create<AchievementStore>((set, get) => ({
  unlockedIds: loadUnlocked(),
  pendingPopups: [],

  unlock: (id: string) => {
    const { unlockedIds, pendingPopups } = get();
    if (unlockedIds.has(id)) return;

    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;

    const newUnlocked = new Set(unlockedIds);
    newUnlocked.add(id);
    saveUnlocked(newUnlocked);

    set({
      unlockedIds: newUnlocked,
      pendingPopups: [...pendingPopups, def],
    });
  },

  dismissPopup: () => {
    const { pendingPopups } = get();
    set({ pendingPopups: pendingPopups.slice(1) });
  },

  isUnlocked: (id: string) => {
    return get().unlockedIds.has(id);
  },

  checkAchievements: (stats: CombatStats) => {
    const { unlockedIds, unlock } = get();

    for (const achievement of ACHIEVEMENTS) {
      if (unlockedIds.has(achievement.id)) continue;
      if (achievement.condition === 'custom') continue;

      const threshold = achievement.threshold ?? 0;

      switch (achievement.condition) {
        case 'kills':
          if (stats.enemiesKilled >= threshold) unlock(achievement.id);
          break;
        case 'boss_kills':
          if (stats.bossesKilled >= threshold) unlock(achievement.id);
          break;
        case 'wave':
          if (stats.wavesCleared >= threshold) unlock(achievement.id);
          break;
        case 'time':
          if (stats.timeSurvived >= threshold) unlock(achievement.id);
          break;
        case 'crits':
          if (stats.criticalHits >= threshold) unlock(achievement.id);
          break;
        case 'spells':
          if (stats.spellsCast >= threshold) unlock(achievement.id);
          break;
        case 'combo':
          if (stats.highestCombo >= threshold) unlock(achievement.id);
          break;
        case 'no_damage_wave':
          // Checked externally via events, not stats threshold
          break;
      }
    }
  },
}));
