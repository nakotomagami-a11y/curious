/**
 * Shared threat tables for enemy AI targeting.
 *
 * Each enemy maintains a list of (playerId, threat) pairs.
 * Enemies attack whichever player has the highest accumulated threat.
 */

import type { EntityId, Vec2, EnemySnapshot, PlayerSnapshot } from '@curious/shared';
import { vec2Distance } from '@curious/shared';
import { ENEMY_AGGRO_RANGE } from '@curious/shared';

export type ThreatEntry = { playerId: EntityId; threat: number };

// Global threat tables: enemyId -> per-player threat list
const threatTables: Map<EntityId, ThreatEntry[]> = new Map();

function getOrCreateTable(enemyId: EntityId): ThreatEntry[] {
  let table = threatTables.get(enemyId);
  if (!table) {
    table = [];
    threatTables.set(enemyId, table);
  }
  return table;
}

function findEntry(table: ThreatEntry[], playerId: EntityId): ThreatEntry | undefined {
  return table.find((e) => e.playerId === playerId);
}

/**
 * Add raw threat from a player toward an enemy.
 */
export function addThreat(enemyId: EntityId, playerId: EntityId, amount: number): void {
  const table = getOrCreateTable(enemyId);
  const entry = findEntry(table, playerId);
  if (entry) {
    entry.threat += amount;
  } else {
    table.push({ playerId, threat: amount });
  }
}

/**
 * Passively accumulate +1 threat/sec for every player within aggro range.
 */
export function addProximityThreat(
  enemyId: EntityId,
  players: Map<EntityId, PlayerSnapshot>,
  enemyPos: Vec2,
  dt: number,
): void {
  for (const player of players.values()) {
    if (player.state !== 'alive') continue;
    const dist = vec2Distance(enemyPos, player.position);
    if (dist <= ENEMY_AGGRO_RANGE) {
      addThreat(enemyId, player.id, 1 * dt);
    }
  }
}

/**
 * When an enemy is hit, nearby allies share 50 % of the attacker's threat.
 *
 * @param hitEnemyId  The enemy that was struck.
 * @param attackerId  The player who dealt the damage.
 * @param damage      Damage dealt (used as threat amount).
 * @param enemies     Full enemy map for proximity check.
 * @param range       Radius within which allies receive shared threat (default 300).
 */
export function shareAllyThreat(
  hitEnemyId: EntityId,
  attackerId: EntityId,
  damage: number,
  enemies: Map<EntityId, EnemySnapshot>,
  range: number = 300,
): void {
  const hitEnemy = enemies.get(hitEnemyId);
  if (!hitEnemy) return;

  const sharedAmount = damage * 0.5;

  for (const ally of enemies.values()) {
    if (ally.id === hitEnemyId) continue;
    if (ally.aiState === 'dying' || ally.aiState === 'dead') continue;

    const dist = vec2Distance(hitEnemy.position, ally.position);
    if (dist <= range) {
      addThreat(ally.id, attackerId, sharedAmount);
    }
  }
}

/**
 * Return the player with the highest threat for a given enemy, or null if
 * the threat table is empty.
 */
export function getHighestThreatTarget(enemyId: EntityId): EntityId | null {
  const table = threatTables.get(enemyId);
  if (!table || table.length === 0) return null;

  let best: ThreatEntry | null = null;
  for (const entry of table) {
    if (!best || entry.threat > best.threat) {
      best = entry;
    }
  }
  return best ? best.playerId : null;
}

/**
 * Clear threat table for a single enemy (e.g. on death / respawn).
 */
export function resetThreatTable(enemyId: EntityId): void {
  threatTables.delete(enemyId);
}

/**
 * Clear all threat tables (e.g. round reset).
 */
export function resetAllThreat(): void {
  threatTables.clear();
}
