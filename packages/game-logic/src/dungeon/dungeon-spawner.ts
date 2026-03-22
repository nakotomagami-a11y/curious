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
 * Find which room the player is currently inside by checking actual tile membership.
 * Uses tile coordinates for accuracy with L/T/cross-shaped rooms.
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
  const playerTile = `${playerCol},${playerRow}`;

  for (const [roomId, room] of world.dungeon.rooms) {
    // First: quick bounding box rejection
    const b = room.worldBounds;
    if (playerPos.x < b.minX || playerPos.x > b.maxX || playerPos.z < b.minZ || playerPos.z > b.maxZ) {
      continue;
    }
    // Then: precise tile membership check
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
  // Collect interior tile positions (skip edge tiles to avoid spawning near walls)
  const tileCenters: Vec2[] = [];
  const tileSet = new Set<string>();
  for (const rect of room.tileRects) {
    for (let r = rect.row; r < rect.row + rect.height; r++) {
      for (let c = rect.col; c < rect.col + rect.width; c++) {
        tileSet.add(`${c},${r}`);
      }
    }
  }

  for (const key of tileSet) {
    const [c, r] = key.split(',').map(Number);
    // Only use interior tiles (all 4 neighbors are also room tiles)
    const isInterior =
      tileSet.has(`${c - 1},${r}`) && tileSet.has(`${c + 1},${r}`) &&
      tileSet.has(`${c},${r - 1}`) && tileSet.has(`${c},${r + 1}`);
    if (!isInterior) continue;

    const pos = tileToWorld(c, r, tileSize);
    if (vec2Distance(pos, playerPos) >= DUNGEON_SPAWN_DISTANCE) {
      tileCenters.push(pos);
    }
  }

  // Fallback: if no interior tiles with distance, relax the distance constraint
  if (tileCenters.length === 0) {
    for (const key of tileSet) {
      const [c, r] = key.split(',').map(Number);
      const isInterior =
        tileSet.has(`${c - 1},${r}`) && tileSet.has(`${c + 1},${r}`) &&
        tileSet.has(`${c},${r - 1}`) && tileSet.has(`${c},${r + 1}`);
      if (!isInterior) continue;
      tileCenters.push(tileToWorld(c, r, tileSize));
    }
  }

  // Last resort: use edge tiles but offset inward (avoid wall overlap)
  if (tileCenters.length === 0) {
    for (const key of tileSet) {
      const [c, r] = key.split(',').map(Number);
      const pos = tileToWorld(c, r, tileSize);
      // Push position toward room center to avoid wall overlap
      const toCenterX = room.center.x - pos.x;
      const toCenterZ = room.center.z - pos.z;
      const d = Math.sqrt(toCenterX * toCenterX + toCenterZ * toCenterZ);
      if (d > 1) {
        pos.x += (toCenterX / d) * 35; // push 35 units inward (enemy radius + margin)
        pos.z += (toCenterZ / d) * 35;
      }
      tileCenters.push(pos);
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
    // Use spawn position as leash origin (room.center can be outside L-shaped rooms)
    const enemy = createEnemy(id, positions[i], positions[i], enemyType, statScale, []);
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
