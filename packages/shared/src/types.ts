// --- Primitives ---
export type Vec2 = { x: number; z: number };
export type EntityId = string;

// --- App State ---
export type AppScene = 'booting' | 'landing' | 'mode-select' | 'lobby' | 'joining' | 'combat' | 'dead';
export type GameMode = 'dev-playground' | 'survival' | 'coop-survival';

// --- Entity States ---
export type PlayerState = 'alive' | 'dying' | 'dead';
export type EnemyType = 'melee' | 'caster' | 'dasher' | 'shielder' | 'summoner' | 'bomber' | 'teleporter' | 'healer';
export type EliteModifier = 'vampiric' | 'thorns' | 'haste' | 'giant' | 'shielded' | 'berserker';
export type EnemyAIState =
  | 'idle' | 'chasing' | 'attacking' | 'telegraphing' | 'dashing' | 'recovering'
  | 'summoning' | 'exploding' | 'blinking' | 'healing'
  | 'dying' | 'dead';
export type BossAIState =
  | 'idle' | 'chasing' | 'telegraphing' | 'jumping' | 'slamming' | 'recovering'
  | 'casting' | 'summoning_pillars' | 'bullet_pattern'
  | 'dying' | 'dead';
export type BossType = 'guardian' | 'hydra' | 'mage';
export type BossPhase = 1 | 2 | 3;

// --- Buffs ---
export type BuffType = 'SPEED_BOOST' | 'BURN' | 'FREEZE' | 'BLOCK_SHIELD';
export type BuffInstance = {
  type: BuffType;
  duration: number;
  tickTimer: number;
  /** For BLOCK_SHIELD: remaining absorption HP */
  absorb?: number;
};

// --- Spells ---
export type SpellId =
  | 'fireball'
  | 'ice_lance'
  | 'lightning_chain'
  | 'heal_circle'
  | 'shield_bubble'
  | 'gravity_well'
  | 'block_shield';
export type ProjectileOwnerType = 'enemy' | 'player';

// --- Attack ---
export type AttackState = {
  comboIndex: number; // 0 = left-to-right, 1 = right-to-left
  progress: number; // 0..1 through slash arc
  startTime: number;
};

// --- Spell Drops ---
export type SpellDropSnapshot = {
  id: EntityId;
  spellId: SpellId;
  position: Vec2;
  lifetime: number;
};

// --- Zones (heal circle, shield bubble, gravity well) ---
export type ZoneType = 'heal' | 'shield_bubble' | 'gravity_well';
export type ZoneSnapshot = {
  id: EntityId;
  ownerId: EntityId;
  zoneType: ZoneType;
  position: Vec2;
  radius: number;
  duration: number;
  /** Remaining absorption HP for shield_bubble */
  absorb?: number;
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
  /** Dynamic spell inventory — each entry is a single-use spell pickup (max 9) */
  spellSlots: SpellId[];
  spellCooldowns: Partial<Record<SpellId, number>>;
  castingSpell: SpellId | null;
  castProgress: number;
};

export type EnemySnapshot = {
  id: EntityId;
  enemyType: EnemyType;
  eliteModifiers: EliteModifier[];
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
  /** For ice lance: how many enemies it can still pierce through */
  pierceRemaining?: number;
  /** Track which entities this piercing projectile already hit */
  piercedIds?: string[];
};

export type BossSnapshot = {
  id: EntityId;
  bossType: BossType;
  phase: BossPhase;
  rageMode: boolean;
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
  /** Stored jump origin for lerping boss position during jump */
  jumpOrigin?: Vec2;
};

// --- Input ---
export type PlayerInput = {
  seq: number;
  moveDir: Vec2;
  aimAngle: number;
  attacking: boolean;
  timestamp: number;
};

// --- Combat Stats ---
export type CombatStats = {
  damageDealt: number;
  damageTaken: number;
  enemiesKilled: number;
  bossesKilled: number;
  spellsCast: number;
  criticalHits: number;
  highestCombo: number;
  timeSurvived: number;
  wavesCleared: number;
  elitesKilled: number;
};

export type LeaderboardEntry = {
  playerName: string;
  score: number;
  wavesCleared: number;
  timeSurvived: number;
  date: string;
};

// --- Session ---
export type SessionState = {
  roomId: string;
  players: Record<EntityId, PlayerSnapshot>;
  enemies: Record<EntityId, EnemySnapshot>;
  boss: BossSnapshot | null;
};
