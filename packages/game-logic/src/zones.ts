import type { GameEvent, ZoneSnapshot, EntityId } from '@curious/shared';
import { vec2Distance, vec2Sub, vec2Normalize, vec2Scale, vec2Add, vec2Length } from '@curious/shared';
import {
  HEAL_CIRCLE_HEAL_TOTAL, HEAL_CIRCLE_DURATION,
  GRAVITY_WELL_DPS, GRAVITY_WELL_PULL_FORCE,
  IFRAME_DURATION, HIT_FLASH_DURATION,
} from '@curious/shared';
import type { SimWorld } from './simulation';

/** Tick all active zones — heals, shields, gravity wells. */
export function tickZones(world: SimWorld, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  const toRemove: EntityId[] = [];

  for (const zone of world.zones.values()) {
    zone.duration -= dt;

    if (zone.duration <= 0) {
      toRemove.push(zone.id);
      events.push({ type: 'ZONE_EXPIRED', zoneId: zone.id });
      continue;
    }

    switch (zone.zoneType) {
      case 'heal':
        tickHealZone(zone, world, dt, events);
        break;
      case 'shield_bubble':
        tickShieldBubbleZone(zone, world, dt, events);
        break;
      case 'gravity_well':
        tickGravityWellZone(zone, world, dt, events);
        break;
    }

    // Shield bubble breaks if absorb depleted
    if (zone.zoneType === 'shield_bubble' && zone.absorb !== undefined && zone.absorb <= 0) {
      toRemove.push(zone.id);
      events.push({ type: 'SHIELD_BREAK', entityId: zone.ownerId });
      events.push({ type: 'ZONE_EXPIRED', zoneId: zone.id });
    }
  }

  for (const id of toRemove) {
    world.zones.delete(id);
  }

  return events;
}

function tickHealZone(zone: ZoneSnapshot, world: SimWorld, dt: number, events: GameEvent[]): void {
  const healPerSec = HEAL_CIRCLE_HEAL_TOTAL / HEAL_CIRCLE_DURATION;

  for (const player of world.players.values()) {
    if (player.state !== 'alive') continue;
    const dist = vec2Distance(player.position, zone.position);
    if (dist <= zone.radius) {
      const healAmount = healPerSec * dt;
      const prevHealth = player.health;
      player.health = Math.min(player.maxHealth, player.health + healAmount);
      const actualHeal = player.health - prevHealth;
      if (actualHeal > 0.1) {
        events.push({ type: 'HEAL_TICK', entityId: player.id, amount: Math.round(actualHeal) });
      }
    }
  }
}

function tickShieldBubbleZone(zone: ZoneSnapshot, world: SimWorld, dt: number, events: GameEvent[]): void {
  // Shield bubble follows owner
  const owner = world.players.get(zone.ownerId);
  if (owner) {
    zone.position = { ...owner.position };
  }

  // Block enemy projectiles that enter the bubble
  for (const proj of world.projectiles.values()) {
    if (proj.ownerType === 'player') continue; // Don't block friendly projectiles
    const dist = vec2Distance(proj.position, zone.position);
    if (dist < zone.radius) {
      // Absorb projectile
      const absorbed = Math.min(proj.damage, zone.absorb ?? 0);
      if (zone.absorb !== undefined) {
        zone.absorb -= absorbed;
      }
      events.push({ type: 'SHIELD_BLOCK', entityId: zone.ownerId, damageAbsorbed: absorbed });
      // Remove projectile
      world.projectiles.delete(proj.id);
    }
  }
}

function tickGravityWellZone(zone: ZoneSnapshot, world: SimWorld, dt: number, events: GameEvent[]): void {
  // Pull enemies toward center and deal DPS
  for (const enemy of world.enemies.values()) {
    if (enemy.aiState === 'dying' || enemy.aiState === 'dead') continue;
    const dist = vec2Distance(enemy.position, zone.position);
    if (dist > zone.radius) continue;

    // Pull toward center
    if (dist > 5) {
      const pullDir = vec2Normalize(vec2Sub(zone.position, enemy.position));
      const pullStrength = GRAVITY_WELL_PULL_FORCE * (1 - dist / zone.radius) * dt;
      enemy.position = vec2Add(enemy.position, vec2Scale(pullDir, pullStrength));
    }

    // DPS
    const damage = GRAVITY_WELL_DPS * dt;
    enemy.health -= damage;
    if (enemy.health <= 0) {
      enemy.health = 0;
      enemy.aiState = 'dying';
      events.push({ type: 'ENTITY_DIED', entityId: enemy.id, entityType: 'enemy' });
    }
  }

  // Also affect boss
  if (world.boss && world.boss.aiState !== 'dying' && world.boss.aiState !== 'dead') {
    const dist = vec2Distance(world.boss.position, zone.position);
    if (dist <= zone.radius && dist > 5) {
      // Weaker pull on boss
      const pullDir = vec2Normalize(vec2Sub(zone.position, world.boss.position));
      const pullStrength = GRAVITY_WELL_PULL_FORCE * 0.3 * (1 - dist / zone.radius) * dt;
      world.boss.position = vec2Add(world.boss.position, vec2Scale(pullDir, pullStrength));
    }
  }
}
