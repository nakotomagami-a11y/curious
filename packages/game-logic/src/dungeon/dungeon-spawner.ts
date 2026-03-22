import type { GameEvent, Vec2, DungeonRoom, WallSegment } from '@curious/shared';
import { vec2Distance, TILE_SIZE, DUNGEON_SPAWN_DISTANCE, ENEMY_RADIUS } from '@curious/shared';
import type { SimWorld } from '../simulation';
import { generateEntityId } from '../simulation';
import { createEnemy } from '../entities/enemy';
import type { StatScale } from '../entities/enemy';
import { createBoss } from '../entities/boss';
import { circleVsWallSegment } from './wall-collision';
import { resolveEntityWallCollisions } from './wall-collision';
import {
  DUNGEON_HEALTH_SCALE,
  DUNGEON_SPEED_SCALE,
  DUNGEON_DAMAGE_SCALE,
} from '@curious/shared';

/**
 * Find which room the player is currently inside by checking actual tile membership.
 */
function findPlayerRoom(world: SimWorld): string | null {
  if (!world.dungeon) return null;

  let playerPos: Vec2 | null = null;
  for (const p of world.players.values()) {
    if (p.state === 'alive') {
      playerPos = p.position;
      break;
    }
  }
  if (!playerPos) return null;

  const tileSize = world.dungeon.tileSize;
  const playerCol = Math.floor(playerPos.x / tileSize);
  const playerRow = Math.floor(playerPos.z / tileSize);

  for (const [roomId, room] of world.dungeon.rooms) {
    const b = room.worldBounds;
    if (playerPos.x < b.minX || playerPos.x > b.maxX || playerPos.z < b.minZ || playerPos.z > b.maxZ) {
      continue;
    }
    for (const rect of room.tileRects) {
      if (
        playerCol >= rect.col && playerCol < rect.col + rect.width &&
        playerRow >= rect.row && playerRow < rect.row + rect.height
      ) {
        return roomId;
      }
    }
  }

  return null;
}

function tileToWorld(col: number, row: number, tileSize: number): Vec2 {
  return { x: col * tileSize + tileSize / 2, z: row * tileSize + tileSize / 2 };
}

/**
 * Get safe spawn positions inside a room. Uses a two-pass approach:
 * 1. Collect tiles that are at least 2 tiles inward from any edge
 * 2. Validate each position against actual wall geometry
 */
function getSafeSpawnPositions(
  room: DungeonRoom,
  count: number,
  playerPos: Vec2,
  world: SimWorld,
): Vec2[] {
  const tileSize = world.dungeon!.tileSize;
  const walls = world.dungeon!.walls;

  // Build tile set for this room
  const tileSet = new Set<string>();
  for (const rect of room.tileRects) {
    for (let r = rect.row; r < rect.row + rect.height; r++) {
      for (let c = rect.col; c < rect.col + rect.width; c++) {
        tileSet.add(`${c},${r}`);
      }
    }
  }

  // Collect candidates: must have all 8 neighbors (including diagonals) in the room
  const candidates: Vec2[] = [];
  for (const key of tileSet) {
    const [c, r] = key.split(',').map(Number);
    let allNeighbors = true;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        if (!tileSet.has(`${c + dc},${r + dr}`)) {
          allNeighbors = false;
          break;
        }
      }
      if (!allNeighbors) break;
    }
    if (!allNeighbors) continue;

    const pos = tileToWorld(c, r, tileSize);

    // Verify no wall collision at this position
    let touchesWall = false;
    for (const wall of walls) {
      if (circleVsWallSegment(pos, ENEMY_RADIUS + 10, wall)) {
        touchesWall = true;
        break;
      }
    }
    if (touchesWall) continue;

    candidates.push(pos);
  }

  // Sort: prefer positions far from player first
  candidates.sort((a, b) => vec2Distance(b, playerPos) - vec2Distance(a, playerPos));

  // If we have enough candidates, use them
  if (candidates.length >= count) {
    return candidates.slice(0, count);
  }

  // Fallback: use room center repeated (collision will push them apart)
  const result = [...candidates];
  while (result.length < count) {
    const offset = {
      x: room.center.x + (Math.random() - 0.5) * 60,
      z: room.center.z + (Math.random() - 0.5) * 60,
    };
    // Validate against walls
    let ok = true;
    for (const wall of walls) {
      if (circleVsWallSegment(offset, ENEMY_RADIUS + 10, wall)) {
        ok = false;
        break;
      }
    }
    if (ok) {
      result.push(offset);
    } else {
      // Just use center — wall collision will fix it
      result.push({ ...room.center });
    }
  }
  return result;
}

/**
 * Spawn enemies for a room based on its enemyConfig.
 */
function spawnRoomEnemies(room: DungeonRoom, world: SimWorld): string[] {
  if (!room.enemyConfig || !world.dungeon) return [];

  const config = room.enemyConfig;
  const ids: string[] = [];

  let playerPos: Vec2 = room.center;
  for (const p of world.players.values()) {
    if (p.state === 'alive') {
      playerPos = p.position;
      break;
    }
  }

  const depth = room.depth;
  const statScale: StatScale = {
    healthMult: 1 + depth * DUNGEON_HEALTH_SCALE,
    speedMult: 1 + depth * DUNGEON_SPEED_SCALE,
    damageMult: 1 + depth * DUNGEON_DAMAGE_SCALE,
  };

  const spawnCount = config.enemyCount;
  const positions = getSafeSpawnPositions(room, spawnCount, playerPos, world);

  for (let i = 0; i < Math.min(spawnCount, positions.length); i++) {
    const enemyType = config.enemyTypes[i % config.enemyTypes.length];
    const id = generateEntityId('de');
    const enemy = createEnemy(id, positions[i], positions[i], enemyType, statScale, []);

    // Force wall collision on spawn to ensure enemy is inside room
    if (world.dungeon) {
      resolveEntityWallCollisions(enemy.position, ENEMY_RADIUS, world.dungeon.walls);
    }

    world.enemies.set(id, enemy);
    ids.push(id);

    world.events.push({
      type: 'ENTITY_SPAWNED',
      entityId: id,
      entityType: 'enemy',
      position: { ...positions[i] },
    });
  }

  // Spawn boss if boss room
  if (config.isBossRoom && config.bossType) {
    const bossId = generateEntityId('db');
    const boss = createBoss(bossId, room.center, config.bossType);
    world.boss = boss;
    ids.push(bossId);

    world.events.push({
      type: 'ENTITY_SPAWNED',
      entityId: bossId,
      entityType: 'boss',
      position: { ...room.center },
    });
  }

  return ids;
}

/**
 * Tick the dungeon spawner — handles room discovery, enemy spawning, and room clearing.
 */
export function tickDungeonSpawner(world: SimWorld, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (!world.dungeonState || !world.dungeon) return events;

  const state = world.dungeonState;
  const layout = world.dungeon;

  const currentRoomId = findPlayerRoom(world);
  if (!currentRoomId) return events;

  const room = layout.rooms.get(currentRoomId);
  if (!room) return events;

  const roomState = state.roomStates[currentRoomId];

  // Player entered an undiscovered room
  if (roomState === 'undiscovered') {
    state.roomStates[currentRoomId] = 'active';
    state.currentRoomId = currentRoomId;

    // Lock all doors of this room
    for (const doorId of room.doorIds) {
      state.doorStates[doorId] = 'locked';
    }

    // Spawn enemies
    const spawnedIds = spawnRoomEnemies(room, world);
    state.activeRoomEnemyIds = spawnedIds;

    events.push({ type: 'ROOM_ENTERED', roomId: currentRoomId });
  }

  // Check if active room is cleared
  if (state.roomStates[currentRoomId] === 'active') {
    let allDead = true;
    for (const enemyId of state.activeRoomEnemyIds) {
      const enemy = world.enemies.get(enemyId);
      if (enemy && enemy.aiState !== 'dead' && enemy.aiState !== 'dying') {
        allDead = false;
        break;
      }
      if (world.boss && world.boss.id === enemyId) {
        if (world.boss.aiState !== 'dead' && world.boss.aiState !== 'dying') {
          allDead = false;
          break;
        }
      }
    }

    if (allDead && state.activeRoomEnemyIds.length > 0) {
      state.roomStates[currentRoomId] = 'cleared';

      for (const doorId of room.doorIds) {
        state.doorStates[doorId] = 'open';
      }

      state.roomsCleared++;
      state.activeRoomEnemyIds = [];

      events.push({ type: 'ROOM_CLEARED', roomId: currentRoomId });

      if (room.enemyConfig?.isBossRoom) {
        state.complete = true;
        events.push({ type: 'DUNGEON_COMPLETE' });
      }
    }
  }

  return events;
}
