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
  CASTER_SPEED,
  CASTER_AGGRO_RANGE,
  CASTER_LEASH_RANGE,
  CASTER_ATTACK_RANGE,
  CASTER_ATTACK_COOLDOWN,
  CASTER_CAST_DURATION,
  CASTER_DESIRED_DISTANCE,
  CASTER_FLEE_DISTANCE,
  ENEMY_RADIUS,
  ENEMY_SEPARATION_RADIUS,
  ENEMY_SEPARATION_FORCE,
  PLAYER_RADIUS,
  PROJECTILE_SPEED,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
} from '@curious/shared';
import type { SimWorld } from './simulation';
import { generateEntityId } from './simulation';
import { createProjectile } from './projectile';

const CASTER_ROTATION_SPEED = 8;

export function tickCasterAI(
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
    case 'attacking':
      events.push(...tickCasting(enemy, world, dt));
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
  if (distFromLeash > CASTER_LEASH_RANGE) return null;

  return target;
}

function faceToward(enemy: EnemySnapshot, targetPos: Vec2, dt: number): void {
  const toTarget = vec2Sub(targetPos, enemy.position);
  if (vec2Length(toTarget) < 0.1) return;
  const targetAngle = vec2Angle(toTarget);
  enemy.rotation = lerpAngle(enemy.rotation, targetAngle, CASTER_ROTATION_SPEED * dt);
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
  const target = findNearestPlayer(enemy, world, CASTER_AGGRO_RANGE);
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
      enemy.position = vec2Add(enemy.position, vec2Scale(dir, CASTER_SPEED * enemy.speedMultiplier * dt));
      faceToward(enemy, enemy.leashOrigin, dt);
    } else {
      enemy.aiState = 'idle';
    }
    return;
  }

  const dist = vec2Distance(enemy.position, target.position);

  // In range and cooldown ready? Start casting
  if (dist <= CASTER_ATTACK_RANGE && enemy.attackCooldownTimer <= 0) {
    enemy.aiState = 'attacking';
    enemy.attackProgress = 0;
    return;
  }

  // Kiting: flee if player too close
  if (dist < CASTER_FLEE_DISTANCE) {
    const away = vec2Normalize(vec2Sub(enemy.position, target.position));
    enemy.position = vec2Add(enemy.position, vec2Scale(away, CASTER_SPEED * enemy.speedMultiplier * dt));
  } else if (dist > CASTER_DESIRED_DISTANCE) {
    // Approach but maintain range
    const toward = vec2Normalize(vec2Sub(target.position, enemy.position));
    enemy.position = vec2Add(enemy.position, vec2Scale(toward, CASTER_SPEED * enemy.speedMultiplier * dt));
  }

  applySeparation(enemy, world, dt);
  faceToward(enemy, target.position, dt);
}

function tickCasting(
  enemy: EnemySnapshot,
  world: SimWorld,
  dt: number,
): GameEvent[] {
  const events: GameEvent[] = [];
  enemy.attackProgress += dt / CASTER_CAST_DURATION;

  // Keep facing target during cast
  const target = enemy.targetId ? world.players.get(enemy.targetId) : null;
  if (target && target.state === 'alive') {
    faceToward(enemy, target.position, dt);
  }

  // Cast complete — spawn projectile
  if (enemy.attackProgress >= 1) {
    if (target && target.state === 'alive') {
      const dir = vec2Normalize(vec2Sub(target.position, enemy.position));
      const velocity = vec2Scale(dir, PROJECTILE_SPEED);
      const spawnPos = vec2Add(enemy.position, vec2Scale(dir, ENEMY_RADIUS + 5));

      const projId = generateEntityId('proj');
      const proj = createProjectile(projId, enemy.id, spawnPos, velocity, 'enemy', false);
      world.projectiles.set(projId, proj);

      events.push({
        type: 'PROJECTILE_SPAWNED',
        projectileId: projId,
        ownerId: enemy.id,
        position: { ...spawnPos },
        velocity: { ...velocity },
      });
    }

    enemy.attackProgress = 0;
    enemy.attackCooldownTimer = CASTER_ATTACK_COOLDOWN;

    const validTarget = getValidTarget(enemy, world);
    enemy.aiState = validTarget ? 'chasing' : 'idle';
    if (!validTarget) enemy.targetId = null;
  }

  return events;
}
