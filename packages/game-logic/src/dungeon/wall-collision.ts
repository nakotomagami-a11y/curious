import type { Vec2, WallSegment } from '@curious/shared';

/**
 * Check if a circle collides with a wall segment (line segment).
 * Returns push vector to resolve collision, or null.
 */
export function circleVsWallSegment(
  center: Vec2,
  radius: number,
  wall: WallSegment,
): Vec2 | null {
  const dx = wall.bx - wall.ax;
  const dz = wall.bz - wall.az;
  const fx = center.x - wall.ax;
  const fz = center.z - wall.az;

  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.0001) {
    // Degenerate wall (zero-length segment) — treat as point
    const dist = Math.sqrt(fx * fx + fz * fz);
    if (dist < radius) {
      const overlap = radius - dist;
      if (dist < 0.001) {
        return { x: overlap, z: 0 };
      }
      return { x: (fx / dist) * overlap, z: (fz / dist) * overlap };
    }
    return null;
  }

  let t = (fx * dx + fz * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = wall.ax + t * dx;
  const closestZ = wall.az + t * dz;
  const distX = center.x - closestX;
  const distZ = center.z - closestZ;
  const dist = Math.sqrt(distX * distX + distZ * distZ);

  if (dist < radius) {
    const overlap = radius - dist;
    if (dist < 0.001) {
      // Push in perpendicular direction to the wall
      const pLen = Math.sqrt(dx * dx + dz * dz);
      return { x: (-dz / pLen) * overlap, z: (dx / pLen) * overlap };
    }
    return { x: (distX / dist) * overlap, z: (distZ / dist) * overlap };
  }

  return null;
}

/**
 * Resolve all wall collisions for a single entity.
 * Runs multiple iterations to handle corners where two walls meet.
 * Mutates position in place.
 */
export function resolveEntityWallCollisions(
  position: Vec2,
  radius: number,
  walls: WallSegment[],
  nearbyWallIndices?: number[],
): void {
  const indices = nearbyWallIndices ?? walls.map((_, i) => i);

  // Multiple passes to resolve corner collisions properly
  for (let pass = 0; pass < 3; pass++) {
    let anyPush = false;
    for (const idx of indices) {
      const wall = walls[idx];
      if (!wall) continue;
      const push = circleVsWallSegment(position, radius, wall);
      if (push) {
        position.x += push.x;
        position.z += push.z;
        anyPush = true;
      }
    }
    if (!anyPush) break; // No collisions this pass, done
  }
}
