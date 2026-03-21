// Game logic modules — pure TS, no framework dependencies

export { createWorld, tickWorld, generateEntityId, resetEntityIdCounter } from './simulation';
export type { SimWorld } from './simulation';

export { createPlayer, applyPlayerMovement, setPlayerRotation, tryStartDash } from './player';
export { createEnemy } from './enemy';
export { tickEnemyAI } from './enemy-ai';
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
