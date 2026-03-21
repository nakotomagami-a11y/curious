import type { EnemySnapshot, GameEvent } from '@curious/shared';
import {
  vec2, vec2Sub, vec2Normalize, vec2Scale, vec2Add, vec2Distance, vec2Angle, vec2FromAngle,
} from '@curious/shared';
import {
  TELEPORTER_SPEED, TELEPORTER_AGGRO_RANGE, TELEPORTER_LEASH_RANGE,
  TELEPORTER_BLINK_RANGE, TELEPORTER_BLINK_COOLDOWN, TELEPORTER_BLINK_TELEGRAPH,
  TELEPORTER_ATTACK_RANGE, TELEPORTER_ATTACK_COOLDOWN,
  TELEPORTER_PUNCH_DAMAGE, TELEPORTER_PUNCH_DURATION,
  PLAYER_RADIUS, ENEMY_RADIUS,
  IFRAME_DURATION, HIT_FLASH_DURATION, KNOCKBACK_PUNCH,
  ENEMY_SEPARATION_RADIUS, ENEMY_SEPARATION_FORCE,
} from '@curious/shared';
import type { SimWorld } from './simulation';
import { getSpeedMultiplier, checkBlockShield } from './buffs';
import { getVampiricHeal } from './elite';

export function tickTeleporterAI(enemy: EnemySnapshot, world: SimWorld, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (enemy.aiState === 'dying' || enemy.aiState === 'dead') return events;

  const speed = TELEPORTER_SPEED * enemy.speedMultiplier * getSpeedMultiplier(enemy.buffs);

  switch (enemy.aiState) {
    case 'idle': {
      let nearest: { id: string; dist: number } | null = null;
      for (const p of world.players.values()) {
        if (p.state !== 'alive') continue;
        const d = vec2Distance(enemy.position, p.position);
        if (d < TELEPORTER_AGGRO_RANGE && (!nearest || d < nearest.dist)) {
          nearest = { id: p.id, dist: d };
        }
      }
      if (nearest) {
        enemy.targetId = nearest.id;
        enemy.aiState = 'chasing';
      }
      break;
    }

    case 'chasing': {
      const target = enemy.targetId ? world.players.get(enemy.targetId) : null;
      if (!target || target.state !== 'alive') {
        enemy.aiState = 'idle';
        enemy.targetId = null;
        break;
      }

      const dist = vec2Distance(enemy.position, target.position);
      if (dist > TELEPORTER_LEASH_RANGE) {
        enemy.aiState = 'idle';
        enemy.targetId = null;
        break;
      }

      const toTarget = vec2Sub(target.position, enemy.position);
      enemy.rotation = vec2Angle(toTarget);

      // Move toward target
      if (dist > TELEPORTER_ATTACK_RANGE + PLAYER_RADIUS + ENEMY_RADIUS) {
        const dir = vec2Normalize(toTarget);
        enemy.position = vec2Add(enemy.position, vec2Scale(dir, speed * dt));
      }

      // Separation
      for (const other of world.enemies.values()) {
        if (other.id === enemy.id || other.aiState === 'dying' || other.aiState === 'dead') continue;
        const d = vec2Distance(enemy.position, other.position);
        if (d < ENEMY_SEPARATION_RADIUS && d > 0.1) {
          const push = vec2Normalize(vec2Sub(enemy.position, other.position));
          enemy.position = vec2Add(enemy.position, vec2Scale(push, ENEMY_SEPARATION_FORCE * dt));
        }
      }

      // Blink cooldown
      enemy.attackCooldownTimer = Math.max(0, enemy.attackCooldownTimer - dt);

      // Blink toward target if in range and cooldown ready
      if (dist > TELEPORTER_ATTACK_RANGE * 2 && dist < TELEPORTER_BLINK_RANGE * 2 && enemy.attackCooldownTimer <= 0) {
        enemy.aiState = 'blinking';
        enemy.telegraphTimer = TELEPORTER_BLINK_TELEGRAPH;
        // Store blink destination (near the player, offset randomly)
        const angle = vec2Angle(toTarget) + (Math.random() - 0.5) * 0.8;
        const blinkDist = Math.min(dist - TELEPORTER_ATTACK_RANGE, TELEPORTER_BLINK_RANGE);
        enemy.dashDirection = vec2FromAngle(angle);
        enemy.dashTimer = blinkDist;
      }

      // Melee attack if close enough
      if (dist < TELEPORTER_ATTACK_RANGE + PLAYER_RADIUS + ENEMY_RADIUS && enemy.attackCooldownTimer <= 0) {
        enemy.aiState = 'attacking';
        enemy.attackProgress = 0;
      }
      break;
    }

    case 'blinking': {
      enemy.telegraphTimer -= dt;
      if (enemy.telegraphTimer <= 0) {
        // Teleport!
        const blinkOffset = vec2Scale(enemy.dashDirection, enemy.dashTimer);
        enemy.position = vec2Add(enemy.position, blinkOffset);
        enemy.attackCooldownTimer = TELEPORTER_BLINK_COOLDOWN;
        // Immediately attack after blink
        enemy.aiState = 'attacking';
        enemy.attackProgress = 0;
      }
      break;
    }

    case 'attacking': {
      enemy.attackProgress += dt / TELEPORTER_PUNCH_DURATION;

      if (enemy.attackProgress >= 0.5 && enemy.attackProgress - dt / TELEPORTER_PUNCH_DURATION < 0.5) {
        const target = enemy.targetId ? world.players.get(enemy.targetId) : null;
        if (target && target.state === 'alive' && target.iFrameTimer <= 0) {
          const dist = vec2Distance(enemy.position, target.position);
          if (dist < TELEPORTER_ATTACK_RANGE + PLAYER_RADIUS + ENEMY_RADIUS + 20) {
            const rawDamage = Math.round(TELEPORTER_PUNCH_DAMAGE * enemy.damageMultiplier);
            const { actualDamage: damage } = checkBlockShield(target.buffs, rawDamage, target.id, events);
            if (damage > 0) {
              target.health -= damage;
              target.hitFlashTimer = HIT_FLASH_DURATION;
              target.iFrameTimer = IFRAME_DURATION;
              const dir = vec2Normalize(vec2Sub(target.position, enemy.position));
              target.knockbackVelocity = vec2Scale(dir, KNOCKBACK_PUNCH);
              events.push({ type: 'DAMAGE_TAKEN', entityId: target.id, amount: damage, newHealth: target.health });
              if (target.health <= 0) {
                target.health = 0;
                target.state = 'dying';
                events.push({ type: 'ENTITY_DIED', entityId: target.id, entityType: 'player' });
              }
              // Elite: vampiric heals enemy after dealing damage
              const vampHeal = getVampiricHeal(enemy, damage);
              if (vampHeal > 0) {
                enemy.health = Math.min(enemy.maxHealth, enemy.health + vampHeal);
              }
            }
          }
        }
      }

      if (enemy.attackProgress >= 1.0) {
        enemy.attackCooldownTimer = TELEPORTER_ATTACK_COOLDOWN;
        enemy.attackProgress = 0;
        enemy.aiState = 'chasing';
      }
      break;
    }
  }

  return events;
}
