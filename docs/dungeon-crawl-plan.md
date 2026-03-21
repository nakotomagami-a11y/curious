# Dungeon Crawl Mode — Implementation Plan

> Created: 2026-03-21
> Status: Planning

---

## Overview

A procedural dungeon crawl game mode where the player navigates through interconnected rooms, clearing enemies to unlock doors and progressing toward a boss room. Rooms are procedurally generated with varied shapes (rectangular, L-shaped, T-shaped, cross-shaped) connected by corridors.

---

## 1. Data Structures

All dungeon types go in `packages/shared/src/dungeon-types.ts`:

```typescript
// Tile coordinate system: integer grid, each tile = TILE_SIZE world units
type TileCoord = { col: number; row: number };

// Axis-aligned rectangle of tiles (room footprints, corridor segments)
type TileRect = { col: number; row: number; width: number; height: number };

// Room shapes composed of 1+ TileRects
type RoomShape = 'rect' | 'L' | 'T' | 'cross';

type DoorState = 'locked' | 'unlocked' | 'open';
type RoomState = 'undiscovered' | 'active' | 'cleared';

type Door = {
  id: string;
  position: Vec2;        // center in world coords
  normal: Vec2;          // outward facing direction
  width: number;         // doorway width (80 world units)
  connectsRooms: [string, string];
  state: DoorState;
};

type DungeonRoom = {
  id: string;
  tileRects: TileRect[];
  worldBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  center: Vec2;
  shape: RoomShape;
  roomIndex: number;     // 0 = spawn, last = boss
  doorIds: string[];
  state: RoomState;
  enemyConfig: RoomEnemyConfig | null;
};

type Corridor = {
  id: string;
  tileRects: TileRect[];
  connectsRooms: [string, string];
  doorIds: string[];
};

type WallSegment = {
  a: Vec2;  // start point
  b: Vec2;  // end point
};

type RoomEnemyConfig = {
  enemyCount: number;
  enemyTypes: EnemyType[];
  eliteCount: number;
  isBossRoom: boolean;
  bossType?: BossType;
  difficulty: number;
};

type DungeonLayout = {
  rooms: Map<string, DungeonRoom>;
  corridors: Map<string, Corridor>;
  doors: Map<string, Door>;
  walls: WallSegment[];
  occupiedTiles: Set<string>;  // "col,row" for fast lookup
  tileSize: number;
  spawnRoomId: string;
  bossRoomId: string;
};
```

### SimWorld Integration

```typescript
// Added to SimWorld:
dungeon: DungeonLayout | null;
dungeonState: DungeonState | null;

type DungeonState = {
  currentRoomId: string;
  roomStates: Map<string, RoomState>;
  doorStates: Map<string, DoorState>;
  roomsCleared: number;
  totalRooms: number;
};
```

---

## 2. Generation Algorithm

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `TILE_SIZE` | 100 | World units per tile (player radius=30, ~3.3 player widths) |
| `MIN_ROOM_TILES` | 4 | Smallest room dimension |
| `MAX_ROOM_TILES` | 10 | Largest room dimension |
| `CORRIDOR_WIDTH` | 2 | Tiles wide (200 world units) |
| `ROOM_GAP` | 3 | Minimum tile gap between rooms for corridors |
| `DUNGEON_ROOM_COUNT` | 8-12 | Rooms per dungeon |
| `DOOR_WIDTH` | 80 | World units |

### Phase 1: Generate Room Footprints

1. Create spawn room (index 0): 6x6 rectangular
2. Create boss room (last index): 8x8 rectangular
3. For rooms 1 to N-2: randomly select shape template + dimensions

### Phase 2: Place Rooms Without Overlap (Incremental Placement)

1. Place room 0 at origin (tile 0,0)
2. For each subsequent room:
   - Pick a random already-placed room as "anchor"
   - Choose random cardinal direction (N/S/E/W) from anchor's bounding box
   - Position new room `ROOM_GAP` tiles away in chosen direction
   - Add random perpendicular offset (keep partial overlap for corridor routing)
   - **Overlap check**: Verify no tiles in `occupiedTiles` set. If overlap, try 8 other direction/offset combos. If all fail, pick different anchor room.
   - Mark room tiles as occupied
   - Record desired connection edge (new room → anchor room)

### Phase 3: Build Connectivity Graph

- Phase 2 creates a tree (each room except 0 has one parent) → **guaranteed full connectivity**
- Optionally add 1-2 extra edges between nearby rooms (distance < threshold) for loops

### Phase 4: Generate Corridors

For each edge in the connectivity graph:

1. Find closest wall faces of the two rooms
2. Route corridor:
   - **Straight**: If rooms are axis-aligned (perpendicular ranges overlap ≥ CORRIDOR_WIDTH)
   - **L-shaped**: One horizontal + one vertical segment (try both bend orientations)
   - **Z-shaped** (fallback): Three segments with two bends
3. Each corridor is `CORRIDOR_WIDTH` tiles wide
4. Check corridor tiles don't overlap rooms/other corridors
5. Place `Door` at each corridor-room junction

### Phase 5: Build Wall Segments

For every occupied tile:
1. Check all 4 neighbors
2. If neighbor is NOT occupied → that edge is a wall
3. If neighbor belongs to a different unconnected room/corridor → also a wall
4. **Merge colinear adjacent edges** into longer `WallSegment`s (reduce collision checks)
5. **Exclude door positions** (leave gap of `DOOR_WIDTH`)

### Phase 6: Validation

| Check | Method | On Fail |
|-------|--------|---------|
| No overlap | `occupiedTiles` set during placement | Retry placement |
| Full connectivity | BFS from room 0 | Regenerate |
| No dead exits | Every door connects exactly 2 rooms | Regenerate |
| Min playable area | Each room ≥ MIN_ROOM_TILES² | Regenerate |
| Boss room is farthest | Graph distance from spawn | Swap with farthest |
| Max retry budget | 50 attempts/room, 10 full regenerations | Use simpler layout |

---

## 3. Room Templates

| Shape | Chance | Construction | Min Size |
|-------|--------|-------------|----------|
| **Rectangular** | 50% | Single TileRect, W×H from [4,10] | 4×4 |
| **L-Shaped** | 20% | Two TileRects: full bottom + partial top (corner cut) | 5×5 |
| **T-Shaped** | 15% | Two TileRects: horizontal bar + vertical stem | 6×5 |
| **Cross-Shaped** | 15% | Two TileRects: horizontal + vertical bar, overlapping center | 7×7 |

Each template randomizes dimensions within bounds. Minimum sub-rectangle dimension: 3 tiles (300 world units).

---

## 4. Corridor Generation Details

### Path Routing

Given room A and room B:
1. Find closest edges (wall faces facing each other)
2. Compute connection points on each edge
3. Route based on alignment:

```
Straight (aligned):     L-bend:              Z-bend (fallback):
  A ════════ B          A ═══╗               A ═══╗
                              ║                    ║
                              ╚═══ B               ╠═══╗
                                                       ║
                                                       B
```

### Door Placement
- Door at exact tile boundary where corridor meets room wall
- Door creates a gap (DOOR_WIDTH) in the wall segment
- Wall segments on each side of door are shortened

---

## 5. Collision — Circle vs Wall Segments

### New Function: `circleVsSegment`

```typescript
function circleVsSegment(
  center: Vec2, radius: number,
  segA: Vec2, segB: Vec2
): Vec2 | null  // push vector or null
```

Algorithm:
1. Project circle center onto line through segA→segB
2. Clamp parameter t to [0, 1] → closest point on segment
3. Distance from center to closest point
4. If distance < radius → push = normalize(center - closest) × (radius - distance)

### Integration

In `resolveCollisions()` after circle-circle pass:
```
if (world.dungeon) {
  for each entity:
    query wall spatial grid for nearby walls
    for each nearby wall: apply circleVsSegment pushback
}
```

### Wall Spatial Grid
- Static grid built once at dungeon generation
- Same cell size as entity spatial grid (200 units)
- Each wall segment inserted into all cells it overlaps

### Door Collision
- **Locked doors** = wall segments (impassable)
- **Open doors** = removed from active wall list
- Dynamic: `activeWalls` list updated on door state change

### Projectile-Wall Collision
- Projectiles destroyed on wall contact (same circleVsSegment)
- Pass through open doors

### Arena Clamping
- Disabled in dungeon mode (walls handle containment)

---

## 6. Enemy Spawning — Per Room

### Difficulty by Room Depth (graph distance from spawn)

| Depth | Enemies | Types | Elites | Scaling |
|-------|---------|-------|--------|---------|
| 0 (spawn) | 0 | — | 0 | — |
| 1-2 | 3-5 | melee, caster | 0 | HP ×1.0-1.3 |
| 3-4 | 4-7 | melee, caster, dasher, shielder | 0-1 | HP ×1.3-1.6 |
| 5+ | 5-8 | all types | 1-2 | HP ×1.6+ |
| Boss | 1 boss + 2-4 | mixed | 0 | Boss stats |

Scaling: `healthMult = 1 + depth × 0.15`, `speedMult = 1 + depth × 0.08`, `damageMult = 1 + depth × 0.10`

### Spawn Trigger Flow

```
Player enters room
  → Room state: undiscovered → active
  → Lock ALL doors of this room
  → Spawn enemies at random positions within room tiles
  → Set enemy leashOrigin = room center
  → Set enemy leash range = room half-diagonal

All enemies killed
  → Room state: active → cleared
  → Unlock + open ALL doors of this room
  → Emit ROOM_CLEARED event
  → If boss room → emit DUNGEON_COMPLETE
```

### Spawn Position Selection
- Pick random tile within room's tileRects
- Convert to world coords + random offset within tile
- Ensure ≥200 units from player position
- Retry up to 20 times

---

## 7. Progression — Door Locking/Unlocking

### State Machine

```
Room:  undiscovered ──(player enters)──→ active ──(enemies cleared)──→ cleared
Door:  unlocked ──(room becomes active)──→ locked ──(room cleared)──→ open
```

### Initial State
- Spawn room: `cleared` (no enemies)
- Doors adjacent to spawn room: `open`
- All other rooms: `undiscovered`
- All other doors: `unlocked` (passable until room activates)

### Door Logic
A door is passable when:
- Both connected rooms are cleared, OR
- One room is cleared and the other is undiscovered (allowing exploration)

A door locks when:
- The player enters a room (preventing escape during combat)

---

## 8. Rendering — Three.js / R3F

### DungeonFloor
- Merged `BufferGeometry` from all room/corridor tile footprints
- Custom shader: dark stone texture, subtle grid pattern
- Room tint by state: dark purple (undiscovered), warm stone (cleared), red glow (active)

### DungeonWalls (Extruded Box Meshes)
- Each wall segment → thin box (width=20, height=150 units)
- All wall boxes merged into single `BufferGeometry` (one draw call)
- Stone/brick material with normal mapping
- Rebuild only when door states change

### DungeonDoors
- **Locked**: Red glowing gate mesh, emissive material, slight animation
- **Open**: No mesh (gap in wall) or semi-transparent archway
- Animated transition (slide up or dissolve)

### DungeonMinimap (HUD overlay)
- Small corner overlay showing room graph
- Rooms as colored rectangles: dark (undiscovered), red (active), green (cleared)
- Current room highlighted
- Corridors as thin lines between rooms

### Camera Adjustments
- Shadow camera follows player with smaller frustum (not fixed 600×600)
- No arena bounds — camera follows player through dungeon

---

## 9. New File Structure

```
packages/shared/src/
├── dungeon-types.ts          # All dungeon data structures
└── dungeon-constants.ts      # TILE_SIZE, CORRIDOR_WIDTH, etc.

packages/game-logic/src/dungeon/
├── room-templates.ts         # Shape generators (rect, L, T, cross)
├── dungeon-generator.ts      # Main generateDungeon() — Phases 1-6
├── corridor-generator.ts     # Corridor routing (straight, L, Z)
├── wall-builder.ts           # Tile→WallSegment conversion, merging, door gaps
├── dungeon-validator.ts      # Connectivity, overlap, dead exit checks
├── dungeon-spawner.ts        # tickDungeonSpawner(), room entry, enemy spawn
├── wall-spatial-grid.ts      # Static spatial grid for wall collision
└── wall-collision.ts         # circleVsSegment, resolveWallCollisions

apps/web/src/modules/Dungeon/
├── components/
│   ├── DungeonRenderer.tsx   # Top-level: floor + walls + doors
│   ├── DungeonFloor.tsx      # Merged floor geometry
│   ├── DungeonWalls.tsx      # Merged wall box geometry
│   ├── DungeonDoors.tsx      # Door meshes with state
│   └── DungeonMinimap.tsx    # HUD room graph overlay
└── hooks/
    └── useDungeonState.ts    # Read dungeon state from store
```

### Modified Files
- `packages/shared/src/types.ts` — Add `'dungeon'` to GameMode
- `packages/shared/src/events.ts` — Add ROOM_ENTERED, ROOM_CLEARED, DOOR_LOCKED, DOOR_UNLOCKED, DUNGEON_COMPLETE
- `packages/shared/src/index.ts` — Export dungeon modules
- `packages/game-logic/src/simulation.ts` — Add dungeon/dungeonState to SimWorld, wall collision in resolveCollisions, dungeon spawner in tick loop, skip arena clamp
- `packages/game-logic/src/combat/collision.ts` — Add circleVsSegment
- `packages/game-logic/src/combat/projectile.ts` — Add projectile-wall collision
- `packages/game-logic/src/index.ts` — Export dungeon modules
- `apps/web/src/modules/Combat/hooks/useModeSelectActions.ts` — Dungeon mode init
- `apps/web/src/modules/Combat/hooks/useSimulation.ts` — Sync dungeon state, handle events
- `apps/web/src/modules/Combat/components/CombatScene.tsx` — Conditional DungeonRenderer
- `apps/web/src/modules/Combat/components/ModeSelectScene.tsx` — Dungeon mode card
- `apps/web/src/lib/stores/game-store.ts` — Dungeon state fields

---

## 10. Edge Cases

| Edge Case | Solution |
|-----------|----------|
| Room placement fails (too crowded) | Retry up to 50 attempts/room, 10 full regenerations |
| Corridor overlaps existing room | Try alternate L-bend orientation, then Z-bend fallback |
| Knockback pushes entity through wall | Wall collision pass after knockback resolves it |
| Projectiles at locked doors | Destroyed by door wall segments |
| Player death mid-room | Standard death → restart dungeon (regenerate) |
| Large dungeon exceeds bounds | No fixed arena bounds in dungeon mode; camera follows player |
| Enemy pathing through corridors | Leash origin at room center keeps them contained |
| Boss room too close to spawn | Validation swaps boss room with farthest room |

---

## 11. Implementation Order

1. **Shared types + constants** (dungeon-types.ts, dungeon-constants.ts)
2. **Room templates** (room-templates.ts)
3. **Dungeon generator** (dungeon-generator.ts, corridor-generator.ts)
4. **Wall builder** (wall-builder.ts)
5. **Validator** (dungeon-validator.ts)
6. **Wall collision** (wall-collision.ts, wall-spatial-grid.ts, update collision.ts)
7. **Dungeon spawner** (dungeon-spawner.ts)
8. **SimWorld integration** (simulation.ts updates)
9. **Rendering** (DungeonRenderer, Floor, Walls, Doors)
10. **Minimap** (DungeonMinimap)
11. **Mode integration** (ModeSelectScene, useModeSelectActions, useSimulation)
12. **Events + audio** (new events, room clear sounds)
