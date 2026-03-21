import type { EntityId, EnemySnapshot, Vec2 } from '@curious/shared';
import { vec2, Vec2Zero } from '@curious/shared';
import { ENEMY_MAX_HEALTH } from '@curious/shared';

export function createEnemy(id: EntityId, position?: Vec2, leashOrigin?: Vec2): EnemySnapshot {
  const pos = position ?? vec2(0, 0);
  return {
    id,
    position: pos,
    rotation: 0,
    health: ENEMY_MAX_HEALTH,
    maxHealth: ENEMY_MAX_HEALTH,
    aiState: 'idle',
    knockbackVelocity: Vec2Zero,
    hitFlashTimer: 0,
    iFrameTimer: 0,
    dissolveProgress: 0,
    targetId: null,
    leashOrigin: leashOrigin ?? pos,
    attackCooldownTimer: 0,
    attackProgress: 0,
  };
}
