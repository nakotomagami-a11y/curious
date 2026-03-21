// --- Primitives ---
export type Vec2 = { x: number; z: number };
export type EntityId = string;

// --- App State ---
export type AppScene = 'booting' | 'landing' | 'mode-select' | 'joining' | 'combat' | 'dead';
export type GameMode = 'dev-playground' | 'survival';

// --- Entity States ---
export type PlayerState = 'alive' | 'dying' | 'dead';
export type EnemyType = 'melee' | 'caster' | 'dasher';
export type EnemyAIState = 'idle' | 'chasing' | 'attacking' | 'telegraphing' | 'dashing' | 'recovering' | 'dying' | 'dead';
export type BossAIState =
  | 'idle'
  | 'chasing'
  | 'telegraphing'
  | 'jumping'
  | 'slamming'
  | 'recovering'
  | 'dying'
  | 'dead';

// --- Buffs ---
export type BuffType = 'SPEED_BOOST' | 'BURN';
export type BuffInstance = {
  type: BuffType;
  duration: number;
  tickTimer: number;
};

// --- Spells ---
export type SpellId = 'fireball';
export type ProjectileOwnerType = 'enemy' | 'player';

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
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  isMoving: boolean;
  state: PlayerState;
  attackState: AttackState | null;
  knockbackVelocity: Vec2;
  hitFlashTimer: number;
  iFrameTimer: number;
  stunTimer: number;
  lastAttackTime: number;
  lastComboIndex: number;
  swordDamage: number;
  dissolveProgress: number;
  deathTimer: number;
  dashTimer: number;
  dashCooldownTimer: number;
  dashDirection: Vec2;
  buffs: BuffInstance[];
  spellCooldowns: Partial<Record<SpellId, number>>;
  castingSpell: SpellId | null;
  castProgress: number;
};

export type EnemySnapshot = {
  id: EntityId;
  enemyType: EnemyType;
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
  speedMultiplier: number;
  damageMultiplier: number;
  buffs: BuffInstance[];
  // Dasher-specific
  dashDirection: Vec2;
  dashTimer: number;
  telegraphTimer: number;
  recoveryTimer: number;
};

export type ProjectileSnapshot = {
  id: EntityId;
  ownerId: EntityId;
  ownerType: ProjectileOwnerType;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  damage: number;
  lifetime: number;
  isFireball: boolean;
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
