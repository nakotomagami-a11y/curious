import type {
  EntityId,
  PlayerSnapshot,
  EnemySnapshot,
  BossSnapshot,
  ProjectileSnapshot,
  SpellDropSnapshot,
  ZoneSnapshot,
  SpellId,
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
  STAMINA_REGEN_RATE,
  STAMINA_REGEN_RATE_IDLE,
  MANA_REGEN_RATE,
  PLAYER_HEALTH_REGEN_RATE,
} from '@curious/shared';
import { separateCircles } from './combat/collision';
import type { Circle } from './combat/collision';
import { createSpatialGrid, clearGrid, insertEntity, getNearbyEntities } from './combat/spatial-grid';
import { tickEnemyAI } from './ai/enemy-ai';
import { tickCasterAI } from './ai/caster-ai';
import { tickDasherAI } from './ai/dasher-ai';
import { tickShielderAI } from './ai/shielder-ai';
import { tickSummonerAI } from './ai/summoner-ai';
import { tickBomberAI } from './ai/bomber-ai';
import { tickTeleporterAI } from './ai/teleporter-ai';
import { tickHealerAI } from './ai/healer-ai';
import { tickBossAI } from './ai/boss-ai';
import { tickSpawner } from './spawning/spawner';
import { tickProjectiles } from './combat/projectile';
import { tickBuffs } from './entities/buffs';
import { tickSurvival } from './spawning/survival-spawner';
import { tickZones } from './spells/zones';
import { tickSpellDrops, rollSpellDrop, checkAutoPickup } from './spells/spell-drops';
import { BOSS_RESPAWN_DELAY, BOSS_MAX_HEALTH } from '@curious/shared';

export type SurvivalState = {
  wave: number;
  enemiesRemaining: number;
  enemiesTotal: number;
  waveActive: boolean;
  megaBossSpawned: boolean;
};

export type SimWorld = {
  players: Map<EntityId, PlayerSnapshot>;
  enemies: Map<EntityId, EnemySnapshot>;
  projectiles: Map<EntityId, ProjectileSnapshot>;
  spellDrops: Map<EntityId, SpellDropSnapshot>;
  zones: Map<EntityId, ZoneSnapshot>;
  boss: BossSnapshot | null;
  events: GameEvent[];
  time: number;
  survival: SurvivalState | null;
  /** Dev playground mode — infinite spells, no consumables */
  devMode: boolean;
};

export function createWorld(): SimWorld {
  return {
    players: new Map(),
    enemies: new Map(),
    projectiles: new Map(),
    spellDrops: new Map(),
    zones: new Map(),
    boss: null,
    events: [],
    time: 0,
    survival: null,
    devMode: false,
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

    // Tick buffs
    if (player.state === 'alive') {
      const healthRef = { current: player.health };
      const buffEvents = tickBuffs(player.id, player.buffs, healthRef, dt);
      player.health = healthRef.current;
      world.events.push(...buffEvents);

      // Check death from burn
      if (player.health <= 0 && player.state === 'alive') {
        player.health = 0;
        player.state = 'dying';
        world.events.push({ type: 'ENTITY_DIED', entityId: player.id, entityType: 'player' });
      }
    }

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
    // AI state machine — dispatch based on enemy type
    let aiEvents: GameEvent[];
    switch (enemy.enemyType) {
      case 'caster':     aiEvents = tickCasterAI(enemy, world, dt); break;
      case 'dasher':     aiEvents = tickDasherAI(enemy, world, dt); break;
      case 'shielder':   aiEvents = tickShielderAI(enemy, world, dt); break;
      case 'summoner':   aiEvents = tickSummonerAI(enemy, world, dt); break;
      case 'bomber':     aiEvents = tickBomberAI(enemy, world, dt); break;
      case 'teleporter': aiEvents = tickTeleporterAI(enemy, world, dt); break;
      case 'healer':     aiEvents = tickHealerAI(enemy, world, dt); break;
      default:           aiEvents = tickEnemyAI(enemy, world, dt); break;
    }
    world.events.push(...aiEvents);
    tickEnemyTimers(enemy, dt);
    applyKnockbackEnemy(enemy, dt);

    // Tick enemy buffs
    if (enemy.aiState !== 'dying' && enemy.aiState !== 'dead') {
      const healthRef = { current: enemy.health };
      const enemyBuffEvents = tickBuffs(enemy.id, enemy.buffs, healthRef, dt);
      enemy.health = healthRef.current;
      world.events.push(...enemyBuffEvents);

      if (enemy.health <= 0) {
        enemy.health = 0;
        enemy.aiState = 'dying';
        world.events.push({ type: 'ENTITY_DIED', entityId: enemy.id, entityType: 'enemy' });
      }
    }

    // dying → dead transition
    if (enemy.aiState === 'dying') {
      enemy.dissolveProgress += dt / DISSOLVE_DURATION;
      if (enemy.dissolveProgress >= 1) {
        enemy.aiState = 'dead';
        enemy.dissolveProgress = 1;
      }
    }
  }

  // Auto-pickup spell drops for all players
  for (const player of world.players.values()) {
    if (player.state === 'alive') {
      const pickupEvents = checkAutoPickup(player, world);
      world.events.push(...pickupEvents);
    }
  }

  // Tick spell drop lifetimes
  tickSpellDrops(world, dt);

  // Tick zones (heal circles, shield bubbles, gravity wells)
  const zoneEvents = tickZones(world, dt);
  world.events.push(...zoneEvents);

  // Tick projectiles (movement, collision, cleanup)
  const projEvents = tickProjectiles(world, dt);
  world.events.push(...projEvents);

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
        world.boss.health = world.boss.maxHealth;
        world.boss.aiState = 'idle';
        world.boss.phase = 1;
        world.boss.rageMode = false;
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

  // Spawner — dev mode only; survival uses wave spawner
  if (world.survival) {
    const survivalEvents = tickSurvival(world, dt);
    world.events.push(...survivalEvents);
  } else {
    tickSpawner(world, dt);
  }

  // Resolve collisions
  resolveCollisions(world);

  // Roll spell drops for enemies that died this tick
  for (const event of world.events) {
    if (event.type === 'ENTITY_DIED' && event.entityType === 'enemy') {
      const enemy = world.enemies.get(event.entityId);
      if (enemy) {
        const dropEvents = rollSpellDrop(enemy.position, world);
        world.events.push(...dropEvents);
      }
    }
  }
}

// --- Collision resolution ---

type Collidable = { position: Vec2; radius: number };

const collisionGrid = createSpatialGrid();

/** Max search radius for nearby entity queries (covers the largest entity radius) */
const COLLISION_SEARCH_RADIUS = BOSS_RADIUS * 3;

function resolveCollisions(world: SimWorld): void {
  clearGrid(collisionGrid);

  // Build entity map and insert into spatial grid
  const entityMap = new Map<string, { obj: Collidable; isStatic: boolean }>();

  for (const p of world.players.values()) {
    if (p.state !== 'dead' && p.state !== 'dying') {
      insertEntity(collisionGrid, p.id, p.position);
      entityMap.set(p.id, { obj: { position: p.position, radius: PLAYER_RADIUS }, isStatic: false });
    }
  }
  for (const e of world.enemies.values()) {
    if (e.aiState !== 'dead' && e.aiState !== 'dying') {
      insertEntity(collisionGrid, e.id, e.position);
      entityMap.set(e.id, { obj: { position: e.position, radius: ENEMY_RADIUS }, isStatic: false });
    }
  }
  if (world.boss && world.boss.aiState !== 'dead' && world.boss.aiState !== 'dying') {
    const bossStatic = world.boss.aiState === 'jumping' || world.boss.aiState === 'slamming' || world.boss.aiState === 'recovering';
    insertEntity(collisionGrid, world.boss.id, world.boss.position);
    entityMap.set(world.boss.id, { obj: { position: world.boss.position, radius: BOSS_RADIUS }, isStatic: bossStatic });
  }

  // For each entity, check only nearby entities from the spatial grid
  for (const [id, a] of entityMap) {
    const nearbyIds = getNearbyEntities(collisionGrid, a.obj.position, COLLISION_SEARCH_RADIUS);
    for (const nearId of nearbyIds) {
      if (nearId <= id) continue; // Avoid duplicate pairs (string comparison)
      const b = entityMap.get(nearId);
      if (!b) continue;

      const result = separateCircles(
        { position: a.obj.position, radius: a.obj.radius },
        { position: b.obj.position, radius: b.obj.radius }
      );
      if (result) {
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
  if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);

  // Stamina regen
  if (p.state === 'alive') {
    const staminaRate = p.isMoving ? STAMINA_REGEN_RATE : STAMINA_REGEN_RATE_IDLE;
    p.stamina = Math.min(p.maxStamina, p.stamina + staminaRate * dt);
  }

  // Mana regen
  if (p.state === 'alive') {
    p.mana = Math.min(p.maxMana, p.mana + MANA_REGEN_RATE * dt);
  }

  // Health regen
  if (p.state === 'alive') {
    p.health = Math.min(p.maxHealth, p.health + PLAYER_HEALTH_REGEN_RATE * dt);
  }

  // Spell cooldowns
  for (const spellId of Object.keys(p.spellCooldowns) as SpellId[]) {
    const cd = p.spellCooldowns[spellId];
    if (cd !== undefined && cd > 0) {
      p.spellCooldowns[spellId] = Math.max(0, cd - dt);
    }
  }
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
