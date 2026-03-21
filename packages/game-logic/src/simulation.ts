import type {
  EntityId,
  PlayerSnapshot,
  EnemySnapshot,
  BossSnapshot,
  GameEvent,
  Vec2,
} from '@curious/shared';
import {
  vec2,
  vec2Add,
  vec2Scale,
  vec2Length,
  vec2Normalize,
  Vec2Zero,
  clampVec2ToArena,
} from '@curious/shared';
import {
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
  PLAYER_RADIUS,
  ENEMY_RADIUS,
  BOSS_RADIUS,
  KNOCKBACK_DECAY,
  KNOCKBACK_MIN_THRESHOLD,
  IFRAME_DURATION,
  HIT_FLASH_DURATION,
  DISSOLVE_DURATION,
  DEATH_ROTATE_DURATION,
  DEATH_DELAY_BEFORE_DISSOLVE,
} from '@curious/shared';
import { separateCircles } from './collision';
import type { Circle } from './collision';
import { tickEnemyAI } from './enemy-ai';
import { tickBossAI } from './boss-ai';
import { tickSpawner } from './spawner';
import { BOSS_RESPAWN_DELAY, BOSS_MAX_HEALTH } from '@curious/shared';

export type SimWorld = {
  players: Map<EntityId, PlayerSnapshot>;
  enemies: Map<EntityId, EnemySnapshot>;
  boss: BossSnapshot | null;
  events: GameEvent[];
  time: number;
};

export function createWorld(): SimWorld {
  return {
    players: new Map(),
    enemies: new Map(),
    boss: null,
    events: [],
    time: 0,
  };
}

let nextId = 0;
export function generateEntityId(prefix: string): EntityId {
  return `${prefix}_${++nextId}`;
}
export function resetEntityIdCounter(): void {
  nextId = 0;
}

// --- Core tick ---

export function tickWorld(world: SimWorld, dt: number): void {
  world.time += dt;
  world.events = [];

  // Tick all players
  for (const player of world.players.values()) {
    tickPlayerTimers(player, dt);
    applyKnockback(player, dt);
    clampPlayerToArena(player);

    // Player death animation: tilt → pause → dissolve → dead
    if (player.state === 'dying') {
      player.deathTimer += dt;
      const dissolveStart = DEATH_ROTATE_DURATION + DEATH_DELAY_BEFORE_DISSOLVE;
      const totalDeath = dissolveStart + DISSOLVE_DURATION;

      if (player.deathTimer >= dissolveStart) {
        player.dissolveProgress = Math.min(
          (player.deathTimer - dissolveStart) / DISSOLVE_DURATION,
          1
        );
      }

      if (player.deathTimer >= totalDeath) {
        player.state = 'dead';
        player.dissolveProgress = 1;
      }
    }
  }

  // Tick all enemies
  for (const enemy of world.enemies.values()) {
    // AI state machine (idle/chase/attack)
    const aiEvents = tickEnemyAI(enemy, world, dt);
    world.events.push(...aiEvents);
    tickEnemyTimers(enemy, dt);
    applyKnockbackEnemy(enemy, dt);
    // dying → dead transition
    if (enemy.aiState === 'dying') {
      enemy.dissolveProgress += dt / DISSOLVE_DURATION;
      if (enemy.dissolveProgress >= 1) {
        enemy.aiState = 'dead';
        enemy.dissolveProgress = 1;
      }
    }
  }

  // Tick boss
  if (world.boss) {
    // Boss AI (handles idle/chasing/telegraphing/jumping/slamming/recovering)
    const bossEvents = tickBossAI(world.boss, world, dt);
    world.events.push(...bossEvents);

    tickBossTimers(world.boss, dt);
    applyKnockbackBoss(world.boss, dt);

    if (world.boss.aiState === 'dying') {
      world.boss.dissolveProgress += dt / DISSOLVE_DURATION;
      if (world.boss.dissolveProgress >= 1) {
        world.boss.aiState = 'dead';
        world.boss.dissolveProgress = 1;
        world.boss.respawnTimer = BOSS_RESPAWN_DELAY;
      }
    }

    // Boss respawn countdown
    if (world.boss.aiState === 'dead') {
      world.boss.respawnTimer -= dt;
      if (world.boss.respawnTimer <= 0) {
        // Reset boss
        world.boss.health = BOSS_MAX_HEALTH;
        world.boss.maxHealth = BOSS_MAX_HEALTH;
        world.boss.aiState = 'idle';
        world.boss.position = { x: 0, z: -250 };
        world.boss.rotation = 0;
        world.boss.dissolveProgress = 0;
        world.boss.respawnTimer = 0;
        world.boss.slamProgress = 0;
        world.boss.slamTargetPosition = null;
        world.boss.slamCooldownTimer = 0;
        world.boss.targetId = null;
        world.boss.knockbackVelocity = Vec2Zero;
        world.boss.hitFlashTimer = 0;
        world.boss.iFrameTimer = 0;
        world.events.push({
          type: 'ENTITY_SPAWNED',
          entityId: world.boss.id,
          entityType: 'boss',
          position: { ...world.boss.position },
        });
      }
    }
  }

  // Spawner — maintain enemy count, respawn dead enemies
  tickSpawner(world, dt);

  // Resolve collisions
  resolveCollisions(world);
}

// --- Collision resolution ---

type Collidable = { position: Vec2; radius: number };

function resolveCollisions(world: SimWorld): void {
  // Gather all collidable entities
  const entities: { obj: Collidable; isStatic: boolean }[] = [];

  for (const p of world.players.values()) {
    if (p.state !== 'dead' && p.state !== 'dying') entities.push({ obj: { position: p.position, radius: PLAYER_RADIUS }, isStatic: false });
  }
  for (const e of world.enemies.values()) {
    if (e.aiState !== 'dead' && e.aiState !== 'dying') entities.push({ obj: { position: e.position, radius: ENEMY_RADIUS }, isStatic: false });
  }
  if (world.boss && world.boss.aiState !== 'dead' && world.boss.aiState !== 'dying') {
    // Boss is static during slam sequence — only players/enemies get pushed out
    const bossStatic = world.boss.aiState === 'jumping' || world.boss.aiState === 'slamming' || world.boss.aiState === 'recovering';
    entities.push({ obj: { position: world.boss.position, radius: BOSS_RADIUS }, isStatic: bossStatic });
  }

  // O(n^2) pairwise — fine for small entity counts
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];
      const result = separateCircles(
        { position: a.obj.position, radius: a.obj.radius },
        { position: b.obj.position, radius: b.obj.radius }
      );
      if (result) {
        // Static entities don't move — their share goes to the other
        if (a.isStatic && b.isStatic) continue;
        if (a.isStatic) {
          b.obj.position = vec2Add(b.obj.position, vec2Add(result.pushB, vec2Scale(result.pushA, -1)));
        } else if (b.isStatic) {
          a.obj.position = vec2Add(a.obj.position, vec2Add(result.pushA, vec2Scale(result.pushB, -1)));
        } else {
          a.obj.position = vec2Add(a.obj.position, result.pushA);
          b.obj.position = vec2Add(b.obj.position, result.pushB);
        }
      }
    }
  }
}

// --- Player helpers ---

function tickPlayerTimers(p: PlayerSnapshot, dt: number): void {
  if (p.iFrameTimer > 0) p.iFrameTimer = Math.max(0, p.iFrameTimer - dt);
  if (p.hitFlashTimer > 0) p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);
  if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - dt);
  if (p.dashCooldownTimer > 0) p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - dt);
}

function applyKnockback(p: PlayerSnapshot, dt: number): void {
  if (vec2Length(p.knockbackVelocity) > KNOCKBACK_MIN_THRESHOLD) {
    p.position = vec2Add(p.position, vec2Scale(p.knockbackVelocity, dt));
    p.knockbackVelocity = vec2Scale(p.knockbackVelocity, KNOCKBACK_DECAY);
  } else {
    p.knockbackVelocity = Vec2Zero;
  }
}

function clampPlayerToArena(p: PlayerSnapshot): void {
  p.position = clampVec2ToArena(
    p.position,
    ARENA_HALF_WIDTH,
    ARENA_HALF_HEIGHT,
    PLAYER_RADIUS
  );
}

// --- Enemy helpers ---

function tickEnemyTimers(e: EnemySnapshot, dt: number): void {
  if (e.iFrameTimer > 0) e.iFrameTimer = Math.max(0, e.iFrameTimer - dt);
  if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
}

function applyKnockbackEnemy(e: EnemySnapshot, dt: number): void {
  if (vec2Length(e.knockbackVelocity) > KNOCKBACK_MIN_THRESHOLD) {
    e.position = vec2Add(e.position, vec2Scale(e.knockbackVelocity, dt));
    e.knockbackVelocity = vec2Scale(e.knockbackVelocity, KNOCKBACK_DECAY);
  } else {
    e.knockbackVelocity = Vec2Zero;
  }
}

// --- Boss helpers ---

function tickBossTimers(b: BossSnapshot, dt: number): void {
  if (b.iFrameTimer > 0) b.iFrameTimer = Math.max(0, b.iFrameTimer - dt);
  if (b.hitFlashTimer > 0) b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);
}

function applyKnockbackBoss(b: BossSnapshot, dt: number): void {
  if (vec2Length(b.knockbackVelocity) > KNOCKBACK_MIN_THRESHOLD) {
    b.position = vec2Add(b.position, vec2Scale(b.knockbackVelocity, dt));
    b.knockbackVelocity = vec2Scale(b.knockbackVelocity, KNOCKBACK_DECAY);
  } else {
    b.knockbackVelocity = Vec2Zero;
  }
}
