import type { EnemySnapshot, GameEvent, Vec2 } from '@curious/shared';
import {
  vec2, vec2Sub, vec2Normalize, vec2Scale, vec2Add, vec2Distance, vec2Angle, vec2Length, angleDifference,
} from '@curious/shared';
import {
  SHIELDER_SPEED, SHIELDER_AGGRO_RANGE, SHIELDER_LEASH_RANGE,
  SHIELDER_ATTACK_RANGE, SHIELDER_ATTACK_COOLDOWN, SHIELDER_PUNCH_DAMAGE,
  SHIELDER_PUNCH_DURATION, ENEMY_DESIRED_DISTANCE,
  IFRAME_DURATION, HIT_FLASH_DURATION, KNOCKBACK_PUNCH, PLAYER_RADIUS, ENEMY_RADIUS,
  ENEMY_SEPARATION_RADIUS, ENEMY_SEPARATION_FORCE,
} from '@curious/shared';
import type { SimWorld } from '../simulation';
import { getSpeedMultiplier, checkBlockShield } from '../entities/buffs';
import { getVampiricHeal } from '../entities/elite';

export function tickShielderAI(enemy: EnemySnapshot, world: SimWorld, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (enemy.aiState === 'dying' || enemy.aiState === 'dead') return events;

  const speed = SHIELDER_SPEED * enemy.speedMultiplier * getSpeedMultiplier(enemy.buffs);

  switch (enemy.aiState) {
    case 'idle': {
      let nearest: { id: string; dist: number } | null = null;
      for (const p of world.players.values()) {
        if (p.state !== 'alive') continue;
        const d = vec2Distance(enemy.position, p.position);
        if (d < SHIELDER_AGGRO_RANGE && (!nearest || d < nearest.dist)) {
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
      if (dist > SHIELDER_LEASH_RANGE) {
        enemy.aiState = 'idle';
        enemy.targetId = null;
        break;
      }

      // Always face target
      const toTarget = vec2Sub(target.position, enemy.position);
      enemy.rotation = vec2Angle(toTarget);

      // Move toward target
      if (dist > ENEMY_DESIRED_DISTANCE) {
        const dir = vec2Normalize(toTarget);
        enemy.position = vec2Add(enemy.position, vec2Scale(dir, speed * dt));
      }

      // Separation from other enemies
      for (const other of world.enemies.values()) {
        if (other.id === enemy.id || other.aiState === 'dying' || other.aiState === 'dead') continue;
        const d = vec2Distance(enemy.position, other.position);
        if (d < ENEMY_SEPARATION_RADIUS && d > 0.1) {
          const push = vec2Normalize(vec2Sub(enemy.position, other.position));
          enemy.position = vec2Add(enemy.position, vec2Scale(push, ENEMY_SEPARATION_FORCE * dt));
        }
      }

      // Attack when in range and cooldown ready
      enemy.attackCooldownTimer = Math.max(0, enemy.attackCooldownTimer - dt);
      if (dist < SHIELDER_ATTACK_RANGE + PLAYER_RADIUS + ENEMY_RADIUS && enemy.attackCooldownTimer <= 0) {
        enemy.aiState = 'attacking';
        enemy.attackProgress = 0;
      }
      break;
    }

    case 'attacking': {
      enemy.attackProgress += dt / SHIELDER_PUNCH_DURATION;

      // Hit at 50% progress
      if (enemy.attackProgress >= 0.5 && enemy.attackProgress - dt / SHIELDER_PUNCH_DURATION < 0.5) {
        const target = enemy.targetId ? world.players.get(enemy.targetId) : null;
        if (target && target.state === 'alive' && target.iFrameTimer <= 0) {
          const dist = vec2Distance(enemy.position, target.position);
          if (dist < SHIELDER_ATTACK_RANGE + PLAYER_RADIUS + ENEMY_RADIUS + 10) {
            const rawDamage = Math.round(SHIELDER_PUNCH_DAMAGE * enemy.damageMultiplier);
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
        enemy.attackCooldownTimer = SHIELDER_ATTACK_COOLDOWN;
        enemy.attackProgress = 0;
        enemy.aiState = 'chasing';
      }
      break;
    }
  }

  return events;
}
