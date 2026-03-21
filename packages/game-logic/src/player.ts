import type { EntityId, PlayerSnapshot, Vec2 } from '@curious/shared';
import { vec2, Vec2Zero, vec2Length, vec2Normalize } from '@curious/shared';
import { PLAYER_MAX_HEALTH, SWORD_DAMAGE, DASH_DURATION, DASH_COOLDOWN } from '@curious/shared';

export function createPlayer(id: EntityId, name: string, position?: Vec2): PlayerSnapshot {
  return {
    id,
    name,
    position: position ?? vec2(0, 0),
    rotation: 0,
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    state: 'alive',
    attackState: null,
    knockbackVelocity: Vec2Zero,
    hitFlashTimer: 0,
    iFrameTimer: 0,
    lastAttackTime: 0,
    lastComboIndex: 1, // start at 1 so first attack uses 0
    swordDamage: SWORD_DAMAGE,
    dissolveProgress: 0,
    deathTimer: 0,
    dashTimer: 0,
    dashCooldownTimer: 0,
    dashDirection: Vec2Zero,
  };
}

export function applyPlayerMovement(
  player: PlayerSnapshot,
  moveDir: Vec2,
  speed: number,
  dt: number
): void {
  if (player.state !== 'alive') return;

  player.position = {
    x: player.position.x + moveDir.x * speed * dt,
    z: player.position.z + moveDir.z * speed * dt,
  };
}

export function tryStartDash(player: PlayerSnapshot, moveDir: Vec2): boolean {
  if (player.state !== 'alive') return false;
  if (player.dashTimer > 0) return false;
  if (player.dashCooldownTimer > 0) return false;
  if (vec2Length(moveDir) < 0.01) return false;

  player.dashTimer = DASH_DURATION;
  player.dashCooldownTimer = DASH_COOLDOWN;
  player.dashDirection = vec2Normalize(moveDir);

  // Cancel any active attack
  player.attackState = null;

  return true;
}

export function setPlayerRotation(player: PlayerSnapshot, aimAngle: number): void {
  if (player.state !== 'alive') return;
  player.rotation = aimAngle;
}
