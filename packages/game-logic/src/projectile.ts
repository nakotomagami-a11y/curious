import type { EntityId, ProjectileSnapshot, ProjectileOwnerType, GameEvent, Vec2 } from '@curious/shared';
import {
  vec2Add,
  vec2Scale,
  vec2Normalize,
  vec2Distance,
} from '@curious/shared';
import {
  PROJECTILE_RADIUS,
  PROJECTILE_DAMAGE,
  PROJECTILE_LIFETIME,
  PROJECTILE_KNOCKBACK,
  FIREBALL_KNOCKBACK,
  ICE_LANCE_KNOCKBACK,
  PLAYER_RADIUS,
  ENEMY_RADIUS,
  BOSS_RADIUS,
  IFRAME_DURATION,
  HIT_FLASH_DURATION,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
  BURN_DURATION,
  FREEZE_DURATION,
  KNOCKBACK_SWORD,
} from '@curious/shared';
import type { SimWorld } from './simulation';
import { applyBuff } from './buffs';

export function createProjectile(
  id: EntityId,
  ownerId: EntityId,
  position: Vec2,
  velocity: Vec2,
  ownerType: ProjectileOwnerType = 'enemy',
  isFireball: boolean = false,
): ProjectileSnapshot {
  return {
    id,
    ownerId,
    ownerType,
    position: { ...position },
    velocity: { ...velocity },
    radius: isFireball ? 15 : PROJECTILE_RADIUS,
    damage: isFireball ? 20 : PROJECTILE_DAMAGE,
    lifetime: isFireball ? 4.0 : PROJECTILE_LIFETIME,
    isFireball,
  };
}

export function tickProjectiles(world: SimWorld, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  const toRemove: EntityId[] = [];

  for (const proj of world.projectiles.values()) {
    // Move
    proj.position = vec2Add(proj.position, vec2Scale(proj.velocity, dt));

    // Lifetime
    proj.lifetime -= dt;
    if (proj.lifetime <= 0) {
      toRemove.push(proj.id);
      continue;
    }

    // Out of bounds
    if (
      Math.abs(proj.position.x) > ARENA_HALF_WIDTH + 50 ||
      Math.abs(proj.position.z) > ARENA_HALF_HEIGHT + 50
    ) {
      toRemove.push(proj.id);
      continue;
    }

    let hit = false;

    if (proj.ownerType === 'player') {
      // Player projectiles hit enemies and boss
      hit = checkPlayerProjectileHits(proj, world, events);
    } else {
      // Enemy projectiles hit players
      hit = checkEnemyProjectileHits(proj, world, events);
    }

    if (hit) {
      toRemove.push(proj.id);
    }
  }

  // Cleanup
  for (const id of toRemove) {
    world.projectiles.delete(id);
  }

  return events;
}

function checkEnemyProjectileHits(
  proj: ProjectileSnapshot,
  world: SimWorld,
  events: GameEvent[],
): boolean {
  for (const player of world.players.values()) {
    if (player.state !== 'alive') continue;
    if (player.iFrameTimer > 0) continue;

    const dist = vec2Distance(proj.position, player.position);
    if (dist < proj.radius + PLAYER_RADIUS) {
      player.health -= proj.damage;
      player.hitFlashTimer = HIT_FLASH_DURATION;
      player.iFrameTimer = IFRAME_DURATION;

      const knockDir = vec2Normalize(proj.velocity);
      player.knockbackVelocity = vec2Scale(knockDir, PROJECTILE_KNOCKBACK);

      events.push({
        type: 'PROJECTILE_HIT',
        projectileId: proj.id,
        targetId: player.id,
        damage: proj.damage,
        position: { ...proj.position },
      });
      events.push({
        type: 'DAMAGE_TAKEN',
        entityId: player.id,
        amount: proj.damage,
        newHealth: player.health,
      });

      if (player.health <= 0) {
        player.health = 0;
        player.state = 'dying';
        events.push({ type: 'ENTITY_DIED', entityId: player.id, entityType: 'player' });
      }

      return true;
    }
  }
  return false;
}

function checkPlayerProjectileHits(
  proj: ProjectileSnapshot,
  world: SimWorld,
  events: GameEvent[],
): boolean {
  const isPiercing = (proj.pierceRemaining ?? 0) > 0;
  const knockback = proj.isFireball ? FIREBALL_KNOCKBACK
    : isPiercing ? ICE_LANCE_KNOCKBACK
    : KNOCKBACK_SWORD;
  let hitSomething = false;

  // Check enemies
  for (const enemy of world.enemies.values()) {
    if (enemy.aiState === 'dying' || enemy.aiState === 'dead') continue;
    if (enemy.iFrameTimer > 0) continue;
    // Skip already-pierced targets
    if (isPiercing && proj.piercedIds?.includes(enemy.id)) continue;

    const dist = vec2Distance(proj.position, enemy.position);
    if (dist < proj.radius + ENEMY_RADIUS) {
      enemy.health -= proj.damage;
      enemy.hitFlashTimer = HIT_FLASH_DURATION;
      enemy.iFrameTimer = IFRAME_DURATION;

      const knockDir = vec2Normalize(proj.velocity);
      enemy.knockbackVelocity = vec2Scale(knockDir, knockback);

      // Apply burn debuff on fireball hit
      if (proj.isFireball) {
        applyBuff(enemy.buffs, 'BURN', BURN_DURATION);
        events.push({ type: 'BUFF_APPLIED', entityId: enemy.id, buffType: 'BURN', duration: BURN_DURATION });
        events.push({ type: 'FIREBALL_EXPLOSION', position: { ...proj.position } });
      }

      // Apply freeze on ice lance hit
      if (isPiercing) {
        applyBuff(enemy.buffs, 'FREEZE', FREEZE_DURATION);
        events.push({ type: 'BUFF_APPLIED', entityId: enemy.id, buffType: 'FREEZE', duration: FREEZE_DURATION });
        events.push({ type: 'ICE_LANCE_HIT', targetId: enemy.id, position: { ...proj.position } });
      }

      events.push({
        type: 'PROJECTILE_HIT',
        projectileId: proj.id,
        targetId: enemy.id,
        damage: proj.damage,
        position: { ...proj.position },
      });
      events.push({
        type: 'DAMAGE_TAKEN',
        entityId: enemy.id,
        amount: proj.damage,
        newHealth: enemy.health,
      });

      if (enemy.health <= 0) {
        enemy.health = 0;
        enemy.aiState = 'dying';
        events.push({ type: 'ENTITY_DIED', entityId: enemy.id, entityType: 'enemy' });
      }

      if (isPiercing) {
        proj.pierceRemaining = (proj.pierceRemaining ?? 1) - 1;
        if (!proj.piercedIds) proj.piercedIds = [];
        proj.piercedIds.push(enemy.id);
        hitSomething = true;
        if (proj.pierceRemaining! <= 0) return true;
        continue; // Keep checking more enemies
      }

      return true;
    }
  }

  // Check boss
  if (world.boss && world.boss.aiState !== 'dying' && world.boss.aiState !== 'dead' && world.boss.iFrameTimer <= 0) {
    if (isPiercing && proj.piercedIds?.includes(world.boss.id)) return hitSomething;

    const dist = vec2Distance(proj.position, world.boss.position);
    if (dist < proj.radius + BOSS_RADIUS) {
      world.boss.health -= proj.damage;
      world.boss.hitFlashTimer = HIT_FLASH_DURATION;
      world.boss.iFrameTimer = IFRAME_DURATION;

      const knockDir = vec2Normalize(proj.velocity);
      world.boss.knockbackVelocity = vec2Scale(knockDir, knockback * 0.5);

      if (proj.isFireball) {
        events.push({ type: 'FIREBALL_EXPLOSION', position: { ...proj.position } });
      }
      if (isPiercing) {
        events.push({ type: 'ICE_LANCE_HIT', targetId: world.boss.id, position: { ...proj.position } });
      }

      events.push({
        type: 'PROJECTILE_HIT',
        projectileId: proj.id,
        targetId: world.boss.id,
        damage: proj.damage,
        position: { ...proj.position },
      });
      events.push({
        type: 'DAMAGE_TAKEN',
        entityId: world.boss.id,
        amount: proj.damage,
        newHealth: world.boss.health,
      });

      if (world.boss.health <= 0) {
        world.boss.health = 0;
        world.boss.aiState = 'dying';
        events.push({ type: 'ENTITY_DIED', entityId: world.boss.id, entityType: 'boss' });
      }

      if (isPiercing) {
        proj.pierceRemaining = (proj.pierceRemaining ?? 1) - 1;
        if (!proj.piercedIds) proj.piercedIds = [];
        proj.piercedIds.push(world.boss.id);
        if (proj.pierceRemaining! <= 0) return true;
        return hitSomething;
      }

      return true;
    }
  }

  return hitSomething;
}
