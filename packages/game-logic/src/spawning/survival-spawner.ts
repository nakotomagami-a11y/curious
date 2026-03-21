import type { EnemyType, GameEvent, Vec2 } from '@curious/shared';
import { vec2, vec2Distance } from '@curious/shared';
import {
  SURVIVAL_BASE_ENEMY_COUNT,
  SURVIVAL_ENEMY_INCREMENT,
  SURVIVAL_MEGA_BOSS_WAVE,
  SURVIVAL_MEGA_BOSS_HEALTH,
  WAVE_HEALTH_SCALE,
  WAVE_SPEED_SCALE,
  WAVE_DAMAGE_SCALE,
  DASHER_SPAWN_CHANCE,
  CASTER_SPAWN_CHANCE,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
} from '@curious/shared';
import type { SimWorld } from '../simulation';
import { generateEntityId } from '../simulation';
import { createEnemy } from '../entities/enemy';
import { createBoss } from '../entities/boss';

const SPAWN_MARGIN = 100;
const MIN_SPAWN_DIST_FROM_PLAYER = 200;

function findSpawnPosition(world: SimWorld): Vec2 {
  const maxX = ARENA_HALF_WIDTH - SPAWN_MARGIN;
  const maxZ = ARENA_HALF_HEIGHT - SPAWN_MARGIN;

  for (let attempt = 0; attempt < 20; attempt++) {
    const x = (Math.random() * 2 - 1) * maxX;
    const z = (Math.random() * 2 - 1) * maxZ;
    const pos = vec2(x, z);

    let tooClose = false;
    for (const player of world.players.values()) {
      if (player.state === 'alive' && vec2Distance(pos, player.position) < MIN_SPAWN_DIST_FROM_PLAYER) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) return pos;
  }
  return vec2(maxX, maxZ);
}

function rollEnemyType(): EnemyType {
  const roll = Math.random();
  if (roll < DASHER_SPAWN_CHANCE) return 'dasher';
  if (roll < DASHER_SPAWN_CHANCE + CASTER_SPAWN_CHANCE) return 'caster';
  return 'melee';
}

/** Spawn all enemies for a wave. Call once at wave start. */
export function initSurvivalWave(world: SimWorld, wave: number): GameEvent[] {
  if (!world.survival) return [];

  const events: GameEvent[] = [];
  const count = SURVIVAL_BASE_ENEMY_COUNT + (wave - 1) * SURVIVAL_ENEMY_INCREMENT;

  const healthMult = 1 + (wave - 1) * WAVE_HEALTH_SCALE;
  const speedMult = 1 + (wave - 1) * WAVE_SPEED_SCALE;
  const damageMult = 1 + (wave - 1) * WAVE_DAMAGE_SCALE;

  // Spawn enemies
  for (let i = 0; i < count; i++) {
    const pos = findSpawnPosition(world);
    const type = rollEnemyType();
    const enemy = createEnemy(
      generateEntityId('enemy'),
      pos,
      pos,
      type,
      { healthMult, speedMult, damageMult },
    );
    world.enemies.set(enemy.id, enemy);
  }

  // Mega boss at wave 5+
  if (wave >= SURVIVAL_MEGA_BOSS_WAVE && !world.survival.megaBossSpawned) {
    const bossPos = findSpawnPosition(world);
    const boss = createBoss(generateEntityId('boss'), bossPos);
    boss.health = SURVIVAL_MEGA_BOSS_HEALTH;
    boss.maxHealth = SURVIVAL_MEGA_BOSS_HEALTH;
    world.boss = boss;
    world.survival.megaBossSpawned = true;
  }

  world.survival.enemiesTotal = count;
  world.survival.enemiesRemaining = count;
  world.survival.waveActive = true;

  events.push({
    type: 'WAVE_START',
    wave,
    enemyCount: count,
  });

  return events;
}

/** Tick survival state — check if wave is complete, start next. */
export function tickSurvival(world: SimWorld, dt: number): GameEvent[] {
  if (!world.survival || !world.survival.waveActive) return [];

  const events: GameEvent[] = [];

  // Count alive enemies (not dying, not dead)
  let alive = 0;
  for (const enemy of world.enemies.values()) {
    if (enemy.aiState !== 'dead' && enemy.aiState !== 'dying') {
      alive++;
    }
  }

  world.survival.enemiesRemaining = alive;

  // Check if wave is complete
  if (alive === 0) {
    const currentWave = world.survival.wave;
    const nextWave = currentWave + 1;

    events.push({
      type: 'WAVE_COMPLETE',
      wave: currentWave,
      nextWave,
    });

    // Clean up dead enemies
    const deadIds: string[] = [];
    for (const [id, enemy] of world.enemies) {
      if (enemy.aiState === 'dead') {
        deadIds.push(id);
      }
    }
    for (const id of deadIds) {
      world.enemies.delete(id);
    }

    // Start next wave
    world.survival.wave = nextWave;
    world.survival.waveActive = false;
    events.push(...initSurvivalWave(world, nextWave));
  }

  return events;
}
