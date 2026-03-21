import type { WallSegment, Vec2 } from '@curious/shared';

const DEFAULT_CELL_SIZE = 200;

export type WallGrid = {
  cells: Map<string, number[]>; // cell key -> wall indices
  cellSize: number;
};

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function createWallGrid(walls: WallSegment[], cellSize: number = DEFAULT_CELL_SIZE): WallGrid {
  const grid: WallGrid = { cells: new Map(), cellSize };

  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    // Bounding box of the wall segment
    const minX = Math.min(wall.ax, wall.bx);
    const maxX = Math.max(wall.ax, wall.bx);
    const minZ = Math.min(wall.az, wall.bz);
    const maxZ = Math.max(wall.az, wall.bz);

    const colMin = Math.floor(minX / cellSize);
    const colMax = Math.floor(maxX / cellSize);
    const rowMin = Math.floor(minZ / cellSize);
    const rowMax = Math.floor(maxZ / cellSize);

    for (let row = rowMin; row <= rowMax; row++) {
      for (let col = colMin; col <= colMax; col++) {
        const key = cellKey(col, row);
        let list = grid.cells.get(key);
        if (!list) {
          list = [];
          grid.cells.set(key, list);
        }
        list.push(i);
      }
    }
  }

  return grid;
}

export function queryWallGrid(grid: WallGrid, pos: Vec2, radius: number): number[] {
  const { cellSize } = grid;
  const colMin = Math.floor((pos.x - radius) / cellSize);
  const colMax = Math.floor((pos.x + radius) / cellSize);
  const rowMin = Math.floor((pos.z - radius) / cellSize);
  const rowMax = Math.floor((pos.z + radius) / cellSize);

  const seen = new Set<number>();
  const result: number[] = [];

  for (let row = rowMin; row <= rowMax; row++) {
    for (let col = colMin; col <= colMax; col++) {
      const key = cellKey(col, row);
      const list = grid.cells.get(key);
      if (list) {
        for (const idx of list) {
          if (!seen.has(idx)) {
            seen.add(idx);
            result.push(idx);
          }
        }
      }
    }
  }

  return result;
}
