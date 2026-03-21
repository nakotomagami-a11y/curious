import type { BossSnapshot, PlayerSnapshot, GameEvent, Vec2 } from '@curious/shared';
import {
  vec2, vec2Sub, vec2Add, vec2Normalize, vec2Scale, vec2Distance, vec2Angle,
  vec2Length, vec2FromAngle, lerpAngle, clampVec2ToArena,
} from '@curious/shared';
import {
  MAGE_BOSS_SPEED, MAGE_BOSS_RADIUS, BOSS_AGGRO_RANGE,
  MAGE_BOSS_TELEPORT_COOLDOWN, MAGE_BOSS_TELEPORT_RANGE,
  MAGE_BOSS_PROJECTILE_DAMAGE, MAGE_BOSS_PROJECTILE_SPEED,
  MAGE_BOSS_PATTERN_COOLDOWN, MAGE_BOSS_PATTERN_COUNT,
  PLAYER_RADIUS, ARENA_HALF_WIDTH, ARENA_HALF_HEIGHT,
} from '@curious/shared';
import type { SimWorld } from '../simulation';
import { generateEntityId } from '../simulation';
import { createProjectile } from '../combat/projectile';
import { getBossSpeedMultiplier, getBossDamageMultiplier, updateBossPhase } from '../entities/boss-phases';

const MAGE_ROTATION_SPEED = 8;

export function tickMageBossAI(boss: BossSnapshot, world: SimWorld, dt: number): GameEvent[] {
  if (boss.aiState === 'dying' || boss.aiState === 'dead') return [];

  if (boss.slamCooldownTimer > 0) {
    boss.slamCooldownTimer = Math.max(0, boss.slamCooldownTimer - dt);
  }

  const events: GameEvent[] = [];
  events.push(...updateBossPhase(boss));

  const speed = MAGE_BOSS_SPEED * getBossSpeedMultiplier(boss);

  switch (boss.aiState) {
    case 'idle': {
      const target = findNearest(boss, world);
      if (target) {
        boss.targetId = target.id;
        boss.aiState = 'chasing';
      }
      break;
    }

    case 'chasing': {
      const target = getTarget(boss, world);
      if (!target) {
        const newTarget = findNearest(boss, world);
        if (newTarget) boss.targetId = newTarget.id;
        else { boss.aiState = 'idle'; boss.targetId = null; }
        break;
      }

      const dist = vec2Distance(boss.position, target.position);
      const toTarget = vec2Sub(target.position, boss.position);
      boss.rotation = lerpAngle(boss.rotation, vec2Angle(toTarget), MAGE_ROTATION_SPEED * dt);

      // Mage keeps distance (250u) and kites
      const desiredDist = 250;
      if (dist < desiredDist * 0.6) {
        const fleeDir = vec2Normalize(vec2Sub(boss.position, target.position));
        boss.position = vec2Add(boss.position, vec2Scale(fleeDir, speed * dt));
      } else if (dist > desiredDist * 1.4) {
        const dir = vec2Normalize(toTarget);
        boss.position = vec2Add(boss.position, vec2Scale(dir, speed * dt));
      }

      // Decide action based on cooldown
      if (boss.slamCooldownTimer <= 0) {
        // Alternate between teleport + attack and bullet pattern
        const roll = Math.random();
        if (roll < 0.4 || boss.phase >= 2) {
          // Bullet pattern
          boss.aiState = 'bullet_pattern';
          boss.slamProgress = 0;
        } else {
          // Teleport behind player + fire
          boss.aiState = 'casting';
          boss.slamProgress = 0;
        }
      }
      break;
    }

    // Teleport cast
    case 'casting': {
      boss.slamProgress += dt / 0.6; // 0.6s cast time

      if (boss.slamProgress >= 1.0) {
        const target = getTarget(boss, world);
        if (target) {
          // Teleport to a random position near the player
          const angle = Math.random() * Math.PI * 2;
          const offset = vec2Scale(vec2FromAngle(angle), MAGE_BOSS_TELEPORT_RANGE * 0.5);
          boss.position = vec2Add(target.position, offset);
          boss.position = clampVec2ToArena(boss.position, ARENA_HALF_WIDTH, ARENA_HALF_HEIGHT, MAGE_BOSS_RADIUS);

          // Fire 3 projectiles at player
          const toTarget = vec2Sub(target.position, boss.position);
          const baseAngle = vec2Angle(toTarget);
          const spread = boss.phase >= 2 ? 0.3 : 0.15;
          const projCount = boss.phase >= 3 ? 5 : 3;

          for (let i = 0; i < projCount; i++) {
            const angleOffset = (i - (projCount - 1) / 2) * spread;
            const dir = vec2FromAngle(baseAngle + angleOffset);
            const spawnPos = vec2Add(boss.position, vec2Scale(dir, MAGE_BOSS_RADIUS + 5));
            const velocity = vec2Scale(dir, MAGE_BOSS_PROJECTILE_SPEED);
            const damage = Math.round(MAGE_BOSS_PROJECTILE_DAMAGE * getBossDamageMultiplier(boss));

            const projId = generateEntityId('mage_proj');
            world.projectiles.set(projId, {
              id: projId,
              ownerId: boss.id,
              ownerType: 'enemy',
              position: { ...spawnPos },
              velocity: { ...velocity },
              radius: 12,
              damage,
              lifetime: 4.0,
              isFireball: false,
            });
            events.push({ type: 'PROJECTILE_SPAWNED', projectileId: projId, ownerId: boss.id, position: { ...spawnPos }, velocity: { ...velocity } });
          }
        }

        boss.slamCooldownTimer = MAGE_BOSS_TELEPORT_COOLDOWN / boss.phase;
        boss.slamProgress = 0;
        boss.aiState = 'recovering';
      }
      break;
    }

    // Bullet hell pattern
    case 'bullet_pattern': {
      boss.slamProgress += dt / 1.0; // 1s to fire full pattern

      if (boss.slamProgress >= 1.0) {
        // Spiral burst pattern
        const count = MAGE_BOSS_PATTERN_COUNT + (boss.phase - 1) * 4;
        const damage = Math.round(MAGE_BOSS_PROJECTILE_DAMAGE * 0.8 * getBossDamageMultiplier(boss));

        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const dir = vec2FromAngle(angle);
          const spawnPos = vec2Add(boss.position, vec2Scale(dir, MAGE_BOSS_RADIUS + 5));
          const velocity = vec2Scale(dir, MAGE_BOSS_PROJECTILE_SPEED * 0.8);

          const projId = generateEntityId('mage_burst');
          world.projectiles.set(projId, {
            id: projId,
            ownerId: boss.id,
            ownerType: 'enemy',
            position: { ...spawnPos },
            velocity: { ...velocity },
            radius: 10,
            damage,
            lifetime: 3.0,
            isFireball: false,
          });
          events.push({ type: 'PROJECTILE_SPAWNED', projectileId: projId, ownerId: boss.id, position: { ...spawnPos }, velocity: { ...velocity } });
        }

        boss.slamCooldownTimer = MAGE_BOSS_PATTERN_COOLDOWN / boss.phase;
        boss.slamProgress = 0;
        boss.aiState = 'recovering';
      }
      break;
    }

    case 'recovering': {
      boss.slamProgress += dt / 1.5;
      if (boss.slamProgress >= 1.0) {
        boss.slamProgress = 0;
        boss.aiState = 'chasing';
      }
      break;
    }
  }

  boss.position = clampVec2ToArena(boss.position, ARENA_HALF_WIDTH, ARENA_HALF_HEIGHT, MAGE_BOSS_RADIUS);
  return events;
}

function findNearest(boss: BossSnapshot, world: SimWorld): PlayerSnapshot | null {
  let nearest: PlayerSnapshot | null = null;
  let nearestDist = BOSS_AGGRO_RANGE;
  for (const p of world.players.values()) {
    if (p.state !== 'alive') continue;
    const d = vec2Distance(boss.position, p.position);
    if (d < nearestDist) { nearestDist = d; nearest = p; }
  }
  return nearest;
}

function getTarget(boss: BossSnapshot, world: SimWorld): PlayerSnapshot | null {
  if (!boss.targetId) return null;
  const t = world.players.get(boss.targetId);
  return t && t.state === 'alive' ? t : null;
}
