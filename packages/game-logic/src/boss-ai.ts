import type { BossSnapshot, PlayerSnapshot, GameEvent, Vec2 } from '@curious/shared';
import {
  vec2Sub,
  vec2Add,
  vec2Normalize,
  vec2Scale,
  vec2Distance,
  vec2Angle,
  vec2Length,
  vec2Lerp,
  lerpAngle,
  clampVec2ToArena,
} from '@curious/shared';
import {
  BOSS_SPEED,
  BOSS_RADIUS,
  BOSS_AGGRO_RANGE,
  BOSS_SLAM_TRIGGER_RANGE,
  BOSS_TELEGRAPH_DURATION,
  BOSS_JUMP_DURATION,
  BOSS_SLAM_RADIUS,
  BOSS_SLAM_DAMAGE,
  BOSS_SLAM_COOLDOWN,
  BOSS_RECOVERY_DURATION,
  PLAYER_RADIUS,
  KNOCKBACK_SLAM,
  IFRAME_DURATION,
  HIT_FLASH_DURATION,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
} from '@curious/shared';
import type { SimWorld } from './simulation';
import { updateBossPhase, getBossSpeedMultiplier, getBossDamageMultiplier } from './boss-phases';
import { tickHydraAI } from './hydra-ai';
import { tickMageBossAI } from './mage-boss-ai';

const BOSS_ROTATION_SPEED = 6;

/**
 * Tick the boss AI state machine. Dispatches to type-specific AI.
 */
export function tickBossAI(
  boss: BossSnapshot,
  world: SimWorld,
  dt: number
): GameEvent[] {
  if (boss.aiState === 'dying' || boss.aiState === 'dead') return [];

  // Dispatch to type-specific AI
  if (boss.bossType === 'hydra') return tickHydraAI(boss, world, dt);
  if (boss.bossType === 'mage') return tickMageBossAI(boss, world, dt);

  // Guardian AI (default)
  return tickGuardianAI(boss, world, dt);
}

function tickGuardianAI(
  boss: BossSnapshot,
  world: SimWorld,
  dt: number
): GameEvent[] {
  if (boss.aiState === 'dying' || boss.aiState === 'dead') return [];

  // Tick cooldown
  if (boss.slamCooldownTimer > 0) {
    boss.slamCooldownTimer = Math.max(0, boss.slamCooldownTimer - dt);
  }

  const events: GameEvent[] = [];
  events.push(...updateBossPhase(boss));

  const speedMult = getBossSpeedMultiplier(boss);

  switch (boss.aiState) {
    case 'idle':
      tickIdle(boss, world);
      break;
    case 'chasing':
      tickChasing(boss, world, dt);
      break;
    case 'telegraphing':
      events.push(...tickTelegraphing(boss, world, dt));
      break;
    case 'jumping':
      tickJumping(boss, dt);
      break;
    case 'slamming':
      events.push(...tickSlamming(boss, world));
      break;
    case 'recovering':
      tickRecovering(boss, dt);
      break;
  }

  // Clamp to arena
  boss.position = clampVec2ToArena(
    boss.position,
    ARENA_HALF_WIDTH,
    ARENA_HALF_HEIGHT,
    BOSS_RADIUS
  );

  return events;
}

// --- Helpers ---

function findNearestPlayer(
  boss: BossSnapshot,
  world: SimWorld,
  range: number
): PlayerSnapshot | null {
  let nearest: PlayerSnapshot | null = null;
  let nearestDist = range;

  for (const player of world.players.values()) {
    if (player.state !== 'alive') continue;
    const dist = vec2Distance(boss.position, player.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = player;
    }
  }

  return nearest;
}

function getValidTarget(
  boss: BossSnapshot,
  world: SimWorld
): PlayerSnapshot | null {
  if (!boss.targetId) return null;
  const target = world.players.get(boss.targetId);
  if (!target || target.state !== 'alive') return null;
  return target;
}

function faceToward(boss: BossSnapshot, targetPos: Vec2, dt: number): void {
  const toTarget = vec2Sub(targetPos, boss.position);
  if (vec2Length(toTarget) < 0.1) return;
  const targetAngle = vec2Angle(toTarget);
  boss.rotation = lerpAngle(boss.rotation, targetAngle, BOSS_ROTATION_SPEED * dt);
}

// --- State handlers ---

function tickIdle(boss: BossSnapshot, world: SimWorld): void {
  const target = findNearestPlayer(boss, world, BOSS_AGGRO_RANGE);
  if (target) {
    boss.targetId = target.id;
    boss.aiState = 'chasing';
  }
}

function tickChasing(boss: BossSnapshot, world: SimWorld, dt: number): void {
  const target = getValidTarget(boss, world);

  if (!target) {
    // Re-scan for a new target
    const newTarget = findNearestPlayer(boss, world, BOSS_AGGRO_RANGE);
    if (newTarget) {
      boss.targetId = newTarget.id;
    } else {
      boss.targetId = null;
      boss.aiState = 'idle';
    }
    return;
  }

  const dist = vec2Distance(boss.position, target.position);

  // Close enough to slam?
  if (dist <= BOSS_SLAM_TRIGGER_RANGE && boss.slamCooldownTimer <= 0) {
    boss.aiState = 'telegraphing';
    boss.slamProgress = 0;
    boss.slamTargetPosition = { ...target.position };
    return;
  }

  // Move toward target, but stop at contact distance to avoid overlapping
  const desiredDist = BOSS_RADIUS + PLAYER_RADIUS;
  if (dist > desiredDist) {
    const dir = vec2Normalize(vec2Sub(target.position, boss.position));
    boss.position = vec2Add(boss.position, vec2Scale(dir, BOSS_SPEED * getBossSpeedMultiplier(boss) * dt));
  }
  faceToward(boss, target.position, dt);
}

function tickTelegraphing(
  boss: BossSnapshot,
  world: SimWorld,
  dt: number
): GameEvent[] {
  const events: GameEvent[] = [];

  // Emit telegraph event at start
  if (boss.slamProgress === 0 && boss.slamTargetPosition) {
    events.push({
      type: 'BOSS_TELEGRAPH',
      bossId: boss.id,
      targetPosition: { ...boss.slamTargetPosition },
    });
  }

  // Update slam target to track player during telegraph
  const target = getValidTarget(boss, world);
  if (target) {
    boss.slamTargetPosition = { ...target.position };
    faceToward(boss, target.position, dt);
  }

  boss.slamProgress += dt / BOSS_TELEGRAPH_DURATION;

  if (boss.slamProgress >= 1) {
    boss.slamProgress = 0;
    // Store jump origin for lerp
    (boss as any)._jumpOrigin = { ...boss.position };
    boss.aiState = 'jumping';
  }

  return events;
}

function tickJumping(boss: BossSnapshot, dt: number): void {
  boss.slamProgress += dt / BOSS_JUMP_DURATION;

  if (boss.slamTargetPosition) {
    const origin = (boss as any)._jumpOrigin ?? boss.position;
    const t = Math.min(boss.slamProgress, 1);
    boss.position = vec2Lerp(origin, boss.slamTargetPosition, t);
  }

  if (boss.slamProgress >= 1) {
    boss.slamProgress = 0;
    boss.aiState = 'slamming';
  }
}

function tickSlamming(boss: BossSnapshot, world: SimWorld): GameEvent[] {
  const events: GameEvent[] = [];

  // AoE damage to all players in radius
  for (const player of world.players.values()) {
    const slamEvents = applyBossSlamToPlayer(player, boss);
    events.push(...slamEvents);
  }

  events.push({
    type: 'BOSS_SLAM',
    bossId: boss.id,
    position: { ...boss.position },
    radius: BOSS_SLAM_RADIUS,
  });

  boss.slamCooldownTimer = BOSS_SLAM_COOLDOWN;
  boss.slamProgress = 0;
  boss.slamTargetPosition = null;
  delete (boss as any)._jumpOrigin;
  boss.aiState = 'recovering';

  return events;
}

function tickRecovering(boss: BossSnapshot, dt: number): void {
  boss.slamProgress += dt / BOSS_RECOVERY_DURATION;

  if (boss.slamProgress >= 1) {
    boss.slamProgress = 0;
    boss.aiState = 'idle';
    boss.targetId = null;
  }
}

/** Apply slam AoE damage to a player if in range. */
function applyBossSlamToPlayer(
  player: PlayerSnapshot,
  boss: BossSnapshot
): GameEvent[] {
  if (player.state !== 'alive') return [];
  if (player.iFrameTimer > 0) return [];

  const dist = vec2Distance(boss.position, player.position);
  if (dist > BOSS_SLAM_RADIUS + PLAYER_RADIUS) return [];

  const events: GameEvent[] = [];

  player.health -= BOSS_SLAM_DAMAGE;
  player.hitFlashTimer = HIT_FLASH_DURATION;
  player.iFrameTimer = IFRAME_DURATION;

  // Knockback away from slam center
  // When player is at (near-)same position as boss, pick a random direction
  const dir = dist < 1
    ? (() => { const a = Math.random() * Math.PI * 2; return { x: Math.cos(a), z: Math.sin(a) }; })()
    : vec2Normalize(vec2Sub(player.position, boss.position));

  // Scale knockback by proximity: full force at center, 30% at edge
  const maxDist = BOSS_SLAM_RADIUS + PLAYER_RADIUS;
  const proximity = 1 - dist / maxDist; // 1 at center, 0 at edge
  const knockbackStrength = KNOCKBACK_SLAM * (0.3 + 0.7 * proximity);
  player.knockbackVelocity = vec2Scale(dir, knockbackStrength);

  events.push({
    type: 'DAMAGE_TAKEN',
    entityId: player.id,
    amount: BOSS_SLAM_DAMAGE,
    newHealth: player.health,
  });

  if (player.health <= 0) {
    player.health = 0;
    player.state = 'dying';
    events.push({
      type: 'ENTITY_DIED',
      entityId: player.id,
      entityType: 'player',
    });
  }

  return events;
}
