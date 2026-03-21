import type { EnemySnapshot, GameEvent } from '@curious/shared';
import {
  vec2Sub, vec2Normalize, vec2Scale, vec2Add, vec2Distance, vec2Angle,
} from '@curious/shared';
import {
  HEALER_SPEED, HEALER_AGGRO_RANGE, HEALER_LEASH_RANGE,
  HEALER_HEAL_RANGE, HEALER_HEAL_RATE, HEALER_HEAL_DURATION, HEALER_HEAL_COOLDOWN,
  HEALER_FLEE_DISTANCE, HEALER_DESIRED_DISTANCE,
  ENEMY_SEPARATION_RADIUS, ENEMY_SEPARATION_FORCE,
} from '@curious/shared';
import type { SimWorld } from '../simulation';
import { getSpeedMultiplier } from '../entities/buffs';

export function tickHealerAI(enemy: EnemySnapshot, world: SimWorld, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (enemy.aiState === 'dying' || enemy.aiState === 'dead') return events;

  const speed = HEALER_SPEED * enemy.speedMultiplier * getSpeedMultiplier(enemy.buffs);

  switch (enemy.aiState) {
    case 'idle': {
      // Aggro when player is nearby
      let nearest: { id: string; dist: number } | null = null;
      for (const p of world.players.values()) {
        if (p.state !== 'alive') continue;
        const d = vec2Distance(enemy.position, p.position);
        if (d < HEALER_AGGRO_RANGE && (!nearest || d < nearest.dist)) {
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

      const distToPlayer = vec2Distance(enemy.position, target.position);
      if (distToPlayer > HEALER_LEASH_RANGE) {
        enemy.aiState = 'idle';
        enemy.targetId = null;
        break;
      }

      // Flee if player too close
      if (distToPlayer < HEALER_FLEE_DISTANCE) {
        const fleeDir = vec2Normalize(vec2Sub(enemy.position, target.position));
        enemy.position = vec2Add(enemy.position, vec2Scale(fleeDir, speed * dt));
        enemy.rotation = vec2Angle(vec2Sub(target.position, enemy.position));
      } else if (distToPlayer > HEALER_DESIRED_DISTANCE) {
        // Stay near allies but not too close to player
        const toPlayer = vec2Sub(target.position, enemy.position);
        enemy.position = vec2Add(enemy.position, vec2Scale(vec2Normalize(toPlayer), speed * 0.3 * dt));
        enemy.rotation = vec2Angle(toPlayer);
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

      // Look for lowest-health ally within heal range
      enemy.attackCooldownTimer = Math.max(0, enemy.attackCooldownTimer - dt);
      if (enemy.attackCooldownTimer <= 0) {
        let healTarget: EnemySnapshot | null = null;
        let lowestPct = 1.0;

        for (const ally of world.enemies.values()) {
          if (ally.id === enemy.id) continue;
          if (ally.aiState === 'dying' || ally.aiState === 'dead') continue;
          const dist = vec2Distance(enemy.position, ally.position);
          if (dist > HEALER_HEAL_RANGE) continue;

          const pct = ally.health / ally.maxHealth;
          if (pct < lowestPct && pct < 0.9) {
            lowestPct = pct;
            healTarget = ally;
          }
        }

        // Also heal boss
        if (world.boss && world.boss.aiState !== 'dying' && world.boss.aiState !== 'dead') {
          const dist = vec2Distance(enemy.position, world.boss.position);
          if (dist <= HEALER_HEAL_RANGE) {
            const pct = world.boss.health / world.boss.maxHealth;
            if (pct < lowestPct && pct < 0.9) {
              healTarget = null; // We'll handle boss healing separately
              // Start healing toward boss
              enemy.aiState = 'healing';
              enemy.attackProgress = 0;
              enemy.targetId = world.boss.id;
              break;
            }
          }
        }

        if (healTarget) {
          enemy.aiState = 'healing';
          enemy.attackProgress = 0;
          // Store heal target id temporarily (reuse dashDirection.x to store idx)
          enemy.targetId = healTarget.id;
        }
      }
      break;
    }

    case 'healing': {
      enemy.attackProgress += dt / HEALER_HEAL_DURATION;

      // Heal tick
      const healPerTick = HEALER_HEAL_RATE * dt;
      const healTargetEnemy = enemy.targetId ? world.enemies.get(enemy.targetId) : null;
      const healTargetBoss = enemy.targetId === world.boss?.id ? world.boss : null;

      if (healTargetEnemy && healTargetEnemy.aiState !== 'dying' && healTargetEnemy.aiState !== 'dead') {
        healTargetEnemy.health = Math.min(healTargetEnemy.maxHealth, healTargetEnemy.health + healPerTick);
        // Face heal target
        const toTarget = vec2Sub(healTargetEnemy.position, enemy.position);
        enemy.rotation = vec2Angle(toTarget);
      } else if (healTargetBoss && healTargetBoss.aiState !== 'dying' && healTargetBoss.aiState !== 'dead') {
        healTargetBoss.health = Math.min(healTargetBoss.maxHealth, healTargetBoss.health + healPerTick);
        const toTarget = vec2Sub(healTargetBoss.position, enemy.position);
        enemy.rotation = vec2Angle(toTarget);
      } else {
        // Target gone, stop healing
        enemy.aiState = 'chasing';
        enemy.attackCooldownTimer = HEALER_HEAL_COOLDOWN;
        break;
      }

      if (enemy.attackProgress >= 1.0) {
        enemy.attackCooldownTimer = HEALER_HEAL_COOLDOWN;
        enemy.attackProgress = 0;
        enemy.aiState = 'chasing';
      }
      break;
    }
  }

  return events;
}
