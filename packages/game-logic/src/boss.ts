import type { EntityId, BossSnapshot, Vec2 } from '@curious/shared';
import { vec2, Vec2Zero } from '@curious/shared';
import { BOSS_MAX_HEALTH } from '@curious/shared';

export function createBoss(id: EntityId, position?: Vec2): BossSnapshot {
  return {
    id,
    position: position ?? vec2(0, 0),
    rotation: 0,
    health: BOSS_MAX_HEALTH,
    maxHealth: BOSS_MAX_HEALTH,
    aiState: 'idle',
    slamTargetPosition: null,
    slamProgress: 0,
    knockbackVelocity: Vec2Zero,
    hitFlashTimer: 0,
    iFrameTimer: 0,
    dissolveProgress: 0,
    respawnTimer: 0,
    slamCooldownTimer: 0,
    targetId: null,
  };
}
