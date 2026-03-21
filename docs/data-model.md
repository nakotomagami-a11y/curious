# Data Model Reference

## Primitives
```ts
type Vec2 = { x: number; z: number }  // XZ plane (NOT x,y — y is vertical in Three.js)
type EntityId = string
```

## Entity Snapshots

### PlayerSnapshot
```ts
{
  id: EntityId
  name: string
  position: Vec2
  rotation: number           // radians, facing direction
  health: number
  maxHealth: number
  state: 'alive' | 'dying' | 'dead'
  attackState: AttackState | null
  knockbackVelocity: Vec2
  hitFlashTimer: number
  iFrameTimer: number        // invulnerability after hit
  lastAttackTime: number     // for combo reset after 1.5s idle
  swordDamage: number        // dynamic damage value (future-proof)
}
```

### AttackState
```ts
{
  comboIndex: number         // 0 = left-to-right, 1 = right-to-left
  progress: number           // 0..1 through slash arc
  startTime: number
}
```

### EnemySnapshot
```ts
{
  id: EntityId
  position: Vec2
  rotation: number
  health: number
  maxHealth: number
  aiState: 'idle' | 'chasing' | 'attacking' | 'dying' | 'dead'
  knockbackVelocity: Vec2
  hitFlashTimer: number
  iFrameTimer: number
  dissolveProgress: number   // 0..1 during dying
  targetId: EntityId | null
  leashOrigin: Vec2          // return point when player runs too far
}
```

### BossSnapshot
```ts
{
  id: EntityId
  position: Vec2
  rotation: number
  health: number
  maxHealth: number
  aiState: 'idle' | 'telegraphing' | 'jumping' | 'slamming' | 'recovering' | 'dying' | 'dead'
  slamTargetPosition: Vec2 | null
  slamProgress: number       // 0..1 for jump arc
  knockbackVelocity: Vec2
  hitFlashTimer: number
  iFrameTimer: number
  dissolveProgress: number
  respawnTimer: number        // countdown after death (shown in world)
}
```

## Game Events (event bus)
```ts
type GameEvent =
  | { type: 'ATTACK_START'; playerId: EntityId; comboIndex: number }
  | { type: 'ATTACK_HIT'; attackerId: EntityId; targetId: EntityId; damage: number; knockback: Vec2 }
  | { type: 'DAMAGE_TAKEN'; entityId: EntityId; amount: number; newHealth: number }
  | { type: 'ENTITY_DIED'; entityId: EntityId; entityType: 'player' | 'enemy' | 'boss' }
  | { type: 'ENTITY_SPAWNED'; entityId: EntityId; entityType: 'enemy' | 'boss'; position: Vec2 }
  | { type: 'BOSS_TELEGRAPH'; bossId: EntityId; targetPosition: Vec2 }
  | { type: 'BOSS_SLAM'; bossId: EntityId; position: Vec2; radius: number }
  | { type: 'BOSS_RESPAWN_TICK'; remainingSeconds: number }
  | { type: 'PLAYER_JOINED'; playerId: EntityId; name: string }
  | { type: 'PLAYER_LEFT'; playerId: EntityId }
```

## Input (client → server)
```ts
type PlayerInput = {
  seq: number               // sequence number for reconciliation
  moveDir: Vec2             // normalized WASD direction
  aimAngle: number          // radians
  attacking: boolean        // left mouse this frame
  timestamp: number
}
```

## Session / App State
```ts
type AppScene = 'booting' | 'landing' | 'joining' | 'combat' | 'dead'

type AppState = {
  scene: AppScene
  playerName: string
  sessionId: EntityId | null
}

type SessionState = {
  roomId: string
  players: Map<EntityId, PlayerSnapshot>
  enemies: Map<EntityId, EnemySnapshot>
  boss: BossSnapshot | null
}
```

## Constants (in packages/shared/constants.ts)
Key values to define:
- Arena: 2000x2000
- Player: speed, maxHealth, sword reach, slash duration (~200ms), slash sweep (~120°), combo cooldown, combo reset (1.5s), attack speed reduction (1.4x), health regen rate, iFrame duration, swordDamage (dynamic)
- Enemy: speed (slower than player), maxHealth, aggro range, leash range, attack range, punch damage, respawn delay (1s)
- Boss: 1.5x scale, maxHealth, telegraph duration, jump duration, slam radius, slam damage, respawn timer (longer)
- Knockback: strength per attack type, decay factor (0.85)
- Spawn: max enemies (2 active, 10 architecture), boss spawn point
- Camera: lag factor, look-ahead distance, shake presets, angle (~60-70°)
