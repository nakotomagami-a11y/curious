/**
 * Pack AI — coordinate groups of enemies for tactical behaviour.
 *
 * Assigns roles (flanker / presser / support) so that enemies surrounding a
 * player behave as a cohesive pack rather than a blob.
 */

import type { EntityId, EnemyType, Vec2 } from '@curious/shared';
import { vec2Sub, vec2Angle, vec2Normalize } from '@curious/shared';
import type { SimWorld } from './simulation';

export type PackRole = 'flanker' | 'presser' | 'support';

// Global role map — written by assignPackRoles, read by individual AI modules.
const packRoles: Map<EntityId, PackRole> = new Map();

/**
 * For each player, find all enemies targeting that player and assign pack roles.
 * Call once per tick (or every few ticks) before individual AI updates.
 */
export function assignPackRoles(world: SimWorld): void {
  packRoles.clear();

  // Group enemies by their current target player
  const targetGroups = new Map<EntityId, { id: EntityId; type: EnemyType }[]>();

  for (const enemy of world.enemies.values()) {
    if (
      enemy.aiState === 'dying' ||
      enemy.aiState === 'dead' ||
      !enemy.targetId
    ) {
      continue;
    }
    // Only group if target is a player
    if (!world.players.has(enemy.targetId)) continue;

    let group = targetGroups.get(enemy.targetId);
    if (!group) {
      group = [];
      targetGroups.set(enemy.targetId, group);
    }
    group.push({ id: enemy.id, type: enemy.enemyType });
  }

  // Assign roles per group
  for (const group of targetGroups.values()) {
    let presserCount = 0;

    for (const entry of group) {
      const role = resolveRole(entry.type, presserCount);
      packRoles.set(entry.id, role);
      if (role === 'presser') presserCount++;
    }
  }
}

function resolveRole(type: EnemyType, currentPresserCount: number): PackRole {
  switch (type) {
    case 'melee':
    case 'shielder':
      // First 2 melee/shielder are pressers, rest flank
      return currentPresserCount < 2 ? 'presser' : 'flanker';

    case 'caster':
    case 'summoner':
    case 'healer':
      return 'support';

    case 'dasher':
    case 'teleporter':
      return 'flanker';

    case 'bomber':
      return 'presser';

    default:
      return 'presser';
  }
}

/**
 * Read the assigned pack role for an entity. Returns null if no role assigned.
 */
export function getPackRole(entityId: EntityId): PackRole | null {
  return packRoles.get(entityId) ?? null;
}

/**
 * For flankers, return an angle offset (radians) so they approach the player
 * from the side rather than head-on.
 *
 * Returns 0 for non-flankers.
 */
export function getFlankAngle(
  entityId: EntityId,
  playerPos: Vec2,
  enemyPos: Vec2,
): number {
  const role = packRoles.get(entityId);
  if (role !== 'flanker') return 0;

  // Compute base angle from player to enemy
  const toEnemy = vec2Sub(enemyPos, playerPos);
  const baseAngle = vec2Angle(vec2Normalize(toEnemy));

  // Alternate sides based on a simple hash of the entity id
  const hash = simpleHash(entityId);
  const side = hash % 2 === 0 ? 1 : -1;

  // Offset between 60° and 90°
  const offsetMagnitude = (Math.PI / 3) + (hash % 6) * (Math.PI / 36); // 60°..90°

  return side * offsetMagnitude;
}

/** Cheap deterministic hash for consistent side assignment. */
function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
