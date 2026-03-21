// Game logic modules — pure TS, no framework dependencies

export { createWorld, tickWorld, generateEntityId, resetEntityIdCounter } from './simulation';
export type { SimWorld, SurvivalState } from './simulation';
export { initSurvivalWave, tickSurvival } from './survival-spawner';

export { createPlayer, applyPlayerMovement, setPlayerRotation, tryStartDash } from './player';
export { createEnemy } from './enemy';
export { tickEnemyAI } from './enemy-ai';
export { tickCasterAI } from './caster-ai';
export { createProjectile, tickProjectiles } from './projectile';
export { tickDasherAI } from './dasher-ai';
export { tickShielderAI } from './shielder-ai';
export { tickSummonerAI } from './summoner-ai';
export { tickBomberAI } from './bomber-ai';
export { tickTeleporterAI } from './teleporter-ai';
export { tickHealerAI } from './healer-ai';
export { applyBuff, tickBuffs, hasBuff, getSpeedMultiplier, checkBlockShield } from './buffs';
export { rollCritical } from './critical';
export type { CritResult } from './critical';
export {
  rollEliteModifiers, applyEliteStats, getEliteDamageReduction,
  getVampiricHeal, getThornsReflect, isBerserkerActive,
  getEliteSpeedMultiplier, getEliteDamageMultiplier, getEliteAttackCooldownMultiplier,
} from './elite';
export { tryCastSpell } from './spells';
export { rollSpellDrop, tickSpellDrops, tryPickupSpell, checkAutoPickup } from './spell-drops';
export { tickZones } from './zones';
export { createBoss } from './boss';
export { tickBossAI } from './boss-ai';
export { tickHydraAI } from './hydra-ai';
export { tickMageBossAI } from './mage-boss-ai';
export { updateBossPhase, getBossSpeedMultiplier, getBossDamageMultiplier, getBossCooldownMultiplier } from './boss-phases';
export { resetSpawner } from './spawner';

export {
  tryStartAttack,
  tickAttack,
  checkSlashHit,
  applyHitToEnemy,
  applyHitToBoss,
} from './combat';

export { createCombatStats, processStatsEvent, calculateScore } from './stats';

export {
  circlesOverlap,
  circlesPenetration,
  separateCircles,
  pointInCircle,
} from './collision';
export type { Circle } from './collision';

export { getAttackTelegraph } from './telegraphs';
export type { TelegraphData, TelegraphShape } from './telegraphs';
export { assignPackRoles, getPackRole, getFlankAngle } from './pack-ai';
export type { PackRole } from './pack-ai';
export {
  addThreat, addProximityThreat, shareAllyThreat,
  getHighestThreatTarget, resetThreatTable, resetAllThreat,
} from './aggro';
export type { ThreatEntry } from './aggro';

export { createSpatialGrid, clearGrid, insertEntity, getNearbyEntities } from './spatial-grid';
export type { SpatialGrid } from './spatial-grid';
export { ObjectPool } from './object-pool';
