import type { DungeonLayout } from '@curious/shared';

/**
 * Validate a generated dungeon layout.
 * Returns true if the dungeon is valid, false if it should be regenerated.
 */
export function validateDungeon(layout: DungeonLayout): boolean {
  const { rooms, doors, spawnRoomId, bossRoomId } = layout;

  // Check 1: spawn and boss rooms exist
  if (!rooms.has(spawnRoomId) || !rooms.has(bossRoomId)) return false;

  // Check 2: BFS from spawnRoomId reaches all rooms
  const visited = new Set<string>();
  const queue: string[] = [spawnRoomId];
  visited.add(spawnRoomId);

  // Build adjacency from doors
  const adjacency = new Map<string, Set<string>>();
  for (const room of rooms.values()) {
    adjacency.set(room.id, new Set());
  }

  for (const door of doors.values()) {
    const [a, b] = door.connectsRooms;
    if (rooms.has(a) && rooms.has(b)) {
      adjacency.get(a)!.add(b);
      adjacency.get(b)!.add(a);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  if (visited.size !== rooms.size) return false;

  // Check 3: Every door connects exactly 2 rooms that exist
  for (const door of doors.values()) {
    const [a, b] = door.connectsRooms;
    if (!rooms.has(a) || !rooms.has(b)) return false;
    if (a === b) return false;
  }

  // Check 4: Boss room has the highest depth
  const bossRoom = rooms.get(bossRoomId)!;
  for (const room of rooms.values()) {
    if (room.id !== bossRoomId && room.depth > bossRoom.depth) {
      return false;
    }
  }

  return true;
}
