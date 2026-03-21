import type { Vec2, EntityId, EnemyType, BossType } from './types';

// --- Tile System ---
export type TileCoord = { col: number; row: number };
export type TileRect = { col: number; row: number; width: number; height: number };

// --- Room ---
export type RoomShape = 'rect' | 'L' | 'T' | 'cross';
export type RoomState = 'undiscovered' | 'active' | 'cleared';

export type RoomEnemyConfig = {
  enemyCount: number;
  enemyTypes: EnemyType[];
  eliteCount: number;
  isBossRoom: boolean;
  bossType?: BossType;
  difficulty: number;
};

export type DungeonRoom = {
  id: string;
  tileRects: TileRect[];
  worldBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  center: Vec2;
  shape: RoomShape;
  roomIndex: number;
  doorIds: string[];
  state: RoomState;
  enemyConfig: RoomEnemyConfig | null;
  /** Graph depth from spawn room (used for difficulty scaling) */
  depth: number;
};

// --- Door ---
export type DoorState = 'locked' | 'unlocked' | 'open';

export type Door = {
  id: string;
  position: Vec2;
  /** Direction the door faces (perpendicular to wall) */
  direction: 'horizontal' | 'vertical';
  width: number;
  connectsRooms: [string, string];
  state: DoorState;
};

// --- Corridor ---
export type Corridor = {
  id: string;
  tileRects: TileRect[];
  connectsRooms: [string, string];
  doorIds: string[];
};

// --- Wall ---
export type WallSegment = {
  ax: number; az: number;
  bx: number; bz: number;
};

// --- Dungeon Layout (static, generated once) ---
export type DungeonLayout = {
  rooms: Map<string, DungeonRoom>;
  corridors: Map<string, Corridor>;
  doors: Map<string, Door>;
  walls: WallSegment[];
  /** Door wall segments that can be toggled (locked = collidable) */
  doorWalls: Map<string, WallSegment>;
  occupiedTiles: Set<string>;
  tileSize: number;
  spawnRoomId: string;
  bossRoomId: string;
};

// --- Dungeon Runtime State ---
export type DungeonState = {
  currentRoomId: string;
  roomStates: Record<string, RoomState>;
  doorStates: Record<string, DoorState>;
  roomsCleared: number;
  totalRooms: number;
  /** Enemy IDs spawned for the currently active room */
  activeRoomEnemyIds: string[];
  complete: boolean;
};
