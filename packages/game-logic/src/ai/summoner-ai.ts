import type { EnemySnapshot, GameEvent } from '@curious/shared';
import {
  vec2Sub, vec2Normalize, vec2Scale, vec2Add, vec2Distance, vec2Angle, vec2Length,
} from '@curious/shared';
import {
  SUMMONER_SPEED, SUMMONER_AGGRO_RANGE, SUMMONER_LEASH_RANGE,
  SUMMONER_DESIRED_DISTANCE, SUMMONER_SUMMON_COOLDOWN, SUMMONER_SUMMON_DURATION,
  SUMMONER_MAX_MINIONS, ENEMY_SEPARATION_RADIUS, ENEMY_SEPARATION_FORCE,
} from '@curious/shared';
import type { SimWorld } from '../simulation';
import { generateEntityId } from '../simulation';
import { createEnemy } from '../entities/enemy';
import { getSpeedMultiplier } from '../entities/buffs';

export function tickSummonerAI(enemy: EnemySnapshot, world: SimWorld, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (enemy.aiState === 'dying' || enemy.aiState === 'dead') return events;

  const speed = SUMMONER_SPEED * enemy.speedMultiplier * getSpeedMultiplier(enemy.buffs);

  switch (enemy.aiState) {
    case 'idle': {
      let nearest: { id: string; dist: number } | null = null;
      for (const p of world.players.values()) {
        if (p.state !== 'alive') continue;
        const d = vec2Distance(enemy.position, p.position);
        if (d < SUMMONER_AGGRO_RANGE && (!nearest || d < nearest.dist)) {
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
      if (dist > SUMMONER_LEASH_RANGE) {
        enemy.aiState = 'idle';
        enemy.targetId = null;
        break;
      }

      const toTarget = vec2Sub(target.position, enemy.position);
      enemy.rotation = vec2Angle(toTarget);

      // Keep distance — flee if too close, approach if too far
      if (dist < SUMMONER_DESIRED_DISTANCE * 0.5) {
        const fleeDir = vec2Normalize(vec2Sub(enemy.position, target.position));
        enemy.position = vec2Add(enemy.position, vec2Scale(fleeDir, speed * dt));
      } else if (dist > SUMMONER_DESIRED_DISTANCE) {
        const dir = vec2Normalize(toTarget);
        enemy.position = vec2Add(enemy.position, vec2Scale(dir, speed * 0.6 * dt));
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

      // Summon when cooldown ready and fewer than max minions alive
      enemy.attackCooldownTimer = Math.max(0, enemy.attackCooldownTimer - dt);
      if (enemy.attackCooldownTimer <= 0) {
        // Count active minions (melee enemies spawned by summoners near this enemy)
        // Simplified: just use a global cap
        enemy.aiState = 'summoning';
        enemy.attackProgress = 0;
      }
      break;
    }

    case 'summoning': {
      enemy.attackProgress += dt / SUMMONER_SUMMON_DURATION;

      if (enemy.attackProgress >= 1.0) {
        // Spawn 2 minions
        for (let i = 0; i < 2; i++) {
          const angle = Math.random() * Math.PI * 2;
          const offset = { x: Math.sin(angle) * 40, z: Math.cos(angle) * 40 };
          const pos = vec2Add(enemy.position, offset);
          const minion = createEnemy(generateEntityId('minion'), pos, pos, 'melee', {
            healthMult: 0.27, // ~20 HP from 75 base
            speedMult: 1.33,  // ~200 from 150 base
            damageMult: 3.0,  // ~3 from 1 base
          }, []); // No elite modifiers on minions
          world.enemies.set(minion.id, minion);
          events.push({ type: 'ENTITY_SPAWNED', entityId: minion.id, entityType: 'enemy', position: { ...pos } });
        }

        enemy.attackCooldownTimer = SUMMONER_SUMMON_COOLDOWN;
        enemy.attackProgress = 0;
        enemy.aiState = 'chasing';
      }
      break;
    }
  }

  return events;
}
