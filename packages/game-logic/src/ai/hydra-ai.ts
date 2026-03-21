import type { BossSnapshot, PlayerSnapshot, GameEvent, Vec2 } from '@curious/shared';
import {
  vec2Sub, vec2Add, vec2Normalize, vec2Scale, vec2Distance, vec2Angle, vec2Length, lerpAngle,
  clampVec2ToArena,
} from '@curious/shared';
import {
  HYDRA_SPEED, HYDRA_RADIUS, BOSS_AGGRO_RANGE, HYDRA_ATTACK_COOLDOWN,
  HYDRA_BITE_DAMAGE, HYDRA_BITE_RANGE,
  PLAYER_RADIUS, KNOCKBACK_PUNCH, IFRAME_DURATION, HIT_FLASH_DURATION,
  ARENA_HALF_WIDTH, ARENA_HALF_HEIGHT,
} from '@curious/shared';
import type { SimWorld } from '../simulation';
import { getBossSpeedMultiplier, getBossDamageMultiplier, updateBossPhase } from '../entities/boss-phases';
import { checkBlockShield } from '../entities/buffs';

const HYDRA_ROTATION_SPEED = 4;

export function tickHydraAI(boss: BossSnapshot, world: SimWorld, dt: number): GameEvent[] {
  if (boss.aiState === 'dying' || boss.aiState === 'dead') return [];

  if (boss.slamCooldownTimer > 0) {
    boss.slamCooldownTimer = Math.max(0, boss.slamCooldownTimer - dt);
  }

  const events: GameEvent[] = [];
  events.push(...updateBossPhase(boss));

  const speed = HYDRA_SPEED * getBossSpeedMultiplier(boss);

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
      const targetAngle = vec2Angle(toTarget);
      boss.rotation = lerpAngle(boss.rotation, targetAngle, HYDRA_ROTATION_SPEED * dt);

      // Move toward target
      if (dist > HYDRA_RADIUS + PLAYER_RADIUS) {
        const dir = vec2Normalize(toTarget);
        boss.position = vec2Add(boss.position, vec2Scale(dir, speed * dt));
      }

      // Multi-head bite attack — each head attacks independently
      // Use slamCooldownTimer for attack timing
      if (dist < HYDRA_BITE_RANGE && boss.slamCooldownTimer <= 0) {
        boss.aiState = 'telegraphing';
        boss.slamProgress = 0;
      }
      break;
    }

    // Hydra bite attack sequence
    case 'telegraphing': {
      boss.slamProgress += dt / 0.5; // 0.5s telegraph
      if (boss.slamProgress >= 1.0) {
        boss.aiState = 'slamming'; // Bite!
        boss.slamProgress = 0;
      }
      break;
    }

    case 'slamming': {
      // Multi-head bite — damage players in range
      // Each head hits independently based on phase (1 head per phase)
      const hitCount = boss.phase;
      const damage = Math.round(HYDRA_BITE_DAMAGE * getBossDamageMultiplier(boss));

      for (const player of world.players.values()) {
        if (player.state !== 'alive' || player.iFrameTimer > 0) continue;
        const dist = vec2Distance(boss.position, player.position);
        if (dist > HYDRA_BITE_RANGE + PLAYER_RADIUS) continue;

        for (let h = 0; h < hitCount; h++) {
          const { actualDamage: biteDmg } = checkBlockShield(player.buffs, damage, player.id, events);
          if (biteDmg <= 0) continue; // Fully absorbed

          player.health -= biteDmg;
          player.hitFlashTimer = HIT_FLASH_DURATION;
          player.iFrameTimer = IFRAME_DURATION;
          const dir = vec2Normalize(vec2Sub(player.position, boss.position));
          player.knockbackVelocity = vec2Scale(dir, KNOCKBACK_PUNCH * 1.5);

          events.push({ type: 'DAMAGE_TAKEN', entityId: player.id, amount: biteDmg, newHealth: player.health });
          if (player.health <= 0) {
            player.health = 0;
            player.state = 'dying';
            events.push({ type: 'ENTITY_DIED', entityId: player.id, entityType: 'player' });
            break;
          }
        }
      }

      boss.slamCooldownTimer = HYDRA_ATTACK_COOLDOWN / boss.phase; // Faster in later phases
      boss.aiState = 'recovering';
      boss.slamProgress = 0;
      break;
    }

    case 'recovering': {
      boss.slamProgress += dt / 1.0;
      if (boss.slamProgress >= 1.0) {
        boss.slamProgress = 0;
        boss.aiState = 'chasing';
      }
      break;
    }
  }

  boss.position = clampVec2ToArena(boss.position, ARENA_HALF_WIDTH, ARENA_HALF_HEIGHT, HYDRA_RADIUS);
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
