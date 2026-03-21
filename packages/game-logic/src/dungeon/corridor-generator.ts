import type { TileRect, DungeonRoom, Corridor, Door } from '@curious/shared';
import { CORRIDOR_WIDTH, DOOR_WIDTH } from '@curious/shared';

/** Encode tile coordinate as a string key for set lookups. */
export function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

type Direction = 'N' | 'S' | 'E' | 'W';
type Edge = { col: number; row: number; dir: Direction };

/** Get all boundary tiles of a room with the edge direction they face outward. */
function getRoomEdges(room: DungeonRoom): Edge[] {
  const tileSet = new Set<string>();
  for (const r of room.tileRects) {
    for (let c = r.col; c < r.col + r.width; c++) {
      for (let rr = r.row; rr < r.row + r.height; rr++) {
        tileSet.add(tileKey(c, rr));
      }
    }
  }

  const edges: Edge[] = [];
  for (const key of tileSet) {
    const [c, r] = key.split(',').map(Number);
    if (!tileSet.has(tileKey(c, r - 1))) edges.push({ col: c, row: r, dir: 'N' });
    if (!tileSet.has(tileKey(c, r + 1))) edges.push({ col: c, row: r, dir: 'S' });
    if (!tileSet.has(tileKey(c - 1, r))) edges.push({ col: c, row: r, dir: 'W' });
    if (!tileSet.has(tileKey(c + 1, r))) edges.push({ col: c, row: r, dir: 'E' });
  }
  return edges;
}

/** Find the closest pair of edges between two rooms. */
function findClosestEdges(
  edgesA: Edge[],
  edgesB: Edge[],
): { edgeA: Edge; edgeB: Edge; dist: number } | null {
  let best: { edgeA: Edge; edgeB: Edge; dist: number } | null = null;

  for (const a of edgesA) {
    for (const b of edgesB) {
      // Only connect facing edges (A east → B west, etc.)
      if (
        (a.dir === 'E' && b.dir === 'W') ||
        (a.dir === 'W' && b.dir === 'E') ||
        (a.dir === 'S' && b.dir === 'N') ||
        (a.dir === 'N' && b.dir === 'S')
      ) {
        const dist = Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
        if (!best || dist < best.dist) {
          best = { edgeA: a, edgeB: b, dist };
        }
      }
    }
  }

  return best;
}

/** Check if a corridor segment overlaps occupied tiles. */
function segmentClear(rect: TileRect, occupied: Set<string>): boolean {
  for (let c = rect.col; c < rect.col + rect.width; c++) {
    for (let r = rect.row; r < rect.row + rect.height; r++) {
      if (occupied.has(tileKey(c, r))) return false;
    }
  }
  return true;
}

/** Get connection point on the outside of an edge tile. */
function getConnectionPoint(edge: Edge): { col: number; row: number } {
  switch (edge.dir) {
    case 'N': return { col: edge.col, row: edge.row - 1 };
    case 'S': return { col: edge.col, row: edge.row + 1 };
    case 'E': return { col: edge.col + 1, row: edge.row };
    case 'W': return { col: edge.col - 1, row: edge.row };
  }
}

/** Try to build a straight corridor between two points. */
function tryStraight(
  start: { col: number; row: number },
  end: { col: number; row: number },
  horizontal: boolean,
  occupied: Set<string>,
): TileRect[] | null {
  if (horizontal && start.row === end.row) {
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);
    const rect: TileRect = {
      col: minC,
      row: start.row - Math.floor(CORRIDOR_WIDTH / 2),
      width: maxC - minC + 1,
      height: CORRIDOR_WIDTH,
    };
    if (segmentClear(rect, occupied)) return [rect];
  } else if (!horizontal && start.col === end.col) {
    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const rect: TileRect = {
      col: start.col - Math.floor(CORRIDOR_WIDTH / 2),
      row: minR,
      width: CORRIDOR_WIDTH,
      height: maxR - minR + 1,
    };
    if (segmentClear(rect, occupied)) return [rect];
  }
  return null;
}

/** Try an L-bend corridor. */
function tryLBend(
  start: { col: number; row: number },
  end: { col: number; row: number },
  occupied: Set<string>,
  variant: 0 | 1,
): TileRect[] | null {
  const hw = Math.floor(CORRIDOR_WIDTH / 2);

  // variant 0: go horizontal first, then vertical
  // variant 1: go vertical first, then horizontal
  if (variant === 0) {
    const midCol = end.col;
    // Horizontal segment from start to midCol
    const hMinC = Math.min(start.col, midCol);
    const hMaxC = Math.max(start.col, midCol);
    const hRect: TileRect = {
      col: hMinC,
      row: start.row - hw,
      width: hMaxC - hMinC + 1,
      height: CORRIDOR_WIDTH,
    };
    // Vertical segment from start.row to end.row at midCol
    const vMinR = Math.min(start.row, end.row);
    const vMaxR = Math.max(start.row, end.row);
    const vRect: TileRect = {
      col: midCol - hw,
      row: vMinR,
      width: CORRIDOR_WIDTH,
      height: vMaxR - vMinR + 1,
    };
    if (segmentClear(hRect, occupied) && segmentClear(vRect, occupied)) {
      return [hRect, vRect];
    }
  } else {
    const midRow = end.row;
    // Vertical segment from start to midRow
    const vMinR = Math.min(start.row, midRow);
    const vMaxR = Math.max(start.row, midRow);
    const vRect: TileRect = {
      col: start.col - hw,
      row: vMinR,
      width: CORRIDOR_WIDTH,
      height: vMaxR - vMinR + 1,
    };
    // Horizontal segment from start.col to end.col at midRow
    const hMinC = Math.min(start.col, end.col);
    const hMaxC = Math.max(start.col, end.col);
    const hRect: TileRect = {
      col: hMinC,
      row: midRow - hw,
      width: hMaxC - hMinC + 1,
      height: CORRIDOR_WIDTH,
    };
    if (segmentClear(vRect, occupied) && segmentClear(hRect, occupied)) {
      return [vRect, hRect];
    }
  }
  return null;
}

/** Try a Z-bend corridor (S-shaped with an offset). */
function tryZBend(
  start: { col: number; row: number },
  end: { col: number; row: number },
  occupied: Set<string>,
): TileRect[] | null {
  const hw = Math.floor(CORRIDOR_WIDTH / 2);
  const midCol = Math.floor((start.col + end.col) / 2);
  const midRow = Math.floor((start.row + end.row) / 2);

  // Horizontal → vertical → horizontal
  const h1: TileRect = {
    col: Math.min(start.col, midCol),
    row: start.row - hw,
    width: Math.abs(midCol - start.col) + 1,
    height: CORRIDOR_WIDTH,
  };
  const v: TileRect = {
    col: midCol - hw,
    row: Math.min(start.row, end.row),
    width: CORRIDOR_WIDTH,
    height: Math.abs(end.row - start.row) + 1,
  };
  const h2: TileRect = {
    col: Math.min(midCol, end.col),
    row: end.row - hw,
    width: Math.abs(end.col - midCol) + 1,
    height: CORRIDOR_WIDTH,
  };

  if (segmentClear(h1, occupied) && segmentClear(v, occupied) && segmentClear(h2, occupied)) {
    return [h1, v, h2];
  }

  // Vertical → horizontal → vertical
  const v1: TileRect = {
    col: start.col - hw,
    row: Math.min(start.row, midRow),
    width: CORRIDOR_WIDTH,
    height: Math.abs(midRow - start.row) + 1,
  };
  const h: TileRect = {
    col: Math.min(start.col, end.col),
    row: midRow - hw,
    width: Math.abs(end.col - start.col) + 1,
    height: CORRIDOR_WIDTH,
  };
  const v2: TileRect = {
    col: end.col - hw,
    row: Math.min(midRow, end.row),
    width: CORRIDOR_WIDTH,
    height: Math.abs(end.row - midRow) + 1,
  };

  if (segmentClear(v1, occupied) && segmentClear(h, occupied) && segmentClear(v2, occupied)) {
    return [v1, h, v2];
  }

  return null;
}

let corridorIdCounter = 0;
let doorIdCounter = 0;

/** Reset ID counters (call at start of each dungeon generation). */
export function resetCorridorIds(): void {
  corridorIdCounter = 0;
  doorIdCounter = 0;
}

function makeDoor(
  edge: Edge,
  roomAId: string,
  roomBId: string,
  tileSize: number,
): Door {
  const id = `door_${doorIdCounter++}`;

  // Door position must be on the tile EDGE (where walls are), not tile center.
  // Edge direction tells us which edge of the tile the door sits on.
  let cx: number;
  let cz: number;
  let direction: 'horizontal' | 'vertical';

  switch (edge.dir) {
    case 'N': // Top edge of tile: z = row * tileSize
      cx = (edge.col + 0.5) * tileSize;
      cz = edge.row * tileSize;
      direction = 'horizontal';
      break;
    case 'S': // Bottom edge: z = (row + 1) * tileSize
      cx = (edge.col + 0.5) * tileSize;
      cz = (edge.row + 1) * tileSize;
      direction = 'horizontal';
      break;
    case 'W': // Left edge: x = col * tileSize
      cx = edge.col * tileSize;
      cz = (edge.row + 0.5) * tileSize;
      direction = 'vertical';
      break;
    case 'E': // Right edge: x = (col + 1) * tileSize
      cx = (edge.col + 1) * tileSize;
      cz = (edge.row + 0.5) * tileSize;
      direction = 'vertical';
      break;
  }

  return {
    id,
    position: { x: cx, z: cz },
    direction,
    width: DOOR_WIDTH,
    connectsRooms: [roomAId, roomBId],
    state: 'locked',
  };
}

/**
 * Generate a corridor connecting two rooms.
 * Returns corridor + doors, or null if routing fails.
 */
export function generateCorridor(
  roomA: DungeonRoom,
  roomB: DungeonRoom,
  occupiedTiles: Set<string>,
  tileSize: number,
): { corridor: Corridor; doors: Door[] } | null {
  const edgesA = getRoomEdges(roomA);
  const edgesB = getRoomEdges(roomB);

  const closest = findClosestEdges(edgesA, edgesB);
  if (!closest) return null;

  const startPt = getConnectionPoint(closest.edgeA);
  const endPt = getConnectionPoint(closest.edgeB);

  const isHorizontal = closest.edgeA.dir === 'E' || closest.edgeA.dir === 'W';

  // Try routing strategies in order
  const strategies: (() => TileRect[] | null)[] = [
    () => tryStraight(startPt, endPt, isHorizontal, occupiedTiles),
    () => tryLBend(startPt, endPt, occupiedTiles, 0),
    () => tryLBend(startPt, endPt, occupiedTiles, 1),
    () => tryZBend(startPt, endPt, occupiedTiles),
  ];

  for (const strategy of strategies) {
    const rects = strategy();
    if (rects) {
      const id = `corridor_${corridorIdCounter++}`;

      const doorA = makeDoor(closest.edgeA, roomA.id, roomB.id, tileSize);
      const doorB = makeDoor(closest.edgeB, roomA.id, roomB.id, tileSize);

      const corridor: Corridor = {
        id,
        tileRects: rects,
        connectsRooms: [roomA.id, roomB.id],
        doorIds: [doorA.id, doorB.id],
      };

      return { corridor, doors: [doorA, doorB] };
    }
  }

  return null;
}
