import type { EnemySnapshot, PlayerSnapshot, GameEvent, Vec2 } from '@curious/shared';
import {
  vec2Sub,
  vec2Add,
  vec2Normalize,
  vec2Scale,
  vec2Distance,
  vec2Angle,
  vec2Length,
  lerpAngle,
  clampVec2ToArena,
} from '@curious/shared';
import {
  ENEMY_SPEED,
  ENEMY_RADIUS,
  ENEMY_AGGRO_RANGE,
  ENEMY_LEASH_RANGE,
  ENEMY_ATTACK_RANGE,
  ENEMY_ATTACK_COOLDOWN,
  ENEMY_PUNCH_DAMAGE,
  ENEMY_PUNCH_DURATION,
  ENEMY_DESIRED_DISTANCE,
  ENEMY_SEPARATION_RADIUS,
  ENEMY_SEPARATION_FORCE,
  PLAYER_RADIUS,
  KNOCKBACK_PUNCH,
  IFRAME_DURATION,
  HIT_FLASH_DURATION,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
} from '@curious/shared';
import type { SimWorld } from './simulation';

const ENEMY_ROTATION_SPEED = 8;
const PUNCH_HIT_PROGRESS = 0.5; // check hit at 50% through punch

/**
 * Tick a single enemy's AI. Handles state transitions, movement, and attacks.
 * Returns events generated (e.g. damage to players).
 */
export function tickEnemyAI(
  enemy: EnemySnapshot,
  world: SimWorld,
  dt: number
): GameEvent[] {
  if (enemy.aiState === 'dying' || enemy.aiState === 'dead') return [];

  // Tick cooldown
  if (enemy.attackCooldownTimer > 0) {
    enemy.attackCooldownTimer = Math.max(0, enemy.attackCooldownTimer - dt);
  }

  const events: GameEvent[] = [];

  switch (enemy.aiState) {
    case 'idle':
      tickIdle(enemy, world);
      break;
    case 'chasing':
      tickChasing(enemy, world, dt);
      break;
    case 'attacking':
      events.push(...tickAttacking(enemy, world, dt));
      break;
  }

  // Clamp to arena
  enemy.position = clampVec2ToArena(
    enemy.position,
    ARENA_HALF_WIDTH,
    ARENA_HALF_HEIGHT,
    ENEMY_RADIUS
  );

  return events;
}

/** Find the nearest alive player within a given range. */
function findNearestPlayer(
  enemy: EnemySnapshot,
  world: SimWorld,
  range: number
): PlayerSnapshot | null {
  let nearest: PlayerSnapshot | null = null;
  let nearestDist = range;

  for (const player of world.players.values()) {
    if (player.state !== 'alive') continue;
    const dist = vec2Distance(enemy.position, player.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = player;
    }
  }

  return nearest;
}

/** Get the current target if still valid (alive + in leash range). */
function getValidTarget(
  enemy: EnemySnapshot,
  world: SimWorld
): PlayerSnapshot | null {
  if (!enemy.targetId) return null;
  const target = world.players.get(enemy.targetId);
  if (!target || target.state !== 'alive') return null;

  // Check leash range from spawn origin
  const distFromLeash = vec2Distance(enemy.position, enemy.leashOrigin);
  if (distFromLeash > ENEMY_LEASH_RANGE) return null;

  return target;
}

/** Face toward a position with smooth rotation. */
function faceToward(enemy: EnemySnapshot, targetPos: Vec2, dt: number): void {
  const toTarget = vec2Sub(targetPos, enemy.position);
  if (vec2Length(toTarget) < 0.1) return;
  const targetAngle = vec2Angle(toTarget);
  enemy.rotation = lerpAngle(enemy.rotation, targetAngle, ENEMY_ROTATION_SPEED * dt);
}

// --- State handlers ---

function tickIdle(enemy: EnemySnapshot, world: SimWorld): void {
  // Look for a player to aggro on
  const target = findNearestPlayer(enemy, world, ENEMY_AGGRO_RANGE);
  if (target) {
    enemy.targetId = target.id;
    enemy.aiState = 'chasing';
  }
}

function tickChasing(enemy: EnemySnapshot, world: SimWorld, dt: number): void {
  const target = getValidTarget(enemy, world);

  if (!target) {
    // Lost target — return to leash origin or go idle
    enemy.targetId = null;
    const distToHome = vec2Distance(enemy.position, enemy.leashOrigin);
    if (distToHome > 5) {
      // Walk back home
      const dir = vec2Normalize(vec2Sub(enemy.leashOrigin, enemy.position));
      enemy.position = vec2Add(enemy.position, vec2Scale(dir, ENEMY_SPEED * enemy.speedMultiplier * dt));
      faceToward(enemy, enemy.leashOrigin, dt);
    } else {
      enemy.aiState = 'idle';
    }
    return;
  }

  const dist = vec2Distance(enemy.position, target.position);

  // Close enough to punch?
  const attackReach = ENEMY_ATTACK_RANGE + ENEMY_RADIUS + PLAYER_RADIUS;
  if (dist <= attackReach && enemy.attackCooldownTimer <= 0) {
    enemy.aiState = 'attacking';
    enemy.attackProgress = 0;
    return;
  }

  // Move toward target, but STOP at desired combat distance
  if (dist > ENEMY_DESIRED_DISTANCE) {
    const dir = vec2Normalize(vec2Sub(target.position, enemy.position));
    enemy.position = vec2Add(enemy.position, vec2Scale(dir, ENEMY_SPEED * enemy.speedMultiplier * dt));
  }

  // Separation from other enemies — prevent stacking
  for (const other of world.enemies.values()) {
    if (other.id === enemy.id) continue;
    if (other.aiState === 'dead' || other.aiState === 'dying') continue;
    const d = vec2Distance(enemy.position, other.position);
    if (d < ENEMY_SEPARATION_RADIUS && d > 0.01) {
      const away = vec2Normalize(vec2Sub(enemy.position, other.position));
      const pushStrength = (1 - d / ENEMY_SEPARATION_RADIUS) * ENEMY_SEPARATION_FORCE * dt;
      enemy.position = vec2Add(enemy.position, vec2Scale(away, pushStrength));
    }
  }

  faceToward(enemy, target.position, dt);
}

function tickAttacking(
  enemy: EnemySnapshot,
  world: SimWorld,
  dt: number
): GameEvent[] {
  const events: GameEvent[] = [];
  const prevProgress = enemy.attackProgress;
  enemy.attackProgress += dt / ENEMY_PUNCH_DURATION;

  // Check hit at the midpoint of the punch
  if (prevProgress < PUNCH_HIT_PROGRESS && enemy.attackProgress >= PUNCH_HIT_PROGRESS) {
    const target = enemy.targetId ? world.players.get(enemy.targetId) : null;
    if (target && target.state === 'alive') {
      const dist = vec2Distance(enemy.position, target.position);
      const reach = ENEMY_ATTACK_RANGE + ENEMY_RADIUS + PLAYER_RADIUS;
      if (dist <= reach) {
        events.push(...applyPunchToPlayer(target, enemy));
      }
    }
  }

  // Punch complete
  if (enemy.attackProgress >= 1) {
    enemy.attackProgress = 0;
    enemy.attackCooldownTimer = ENEMY_ATTACK_COOLDOWN;

    // Return to chasing or idle
    const target = getValidTarget(enemy, world);
    enemy.aiState = target ? 'chasing' : 'idle';
    if (!target) enemy.targetId = null;
  }

  return events;
}

/** Apply punch damage to a player. */
function applyPunchToPlayer(
  player: PlayerSnapshot,
  enemy: EnemySnapshot
): GameEvent[] {
  if (player.iFrameTimer > 0) return [];
  if (player.state !== 'alive') return [];

  const events: GameEvent[] = [];

  const damage = Math.round(ENEMY_PUNCH_DAMAGE * enemy.damageMultiplier);
  player.health -= damage;
  player.hitFlashTimer = HIT_FLASH_DURATION;
  player.iFrameTimer = IFRAME_DURATION;

  // Knockback away from enemy
  const dir = vec2Normalize(vec2Sub(player.position, enemy.position));
  player.knockbackVelocity = vec2Scale(dir, KNOCKBACK_PUNCH);

  events.push({
    type: 'DAMAGE_TAKEN',
    entityId: player.id,
    amount: damage,
    newHealth: player.health,
  });

  if (player.health <= 0) {
    player.health = 0;
    player.state = 'dying';
    events.push({
      type: 'ENTITY_DIED',
      entityId: player.id,
      entityType: 'player',
    });
  }

  return events;
}
