// Game logic modules — pure TS, no framework dependencies

// --- Core ---
export { createWorld, tickWorld, generateEntityId, resetEntityIdCounter } from './simulation';
export type { SimWorld, SurvivalState } from './simulation';

// --- Entities ---
export { createPlayer, applyPlayerMovement, setPlayerRotation, tryStartDash } from './entities/player';
export { createEnemy } from './entities/enemy';
export { createBoss } from './entities/boss';
export { applyBuff, tickBuffs, hasBuff, getSpeedMultiplier, checkBlockShield } from './entities/buffs';
export {
  rollEliteModifiers, applyEliteStats, getEliteDamageReduction,
  getVampiricHeal, getThornsReflect, isBerserkerActive,
  getEliteSpeedMultiplier, getEliteDamageMultiplier, getEliteAttackCooldownMultiplier,
} from './entities/elite';
export { updateBossPhase, getBossSpeedMultiplier, getBossDamageMultiplier, getBossCooldownMultiplier } from './entities/boss-phases';

// --- Combat ---
export {
  tryStartAttack, tickAttack, checkSlashHit, applyHitToEnemy, applyHitToBoss,
} from './combat/combat';
export { rollCritical } from './combat/critical';
export type { CritResult } from './combat/critical';
export { createProjectile, tickProjectiles } from './combat/projectile';
export { circlesOverlap, circlesPenetration, separateCircles, pointInCircle } from './combat/collision';
export type { Circle } from './combat/collision';
export { createSpatialGrid, clearGrid, insertEntity, getNearbyEntities } from './combat/spatial-grid';
export type { SpatialGrid } from './combat/spatial-grid';

// --- AI ---
export { tickEnemyAI } from './ai/enemy-ai';
export { tickCasterAI } from './ai/caster-ai';
export { tickDasherAI } from './ai/dasher-ai';
export { tickShielderAI } from './ai/shielder-ai';
export { tickSummonerAI } from './ai/summoner-ai';
export { tickBomberAI } from './ai/bomber-ai';
export { tickTeleporterAI } from './ai/teleporter-ai';
export { tickHealerAI } from './ai/healer-ai';
export { tickBossAI } from './ai/boss-ai';
export { tickHydraAI } from './ai/hydra-ai';
export { tickMageBossAI } from './ai/mage-boss-ai';
export { getAttackTelegraph } from './ai/telegraphs';
export type { TelegraphData, TelegraphShape } from './ai/telegraphs';
export { assignPackRoles, getPackRole, getFlankAngle } from './ai/pack-ai';
export type { PackRole } from './ai/pack-ai';
export { addThreat, addProximityThreat, shareAllyThreat, getHighestThreatTarget, resetThreatTable, resetAllThreat } from './ai/aggro';
export type { ThreatEntry } from './ai/aggro';

// --- Spells ---
export { tryCastSpell } from './spells/spells';
export { rollSpellDrop, tickSpellDrops, tryPickupSpell, checkAutoPickup } from './spells/spell-drops';
export { tickZones } from './spells/zones';

// --- Spawning ---
export { resetSpawner } from './spawning/spawner';
export { initSurvivalWave, tickSurvival } from './spawning/survival-spawner';

// --- Stats ---
export { createCombatStats, processStatsEvent, calculateScore } from './stats/stats';

// --- Utils ---
export { ObjectPool } from './utils/object-pool';
