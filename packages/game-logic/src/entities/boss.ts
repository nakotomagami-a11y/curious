import type { EntityId, BossSnapshot, BossType, Vec2 } from '@curious/shared';
import { vec2, Vec2Zero } from '@curious/shared';
import { BOSS_MAX_HEALTH, HYDRA_MAX_HEALTH, MAGE_BOSS_MAX_HEALTH } from '@curious/shared';

export function createBoss(id: EntityId, position?: Vec2, bossType: BossType = 'guardian'): BossSnapshot {
  const maxHealth = bossType === 'hydra' ? HYDRA_MAX_HEALTH
    : bossType === 'mage' ? MAGE_BOSS_MAX_HEALTH
    : BOSS_MAX_HEALTH;

  return {
    id,
    bossType,
    phase: 1,
    rageMode: false,
    position: position ?? vec2(0, 0),
    rotation: 0,
    health: maxHealth,
    maxHealth,
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
