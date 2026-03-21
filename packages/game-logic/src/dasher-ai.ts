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
  Vec2Zero,
} from '@curious/shared';
import {
  DASHER_SPEED,
  DASHER_AGGRO_RANGE,
  DASHER_LEASH_RANGE,
  DASHER_ATTACK_RANGE,
  DASHER_ATTACK_COOLDOWN,
  DASHER_TELEGRAPH_DURATION,
  DASHER_DASH_SPEED,
  DASHER_DASH_DURATION,
  DASHER_DASH_DAMAGE,
  DASHER_RECOVERY_DURATION,
  DASHER_DESIRED_DISTANCE,
  ENEMY_RADIUS,
  ENEMY_SEPARATION_RADIUS,
  ENEMY_SEPARATION_FORCE,
  PLAYER_RADIUS,
  KNOCKBACK_DASHER,
  IFRAME_DURATION,
  HIT_FLASH_DURATION,
  STUN_DURATION,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
} from '@curious/shared';
import type { SimWorld } from './simulation';

const DASHER_ROTATION_SPEED = 8;

export function tickDasherAI(
  enemy: EnemySnapshot,
  world: SimWorld,
  dt: number,
): GameEvent[] {
  if (enemy.aiState === 'dying' || enemy.aiState === 'dead') return [];

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
    case 'telegraphing':
      events.push(...tickTelegraphing(enemy, world, dt));
      break;
    case 'dashing':
      events.push(...tickDashing(enemy, world, dt));
      break;
    case 'recovering':
      tickRecovering(enemy, world, dt);
      break;
  }

  enemy.position = clampVec2ToArena(
    enemy.position,
    ARENA_HALF_WIDTH,
    ARENA_HALF_HEIGHT,
    ENEMY_RADIUS,
  );

  return events;
}

function findNearestPlayer(
  enemy: EnemySnapshot,
  world: SimWorld,
  range: number,
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

function getValidTarget(
  enemy: EnemySnapshot,
  world: SimWorld,
): PlayerSnapshot | null {
  if (!enemy.targetId) return null;
  const target = world.players.get(enemy.targetId);
  if (!target || target.state !== 'alive') return null;
  const distFromLeash = vec2Distance(enemy.position, enemy.leashOrigin);
  if (distFromLeash > DASHER_LEASH_RANGE) return null;
  return target;
}

function faceToward(enemy: EnemySnapshot, targetPos: Vec2, dt: number): void {
  const toTarget = vec2Sub(targetPos, enemy.position);
  if (vec2Length(toTarget) < 0.1) return;
  const targetAngle = vec2Angle(toTarget);
  enemy.rotation = lerpAngle(enemy.rotation, targetAngle, DASHER_ROTATION_SPEED * dt);
}

function applySeparation(enemy: EnemySnapshot, world: SimWorld, dt: number): void {
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
}

// --- State handlers ---

function tickIdle(enemy: EnemySnapshot, world: SimWorld): void {
  const target = findNearestPlayer(enemy, world, DASHER_AGGRO_RANGE);
  if (target) {
    enemy.targetId = target.id;
    enemy.aiState = 'chasing';
  }
}

function tickChasing(enemy: EnemySnapshot, world: SimWorld, dt: number): void {
  const target = getValidTarget(enemy, world);

  if (!target) {
    enemy.targetId = null;
    const distToHome = vec2Distance(enemy.position, enemy.leashOrigin);
    if (distToHome > 5) {
      const dir = vec2Normalize(vec2Sub(enemy.leashOrigin, enemy.position));
      enemy.position = vec2Add(enemy.position, vec2Scale(dir, DASHER_SPEED * enemy.speedMultiplier * dt));
      faceToward(enemy, enemy.leashOrigin, dt);
    } else {
      enemy.aiState = 'idle';
    }
    return;
  }

  const dist = vec2Distance(enemy.position, target.position);

  // In range and cooldown ready? Start telegraphing
  if (dist <= DASHER_ATTACK_RANGE && enemy.attackCooldownTimer <= 0) {
    enemy.aiState = 'telegraphing';
    enemy.telegraphTimer = 0;
    return;
  }

  // Move toward target
  if (dist > DASHER_DESIRED_DISTANCE) {
    const toward = vec2Normalize(vec2Sub(target.position, enemy.position));
    enemy.position = vec2Add(enemy.position, vec2Scale(toward, DASHER_SPEED * enemy.speedMultiplier * dt));
  }

  applySeparation(enemy, world, dt);
  faceToward(enemy, target.position, dt);
}

function tickTelegraphing(
  enemy: EnemySnapshot,
  world: SimWorld,
  dt: number,
): GameEvent[] {
  const events: GameEvent[] = [];

  if (enemy.telegraphTimer === 0) {
    // Lock direction at start of telegraph
    const target = enemy.targetId ? world.players.get(enemy.targetId) : null;
    if (target && target.state === 'alive') {
      enemy.dashDirection = vec2Normalize(vec2Sub(target.position, enemy.position));
    } else {
      // Face forward
      enemy.dashDirection = { x: Math.sin(enemy.rotation), z: Math.cos(enemy.rotation) };
    }
    events.push({
      type: 'DASHER_TELEGRAPH',
      enemyId: enemy.id,
      direction: { ...enemy.dashDirection },
      duration: DASHER_TELEGRAPH_DURATION,
    });
  }

  enemy.telegraphTimer += dt;

  if (enemy.telegraphTimer >= DASHER_TELEGRAPH_DURATION) {
    enemy.aiState = 'dashing';
    enemy.dashTimer = 0;
    enemy.telegraphTimer = 0;
    events.push({
      type: 'DASHER_DASH_START',
      enemyId: enemy.id,
      direction: { ...enemy.dashDirection },
    });
  }

  return events;
}

function tickDashing(
  enemy: EnemySnapshot,
  world: SimWorld,
  dt: number,
): GameEvent[] {
  const events: GameEvent[] = [];

  enemy.dashTimer += dt;
  enemy.position = vec2Add(enemy.position, vec2Scale(enemy.dashDirection, DASHER_DASH_SPEED * dt));

  // Check collision with players
  for (const player of world.players.values()) {
    if (player.state !== 'alive') continue;
    if (player.iFrameTimer > 0) continue;

    const dist = vec2Distance(enemy.position, player.position);
    if (dist < ENEMY_RADIUS + PLAYER_RADIUS) {
      const dmg = Math.round(DASHER_DASH_DAMAGE * enemy.damageMultiplier);
      player.health -= dmg;
      player.hitFlashTimer = HIT_FLASH_DURATION;
      player.iFrameTimer = IFRAME_DURATION;
      player.stunTimer = STUN_DURATION;

      const knockDir = vec2Normalize(enemy.dashDirection);
      player.knockbackVelocity = vec2Scale(knockDir, KNOCKBACK_DASHER);

      events.push({
        type: 'DAMAGE_TAKEN',
        entityId: player.id,
        amount: dmg,
        newHealth: player.health,
      });
      events.push({
        type: 'PLAYER_STUNNED',
        playerId: player.id,
        duration: STUN_DURATION,
      });

      if (player.health <= 0) {
        player.health = 0;
        player.state = 'dying';
        events.push({ type: 'ENTITY_DIED', entityId: player.id, entityType: 'player' });
      }
    }
  }

  if (enemy.dashTimer >= DASHER_DASH_DURATION) {
    enemy.aiState = 'recovering';
    enemy.recoveryTimer = DASHER_RECOVERY_DURATION;
    enemy.dashTimer = 0;
  }

  return events;
}

function tickRecovering(enemy: EnemySnapshot, world: SimWorld, dt: number): void {
  enemy.recoveryTimer -= dt;
  if (enemy.recoveryTimer <= 0) {
    enemy.recoveryTimer = 0;
    enemy.attackCooldownTimer = DASHER_ATTACK_COOLDOWN;
    const target = getValidTarget(enemy, world);
    enemy.aiState = target ? 'chasing' : 'idle';
    if (!target) enemy.targetId = null;
  }
}
