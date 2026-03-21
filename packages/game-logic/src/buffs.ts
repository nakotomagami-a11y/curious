import type { BuffInstance, BuffType, GameEvent, EntityId } from '@curious/shared';
import {
  SPEED_BOOST_MULTIPLIER,
  BURN_DPS,
  BURN_TICK_INTERVAL,
} from '@curious/shared';

/** Apply a buff to an entity. Refreshes duration if already present. */
export function applyBuff(
  buffs: BuffInstance[],
  type: BuffType,
  duration: number,
): void {
  const existing = buffs.find(b => b.type === type);
  if (existing) {
    existing.duration = duration;
    existing.tickTimer = 0;
  } else {
    buffs.push({ type, duration, tickTimer: 0 });
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
  return hasBuff(buffs, 'SPEED_BOOST') ? SPEED_BOOST_MULTIPLIER : 1.0;
}
