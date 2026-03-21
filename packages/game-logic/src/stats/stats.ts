import type { CombatStats } from '@curious/shared';
import type { GameEvent } from '@curious/shared';

export function createCombatStats(): CombatStats {
  return {
    damageDealt: 0,
    damageTaken: 0,
    enemiesKilled: 0,
    bossesKilled: 0,
    spellsCast: 0,
    criticalHits: 0,
    highestCombo: 0,
    timeSurvived: 0,
    wavesCleared: 0,
    elitesKilled: 0,
  };
}

export function processStatsEvent(stats: CombatStats, event: GameEvent): void {
  switch (event.type) {
    case 'ATTACK_HIT':
      stats.damageDealt += event.damage;
      if (event.isCritical) {
        stats.criticalHits++;
      }
      break;
    case 'DAMAGE_TAKEN':
      // Only track damage taken by the player
      // We don't have entityType on DAMAGE_TAKEN, so we track all damage
      // The caller should filter if needed
      stats.damageTaken += event.amount;
      break;
    case 'ENTITY_DIED':
      if (event.entityType === 'enemy') {
        stats.enemiesKilled++;
      } else if (event.entityType === 'boss') {
        stats.bossesKilled++;
      }
      break;
    case 'SPELL_CAST':
      stats.spellsCast++;
      break;
    case 'WAVE_COMPLETE':
      stats.wavesCleared++;
      break;
  }
}

export function calculateScore(stats: CombatStats): number {
  return (
    stats.enemiesKilled * 10 +
    stats.elitesKilled * 50 +
    stats.bossesKilled * 200 +
    stats.damageDealt / 10 +
    stats.wavesCleared * 100 +
    Math.floor(stats.timeSurvived)
  );
}
