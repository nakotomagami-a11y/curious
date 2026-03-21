import type { GameEvent, SpellId, SpellDropSnapshot, Vec2, PlayerSnapshot, EntityId } from '@curious/shared';
import { vec2Distance } from '@curious/shared';
import {
  SPELL_DROP_CHANCE,
  SPELL_DROP_LIFETIME,
  SPELL_DROP_PICKUP_RANGE,
  MAX_SPELL_SLOTS,
} from '@curious/shared';
import type { SimWorld } from '../simulation';
import { generateEntityId } from '../simulation';

const ALL_SPELLS: SpellId[] = [
  'fireball',
  'ice_lance',
  'lightning_chain',
  'heal_circle',
  'shield_bubble',
  'gravity_well',
  'block_shield',
];

/** Roll for a spell drop when an enemy dies. 20% chance. */
export function rollSpellDrop(position: Vec2, world: SimWorld): GameEvent[] {
  if (Math.random() > SPELL_DROP_CHANCE) return [];

  const spellId = ALL_SPELLS[Math.floor(Math.random() * ALL_SPELLS.length)];
  const dropId = generateEntityId('spell_drop');

  world.spellDrops.set(dropId, {
    id: dropId,
    spellId,
    position: { ...position },
    lifetime: SPELL_DROP_LIFETIME,
  });

  return [{ type: 'SPELL_DROPPED', spellId, position: { ...position } }];
}

/** Tick spell drop lifetimes — remove expired drops. */
export function tickSpellDrops(world: SimWorld, dt: number): void {
  const toRemove: EntityId[] = [];
  for (const drop of world.spellDrops.values()) {
    drop.lifetime -= dt;
    if (drop.lifetime <= 0) {
      toRemove.push(drop.id);
    }
  }
  for (const id of toRemove) {
    world.spellDrops.delete(id);
  }
}

/** Try to pick up a nearby spell drop for a player. Called on interact key. */
export function tryPickupSpell(player: PlayerSnapshot, world: SimWorld): GameEvent[] {
  if (player.state !== 'alive') return [];

  if (player.spellSlots.length >= MAX_SPELL_SLOTS) {
    return [{ type: 'SPELL_SLOT_FULL', playerId: player.id }];
  }

  // Find nearest drop within pickup range
  let nearest: SpellDropSnapshot | null = null;
  let nearestDist = SPELL_DROP_PICKUP_RANGE + 1;

  for (const drop of world.spellDrops.values()) {
    const dist = vec2Distance(player.position, drop.position);
    if (dist < nearestDist && dist <= SPELL_DROP_PICKUP_RANGE) {
      nearest = drop;
      nearestDist = dist;
    }
  }

  if (!nearest) return [];

  // Pick it up
  player.spellSlots.push(nearest.spellId);
  world.spellDrops.delete(nearest.id);

  return [{ type: 'SPELL_PICKED_UP', playerId: player.id, spellId: nearest.spellId }];
}

/** Auto-pickup: check if player walks over a spell drop. */
export function checkAutoPickup(player: PlayerSnapshot, world: SimWorld): GameEvent[] {
  if (player.state !== 'alive') return [];
  if (player.spellSlots.length >= MAX_SPELL_SLOTS) return [];

  const events: GameEvent[] = [];
  const toRemove: EntityId[] = [];

  for (const drop of world.spellDrops.values()) {
    if (player.spellSlots.length >= MAX_SPELL_SLOTS) break;
    const dist = vec2Distance(player.position, drop.position);
    if (dist <= SPELL_DROP_PICKUP_RANGE) {
      player.spellSlots.push(drop.spellId);
      toRemove.push(drop.id);
      events.push({ type: 'SPELL_PICKED_UP', playerId: player.id, spellId: drop.spellId });
    }
  }

  for (const id of toRemove) {
    world.spellDrops.delete(id);
  }

  return events;
}
