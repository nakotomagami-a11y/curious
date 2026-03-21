import type {
  Vec2,
  TileCoord,
  TileRect,
  DungeonRoom,
  DungeonLayout,
  RoomShape,
  RoomEnemyConfig,
  EnemyType,
  Door,
  Corridor,
} from '@curious/shared';
import {
  TILE_SIZE,
  ROOM_GAP,
  DUNGEON_MIN_ROOMS,
  DUNGEON_MAX_ROOMS,
  DUNGEON_SPAWN_ROOM_SIZE,
  DUNGEON_BOSS_ROOM_SIZE,
  MAX_PLACEMENT_ATTEMPTS,
  MAX_GENERATION_RETRIES,
  DUNGEON_EXTRA_EDGES,
  DUNGEON_EXTRA_EDGE_MAX_DIST,
  vec2Distance,
  vec2,
} from '@curious/shared';
import { rollRoomShape, generateRoomTiles } from './room-templates';
import { generateCorridor, resetCorridorIds, tileKey } from './corridor-generator';
import { buildWalls } from './wall-builder';
import { validateDungeon } from './dungeon-validator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Expand TileRects into individual tile coordinates. */
function getTilesForRoom(tileRects: TileRect[]): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (const r of tileRects) {
    for (let c = r.col; c < r.col + r.width; c++) {
      for (let rr = r.row; rr < r.row + r.height; rr++) {
        tiles.push({ col: c, row: rr });
      }
    }
  }
  return tiles;
}

/** Convert tile coordinate to world-space center. */
function tileToWorld(col: number, row: number, tileSize: number): Vec2 {
  return vec2((col + 0.5) * tileSize, (row + 0.5) * tileSize);
}

/** Compute world-space bounding box for a set of tile rects. */
function computeRoomWorldBounds(
  tileRects: TileRect[],
  tileSize: number,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minC = Infinity, maxC = -Infinity;
  let minR = Infinity, maxR = -Infinity;
  for (const r of tileRects) {
    minC = Math.min(minC, r.col);
    maxC = Math.max(maxC, r.col + r.width);
    minR = Math.min(minR, r.row);
    maxR = Math.max(maxR, r.row + r.height);
  }
  return {
    minX: minC * tileSize,
    maxX: maxC * tileSize,
    minZ: minR * tileSize,
    maxZ: maxR * tileSize,
  };
}

function computeRoomCenter(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): Vec2 {
  return vec2((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2);
}

/** BFS depth from spawn room through door connections. */
function getGraphDepth(
  rooms: Map<string, DungeonRoom>,
  doors: Map<string, Door>,
): Map<string, number> {
  // Build adjacency from doors
  const adj = new Map<string, Set<string>>();
  for (const room of rooms.values()) {
    adj.set(room.id, new Set());
  }
  for (const door of doors.values()) {
    const [a, b] = door.connectsRooms;
    if (adj.has(a) && adj.has(b)) {
      adj.get(a)!.add(b);
      adj.get(b)!.add(a);
    }
  }

  const depthMap = new Map<string, number>();
  // Find spawn room
  let spawnId: string | null = null;
  for (const r of rooms.values()) {
    if (r.roomIndex === 0) { spawnId = r.id; break; }
  }
  if (!spawnId) return depthMap;

  const queue: string[] = [spawnId];
  depthMap.set(spawnId, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const depth = depthMap.get(current)!;
    for (const neighbor of adj.get(current) ?? []) {
      if (!depthMap.has(neighbor)) {
        depthMap.set(neighbor, depth + 1);
        queue.push(neighbor);
      }
    }
  }

  return depthMap;
}

const ALL_ENEMY_TYPES: EnemyType[] = ['melee', 'caster', 'dasher', 'shielder', 'summoner', 'bomber', 'teleporter', 'healer'];

/** Assign enemy configuration based on room depth. */
function assignEnemyConfig(depth: number, isBoss: boolean): RoomEnemyConfig | null {
  if (isBoss) {
    return {
      enemyCount: randInt(2, 4),
      enemyTypes: ['melee', 'caster'],
      eliteCount: 0,
      isBossRoom: true,
      bossType: 'guardian',
      difficulty: depth,
    };
  }

  if (depth === 0) return null; // spawn room

  if (depth <= 2) {
    return {
      enemyCount: randInt(3, 5),
      enemyTypes: ['melee', 'caster'],
      eliteCount: 0,
      isBossRoom: false,
      difficulty: depth,
    };
  }

  if (depth <= 4) {
    return {
      enemyCount: randInt(4, 7),
      enemyTypes: ['melee', 'caster', 'dasher', 'shielder'],
      eliteCount: randInt(0, 1),
      isBossRoom: false,
      difficulty: depth,
    };
  }

  // depth 5+
  return {
    enemyCount: randInt(5, 8),
    enemyTypes: [...ALL_ENEMY_TYPES],
    eliteCount: randInt(1, 2),
    isBossRoom: false,
    difficulty: depth,
  };
}

// ---------------------------------------------------------------------------
// Room placement helpers
// ---------------------------------------------------------------------------

type Direction = 'N' | 'S' | 'E' | 'W';

function getRoomTileBounds(tileRects: TileRect[]): { minC: number; maxC: number; minR: number; maxR: number } {
  let minC = Infinity, maxC = -Infinity;
  let minR = Infinity, maxR = -Infinity;
  for (const r of tileRects) {
    minC = Math.min(minC, r.col);
    maxC = Math.max(maxC, r.col + r.width);
    minR = Math.min(minR, r.row);
    maxR = Math.max(maxR, r.row + r.height);
  }
  return { minC, maxC, minR, maxR };
}

/** Offset tile rects so their min corner is at (col, row). */
function offsetTileRects(rects: TileRect[], dCol: number, dRow: number): TileRect[] {
  return rects.map(r => ({
    col: r.col + dCol,
    row: r.row + dRow,
    width: r.width,
    height: r.height,
  }));
}

function tilesOverlap(rects: TileRect[], occupied: Set<string>): boolean {
  for (const r of rects) {
    for (let c = r.col; c < r.col + r.width; c++) {
      for (let rr = r.row; rr < r.row + r.height; rr++) {
        if (occupied.has(tileKey(c, rr))) return false;
      }
    }
  }
  // Also check gap
  return true;
}

/** Check that no tile in rects (expanded by gap) overlaps occupied tiles. */
function placementClear(rects: TileRect[], occupied: Set<string>, gap: number): boolean {
  for (const r of rects) {
    for (let c = r.col - gap; c < r.col + r.width + gap; c++) {
      for (let rr = r.row - gap; rr < r.row + r.height + gap; rr++) {
        if (occupied.has(tileKey(c, rr))) return false;
      }
    }
  }
  return true;
}

/** Place a new room adjacent to an anchor room in a given direction. */
function computePlacement(
  anchorBounds: { minC: number; maxC: number; minR: number; maxR: number },
  newBounds: { minC: number; maxC: number; minR: number; maxR: number },
  dir: Direction,
  perpOffset: number,
): { dCol: number; dRow: number } {
  const newW = newBounds.maxC - newBounds.minC;
  const newH = newBounds.maxR - newBounds.minR;
  const anchorW = anchorBounds.maxC - anchorBounds.minC;
  const anchorH = anchorBounds.maxR - anchorBounds.minR;

  switch (dir) {
    case 'N':
      return {
        dCol: anchorBounds.minC + Math.floor(anchorW / 2) - Math.floor(newW / 2) + perpOffset - newBounds.minC,
        dRow: anchorBounds.minR - ROOM_GAP - newH - newBounds.minR,
      };
    case 'S':
      return {
        dCol: anchorBounds.minC + Math.floor(anchorW / 2) - Math.floor(newW / 2) + perpOffset - newBounds.minC,
        dRow: anchorBounds.maxR + ROOM_GAP - newBounds.minR,
      };
    case 'W':
      return {
        dCol: anchorBounds.minC - ROOM_GAP - newW - newBounds.minC,
        dRow: anchorBounds.minR + Math.floor(anchorH / 2) - Math.floor(newH / 2) + perpOffset - newBounds.minR,
      };
    case 'E':
      return {
        dCol: anchorBounds.maxC + ROOM_GAP - newBounds.minC,
        dRow: anchorBounds.minR + Math.floor(anchorH / 2) - Math.floor(newH / 2) + perpOffset - newBounds.minR,
      };
  }
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

type PlacementEdge = { from: number; to: number };

/**
 * Generate a complete dungeon layout.
 * @param roomCount - Number of rooms (defaults to random in [MIN, MAX] range).
 */
export function generateDungeon(roomCount?: number): DungeonLayout {
  const count = roomCount ?? randInt(DUNGEON_MIN_ROOMS, DUNGEON_MAX_ROOMS);

  for (let retry = 0; retry < MAX_GENERATION_RETRIES; retry++) {
    const result = tryGenerate(count);
    if (result) return result;
  }

  // Fallback: force a small dungeon
  const result = tryGenerate(DUNGEON_MIN_ROOMS);
  if (result) return result;

  // Should never happen, but satisfy the type system
  throw new Error('Failed to generate dungeon after maximum retries');
}

function tryGenerate(roomCount: number): DungeonLayout | null {
  resetCorridorIds();

  const occupiedTiles = new Set<string>();
  const directions: Direction[] = ['N', 'S', 'E', 'W'];

  // Phase 1: Create room footprints
  const roomFootprints: { shape: RoomShape; tileRects: TileRect[] }[] = [];

  // Room 0 = spawn room (6x6 rect)
  roomFootprints.push({
    shape: 'rect',
    tileRects: [{ col: 0, row: 0, width: DUNGEON_SPAWN_ROOM_SIZE, height: DUNGEON_SPAWN_ROOM_SIZE }],
  });

  // Room 1 = boss room (8x8 rect)
  roomFootprints.push({
    shape: 'rect',
    tileRects: [{ col: 0, row: 0, width: DUNGEON_BOSS_ROOM_SIZE, height: DUNGEON_BOSS_ROOM_SIZE }],
  });

  // Remaining rooms = random templates
  for (let i = 2; i < roomCount; i++) {
    const shape = rollRoomShape();
    roomFootprints.push({ shape, tileRects: generateRoomTiles(shape) });
  }

  // Phase 2: Place rooms incrementally
  const placedRooms: DungeonRoom[] = [];
  const placementEdges: PlacementEdge[] = [];

  // Place room 0 at origin
  const spawnRects = roomFootprints[0].tileRects;
  addTilesToOccupied(spawnRects, occupiedTiles);
  placedRooms.push(createRoomFromRects('room_0', 0, spawnRects, roomFootprints[0].shape));

  // Place remaining rooms
  for (let i = 1; i < roomCount; i++) {
    const fp = roomFootprints[i];
    let placed = false;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const anchorIdx = randInt(0, placedRooms.length - 1);
      const anchor = placedRooms[anchorIdx];
      const anchorBounds = getRoomTileBounds(anchor.tileRects);
      const newBounds = getRoomTileBounds(fp.tileRects);

      const dir = pickRandom(directions);
      const perpOffset = randInt(-3, 3);

      const offset = computePlacement(anchorBounds, newBounds, dir, perpOffset);
      const positioned = offsetTileRects(fp.tileRects, offset.dCol, offset.dRow);

      if (placementClear(positioned, occupiedTiles, 1)) {
        addTilesToOccupied(positioned, occupiedTiles);
        const room = createRoomFromRects(`room_${i}`, i, positioned, fp.shape);
        placedRooms.push(room);
        placementEdges.push({ from: i, to: anchorIdx });
        placed = true;
        break;
      }
    }

    if (!placed) return null; // Retry full generation
  }

  // Phase 3: Build connectivity graph
  // Start with the placement tree edges
  const graphEdges = new Set<string>();
  const edgeList: [number, number][] = [];

  for (const e of placementEdges) {
    const key = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
    if (!graphEdges.has(key)) {
      graphEdges.add(key);
      edgeList.push([e.from, e.to]);
    }
  }

  // Add 1-2 extra loop edges between nearby rooms
  let extraAdded = 0;
  const roomPairs: [number, number, number][] = []; // [i, j, dist]
  for (let i = 0; i < placedRooms.length; i++) {
    for (let j = i + 1; j < placedRooms.length; j++) {
      const key = `${i}-${j}`;
      if (graphEdges.has(key)) continue;
      const dist = vec2Distance(placedRooms[i].center, placedRooms[j].center);
      if (dist <= DUNGEON_EXTRA_EDGE_MAX_DIST) {
        roomPairs.push([i, j, dist]);
      }
    }
  }
  roomPairs.sort((a, b) => a[2] - b[2]);

  for (const [i, j] of roomPairs) {
    if (extraAdded >= DUNGEON_EXTRA_EDGES) break;
    const key = `${i}-${j}`;
    if (!graphEdges.has(key)) {
      graphEdges.add(key);
      edgeList.push([i, j]);
      extraAdded++;
    }
  }

  // Phase 4: Generate corridors
  const rooms = new Map<string, DungeonRoom>();
  for (const r of placedRooms) rooms.set(r.id, r);

  const corridors = new Map<string, Corridor>();
  const allDoors = new Map<string, Door>();

  // Corridor routing: track corridor-only tiles separately.
  // Corridors can overlap with room tiles (connecting to rooms) but not other corridors.
  const roomTileSet = new Set<string>(occupiedTiles); // snapshot of room tiles only
  const corridorOnlyTiles = new Set<string>(); // only corridor tiles

  for (const [iA, iB] of edgeList) {
    const roomA = placedRooms[iA];
    const roomB = placedRooms[iB];

    const result = generateCorridor(roomA, roomB, corridorOnlyTiles, TILE_SIZE, roomTileSet);
    if (result) {
      const { corridor, doors } = result;
      corridors.set(corridor.id, corridor);

      // Add corridor tiles to both tracking sets
      for (const tr of corridor.tileRects) {
        for (let c = tr.col; c < tr.col + tr.width; c++) {
          for (let r = tr.row; r < tr.row + tr.height; r++) {
            corridorOnlyTiles.add(tileKey(c, r));
            occupiedTiles.add(tileKey(c, r));
          }
        }
      }

      for (const door of doors) {
        allDoors.set(door.id, door);
        roomA.doorIds.push(door.id);
        roomB.doorIds.push(door.id);
      }
    }
    // If corridor fails for an extra edge, that's ok. For tree edges it's more critical.
  }

  // Phase 5: Build walls
  const { walls, doorWalls } = buildWalls(occupiedTiles, allDoors, TILE_SIZE);

  // Phase 6: Validate - compute depths and assign enemies
  const depthMap = getGraphDepth(rooms, allDoors);

  // Apply depths
  for (const [id, depth] of depthMap) {
    const room = rooms.get(id);
    if (room) room.depth = depth;
  }

  // Find the deepest room and ensure it's the boss room
  let spawnRoomId = placedRooms[0].id;
  let bossRoomId = placedRooms[1].id;

  let maxDepth = 0;
  let deepestRoomId = spawnRoomId;
  for (const [id, depth] of depthMap) {
    if (depth > maxDepth && id !== spawnRoomId) {
      maxDepth = depth;
      deepestRoomId = id;
    }
  }

  // Swap boss room to deepest if needed
  if (deepestRoomId !== bossRoomId) {
    const bossRoom = rooms.get(bossRoomId)!;
    const deepRoom = rooms.get(deepestRoomId)!;

    // Swap roomIndex
    const tmpIdx = bossRoom.roomIndex;
    bossRoom.roomIndex = deepRoom.roomIndex;
    deepRoom.roomIndex = tmpIdx;

    bossRoomId = deepestRoomId;
  }

  // Assign enemy configs
  for (const room of rooms.values()) {
    const isBoss = room.id === bossRoomId;
    room.enemyConfig = assignEnemyConfig(room.depth, isBoss);
  }

  const layout: DungeonLayout = {
    rooms,
    corridors,
    doors: allDoors,
    walls,
    doorWalls,
    occupiedTiles,
    tileSize: TILE_SIZE,
    spawnRoomId,
    bossRoomId,
  };

  if (!validateDungeon(layout)) return null;

  return layout;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function addTilesToOccupied(rects: TileRect[], occupied: Set<string>): void {
  for (const r of rects) {
    for (let c = r.col; c < r.col + r.width; c++) {
      for (let rr = r.row; rr < r.row + r.height; rr++) {
        occupied.add(tileKey(c, rr));
      }
    }
  }
}

function createRoomFromRects(
  id: string,
  roomIndex: number,
  tileRects: TileRect[],
  shape: RoomShape,
): DungeonRoom {
  const worldBounds = computeRoomWorldBounds(tileRects, TILE_SIZE);
  const center = computeRoomCenter(worldBounds);

  return {
    id,
    tileRects,
    worldBounds,
    center,
    shape,
    roomIndex,
    doorIds: [],
    state: 'undiscovered',
    enemyConfig: null,
    depth: 0,
  };
}
