import type { PlayerSnapshot, SpellId, GameEvent, Vec2, EnemySnapshot } from '@curious/shared';
import {
  FIREBALL_COOLDOWN, FIREBALL_MANA_COST, FIREBALL_SPEED, FIREBALL_RADIUS,
  FIREBALL_DAMAGE, FIREBALL_LIFETIME, PLAYER_RADIUS,
  ICE_LANCE_MANA_COST, ICE_LANCE_COOLDOWN, ICE_LANCE_SPEED, ICE_LANCE_RADIUS,
  ICE_LANCE_DAMAGE, ICE_LANCE_LIFETIME, ICE_LANCE_MAX_PIERCE,
  LIGHTNING_CHAIN_MANA_COST, LIGHTNING_CHAIN_COOLDOWN, LIGHTNING_CHAIN_DAMAGE,
  LIGHTNING_CHAIN_BOUNCES, LIGHTNING_CHAIN_RANGE,
  HEAL_CIRCLE_MANA_COST, HEAL_CIRCLE_COOLDOWN, HEAL_CIRCLE_RADIUS, HEAL_CIRCLE_DURATION,
  SHIELD_BUBBLE_MANA_COST, SHIELD_BUBBLE_COOLDOWN, SHIELD_BUBBLE_RADIUS,
  SHIELD_BUBBLE_DURATION, SHIELD_BUBBLE_ABSORB,
  GRAVITY_WELL_MANA_COST, GRAVITY_WELL_COOLDOWN, GRAVITY_WELL_RADIUS, GRAVITY_WELL_DURATION,
  BLOCK_SHIELD_MANA_COST, BLOCK_SHIELD_COOLDOWN, BLOCK_SHIELD_DURATION, BLOCK_SHIELD_ABSORB,
  ENEMY_RADIUS, BOSS_RADIUS, IFRAME_DURATION, HIT_FLASH_DURATION, FREEZE_DURATION,
} from '@curious/shared';
import { vec2Normalize, vec2Scale, vec2Add, vec2Length, vec2Sub, vec2Distance } from '@curious/shared';
import type { SimWorld } from '../simulation';
import { generateEntityId } from '../simulation';
import { applyBuff } from '../entities/buffs';

/** Try to cast the spell at the given slot index. Consumes the slot on success (unless dev mode). */
export function tryCastSpell(
  player: PlayerSnapshot,
  spellSlot: number,
  aimDirection: Vec2,
  world: SimWorld,
): GameEvent[] {
  if (spellSlot < 0 || spellSlot >= player.spellSlots.length) return [];
  const spellId = player.spellSlots[spellSlot];
  if (!spellId) return [];

  const events = castSpellById(player, spellId, aimDirection, world);
  if (events.length > 0 && !world.devMode) {
    // Single-use: remove from slot (skipped in dev mode for infinite spells)
    player.spellSlots.splice(spellSlot, 1);
  }
  return events;
}

function castSpellById(
  player: PlayerSnapshot,
  spellId: SpellId,
  aimDirection: Vec2,
  world: SimWorld,
): GameEvent[] {
  switch (spellId) {
    case 'fireball': return tryCastFireball(player, aimDirection, world);
    case 'ice_lance': return tryCastIceLance(player, aimDirection, world);
    case 'lightning_chain': return tryCastLightningChain(player, world);
    case 'heal_circle': return tryCastHealCircle(player, world);
    case 'shield_bubble': return tryCastShieldBubble(player, world);
    case 'gravity_well': return tryCastGravityWell(player, aimDirection, world);
    case 'block_shield': return tryCastBlockShield(player);
    default: return [];
  }
}

function commonCastCheck(player: PlayerSnapshot, manaCost: number, spellId: SpellId): boolean {
  if (player.state !== 'alive') return false;
  if (player.stunTimer > 0) return false;
  if (player.mana < manaCost) return false;
  const cooldown = player.spellCooldowns[spellId] ?? 0;
  if (cooldown > 0) return false;
  return true;
}

function consumeMana(player: PlayerSnapshot, manaCost: number, spellId: SpellId, cooldown: number): void {
  player.mana -= manaCost;
  player.spellCooldowns[spellId] = cooldown;
}

// --- Fireball ---
function tryCastFireball(player: PlayerSnapshot, aimDirection: Vec2, world: SimWorld): GameEvent[] {
  if (!commonCastCheck(player, FIREBALL_MANA_COST, 'fireball')) return [];
  if (vec2Length(aimDirection) < 0.01) return [];

  consumeMana(player, FIREBALL_MANA_COST, 'fireball', FIREBALL_COOLDOWN);

  const dir = vec2Normalize(aimDirection);
  const spawnPos = vec2Add(player.position, vec2Scale(dir, PLAYER_RADIUS + 5));
  const velocity = vec2Scale(dir, FIREBALL_SPEED);

  const projId = generateEntityId('fireball');
  world.projectiles.set(projId, {
    id: projId,
    ownerId: player.id,
    ownerType: 'player',
    position: { ...spawnPos },
    velocity: { ...velocity },
    radius: FIREBALL_RADIUS,
    damage: FIREBALL_DAMAGE,
    lifetime: FIREBALL_LIFETIME,
    isFireball: true,
  });

  return [
    { type: 'SPELL_CAST', playerId: player.id, spellId: 'fireball', direction: { ...dir } },
    { type: 'PROJECTILE_SPAWNED', projectileId: projId, ownerId: player.id, position: { ...spawnPos }, velocity: { ...velocity } },
  ];
}

// --- Ice Lance (piercing projectile) ---
function tryCastIceLance(player: PlayerSnapshot, aimDirection: Vec2, world: SimWorld): GameEvent[] {
  if (!commonCastCheck(player, ICE_LANCE_MANA_COST, 'ice_lance')) return [];
  if (vec2Length(aimDirection) < 0.01) return [];

  consumeMana(player, ICE_LANCE_MANA_COST, 'ice_lance', ICE_LANCE_COOLDOWN);

  const dir = vec2Normalize(aimDirection);
  const spawnPos = vec2Add(player.position, vec2Scale(dir, PLAYER_RADIUS + 5));
  const velocity = vec2Scale(dir, ICE_LANCE_SPEED);

  const projId = generateEntityId('ice_lance');
  world.projectiles.set(projId, {
    id: projId,
    ownerId: player.id,
    ownerType: 'player',
    position: { ...spawnPos },
    velocity: { ...velocity },
    radius: ICE_LANCE_RADIUS,
    damage: ICE_LANCE_DAMAGE,
    lifetime: ICE_LANCE_LIFETIME,
    isFireball: false,
    pierceRemaining: ICE_LANCE_MAX_PIERCE,
    piercedIds: [],
  });

  return [
    { type: 'SPELL_CAST', playerId: player.id, spellId: 'ice_lance', direction: { ...dir } },
    { type: 'PROJECTILE_SPAWNED', projectileId: projId, ownerId: player.id, position: { ...spawnPos }, velocity: { ...velocity } },
  ];
}

// --- Lightning Chain (instant, bounces between enemies) ---
function tryCastLightningChain(player: PlayerSnapshot, world: SimWorld): GameEvent[] {
  if (!commonCastCheck(player, LIGHTNING_CHAIN_MANA_COST, 'lightning_chain')) return [];

  // Find nearest enemy to start chain
  let nearestEnemy: EnemySnapshot | null = null;
  let nearestDist = LIGHTNING_CHAIN_RANGE * 2;
  for (const enemy of world.enemies.values()) {
    if (enemy.aiState === 'dying' || enemy.aiState === 'dead') continue;
    const dist = vec2Distance(player.position, enemy.position);
    if (dist < nearestDist && dist < LIGHTNING_CHAIN_RANGE * 2) {
      nearestDist = dist;
      nearestEnemy = enemy;
    }
  }

  if (!nearestEnemy) return [];

  consumeMana(player, LIGHTNING_CHAIN_MANA_COST, 'lightning_chain', LIGHTNING_CHAIN_COOLDOWN);

  const hitIds: string[] = [];
  const targets: EnemySnapshot[] = [nearestEnemy];
  hitIds.push(nearestEnemy.id);

  // Chain to nearby enemies
  let current = nearestEnemy;
  for (let bounce = 0; bounce < LIGHTNING_CHAIN_BOUNCES; bounce++) {
    let nextTarget: EnemySnapshot | null = null;
    let nextDist = LIGHTNING_CHAIN_RANGE;
    for (const enemy of world.enemies.values()) {
      if (enemy.aiState === 'dying' || enemy.aiState === 'dead') continue;
      if (hitIds.includes(enemy.id)) continue;
      const dist = vec2Distance(current.position, enemy.position);
      if (dist < nextDist) {
        nextDist = dist;
        nextTarget = enemy;
      }
    }
    // Also check boss
    if (world.boss && world.boss.aiState !== 'dying' && world.boss.aiState !== 'dead' && !hitIds.includes(world.boss.id)) {
      const dist = vec2Distance(current.position, world.boss.position);
      if (dist < nextDist) {
        // Boss hit — apply damage directly
        if (world.boss.iFrameTimer <= 0) {
          world.boss.health -= LIGHTNING_CHAIN_DAMAGE;
          world.boss.hitFlashTimer = HIT_FLASH_DURATION;
          world.boss.iFrameTimer = IFRAME_DURATION;
          hitIds.push(world.boss.id);
          if (world.boss.health <= 0) {
            world.boss.health = 0;
            world.boss.aiState = 'dying';
          }
        }
        continue;
      }
    }
    if (!nextTarget) break;
    targets.push(nextTarget);
    hitIds.push(nextTarget.id);
    current = nextTarget;
  }

  // Apply damage to all chained enemies
  const events: GameEvent[] = [];
  for (const target of targets) {
    if (target.iFrameTimer > 0) continue;
    target.health -= LIGHTNING_CHAIN_DAMAGE;
    target.hitFlashTimer = HIT_FLASH_DURATION;
    target.iFrameTimer = IFRAME_DURATION;
    // Apply freeze debuff
    applyBuff(target.buffs, 'FREEZE', FREEZE_DURATION);

    events.push({ type: 'DAMAGE_TAKEN', entityId: target.id, amount: LIGHTNING_CHAIN_DAMAGE, newHealth: target.health });
    if (target.health <= 0) {
      target.health = 0;
      target.aiState = 'dying';
      events.push({ type: 'ENTITY_DIED', entityId: target.id, entityType: 'enemy' });
    }
  }

  events.unshift({ type: 'SPELL_CAST', playerId: player.id, spellId: 'lightning_chain', direction: { x: 0, z: 1 } });
  events.push({ type: 'LIGHTNING_CHAIN', sourceId: player.id, targetIds: hitIds, damage: LIGHTNING_CHAIN_DAMAGE });

  return events;
}

// --- Heal Circle (zone at player feet) ---
function tryCastHealCircle(player: PlayerSnapshot, world: SimWorld): GameEvent[] {
  if (!commonCastCheck(player, HEAL_CIRCLE_MANA_COST, 'heal_circle')) return [];

  consumeMana(player, HEAL_CIRCLE_MANA_COST, 'heal_circle', HEAL_CIRCLE_COOLDOWN);

  const zoneId = generateEntityId('heal_zone');
  world.zones.set(zoneId, {
    id: zoneId,
    ownerId: player.id,
    zoneType: 'heal',
    position: { ...player.position },
    radius: HEAL_CIRCLE_RADIUS,
    duration: HEAL_CIRCLE_DURATION,
  });

  return [
    { type: 'SPELL_CAST', playerId: player.id, spellId: 'heal_circle', direction: { x: 0, z: 1 } },
    { type: 'ZONE_SPAWNED', zoneId, zoneType: 'heal', position: { ...player.position }, radius: HEAL_CIRCLE_RADIUS },
  ];
}

// --- Shield Bubble (zone around player, blocks projectiles) ---
function tryCastShieldBubble(player: PlayerSnapshot, world: SimWorld): GameEvent[] {
  if (!commonCastCheck(player, SHIELD_BUBBLE_MANA_COST, 'shield_bubble')) return [];

  consumeMana(player, SHIELD_BUBBLE_MANA_COST, 'shield_bubble', SHIELD_BUBBLE_COOLDOWN);

  const zoneId = generateEntityId('shield_zone');
  world.zones.set(zoneId, {
    id: zoneId,
    ownerId: player.id,
    zoneType: 'shield_bubble',
    position: { ...player.position },
    radius: SHIELD_BUBBLE_RADIUS,
    duration: SHIELD_BUBBLE_DURATION,
    absorb: SHIELD_BUBBLE_ABSORB,
  });

  return [
    { type: 'SPELL_CAST', playerId: player.id, spellId: 'shield_bubble', direction: { x: 0, z: 1 } },
    { type: 'ZONE_SPAWNED', zoneId, zoneType: 'shield_bubble', position: { ...player.position }, radius: SHIELD_BUBBLE_RADIUS },
  ];
}

// --- Gravity Well (zone at aim position, pulls enemies) ---
function tryCastGravityWell(player: PlayerSnapshot, aimDirection: Vec2, world: SimWorld): GameEvent[] {
  if (!commonCastCheck(player, GRAVITY_WELL_MANA_COST, 'gravity_well')) return [];

  consumeMana(player, GRAVITY_WELL_MANA_COST, 'gravity_well', GRAVITY_WELL_COOLDOWN);

  const dir = vec2Length(aimDirection) > 0.01 ? vec2Normalize(aimDirection) : { x: 0, z: 1 };
  // Place 250u ahead of player in aim direction
  const zonePos = vec2Add(player.position, vec2Scale(dir, 250));

  const zoneId = generateEntityId('gravity_zone');
  world.zones.set(zoneId, {
    id: zoneId,
    ownerId: player.id,
    zoneType: 'gravity_well',
    position: { ...zonePos },
    radius: GRAVITY_WELL_RADIUS,
    duration: GRAVITY_WELL_DURATION,
  });

  return [
    { type: 'SPELL_CAST', playerId: player.id, spellId: 'gravity_well', direction: { ...dir } },
    { type: 'ZONE_SPAWNED', zoneId, zoneType: 'gravity_well', position: { ...zonePos }, radius: GRAVITY_WELL_RADIUS },
  ];
}

// --- Block Shield (personal buff) ---
function tryCastBlockShield(player: PlayerSnapshot): GameEvent[] {
  if (!commonCastCheck(player, BLOCK_SHIELD_MANA_COST, 'block_shield')) return [];

  consumeMana(player, BLOCK_SHIELD_MANA_COST, 'block_shield', BLOCK_SHIELD_COOLDOWN);

  // Apply as buff with absorb value
  const existing = player.buffs.find(b => b.type === 'BLOCK_SHIELD');
  if (existing) {
    existing.duration = BLOCK_SHIELD_DURATION;
    existing.absorb = BLOCK_SHIELD_ABSORB;
  } else {
    player.buffs.push({
      type: 'BLOCK_SHIELD',
      duration: BLOCK_SHIELD_DURATION,
      tickTimer: 0,
      absorb: BLOCK_SHIELD_ABSORB,
    });
  }

  return [
    { type: 'SPELL_CAST', playerId: player.id, spellId: 'block_shield', direction: { x: 0, z: 1 } },
    { type: 'BUFF_APPLIED', entityId: player.id, buffType: 'BLOCK_SHIELD', duration: BLOCK_SHIELD_DURATION },
  ];
}
