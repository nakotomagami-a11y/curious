// --- Dungeon Tile Grid ---
export const TILE_SIZE = 100; // world units per tile
export const CORRIDOR_WIDTH = 2; // tiles
export const ROOM_GAP = 3; // min tile gap between rooms
export const DOOR_WIDTH = 80; // world units
export const WALL_THICKNESS = 10; // world units (for rendering)
export const WALL_HEIGHT = 150; // visual height (world units)

// --- Room Sizes ---
export const MIN_ROOM_TILES = 4;
export const MAX_ROOM_TILES = 10;
export const MIN_SUB_RECT_TILES = 3; // minimum dimension for any sub-rectangle

// --- Dungeon Size ---
export const DUNGEON_MIN_ROOMS = 8;
export const DUNGEON_MAX_ROOMS = 12;
export const DUNGEON_MAX_GRID = 60; // max tiles in any direction

// --- Room Shape Chances ---
export const ROOM_SHAPE_RECT_CHANCE = 0.50;
export const ROOM_SHAPE_L_CHANCE = 0.20;
export const ROOM_SHAPE_T_CHANCE = 0.15;
// cross = remainder (0.15)

// --- Generation Limits ---
export const MAX_PLACEMENT_ATTEMPTS = 50;
export const MAX_GENERATION_RETRIES = 10;

// --- Spawning ---
export const DUNGEON_SPAWN_DISTANCE = 200; // min dist from player for enemy spawn
export const DUNGEON_SPAWN_ROOM_SIZE = 6; // tiles for spawn room
export const DUNGEON_BOSS_ROOM_SIZE = 8; // tiles for boss room

// --- Enemy Scaling (per depth) ---
export const DUNGEON_HEALTH_SCALE = 0.15; // per depth
export const DUNGEON_SPEED_SCALE = 0.08;
export const DUNGEON_DAMAGE_SCALE = 0.10;

// --- Extra Loop Edges ---
export const DUNGEON_EXTRA_EDGES = 2; // optional extra connections for loops
export const DUNGEON_EXTRA_EDGE_MAX_DIST = 800; // max distance for extra edge (world units)
