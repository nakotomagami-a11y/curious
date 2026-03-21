import type { EnemySnapshot, GameEvent } from '@curious/shared';
import {
  vec2Sub, vec2Normalize, vec2Scale, vec2Add, vec2Distance, vec2Angle,
} from '@curious/shared';
import {
  BOMBER_SPEED, BOMBER_AGGRO_RANGE, BOMBER_LEASH_RANGE,
  BOMBER_EXPLODE_RADIUS, BOMBER_EXPLODE_DAMAGE, BOMBER_FUSE_TIME,
  BOMBER_PROXIMITY_RANGE, PLAYER_RADIUS, ENEMY_RADIUS,
  IFRAME_DURATION, HIT_FLASH_DURATION, KNOCKBACK_SLAM,
  ENEMY_SEPARATION_RADIUS, ENEMY_SEPARATION_FORCE,
} from '@curious/shared';
import type { SimWorld } from './simulation';
import { getSpeedMultiplier } from './buffs';

export function tickBomberAI(enemy: EnemySnapshot, world: SimWorld, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (enemy.aiState === 'dying' || enemy.aiState === 'dead') return events;

  const speed = BOMBER_SPEED * enemy.speedMultiplier * getSpeedMultiplier(enemy.buffs);

  switch (enemy.aiState) {
    case 'idle': {
      let nearest: { id: string; dist: number } | null = null;
      for (const p of world.players.values()) {
        if (p.state !== 'alive') continue;
        const d = vec2Distance(enemy.position, p.position);
        if (d < BOMBER_AGGRO_RANGE && (!nearest || d < nearest.dist)) {
          nearest = { id: p.id, dist: d };
        }
      }
      if (nearest) {
        enemy.targetId = nearest.id;
        enemy.aiState = 'chasing';
        enemy.recoveryTimer = BOMBER_FUSE_TIME; // Repurpose as fuse timer
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
      if (dist > BOMBER_LEASH_RANGE) {
        enemy.aiState = 'idle';
        enemy.targetId = null;
        break;
      }

      // Beeline toward player
      const toTarget = vec2Sub(target.position, enemy.position);
      enemy.rotation = vec2Angle(toTarget);
      const dir = vec2Normalize(toTarget);
      enemy.position = vec2Add(enemy.position, vec2Scale(dir, speed * dt));

      // Separation
      for (const other of world.enemies.values()) {
        if (other.id === enemy.id || other.aiState === 'dying' || other.aiState === 'dead') continue;
        const d = vec2Distance(enemy.position, other.position);
        if (d < ENEMY_SEPARATION_RADIUS && d > 0.1) {
          const push = vec2Normalize(vec2Sub(enemy.position, other.position));
          enemy.position = vec2Add(enemy.position, vec2Scale(push, ENEMY_SEPARATION_FORCE * 0.5 * dt));
        }
      }

      // Check proximity — start fuse countdown when near player
      if (dist < BOMBER_PROXIMITY_RANGE + PLAYER_RADIUS + ENEMY_RADIUS) {
        enemy.recoveryTimer -= dt;
      }

      // Fuse expired or touching player → explode
      if (enemy.recoveryTimer <= 0 || dist < PLAYER_RADIUS + ENEMY_RADIUS) {
        enemy.aiState = 'exploding';
        enemy.attackProgress = 0;
      }
      break;
    }

    case 'exploding': {
      // Brief explosion animation (0.2s)
      enemy.attackProgress += dt / 0.2;

      if (enemy.attackProgress >= 1.0) {
        // Deal AoE damage to all players
        for (const player of world.players.values()) {
          if (player.state !== 'alive') continue;
          if (player.iFrameTimer > 0) continue;
          const dist = vec2Distance(enemy.position, player.position);
          if (dist < BOMBER_EXPLODE_RADIUS + PLAYER_RADIUS) {
            const damage = Math.round(BOMBER_EXPLODE_DAMAGE * enemy.damageMultiplier);
            player.health -= damage;
            player.hitFlashTimer = HIT_FLASH_DURATION;
            player.iFrameTimer = IFRAME_DURATION;

            // Knockback away from explosion
            const dir = vec2Normalize(vec2Sub(player.position, enemy.position));
            const strength = KNOCKBACK_SLAM * (1 - dist / BOMBER_EXPLODE_RADIUS);
            player.knockbackVelocity = vec2Scale(dir, Math.max(strength, KNOCKBACK_SLAM * 0.3));

            events.push({ type: 'DAMAGE_TAKEN', entityId: player.id, amount: damage, newHealth: player.health });
            if (player.health <= 0) {
              player.health = 0;
              player.state = 'dying';
              events.push({ type: 'ENTITY_DIED', entityId: player.id, entityType: 'player' });
            }
          }
        }

        // Bomber dies after exploding
        enemy.health = 0;
        enemy.aiState = 'dying';
        events.push({ type: 'ENTITY_DIED', entityId: enemy.id, entityType: 'enemy' });
      }
      break;
    }
  }

  return events;
}
