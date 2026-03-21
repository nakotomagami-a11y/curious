import type { GameEvent, Vec2, DungeonRoom, WallSegment } from '@curious/shared';
import { vec2Distance, TILE_SIZE, DUNGEON_SPAWN_DISTANCE } from '@curious/shared';
import type { SimWorld } from '../simulation';
import { generateEntityId } from '../simulation';
import { createEnemy } from '../entities/enemy';
import type { StatScale } from '../entities/enemy';
import { createBoss } from '../entities/boss';
import {
  DUNGEON_HEALTH_SCALE,
  DUNGEON_SPEED_SCALE,
  DUNGEON_DAMAGE_SCALE,
} from '@curious/shared';

/**
 * Find which room the player is currently inside by checking worldBounds.
 */
function findPlayerRoom(world: SimWorld): string | null {
  if (!world.dungeon) return null;

  // Get first alive player
  let playerPos: Vec2 | null = null;
  for (const p of world.players.values()) {
    if (p.state === 'alive') {
      playerPos = p.position;
      break;
    }
  }
  if (!playerPos) return null;

  for (const [roomId, room] of world.dungeon.rooms) {
    const b = room.worldBounds;
    if (
      playerPos.x >= b.minX &&
      playerPos.x <= b.maxX &&
      playerPos.z >= b.minZ &&
      playerPos.z <= b.maxZ
    ) {
      return roomId;
    }
  }

  return null;
}

/**
 * Convert a tile coordinate to world position (center of tile).
 */
function tileToWorld(col: number, row: number, tileSize: number): Vec2 {
  return {
    x: col * tileSize + tileSize / 2,
    z: row * tileSize + tileSize / 2,
  };
}

/**
 * Get random spawn positions within a room, at least DUNGEON_SPAWN_DISTANCE from player.
 */
function getSpawnPositions(
  room: DungeonRoom,
  count: number,
  playerPos: Vec2,
  tileSize: number,
): Vec2[] {
  // Collect all tile positions within room
  const tileCenters: Vec2[] = [];
  for (const rect of room.tileRects) {
    for (let r = rect.row; r < rect.row + rect.height; r++) {
      for (let c = rect.col; c < rect.col + rect.width; c++) {
        const pos = tileToWorld(c, r, tileSize);
        if (vec2Distance(pos, playerPos) >= DUNGEON_SPAWN_DISTANCE) {
          tileCenters.push(pos);
        }
      }
    }
  }

  // Shuffle and pick
  for (let i = tileCenters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tileCenters[i], tileCenters[j]] = [tileCenters[j], tileCenters[i]];
  }

  // If not enough far-away tiles, use what we have
  return tileCenters.slice(0, count);
}

/**
 * Spawn enemies for a room based on its enemyConfig.
 */
function spawnRoomEnemies(room: DungeonRoom, world: SimWorld): string[] {
  if (!room.enemyConfig || !world.dungeon) return [];

  const config = room.enemyConfig;
  const ids: string[] = [];

  // Get player position
  let playerPos: Vec2 = room.center;
  for (const p of world.players.values()) {
    if (p.state === 'alive') {
      playerPos = p.position;
      break;
    }
  }

  const tileSize = world.dungeon.tileSize;
  const depth = room.depth;
  const statScale: StatScale = {
    healthMult: 1 + depth * DUNGEON_HEALTH_SCALE,
    speedMult: 1 + depth * DUNGEON_SPEED_SCALE,
    damageMult: 1 + depth * DUNGEON_DAMAGE_SCALE,
  };

  // Spawn regular enemies
  const spawnCount = config.enemyCount;
  const positions = getSpawnPositions(room, spawnCount, playerPos, tileSize);

  for (let i = 0; i < Math.min(spawnCount, positions.length); i++) {
    const enemyType = config.enemyTypes[i % config.enemyTypes.length];
    const id = generateEntityId('de'); // dungeon enemy
    const enemy = createEnemy(id, positions[i], room.center, enemyType, statScale, []);
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
    const bossId = generateEntityId('db'); // dungeon boss
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

  // Find which room the player is in
  const currentRoomId = findPlayerRoom(world);
  if (!currentRoomId) return events;

  const room = layout.rooms.get(currentRoomId);
  if (!room) return events;

  const roomState = state.roomStates[currentRoomId];

  // Player entered an undiscovered room
  if (roomState === 'undiscovered') {
    // Set room to active
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
      // Also check if it's the boss
      if (world.boss && world.boss.id === enemyId) {
        if (world.boss.aiState !== 'dead' && world.boss.aiState !== 'dying') {
          allDead = false;
          break;
        }
      }
    }

    if (allDead && state.activeRoomEnemyIds.length > 0) {
      // Room cleared
      state.roomStates[currentRoomId] = 'cleared';

      // Unlock and open all doors of this room
      for (const doorId of room.doorIds) {
        state.doorStates[doorId] = 'open';
      }

      state.roomsCleared++;
      state.activeRoomEnemyIds = [];

      events.push({ type: 'ROOM_CLEARED', roomId: currentRoomId });

      // Check if boss room was cleared
      if (room.enemyConfig?.isBossRoom) {
        state.complete = true;
        events.push({ type: 'DUNGEON_COMPLETE' });
      }
    }
  }

  return events;
}
