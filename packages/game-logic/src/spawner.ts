import type { EnemySnapshot, EnemyType, Vec2 } from '@curious/shared';
import { vec2, vec2Distance } from '@curious/shared';
import {
  ENEMY_ACTIVE_COUNT,
  ENEMY_RESPAWN_DELAY,
  CASTER_SPAWN_CHANCE,
  DASHER_SPAWN_CHANCE,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
  PLAYER_RADIUS,
} from '@curious/shared';
import type { SimWorld } from './simulation';
import { generateEntityId } from './simulation';
import { createEnemy } from './enemy';

const MIN_SPAWN_DIST_FROM_PLAYER = 300;
const SPAWN_MARGIN = 100; // keep away from arena edges

type RespawnEntry = {
  timer: number;
};

const respawnTimers = new Map<string, RespawnEntry>();

/** Reset spawner state (call on world reset). */
export function resetSpawner(): void {
  respawnTimers.clear();
}

/** Tick the spawner — manages enemy count, respawns dead enemies. */
export function tickSpawner(world: SimWorld, dt: number): void {
  // Count alive/active enemies (not dead)
  let aliveCount = 0;
  const deadEnemies: EnemySnapshot[] = [];

  for (const enemy of world.enemies.values()) {
    if (enemy.aiState === 'dead') {
      deadEnemies.push(enemy);
    } else {
      aliveCount++;
    }
  }

  // Tick respawn timers for dead enemies
  for (const enemy of deadEnemies) {
    let entry = respawnTimers.get(enemy.id);
    if (!entry) {
      entry = { timer: ENEMY_RESPAWN_DELAY };
      respawnTimers.set(enemy.id, entry);
    }

    entry.timer -= dt;

    if (entry.timer <= 0 && aliveCount < ENEMY_ACTIVE_COUNT) {
      // Respawn this enemy
      respawnEnemy(enemy, world);
      respawnTimers.delete(enemy.id);
      aliveCount++;
    }
  }

  // Spawn new enemies if we don't have enough
  while (aliveCount < ENEMY_ACTIVE_COUNT && world.enemies.size < ENEMY_ACTIVE_COUNT) {
    const pos = findSpawnPosition(world);
    const roll = Math.random();
    const type: EnemyType = roll < DASHER_SPAWN_CHANCE ? 'dasher'
      : roll < DASHER_SPAWN_CHANCE + CASTER_SPAWN_CHANCE ? 'caster'
      : 'melee';
    const enemy = createEnemy(generateEntityId('enemy'), pos, pos, type);
    world.enemies.set(enemy.id, enemy);
    aliveCount++;
  }
}

/** Reset a dead enemy back to alive at a new position. */
function respawnEnemy(enemy: EnemySnapshot, world: SimWorld): void {
  const pos = findSpawnPosition(world);
  enemy.position = pos;
  enemy.leashOrigin = pos;
  enemy.rotation = 0;
  enemy.health = enemy.maxHealth;
  enemy.aiState = 'idle';
  enemy.knockbackVelocity = { x: 0, z: 0 };
  enemy.hitFlashTimer = 0;
  enemy.iFrameTimer = 0;
  enemy.dissolveProgress = 0;
  enemy.targetId = null;
  enemy.attackCooldownTimer = 0;
  enemy.attackProgress = 0;
  enemy.buffs = [];
  enemy.dashDirection = { x: 0, z: 0 };
  enemy.dashTimer = 0;
  enemy.telegraphTimer = 0;
  enemy.recoveryTimer = 0;
}

/** Find a random spawn position away from all players. */
function findSpawnPosition(world: SimWorld): Vec2 {
  const maxX = ARENA_HALF_WIDTH - SPAWN_MARGIN;
  const maxZ = ARENA_HALF_HEIGHT - SPAWN_MARGIN;

  for (let attempt = 0; attempt < 20; attempt++) {
    const x = (Math.random() * 2 - 1) * maxX;
    const z = (Math.random() * 2 - 1) * maxZ;
    const pos = vec2(x, z);

    // Check distance from all players
    let tooClose = false;
    for (const player of world.players.values()) {
      if (player.state === 'alive' && vec2Distance(pos, player.position) < MIN_SPAWN_DIST_FROM_PLAYER) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) return pos;
  }

  // Fallback: spawn at arena edge
  return vec2(maxX, maxZ);
}
