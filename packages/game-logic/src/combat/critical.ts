import type { Vec2, EnemyAIState, BossAIState } from '@curious/shared';
import { vec2Sub, vec2Angle, angleDifference } from '@curious/shared';
import {
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  BACKSTAB_CRIT_BONUS,
  TELEGRAPH_CRIT_BONUS,
} from '@curious/shared';

export type CritResult = {
  isCrit: boolean;
  multiplier: number;
};

/**
 * Roll for a critical hit.
 * - Base 15% chance
 * - +30% if attacking from behind (angle > 120° from target facing)
 * - +100% if target is telegraphing/casting an attack
 */
export function rollCritical(
  attackerPos: Vec2,
  targetPos: Vec2,
  targetRotation: number,
  targetAIState: EnemyAIState | BossAIState,
): CritResult {
  let chance = CRIT_CHANCE;

  // Backstab bonus: check if attacker is behind the target
  const toAttacker = vec2Sub(attackerPos, targetPos);
  const angleToAttacker = vec2Angle(toAttacker);
  const angleDiff = Math.abs(angleDifference(targetRotation, angleToAttacker));
  // Behind = attacker is more than 120° away from target's facing direction
  if (angleDiff > (120 * Math.PI) / 180) {
    chance += BACKSTAB_CRIT_BONUS;
  }

  // Telegraph bonus: guaranteed crit when target is winding up
  const telegraphStates: (EnemyAIState | BossAIState)[] = ['telegraphing', 'attacking'];
  if (telegraphStates.includes(targetAIState)) {
    chance += TELEGRAPH_CRIT_BONUS;
  }

  const isCrit = Math.random() < chance;
  return {
    isCrit,
    multiplier: isCrit ? CRIT_MULTIPLIER : 1.0,
  };
}
