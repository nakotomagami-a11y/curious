export type AchievementId = string;

export type AchievementDef = {
  id: AchievementId;
  name: string;
  description: string;
  icon: string; // emoji
  condition: 'kills' | 'boss_kills' | 'wave' | 'time' | 'crits' | 'spells' | 'combo' | 'no_damage_wave' | 'custom';
  threshold?: number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_blood', name: 'First Blood', description: 'Kill your first enemy', icon: '\u2694\uFE0F', condition: 'kills', threshold: 1 },
  { id: 'warmed_up', name: 'Warmed Up', description: 'Kill 10 enemies in a single run', icon: '\uD83D\uDD25', condition: 'kills', threshold: 10 },
  { id: 'centurion', name: 'Centurion', description: 'Kill 100 enemies in a single run', icon: '\uD83D\uDDE1\uFE0F', condition: 'kills', threshold: 100 },
  { id: 'untouchable', name: 'Untouchable', description: 'Complete a wave without taking damage', icon: '\uD83D\uDEE1\uFE0F', condition: 'no_damage_wave' },
  { id: 'boss_slayer', name: 'Boss Slayer', description: 'Defeat a boss', icon: '\uD83D\uDC80', condition: 'boss_kills', threshold: 1 },
  { id: 'hydra_hunter', name: 'Hydra Hunter', description: 'Defeat the Hydra boss', icon: '\uD83D\uDC09', condition: 'custom' },
  { id: 'archmage_end', name: "Archmage's End", description: 'Defeat the Mage boss', icon: '\uD83E\uDDD9', condition: 'custom' },
  { id: 'combo_master', name: 'Combo Master', description: 'Land a 5-hit combo', icon: '\u26A1', condition: 'combo', threshold: 5 },
  { id: 'critical_streak', name: 'Critical Streak', description: 'Land 3 critical hits in a row', icon: '\uD83C\uDFAF', condition: 'crits', threshold: 3 },
  { id: 'spell_collector', name: 'Spell Collector', description: 'Have 9 spells at once', icon: '\uD83C\uDF1F', condition: 'custom' },
  { id: 'elementalist', name: 'Elementalist', description: 'Cast each spell type at least once', icon: '\uD83C\uDF08', condition: 'custom' },
  { id: 'elite_crusher', name: 'Elite Crusher', description: 'Kill 10 elite enemies total', icon: '\uD83D\uDCAA', condition: 'custom' },
  { id: 'survivor', name: 'Survivor', description: 'Reach wave 10 in survival mode', icon: '\uD83C\uDFC6', condition: 'wave', threshold: 10 },
  { id: 'endurance', name: 'Endurance', description: 'Survive for 5 minutes', icon: '\u23F0', condition: 'time', threshold: 300 },
  { id: 'glass_cannon', name: 'Glass Cannon', description: 'Deal 1000 damage without healing', icon: '\uD83D\uDCA5', condition: 'custom' },
  { id: 'no_spells', name: 'No Spells Needed', description: 'Kill a boss using only sword attacks', icon: '\u2694\uFE0F', condition: 'custom' },
  { id: 'demolition', name: 'Demolition Expert', description: 'Kill 5 enemies with a single gravity well', icon: '\uD83C\uDF00', condition: 'custom' },
  { id: 'chain_lightning', name: 'Chain Lightning', description: 'Hit 4 enemies with one lightning chain', icon: '\u26A1', condition: 'custom' },
  { id: 'speed_runner', name: 'Speed Runner', description: 'Clear wave 5 in under 2 minutes', icon: '\uD83C\uDFC3', condition: 'custom' },
  { id: 'immortal', name: 'Immortal', description: 'Complete 3 consecutive waves without dying', icon: '\uD83D\uDC51', condition: 'custom' },
];
