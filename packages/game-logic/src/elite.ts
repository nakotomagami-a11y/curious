import type { EnemySnapshot, EliteModifier, Vec2, GameEvent } from '@curious/shared';
import { vec2Sub, vec2Angle, angleDifference } from '@curious/shared';
import {
  ELITE_SPAWN_CHANCE,
  ELITE_VAMPIRIC_HEAL_PCT,
  ELITE_THORNS_REFLECT_PCT,
  ELITE_HASTE_SPEED_MULT,
  ELITE_HASTE_ATTACK_MULT,
  ELITE_GIANT_SCALE,
  ELITE_GIANT_HP_MULT,
  ELITE_GIANT_DAMAGE_MULT,
  ELITE_GIANT_SPEED_MULT,
  ELITE_SHIELDED_FRONT_REDUCTION,
  ELITE_BERSERKER_THRESHOLD,
  ELITE_BERSERKER_DAMAGE_MULT,
  ELITE_BERSERKER_SPEED_MULT,
} from '@curious/shared';

const ALL_MODIFIERS: EliteModifier[] = ['vampiric', 'thorns', 'haste', 'giant', 'shielded', 'berserker'];

/** Roll for elite modifiers when spawning an enemy. Returns empty array for non-elites. */
export function rollEliteModifiers(): EliteModifier[] {
  if (Math.random() > ELITE_SPAWN_CHANCE) return [];

  // Pick 1-2 random modifiers (no duplicates)
  const count = Math.random() < 0.3 ? 2 : 1;
  const shuffled = [...ALL_MODIFIERS].sort(() => Math.random() - 0.5);

  // Avoid conflicting modifiers (giant + haste is weird)
  const result: EliteModifier[] = [shuffled[0]];
  if (count === 2) {
    for (let i = 1; i < shuffled.length; i++) {
      const candidate = shuffled[i];
      // Skip giant+haste combo
      if (result.includes('giant') && candidate === 'haste') continue;
      if (result.includes('haste') && candidate === 'giant') continue;
      result.push(candidate);
      break;
    }
  }

  return result;
}

/** Apply elite stat modifiers to a freshly created enemy. */
export function applyEliteStats(enemy: EnemySnapshot): void {
  const mods = enemy.eliteModifiers;
  if (mods.length === 0) return;

  for (const mod of mods) {
    switch (mod) {
      case 'giant':
        enemy.maxHealth = Math.round(enemy.maxHealth * ELITE_GIANT_HP_MULT);
        enemy.health = enemy.maxHealth;
        enemy.damageMultiplier *= ELITE_GIANT_DAMAGE_MULT;
        enemy.speedMultiplier *= ELITE_GIANT_SPEED_MULT;
        break;
      case 'haste':
        enemy.speedMultiplier *= ELITE_HASTE_SPEED_MULT;
        enemy.attackCooldownTimer = 0; // Start ready to attack
        break;
      case 'vampiric':
      case 'thorns':
      case 'shielded':
      case 'berserker':
        // These are processed during combat, not as stat changes
        break;
    }
  }
}

/** Check if an elite enemy should reduce incoming frontal damage (shielded modifier). */
export function getEliteDamageReduction(
  enemy: EnemySnapshot,
  attackerPos: Vec2,
): number {
  if (!enemy.eliteModifiers.includes('shielded')) return 1.0;

  // Check if attacker is in front of enemy (within 60° of facing)
  const toAttacker = vec2Sub(attackerPos, enemy.position);
  const angleToAttacker = vec2Angle(toAttacker);
  const angleDiff = Math.abs(angleDifference(enemy.rotation, angleToAttacker));

  if (angleDiff < Math.PI / 3) {
    return ELITE_SHIELDED_FRONT_REDUCTION; // 50% damage from front
  }
  return 1.0;
}

/** Calculate vampiric healing for an elite enemy after dealing damage. */
export function getVampiricHeal(enemy: EnemySnapshot, damageDealt: number): number {
  if (!enemy.eliteModifiers.includes('vampiric')) return 0;
  return Math.round(damageDealt * ELITE_VAMPIRIC_HEAL_PCT);
}

/** Calculate thorns reflect damage for an elite enemy when hit. */
export function getThornsReflect(enemy: EnemySnapshot, damageReceived: number): number {
  if (!enemy.eliteModifiers.includes('thorns')) return 0;
  return Math.round(damageReceived * ELITE_THORNS_REFLECT_PCT);
}

/** Check if berserker mode should be active. */
export function isBerserkerActive(enemy: EnemySnapshot): boolean {
  if (!enemy.eliteModifiers.includes('berserker')) return false;
  return enemy.health / enemy.maxHealth < ELITE_BERSERKER_THRESHOLD;
}

/** Get effective speed multiplier accounting for elite modifiers. */
export function getEliteSpeedMultiplier(enemy: EnemySnapshot): number {
  let mult = 1.0;
  if (isBerserkerActive(enemy)) {
    mult *= ELITE_BERSERKER_SPEED_MULT;
  }
  return mult;
}

/** Get effective damage multiplier accounting for elite modifiers. */
export function getEliteDamageMultiplier(enemy: EnemySnapshot): number {
  let mult = 1.0;
  if (isBerserkerActive(enemy)) {
    mult *= ELITE_BERSERKER_DAMAGE_MULT;
  }
  return mult;
}

/** Get attack cooldown multiplier for haste enemies. */
export function getEliteAttackCooldownMultiplier(enemy: EnemySnapshot): number {
  if (enemy.eliteModifiers.includes('haste')) return ELITE_HASTE_ATTACK_MULT;
  return 1.0;
}
