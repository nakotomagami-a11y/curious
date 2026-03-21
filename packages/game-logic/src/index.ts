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
export { applyBuff, tickBuffs, hasBuff, getSpeedMultiplier } from './buffs';
export { tryCastSpell } from './spells';
export { createBoss } from './boss';
export { tickBossAI } from './boss-ai';
export { resetSpawner } from './spawner';

export {
  tryStartAttack,
  tickAttack,
  checkSlashHit,
  applyHitToEnemy,
  applyHitToBoss,
} from './combat';

export {
  circlesOverlap,
  circlesPenetration,
  separateCircles,
  pointInCircle,
} from './collision';
export type { Circle } from './collision';
