import type { BuffInstance, BuffType, GameEvent, EntityId } from '@curious/shared';
import {
  SPEED_BOOST_MULTIPLIER,
  BURN_DPS,
  BURN_TICK_INTERVAL,
  FREEZE_SPEED_MULTIPLIER,
  BLOCK_SHIELD_REFLECT_DAMAGE,
} from '@curious/shared';

/** Apply a buff to an entity. Refreshes duration if already present. */
export function applyBuff(
  buffs: BuffInstance[],
  type: BuffType,
  duration: number,
  absorb?: number,
): void {
  const existing = buffs.find(b => b.type === type);
  if (existing) {
    existing.duration = duration;
    existing.tickTimer = 0;
    if (absorb !== undefined) existing.absorb = absorb;
  } else {
    buffs.push({ type, duration, tickTimer: 0, absorb });
  }
}

/** Tick all buffs on an entity. Returns events. Mutates buffs array in place. */
export function tickBuffs(
  entityId: EntityId,
  buffs: BuffInstance[],
  health: { current: number },
  dt: number,
): GameEvent[] {
  const events: GameEvent[] = [];

  for (let i = buffs.length - 1; i >= 0; i--) {
    const buff = buffs[i];
    buff.duration -= dt;

    // Process burn tick
    if (buff.type === 'BURN') {
      buff.tickTimer += dt;
      if (buff.tickTimer >= BURN_TICK_INTERVAL) {
        buff.tickTimer -= BURN_TICK_INTERVAL;
        const damage = Math.round(BURN_DPS * BURN_TICK_INTERVAL);
        health.current -= damage;
        events.push({ type: 'BURN_TICK', entityId, damage });
      }
    }

    // BLOCK_SHIELD: check if absorb is depleted
    if (buff.type === 'BLOCK_SHIELD' && buff.absorb !== undefined && buff.absorb <= 0) {
      buff.duration = 0; // Force expiry
      events.push({ type: 'SHIELD_BREAK', entityId });
    }

    // Remove expired
    if (buff.duration <= 0) {
      events.push({ type: 'BUFF_EXPIRED', entityId, buffType: buff.type });
      buffs.splice(i, 1);
    }
  }

  return events;
}

/** Check if entity has a specific buff. */
export function hasBuff(buffs: BuffInstance[], type: BuffType): boolean {
  return buffs.some(b => b.type === type);
}

/** Get effective speed multiplier from buffs. */
export function getSpeedMultiplier(buffs: BuffInstance[]): number {
  let mult = 1.0;
  if (hasBuff(buffs, 'SPEED_BOOST')) mult *= SPEED_BOOST_MULTIPLIER;
  if (hasBuff(buffs, 'FREEZE')) mult *= FREEZE_SPEED_MULTIPLIER;
  return mult;
}

/**
 * Check if BLOCK_SHIELD absorbs incoming damage.
 * Returns the actual damage the entity should take (after absorption).
 * Also returns reflect damage to apply to the attacker.
 */
export function checkBlockShield(
  buffs: BuffInstance[],
  incomingDamage: number,
  entityId: EntityId,
  events: GameEvent[],
): { actualDamage: number; reflectDamage: number } {
  const shield = buffs.find(b => b.type === 'BLOCK_SHIELD');
  if (!shield || !shield.absorb || shield.absorb <= 0) {
    return { actualDamage: incomingDamage, reflectDamage: 0 };
  }

  const absorbed = Math.min(incomingDamage, shield.absorb);
  shield.absorb -= absorbed;
  const remaining = incomingDamage - absorbed;

  events.push({ type: 'SHIELD_BLOCK', entityId, damageAbsorbed: absorbed });

  return {
    actualDamage: remaining,
    reflectDamage: absorbed > 0 ? BLOCK_SHIELD_REFLECT_DAMAGE : 0,
  };
}
