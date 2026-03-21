import type { WallSegment, Door } from '@curious/shared';
import { DOOR_WIDTH } from '@curious/shared';
import { tileKey } from './corridor-generator';

type RawWall = {
  ax: number; az: number;
  bx: number; bz: number;
  /** Axis: 'h' for horizontal (same z), 'v' for vertical (same x) */
  axis: 'h' | 'v';
};

/**
 * Build wall segments around all occupied tiles, merging colinear walls
 * and splitting at door positions.
 */
export function buildWalls(
  occupiedTiles: Set<string>,
  doors: Map<string, Door>,
  tileSize: number,
): { walls: WallSegment[]; doorWalls: Map<string, WallSegment> } {
  const rawWalls: RawWall[] = [];

  // Phase 1: Find all boundary edges
  for (const key of occupiedTiles) {
    const [c, r] = key.split(',').map(Number);

    // North edge (row - 1 not occupied)
    if (!occupiedTiles.has(tileKey(c, r - 1))) {
      rawWalls.push({
        ax: c * tileSize, az: r * tileSize,
        bx: (c + 1) * tileSize, bz: r * tileSize,
        axis: 'h',
      });
    }
    // South edge
    if (!occupiedTiles.has(tileKey(c, r + 1))) {
      rawWalls.push({
        ax: c * tileSize, az: (r + 1) * tileSize,
        bx: (c + 1) * tileSize, bz: (r + 1) * tileSize,
        axis: 'h',
      });
    }
    // West edge
    if (!occupiedTiles.has(tileKey(c - 1, r))) {
      rawWalls.push({
        ax: c * tileSize, az: r * tileSize,
        bx: c * tileSize, bz: (r + 1) * tileSize,
        axis: 'v',
      });
    }
    // East edge
    if (!occupiedTiles.has(tileKey(c + 1, r))) {
      rawWalls.push({
        ax: (c + 1) * tileSize, az: r * tileSize,
        bx: (c + 1) * tileSize, bz: (r + 1) * tileSize,
        axis: 'v',
      });
    }
  }

  // Phase 2: Merge colinear adjacent walls
  const merged = mergeWalls(rawWalls);

  // Phase 3: Split walls at door positions
  const doorWalls = new Map<string, WallSegment>();
  let finalWalls: WallSegment[] = [];

  for (const wall of merged) {
    const splits = splitWallAtDoors(wall, doors, doorWalls);
    finalWalls.push(...splits);
  }

  return { walls: finalWalls, doorWalls };
}

function mergeWalls(walls: RawWall[]): WallSegment[] {
  // Separate into horizontal and vertical groups
  const hWalls = walls.filter(w => w.axis === 'h');
  const vWalls = walls.filter(w => w.axis === 'v');

  const merged: WallSegment[] = [];

  // Merge horizontal walls: group by z, sort by x, merge consecutive
  const hGroups = new Map<number, RawWall[]>();
  for (const w of hWalls) {
    const z = w.az;
    if (!hGroups.has(z)) hGroups.set(z, []);
    hGroups.get(z)!.push(w);
  }

  for (const [, group] of hGroups) {
    group.sort((a, b) => a.ax - b.ax);
    let current = { ax: group[0].ax, az: group[0].az, bx: group[0].bx, bz: group[0].bz };
    for (let i = 1; i < group.length; i++) {
      if (group[i].ax <= current.bx + 0.01) {
        // Extend
        current.bx = Math.max(current.bx, group[i].bx);
      } else {
        merged.push({ ax: current.ax, az: current.az, bx: current.bx, bz: current.bz });
        current = { ax: group[i].ax, az: group[i].az, bx: group[i].bx, bz: group[i].bz };
      }
    }
    merged.push({ ax: current.ax, az: current.az, bx: current.bx, bz: current.bz });
  }

  // Merge vertical walls: group by x, sort by z, merge consecutive
  const vGroups = new Map<number, RawWall[]>();
  for (const w of vWalls) {
    const x = w.ax;
    if (!vGroups.has(x)) vGroups.set(x, []);
    vGroups.get(x)!.push(w);
  }

  for (const [, group] of vGroups) {
    group.sort((a, b) => a.az - b.az);
    let current = { ax: group[0].ax, az: group[0].az, bx: group[0].bx, bz: group[0].bz };
    for (let i = 1; i < group.length; i++) {
      if (group[i].az <= current.bz + 0.01) {
        current.bz = Math.max(current.bz, group[i].bz);
      } else {
        merged.push({ ax: current.ax, az: current.az, bx: current.bx, bz: current.bz });
        current = { ax: group[i].ax, az: group[i].az, bx: group[i].bx, bz: group[i].bz };
      }
    }
    merged.push({ ax: current.ax, az: current.az, bx: current.bx, bz: current.bz });
  }

  return merged;
}

function splitWallAtDoors(
  wall: WallSegment,
  doors: Map<string, Door>,
  doorWalls: Map<string, WallSegment>,
): WallSegment[] {
  const isHorizontal = Math.abs(wall.az - wall.bz) < 0.01;
  const isVertical = Math.abs(wall.ax - wall.bx) < 0.01;

  for (const [doorId, door] of doors) {
    if (doorWalls.has(doorId)) continue; // already split

    const halfDoor = DOOR_WIDTH / 2;

    if (isHorizontal && door.direction === 'horizontal') {
      // Check if door is on this wall
      const wz = wall.az;
      if (Math.abs(door.position.z - wz) < 1 && door.position.x > wall.ax && door.position.x < wall.bx) {
        const gapStart = door.position.x - halfDoor;
        const gapEnd = door.position.x + halfDoor;

        doorWalls.set(doorId, { ax: gapStart, az: wz, bx: gapEnd, bz: wz });

        const result: WallSegment[] = [];
        if (gapStart > wall.ax + 0.01) {
          result.push({ ax: wall.ax, az: wz, bx: gapStart, bz: wz });
        }
        if (wall.bx > gapEnd + 0.01) {
          result.push({ ax: gapEnd, az: wz, bx: wall.bx, bz: wz });
        }
        return result;
      }
    }

    if (isVertical && door.direction === 'vertical') {
      const wx = wall.ax;
      if (Math.abs(door.position.x - wx) < 1 && door.position.z > wall.az && door.position.z < wall.bz) {
        const gapStart = door.position.z - halfDoor;
        const gapEnd = door.position.z + halfDoor;

        doorWalls.set(doorId, { ax: wx, az: gapStart, bx: wx, bz: gapEnd });

        const result: WallSegment[] = [];
        if (gapStart > wall.az + 0.01) {
          result.push({ ax: wx, az: wall.az, bx: wx, bz: gapStart });
        }
        if (wall.bz > gapEnd + 0.01) {
          result.push({ ax: wx, az: gapEnd, bx: wx, bz: wall.bz });
        }
        return result;
      }
    }
  }

  // No door intersects this wall
  return [wall];
}
