// --- Primitives ---
export type Vec2 = { x: number; z: number };
export type EntityId = string;

// --- App State ---
export type AppScene = 'booting' | 'landing' | 'joining' | 'combat' | 'dead';

// --- Entity States ---
export type PlayerState = 'alive' | 'dying' | 'dead';
export type EnemyAIState = 'idle' | 'chasing' | 'attacking' | 'dying' | 'dead';
export type BossAIState =
  | 'idle'
  | 'chasing'
  | 'telegraphing'
  | 'jumping'
  | 'slamming'
  | 'recovering'
  | 'dying'
  | 'dead';

// --- Attack ---
export type AttackState = {
  comboIndex: number; // 0 = left-to-right, 1 = right-to-left
  progress: number; // 0..1 through slash arc
  startTime: number;
};

// --- Entity Snapshots ---
export type PlayerSnapshot = {
  id: EntityId;
  name: string;
  position: Vec2;
  rotation: number;
  health: number;
  maxHealth: number;
  state: PlayerState;
  attackState: AttackState | null;
  knockbackVelocity: Vec2;
  hitFlashTimer: number;
  iFrameTimer: number;
  lastAttackTime: number;
  lastComboIndex: number;
  swordDamage: number;
  dissolveProgress: number;
  deathTimer: number;
  dashTimer: number;
  dashCooldownTimer: number;
  dashDirection: Vec2;
};

export type EnemySnapshot = {
  id: EntityId;
  position: Vec2;
  rotation: number;
  health: number;
  maxHealth: number;
  aiState: EnemyAIState;
  knockbackVelocity: Vec2;
  hitFlashTimer: number;
  iFrameTimer: number;
  dissolveProgress: number;
  targetId: EntityId | null;
  leashOrigin: Vec2;
  attackCooldownTimer: number;
  attackProgress: number;
};

export type BossSnapshot = {
  id: EntityId;
  position: Vec2;
  rotation: number;
  health: number;
  maxHealth: number;
  aiState: BossAIState;
  slamTargetPosition: Vec2 | null;
  slamProgress: number;
  knockbackVelocity: Vec2;
  hitFlashTimer: number;
  iFrameTimer: number;
  dissolveProgress: number;
  respawnTimer: number;
  slamCooldownTimer: number;
  targetId: EntityId | null;
};

// --- Input ---
export type PlayerInput = {
  seq: number;
  moveDir: Vec2;
  aimAngle: number;
  attacking: boolean;
  timestamp: number;
};

// --- Session ---
export type SessionState = {
  roomId: string;
  players: Record<EntityId, PlayerSnapshot>;
  enemies: Record<EntityId, EnemySnapshot>;
  boss: BossSnapshot | null;
};
