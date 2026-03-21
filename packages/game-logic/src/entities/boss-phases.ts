import type { BossSnapshot, BossPhase, GameEvent } from '@curious/shared';
import {
  BOSS_PHASE_2_THRESHOLD, BOSS_PHASE_3_THRESHOLD, BOSS_RAGE_THRESHOLD,
  BOSS_RAGE_SPEED_MULT, BOSS_RAGE_DAMAGE_MULT,
} from '@curious/shared';

/** Check and apply phase transitions based on HP percentage. */
export function updateBossPhase(boss: BossSnapshot): GameEvent[] {
  if (boss.aiState === 'dying' || boss.aiState === 'dead') return [];

  const hpPct = boss.health / boss.maxHealth;
  const events: GameEvent[] = [];

  // Phase transitions
  let newPhase: BossPhase = 1;
  if (hpPct <= BOSS_PHASE_3_THRESHOLD) newPhase = 3;
  else if (hpPct <= BOSS_PHASE_2_THRESHOLD) newPhase = 2;

  if (newPhase > boss.phase) {
    boss.phase = newPhase;
    // Could emit a BOSS_PHASE_CHANGE event here for VFX
  }

  // Rage mode
  const shouldRage = hpPct <= BOSS_RAGE_THRESHOLD;
  if (shouldRage && !boss.rageMode) {
    boss.rageMode = true;
    // Could emit BOSS_RAGE_ACTIVATED event
  }

  return events;
}

/** Get effective speed multiplier for boss considering phase and rage. */
export function getBossSpeedMultiplier(boss: BossSnapshot): number {
  let mult = 1.0;
  // Phase scaling: +10% per phase
  mult += (boss.phase - 1) * 0.10;
  // Rage
  if (boss.rageMode) mult *= BOSS_RAGE_SPEED_MULT;
  return mult;
}

/** Get effective damage multiplier for boss considering phase and rage. */
export function getBossDamageMultiplier(boss: BossSnapshot): number {
  let mult = 1.0;
  mult += (boss.phase - 1) * 0.15;
  if (boss.rageMode) mult *= BOSS_RAGE_DAMAGE_MULT;
  return mult;
}

/** Get slam cooldown reduction based on phase. */
export function getBossCooldownMultiplier(boss: BossSnapshot): number {
  // Faster attacks in later phases
  return 1.0 - (boss.phase - 1) * 0.15; // 15% faster per phase
}
