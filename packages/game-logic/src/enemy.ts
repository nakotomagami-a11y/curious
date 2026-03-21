import type { EntityId, EnemySnapshot, EnemyType, Vec2 } from '@curious/shared';
import { vec2, Vec2Zero } from '@curious/shared';
import { ENEMY_MAX_HEALTH, CASTER_MAX_HEALTH, DASHER_MAX_HEALTH } from '@curious/shared';

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
): EnemySnapshot {
  const pos = position ?? vec2(0, 0);
  const baseHp = enemyType === 'caster' ? CASTER_MAX_HEALTH
               : enemyType === 'dasher' ? DASHER_MAX_HEALTH
               : ENEMY_MAX_HEALTH;
  const hp = Math.round(baseHp * (statScale?.healthMult ?? 1));
  return {
    id,
    enemyType,
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
}
