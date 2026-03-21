import type { TileRect, RoomShape } from '@curious/shared';
import {
  MIN_ROOM_TILES,
  MAX_ROOM_TILES,
  MIN_SUB_RECT_TILES,
  ROOM_SHAPE_RECT_CHANCE,
  ROOM_SHAPE_L_CHANCE,
  ROOM_SHAPE_T_CHANCE,
} from '@curious/shared';

/** Pick a random integer in [min, max] inclusive. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Roll a random room shape based on configured chances. */
export function rollRoomShape(): RoomShape {
  const r = Math.random();
  if (r < ROOM_SHAPE_RECT_CHANCE) return 'rect';
  if (r < ROOM_SHAPE_RECT_CHANCE + ROOM_SHAPE_L_CHANCE) return 'L';
  if (r < ROOM_SHAPE_RECT_CHANCE + ROOM_SHAPE_L_CHANCE + ROOM_SHAPE_T_CHANCE) return 'T';
  return 'cross';
}

/**
 * Generate tile rectangles for a room of the given shape.
 * @param shape - The room shape type.
 * @param sizeHint - Optional hint for overall size (clamped to valid range).
 */
export function generateRoomTiles(shape: RoomShape, sizeHint?: number): TileRect[] {
  const size = sizeHint
    ? Math.max(MIN_ROOM_TILES, Math.min(MAX_ROOM_TILES, sizeHint))
    : randInt(MIN_ROOM_TILES, MAX_ROOM_TILES);

  switch (shape) {
    case 'rect':
      return generateRect(size);
    case 'L':
      return generateL(size);
    case 'T':
      return generateT(size);
    case 'cross':
      return generateCross(size);
  }
}

function generateRect(size: number): TileRect[] {
  const w = randInt(Math.max(MIN_SUB_RECT_TILES, size - 2), Math.min(MAX_ROOM_TILES, size + 2));
  const h = randInt(Math.max(MIN_SUB_RECT_TILES, size - 2), Math.min(MAX_ROOM_TILES, size + 2));
  return [{ col: 0, row: 0, width: w, height: h }];
}

function generateL(size: number): TileRect[] {
  // Base rect then cut one corner to form an L.
  const totalW = Math.max(MIN_SUB_RECT_TILES + MIN_SUB_RECT_TILES, randInt(size, Math.min(MAX_ROOM_TILES, size + 3)));
  const totalH = Math.max(MIN_SUB_RECT_TILES + MIN_SUB_RECT_TILES, randInt(size, Math.min(MAX_ROOM_TILES, size + 3)));

  // Split heights for the two rects
  const splitH = randInt(MIN_SUB_RECT_TILES, totalH - MIN_SUB_RECT_TILES);
  // Width of the narrower part
  const narrowW = randInt(MIN_SUB_RECT_TILES, totalW - 1);

  // Pick which corner is cut (4 orientations)
  const corner = randInt(0, 3);
  switch (corner) {
    case 0: // cut top-right
      return [
        { col: 0, row: 0, width: totalW, height: splitH },
        { col: 0, row: splitH, width: narrowW, height: totalH - splitH },
      ];
    case 1: // cut top-left
      return [
        { col: 0, row: 0, width: totalW, height: splitH },
        { col: totalW - narrowW, row: splitH, width: narrowW, height: totalH - splitH },
      ];
    case 2: // cut bottom-right
      return [
        { col: 0, row: 0, width: narrowW, height: totalH - splitH },
        { col: 0, row: totalH - splitH, width: totalW, height: splitH },
      ];
    case 3: // cut bottom-left
    default:
      return [
        { col: totalW - narrowW, row: 0, width: narrowW, height: totalH - splitH },
        { col: 0, row: totalH - splitH, width: totalW, height: splitH },
      ];
  }
}

function generateT(size: number): TileRect[] {
  // Bar + stem forming a T. Randomize orientation.
  const barLen = Math.max(MIN_SUB_RECT_TILES * 2, randInt(size, Math.min(MAX_ROOM_TILES, size + 3)));
  const barThick = MIN_SUB_RECT_TILES;
  const stemLen = randInt(MIN_SUB_RECT_TILES, Math.min(MAX_ROOM_TILES - barThick, size));
  const stemThick = MIN_SUB_RECT_TILES;

  const stemOffset = Math.floor((barLen - stemThick) / 2);

  const orient = randInt(0, 3);
  switch (orient) {
    case 0: // bar on top, stem down
      return [
        { col: 0, row: 0, width: barLen, height: barThick },
        { col: stemOffset, row: barThick, width: stemThick, height: stemLen },
      ];
    case 1: // bar on bottom, stem up
      return [
        { col: stemOffset, row: 0, width: stemThick, height: stemLen },
        { col: 0, row: stemLen, width: barLen, height: barThick },
      ];
    case 2: // bar on left, stem right
      return [
        { col: 0, row: 0, width: barThick, height: barLen },
        { col: barThick, row: stemOffset, width: stemLen, height: stemThick },
      ];
    case 3: // bar on right, stem left
    default:
      return [
        { col: stemLen, row: 0, width: barThick, height: barLen },
        { col: 0, row: stemOffset, width: stemLen, height: stemThick },
      ];
  }
}

function generateCross(size: number): TileRect[] {
  // Horizontal and vertical bars overlapping in center.
  const armLen = Math.max(MIN_SUB_RECT_TILES * 2, randInt(size, Math.min(MAX_ROOM_TILES, size + 2)));
  const armThick = MIN_SUB_RECT_TILES;

  const cx = Math.floor((armLen - armThick) / 2);
  const cy = Math.floor((armLen - armThick) / 2);

  return [
    { col: 0, row: cy, width: armLen, height: armThick },  // horizontal bar
    { col: cx, row: 0, width: armThick, height: armLen },   // vertical bar
  ];
}
