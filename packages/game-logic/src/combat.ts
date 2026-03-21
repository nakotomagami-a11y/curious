import type {
  PlayerSnapshot,
  EnemySnapshot,
  BossSnapshot,
  AttackState,
  GameEvent,
  Vec2,
} from '@curious/shared';
import {
  SLASH_DURATION,
  SLASH_SWEEP_ANGLE,
  SLASH_HOLD_DURATION,
  ATTACK_COOLDOWN,
  COMBO_RESET_TIME,
  SWORD_REACH,
  SWORD_DAMAGE,
  PLAYER_RADIUS,
  ENEMY_RADIUS,
  BOSS_RADIUS,
  KNOCKBACK_SWORD,
  IFRAME_DURATION,
  HIT_FLASH_DURATION,
  STAMINA_COST_ATTACK,
} from '@curious/shared';
import {
  vec2Sub,
  vec2Normalize,
  vec2Scale,
  vec2Distance,
  vec2Angle,
  vec2FromAngle,
  angleDifference,
} from '@curious/shared';

/** Try to start an attack. Returns true if attack started. */
export function tryStartAttack(
  player: PlayerSnapshot,
  worldTime: number
): boolean {
  if (player.stamina < STAMINA_COST_ATTACK) return false;
  if (player.stunTimer > 0) return false;

  // During hold phase (progress >= 1.0) — allow combo chain
  if (player.attackState !== null) {
    if (player.attackState.progress >= 1.0) {
      player.stamina -= STAMINA_COST_ATTACK;
      const comboIndex = player.attackState.comboIndex === 0 ? 1 : 0;
      player.lastAttackTime = worldTime;
      player.lastComboIndex = player.attackState.comboIndex;
      player.attackState = {
        comboIndex,
        progress: 0,
        startTime: worldTime,
      };
      return true;
    }
    return false; // still in active swing
  }

  // Still on cooldown
  if (worldTime - player.lastAttackTime < ATTACK_COOLDOWN) return false;

  // Determine combo index — alternate L/R, reset after idle
  let comboIndex = 0;
  if (worldTime - player.lastAttackTime < COMBO_RESET_TIME) {
    comboIndex = player.lastComboIndex === 0 ? 1 : 0;
  }

  player.stamina -= STAMINA_COST_ATTACK;
  player.attackState = {
    comboIndex,
    progress: 0,
    startTime: worldTime,
  };

  return true;
}

/** Tick the attack state. Progress 0→1 = swing, 1→holdEnd = hold phase. */
export function tickAttack(
  player: PlayerSnapshot,
  dt: number,
  worldTime: number
): void {
  if (!player.attackState) return;

  player.attackState.progress += dt / SLASH_DURATION;

  // Hold phase ends after SLASH_HOLD_DURATION past the swing
  const holdEnd = 1.0 + SLASH_HOLD_DURATION / SLASH_DURATION;
  if (player.attackState.progress >= holdEnd) {
    player.lastAttackTime = worldTime;
    player.lastComboIndex = player.attackState.comboIndex;
    player.attackState = null;
  }
}

/** Check if a slash arc hits a target circle. */
export function checkSlashHit(
  playerPos: Vec2,
  playerRotation: number,
  attackState: AttackState,
  targetPos: Vec2,
  targetRadius: number
): boolean {
  const dist = vec2Distance(playerPos, targetPos);
  const reach = SWORD_REACH + PLAYER_RADIUS + targetRadius;

  // Range check
  if (dist > reach) return false;

  // Angle check — is target within the sweep arc?
  const toTarget = vec2Sub(targetPos, playerPos);
  const angleToTarget = vec2Angle(toTarget);
  const halfSweep = SLASH_SWEEP_ANGLE / 2;

  const diff = Math.abs(angleDifference(playerRotation, angleToTarget));
  return diff < halfSweep;
}

/** Apply hit results to an enemy. */
export function applyHitToEnemy(
  enemy: EnemySnapshot,
  damage: number,
  attackerPos: Vec2
): GameEvent[] {
  if (enemy.iFrameTimer > 0) return [];
  if (enemy.aiState === 'dead' || enemy.aiState === 'dying') return [];

  const events: GameEvent[] = [];

  enemy.health -= damage;
  enemy.hitFlashTimer = HIT_FLASH_DURATION;
  enemy.iFrameTimer = IFRAME_DURATION;

  // Knockback away from attacker
  const dir = vec2Normalize(vec2Sub(enemy.position, attackerPos));
  enemy.knockbackVelocity = vec2Scale(dir, KNOCKBACK_SWORD);

  events.push({
    type: 'DAMAGE_TAKEN',
    entityId: enemy.id,
    amount: damage,
    newHealth: enemy.health,
  });

  if (enemy.health <= 0) {
    enemy.health = 0;
    enemy.aiState = 'dying';
    events.push({
      type: 'ENTITY_DIED',
      entityId: enemy.id,
      entityType: 'enemy',
    });
  }

  return events;
}

/** Apply hit results to a boss. */
export function applyHitToBoss(
  boss: BossSnapshot,
  damage: number,
  attackerPos: Vec2
): GameEvent[] {
  if (boss.iFrameTimer > 0) return [];
  if (boss.aiState === 'dead' || boss.aiState === 'dying') return [];

  const events: GameEvent[] = [];

  boss.health -= damage;
  boss.hitFlashTimer = HIT_FLASH_DURATION;
  boss.iFrameTimer = IFRAME_DURATION;

  const dir = vec2Normalize(vec2Sub(boss.position, attackerPos));
  boss.knockbackVelocity = vec2Scale(dir, KNOCKBACK_SWORD * 0.5); // Boss resists knockback

  events.push({
    type: 'DAMAGE_TAKEN',
    entityId: boss.id,
    amount: damage,
    newHealth: boss.health,
  });

  if (boss.health <= 0) {
    boss.health = 0;
    boss.aiState = 'dying';
    events.push({
      type: 'ENTITY_DIED',
      entityId: boss.id,
      entityType: 'boss',
    });
  }

  return events;
}
