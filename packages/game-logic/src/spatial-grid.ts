import type { EntityId, Vec2 } from '@curious/shared';

const CELL_SIZE = 200; // 10x10 grid
const GRID_COLS = 10;
const GRID_ROWS = 10;

/** World coordinates go from -1000 to +1000, so offset by 1000 to get 0..2000 */
const WORLD_OFFSET = 1000;

export type SpatialGrid = {
  cells: Set<EntityId>[][];
};

export function createSpatialGrid(): SpatialGrid {
  const cells: Set<EntityId>[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    cells[r] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      cells[r][c] = new Set();
    }
  }
  return { cells };
}

export function clearGrid(grid: SpatialGrid): void {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      grid.cells[r][c].clear();
    }
  }
}

function toCol(x: number): number {
  const col = Math.floor((x + WORLD_OFFSET) / CELL_SIZE);
  return Math.max(0, Math.min(GRID_COLS - 1, col));
}

function toRow(z: number): number {
  const row = Math.floor((z + WORLD_OFFSET) / CELL_SIZE);
  return Math.max(0, Math.min(GRID_ROWS - 1, row));
}

export function insertEntity(grid: SpatialGrid, id: EntityId, pos: Vec2): void {
  const col = toCol(pos.x);
  const row = toRow(pos.z);
  grid.cells[row][col].add(id);
}

export function getNearbyEntities(grid: SpatialGrid, pos: Vec2, range: number): EntityId[] {
  const centerCol = toCol(pos.x);
  const centerRow = toRow(pos.z);

  // How many cells the range can span
  const cellSpan = Math.ceil(range / CELL_SIZE);

  const minCol = Math.max(0, centerCol - cellSpan);
  const maxCol = Math.min(GRID_COLS - 1, centerCol + cellSpan);
  const minRow = Math.max(0, centerRow - cellSpan);
  const maxRow = Math.min(GRID_ROWS - 1, centerRow + cellSpan);

  const result: EntityId[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const cell = grid.cells[r][c];
      for (const id of cell) {
        result.push(id);
      }
    }
  }
  return result;
}
