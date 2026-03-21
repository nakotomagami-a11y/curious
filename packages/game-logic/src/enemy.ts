import type { EntityId, EnemySnapshot, EnemyType, EliteModifier, Vec2 } from '@curious/shared';
import { vec2, Vec2Zero } from '@curious/shared';
import {
  ENEMY_MAX_HEALTH, CASTER_MAX_HEALTH, DASHER_MAX_HEALTH,
  SHIELDER_MAX_HEALTH, SUMMONER_MAX_HEALTH, BOMBER_MAX_HEALTH,
  TELEPORTER_MAX_HEALTH, HEALER_MAX_HEALTH,
} from '@curious/shared';
import { rollEliteModifiers, applyEliteStats } from './elite';

export type StatScale = {
  healthMult: number;
  speedMult: number;
  damageMult: number;
};

export function createEnemy(
  id: EntityId,
  position?: Vec2,
  leashOrigin?: Vec2,
  enemyType: EnemyType = 'melee',
  statScale?: StatScale,
  forceEliteModifiers?: EliteModifier[],
): EnemySnapshot {
  const pos = position ?? vec2(0, 0);
  const baseHp = enemyType === 'caster' ? CASTER_MAX_HEALTH
               : enemyType === 'dasher' ? DASHER_MAX_HEALTH
               : enemyType === 'shielder' ? SHIELDER_MAX_HEALTH
               : enemyType === 'summoner' ? SUMMONER_MAX_HEALTH
               : enemyType === 'bomber' ? BOMBER_MAX_HEALTH
               : enemyType === 'teleporter' ? TELEPORTER_MAX_HEALTH
               : enemyType === 'healer' ? HEALER_MAX_HEALTH
               : ENEMY_MAX_HEALTH;
  const hp = Math.round(baseHp * (statScale?.healthMult ?? 1));
  const eliteModifiers = forceEliteModifiers ?? rollEliteModifiers();

  const enemy: EnemySnapshot = {
    id,
    enemyType,
    eliteModifiers,
    position: pos,
    rotation: 0,
    health: hp,
    maxHealth: hp,
    aiState: 'idle',
    knockbackVelocity: Vec2Zero,
    hitFlashTimer: 0,
    iFrameTimer: 0,
    dissolveProgress: 0,
    targetId: null,
    leashOrigin: leashOrigin ?? pos,
    attackCooldownTimer: 0,
    attackProgress: 0,
    speedMultiplier: statScale?.speedMult ?? 1,
    damageMultiplier: statScale?.damageMult ?? 1,
    buffs: [],
    dashDirection: Vec2Zero,
    dashTimer: 0,
    telegraphTimer: 0,
    recoveryTimer: 0,
  };

  // Apply elite stat modifications
  applyEliteStats(enemy);

  return enemy;
}
