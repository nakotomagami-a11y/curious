# Feature Plan v2 — Curious Combat Arena

> Created: 2026-03-21
> Status: Planning

---

## Overview

This plan covers a major feature expansion organized into 12 phases. Each phase is designed to build on the previous one, with shared/game-logic changes first and rendering/UI second.

---

## Phase 1: Spell System Overhaul + Spell Drops

**Goal**: Expand from 1 spell to 7, make spells consumable pickups dropped by enemies.

### 1A — Shared Types & Constants

- Add new `SpellId` values: `'ice_lance' | 'lightning_chain' | 'heal_circle' | 'shield_bubble' | 'gravity_well' | 'block_shield'`
- Add `SpellDrop` type: `{ id: EntityId, spellId: SpellId, position: Vec2, lifetime: number }`
- Add `SPELL_DROP_CHANCE = 0.20` (20% on enemy death)
- Add `MAX_SPELL_SLOTS = 9`
- Add constants for each spell:
  - **Ice Lance**: 15 mana, 3s cooldown, piercing line projectile, 25 damage, applies FREEZE debuff (50% slow, 2s)
  - **Lightning Chain**: 30 mana, 5s cooldown, bounces 3 times between enemies within 150u, 15 damage per bounce
  - **Heal Circle**: 20 mana, 8s cooldown, AoE 120u radius, heals 30 HP over 3s to player standing in zone
  - **Shield Bubble**: 25 mana, 10s cooldown, blocks all projectiles in 80u radius for 3s, absorbs up to 50 damage
  - **Gravity Well**: 35 mana, 12s cooldown, pulls enemies within 200u toward center for 3s, 5 DPS
  - **Block Shield**: 15 mana, 6s cooldown, personal shield lasting 1.5s, absorbs up to 40 damage, reflects 10 damage to melee attackers
- Add new `BuffType` values: `'FREEZE' | 'SHIELD_BUBBLE' | 'BLOCK_SHIELD' | 'GRAVITY_PULL'`
- Add `SpellDropSnapshot` to world state
- Add events: `SPELL_DROPPED`, `SPELL_PICKED_UP`, `SPELL_SLOT_FULL`, `SHIELD_BLOCK`, `SHIELD_BREAK`

### 1B — Game Logic

- **spells.ts**: Implement cast functions for each new spell
  - `tryCastIceLance()` — spawns piercing projectile that doesn't die on first hit
  - `tryCastLightningChain()` — finds nearest enemy, chains to N more within radius
  - `tryCastHealCircle()` — places healing zone entity at player feet
  - `tryCastShieldBubble()` — places shield zone entity around player
  - `tryCastGravityWell()` — places gravity zone at aim position
  - `tryCastBlockShield()` — applies BLOCK_SHIELD buff to player
- **spell-drops.ts** (new):
  - `rollSpellDrop(position: Vec2, world: SimWorld)` — 20% chance, random spell, adds to `world.spellDrops`
  - `tickSpellDrops(world, dt)` — lifetime decay, remove expired (30s lifetime)
  - `tryPickupSpell(player, world)` — proximity check (40u), reject if slots >= 9
- **Player spell slots**: Change from fixed 3-slot to dynamic array `spellSlots: SpellId[]` (max 9)
  - Spells are single-use: remove from slot on cast
  - Fireball no longer default — all spells come from drops
- **zones.ts** (new): Persistent area-effect entities
  - `HealZone`, `ShieldZone`, `GravityZone` types
  - `tickZones(world, dt)` — apply effects per tick, remove expired
- **buffs.ts**: Implement FREEZE (speed 0.5x), BLOCK_SHIELD (damage absorption), GRAVITY_PULL (movement override)
- **simulation.ts**: Add `world.spellDrops`, `world.zones` maps; tick them in main loop
- **combat.ts**: Check BLOCK_SHIELD buff before applying damage — absorb and reflect

### 1C — Rendering & UI

- **SpellDropRig**: Floating orb on ground, color-coded per spell, gentle bob + rotate + glow
- **HealZoneRig**: Green circle on ground with rising particle motes
- **ShieldBubbleRig**: Translucent sphere with hex-grid pattern, flickers on hit
- **GravityWellRig**: Dark swirl on ground pulling in particle debris
- **IceLanceRig**: Blue elongated projectile with frost trail
- **LightningChainRig**: Animated line segments between chain targets (brief flash)
- **BlockShieldRig**: Small frontal shield attached to player, cracks on absorb
- **PlayerHUD spell slots**: Expand to show up to 9 slots in a row, each with spell icon + keybind (1-9)
- **Pickup prompt**: "Press F" text when near a spell drop

---

## Phase 2: Critical Hit System

**Goal**: Add critical hits with visual/audio feedback.

### 2A — Shared

- Add `CRIT_CHANCE = 0.15` (15% base)
- Add `CRIT_MULTIPLIER = 2.0`
- Add `BACKSTAB_CRIT_BONUS = 0.30` (backstab = guaranteed +30% crit chance → 45% total)
- Add `TELEGRAPH_CRIT_BONUS = 1.0` (hitting during enemy telegraph = guaranteed crit)
- Add `isCritical` field to `ATTACK_HIT` event

### 2B — Game Logic

- **combat.ts**: `rollCritical(attackerPos, targetPos, targetRotation, targetState)`:
  - Base 15% chance
  - +30% if hitting from behind (angle > 120° from target facing)
  - +100% if target is in 'telegraphing' state
  - Returns `{ isCrit: boolean, multiplier: number }`
- Apply crit multiplier to damage in `applyHitToEnemy` / `applyHitToBoss`

### 2C — Rendering

- **DamageNumbers**: Yellow text + larger scale + "CRIT!" prefix for critical hits
- **Camera shake**: 1.5x intensity on crit
- **Hit sparks**: White/gold color + 2x particle count on crit
- **Screen flash**: Brief white overlay (50ms) on crit
- **Audio**: Distinct "critical hit" sound effect (higher pitch, more impact)

---

## Phase 3: Elite Enemy Modifiers

**Goal**: Random modifiers on enemies that change their behavior + visual indicator.

### 3A — Shared

- Add `EliteModifier = 'vampiric' | 'thorns' | 'haste' | 'giant' | 'shielded' | 'berserker'`
- Add `ELITE_SPAWN_CHANCE = 0.15` (15% of enemies spawn elite)
- Add `eliteModifiers: EliteModifier[]` to `EnemySnapshot`
- Constants per modifier:
  - **Vampiric**: heals 20% of damage dealt
  - **Thorns**: reflects 30% damage to attacker
  - **Haste**: 2x movement and attack speed
  - **Giant**: 1.8x scale, 2x HP, 1.5x damage, 0.7x speed
  - **Shielded**: Takes 50% reduced damage from front
  - **Berserker**: Below 30% HP → 2x damage, 1.5x speed, red glow

### 3B — Game Logic

- **elite.ts** (new):
  - `rollEliteModifiers()`: 15% chance to be elite, picks 1-2 random modifiers
  - `applyEliteStats(enemy, modifiers)`: Modify base stats
  - `tickEliteEffects(enemy, world, dt)`: Process passive effects (vampiric heal, berserker threshold)
- **combat.ts**: Check thorns on hit → reflect damage; check shielded → reduce frontal damage
- **spawner.ts / survival-spawner.ts**: Call `rollEliteModifiers()` on enemy creation

### 3C — Rendering

- **Elite indicator**: Glowing colored ring under elite enemies
  - Vampiric: red ring + dripping particles
  - Thorns: spiky purple aura
  - Haste: blue speed lines
  - Giant: just larger + ground cracks
  - Shielded: frontal golden half-dome
  - Berserker: orange glow (red below 30% HP)
- **Elite nameplate**: Small modifier icon(s) above health bar
- **Audio**: Elite spawn has distinct "power up" sound

---

## Phase 4: New Enemy Types

**Goal**: Add 5 new enemy types with unique AI behaviors.

### 4A — Shared

- Extend `EnemyType`: add `'shielder' | 'summoner' | 'bomber' | 'teleporter' | 'healer'`
- Add constants for each:
  - **Shielder**: HP 100, speed 100, frontal shield blocks all damage from front arc (120°), must be flanked
  - **Summoner**: HP 40, speed 80, summons 2 minions every 6s (minion: HP 20, speed 200, 3 damage, despawns after 8s)
  - **Bomber**: HP 30, speed 180, runs toward player, explodes on death or after 5s proximity (80u radius, 25 damage)
  - **Teleporter**: HP 45, speed 130, blinks 200u every 3s, attacks immediately after blink
  - **Healer**: HP 55, speed 110, heals nearest ally 5 HP/s within 200u range, prioritized target

### 4B — Game Logic

- **shielder-ai.ts** (new): Faces player, advances slowly, shield blocks frontal hits. Drops shield briefly (0.5s) when attacking
- **summoner-ai.ts** (new): Stays at 400u distance, periodically spawns minion entities (capped at 4 active minions)
- **bomber-ai.ts** (new): Beelines toward player, flashes faster as timer expires, explodes dealing AoE damage
- **teleporter-ai.ts** (new): Chases → telegraphs blink (0.3s) → appears at new position → attacks
- **healer-ai.ts** (new): Stays behind frontline, channels heal beam on lowest-HP ally, flees if player approaches
- **enemy.ts**: Add factory cases for new types
- **spawner.ts**: Update spawn weights to include new types
- **simulation.ts**: Add AI dispatch for new types

### 4C — Rendering

- **ShielderRig**: Metallic grey body, visible shield plane in front, shield flickers when hit
- **SummonerRig**: Dark purple body, hands glow during summon cast, summoning circle on ground
- **BomberRig**: Orange/red body, pulsing glow that accelerates, explosion VFX on death
- **TeleporterRig**: Cyan body, blink-out particles (scatter) + blink-in particles (converge)
- **HealerRig**: Green/white body, visible heal beam (line to target), healing runes around target
- **Spawn animation**: All enemies materialize with a ground-circle + rising particle effect over 0.5s

---

## Phase 5: Advanced Enemy AI

**Goal**: Improve tactical behavior — telegraphs, pack coordination, aggro sharing.

### 5A — Game Logic

- **telegraphs.ts** (new):
  - All enemy attacks now have telegraph indicators before they land
  - Melee: 0.3s wind-up with ground cone indicator
  - Caster: projectile path preview line (faint)
  - Dasher: already has telegraph (enhance with ground line)
  - Boss: already has slam indicator (keep)
- **pack-ai.ts** (new):
  - `assignRoles(enemies, playerPos)`: Designate flankers, pressurers, support
  - Melee: 2 engage front, others flank sides
  - Casters stay behind melee line
  - Dashers look for openings when player is engaged with melee
  - Healers hide behind shielders
- **aggro.ts** (new):
  - `ThreatTable`: per-enemy map of `playerId → threat`
  - Threat increases on: being hit (+damage dealt), proximity (+1/s), healing allies near player (+5/s)
  - Nearby enemies (within 300u) share 50% threat when an ally is hit
  - Enemies target highest-threat player

### 5B — Rendering

- **Telegraph indicators**: Ground-projected shapes (cones, lines, circles) with red/orange color, pulsing opacity
- **Pack behavior debug** (dev mode only): Faint lines showing role assignments

---

## Phase 6: Boss Expansion

**Goal**: Add 2 new bosses, boss phases, rage mode, arenas, segmented HP.

### 6A — Shared

- Add `BossType = 'guardian' | 'hydra' | 'mage'`
- Add `BossPhase = 1 | 2 | 3`
- Add boss-specific constants:
  - **Hydra**: HP 500, 3 heads (each can attack independently), severing a head spawns 2 mini-heads, speed 80
  - **Mage Boss**: HP 400, teleports, summons elemental pillars (fire/ice/lightning), bullet-hell projectile patterns, speed 60
- Add `phase`, `bossType`, `rageMode` to `BossSnapshot`
- Add `BossSegment` concept: HP bar divided into segments (e.g., 4 segments for 400 HP = 100 each)

### 6B — Game Logic

- **boss.ts**: Generalize to support multiple boss types, add phase transitions
- **hydra-ai.ts** (new): Multi-head attack system, head-severing spawns sub-entities
- **mage-boss-ai.ts** (new): Teleport, pillar summon, projectile patterns (spiral, burst, wave)
- **boss-phases.ts** (new):
  - Phase 2 at 50% HP: new attack patterns, faster timings
  - Phase 3 at 25% HP: even more aggressive
  - Rage mode at 20% HP: +50% speed, +30% damage, visual overcharge, new desperation attack
- **boss-arena.ts** (new): Arena hazard system
  - Guardian: falling rocks (random AoE warnings)
  - Hydra: poison pools left by severed heads
  - Mage: rotating fire walls, ice patches

### 6C — Rendering

- **HydraRig**: Multi-headed model (3 cylinder "heads" on stalks), heads animate independently
- **MageBossRig**: Robed figure (tall cylinder + sphere head), teleport particles, casting effects
- **Phase transition**: Screen flash + boss roar + brief slowmo
- **Rage mode**: Red/orange pulsing aura, distortion shader, intensified particles
- **Boss health segments**: Segmented HP bar with notch marks at 25/50/75%, flash on segment break
- **Arena hazards**: Ground indicators for each hazard type

---

## Phase 7: Stats, Post-Death Screen & Leaderboard

**Goal**: Track combat stats, display post-death summary, mock leaderboard UI.

### 7A — Shared

- Add `CombatStats` type:
  ```
  {
    damageDealt: number
    damageTaken: number
    enemiesKilled: number
    bossesKilled: number
    spellsCast: number
    criticalHits: number
    highestCombo: number
    timeSurvived: number
    wavesCleared: number
    elitesKilled: number
  }
  ```
- Add `LeaderboardEntry` type: `{ playerName, score, wavesCleared, timeSurvived, date }`

### 7B — Game Logic

- **stats.ts** (new):
  - `createCombatStats()`: Initialize zeroed stats
  - `processStatsEvent(stats, event)`: Increment counters based on game events
  - `calculateScore(stats)`: Formula: `kills×10 + elites×50 + bosses×200 + damage/10 + waves×100 + time×1`

### 7C — Rendering

- **DeathStatsScreen**: Full-screen overlay on death
  - Player name + "DEFEATED" title
  - Stat grid: damage dealt/taken, kills, crits, combos, time, waves
  - Score display with animated count-up
  - "Try Again" + "Main Menu" buttons
- **LeaderboardPanel**: Accessible from main menu
  - Tab per game mode (Survival / Endless)
  - Table: Rank, Name, Score, Waves, Time, Date
  - Mock data (10 entries) — placeholder for server integration
  - **NOTE FOR FUTURE**: Hook up to Colyseus server for real leaderboard data. Currently uses localStorage for local scores only.

---

## Phase 8: Co-op Survival (UI Mock)

**Goal**: Design and implement the co-op UI flow — lobby, ready-up, in-game multiplayer HUD. All non-functional until server integration.

### 8A — UI Components

- **CoopLobbyScreen**:
  - Room code display + "Copy" button
  - Player list (1-4 slots) with ready checkboxes
  - "Start Game" button (host only, enabled when all ready)
  - Chat box (mock, non-functional)
- **CoopHUD additions**:
  - Teammate health bars (top of screen, compact)
  - Teammate position indicators on minimap
  - Revive prompt when near downed teammate ("Hold F to revive")
  - Shared wave progress bar
- **Mode Select**: Add "Co-op Survival" card alongside existing modes (greyed with "Coming Soon" badge)

### 8B — Important Notes for Server Integration

> **MULTIPLAYER INTEGRATION NOTES** (preserve for Phase 11+):
> - Co-op supports 2-4 players in a shared survival arena
> - Server-authoritative: all game logic runs on Colyseus server
> - Client sends inputs (movement, aim, attack, spell cast)
> - Server broadcasts world snapshots at 20Hz
> - Client interpolates between snapshots for smooth rendering
> - Lobby system: host creates room, shares code, others join
> - Ready-check required before game start
> - Player disconnect: AI takes over for 30s, then player removed
> - Revive system: downed players have 10s bleedout timer, teammates can revive with 3s channel
> - Shared threat tables for enemy AI targeting
> - Loot drops are per-player (no steal)
> - Wave scaling: +50% enemies per additional player

---

## Phase 9: Visual Effects Expansion

**Goal**: Add footstep dust, spell VFX, screen effects, kill streaks, idle animations, spawn animations.

### 9A — Particle Effects

- **Footstep dust** (#54): Small dust puffs at player feet every 0.2s while moving, larger cloud on dash
- **Spell VFX** (#55):
  - Ice lance: frost trail particles, ice shard fragments on hit
  - Lightning chain: bright arc segments between targets, sparks at each node
  - Heal circle: green motes rising from ground, gentle pulse
  - Shield bubble: hex-grid shimmer, crack effect on absorb
  - Gravity well: dark spiral particles, debris pulled inward
  - Block shield: energy plane in front, fracture pattern on break
- **Enemy spawn animation** (#61): Ground circle expands → enemy rises from it with particles → circle fades (0.5s total)

### 9B — Screen Effects (#56)

- **Low HP vignette**: Red pulsing vignette when health < 30%
- **Freeze tint**: Blue overlay + frost edges when frozen
- **Shield active**: Faint golden edge glow while block shield is active

### 9C — Kill Streak Effects (#57)

- Track consecutive kills within 3s window
- 3-kill: "Triple Kill" text + character glow
- 5-kill: "Rampage" text + brighter glow + trail gets longer
- 10-kill: "Unstoppable" text + camera zoom tightens slightly + screen edge glow

### 9D — Idle Animations (#58)

- Enhanced idle: subtle weight shift left/right (0.5Hz), occasional weapon readjust
- Breathing: gentle vertical bob (0.3Hz, ±0.5 units)
- Enemy idle: head scan left/right, occasional shuffle step

---

## Phase 10: Audio Improvements

**Goal**: Better audio variety, dynamic music, and ambient sounds.

### 10A — Hit Sound Variety

- 3-4 variations per hit type (sword hit, punch, projectile impact)
- Randomize pitch ±10% on each play to avoid repetition
- Combo escalation: successive combo hits get +5% pitch per step

### 10B — Combat Audio

- Critical hit: distinct high-impact sound
- Shield block: metallic clang
- Spell cast sounds: unique per spell type (ice crack, thunder rumble, healing chime, energy hum, gravity whoosh)
- Elite spawn: power-up whoosh
- Boss phase transition: dramatic chord
- Kill streak: escalating chime sequence

### 10C — Ambient & Feedback

- Low HP heartbeat: pulsing bass at < 20% HP, increases tempo as HP drops
- Boss intro: dramatic stinger + name reveal sound
- Wave complete: victory fanfare (short)
- Death: somber tone + impact

### 10D — Dynamic Music (stretch goal)

- Layered music system: base ambient track + combat layer + boss layer
- Crossfade between layers based on game state
- Combat layer fades in when enemies are aggro'd, out when all dead

---

## Phase 11: Settings Menu

**Goal**: In-game settings for audio and video.

### UI

- **Settings button**: Gear icon on main menu + ESC during gameplay
- **Audio tab**:
  - Master volume slider (0-100%)
  - Music volume slider
  - SFX volume slider
  - Mute toggle
- **Video tab**:
  - Quality preset: Low / Medium / High
  - Post-processing toggle (bloom, vignette)
  - Shadow quality: Off / Low / High
  - Particle density: Low / Medium / High
  - Show FPS counter toggle
- **Controls tab**:
  - Key bindings display (read-only for now)
  - Mouse sensitivity slider
- **Persist to localStorage**

---

## Phase 12: Achievement System

**Goal**: 20 achievements with unlock tracking and notification UI.

### Achievement List

| # | Name | Description | Condition |
|---|------|-------------|-----------|
| 1 | First Blood | Kill your first enemy | 1 enemy killed |
| 2 | Warmed Up | Kill 10 enemies in a single run | 10 kills |
| 3 | Centurion | Kill 100 enemies in a single run | 100 kills |
| 4 | Untouchable | Complete a wave without taking damage | Wave clear, 0 damage taken |
| 5 | Boss Slayer | Defeat a boss | 1 boss killed |
| 6 | Hydra Hunter | Defeat the Hydra boss | Kill Hydra |
| 7 | Archmage's End | Defeat the Mage boss | Kill Mage boss |
| 8 | Combo Master | Land a 5-hit combo | 5 consecutive hits within combo window |
| 9 | Critical Streak | Land 3 critical hits in a row | 3 consecutive crits |
| 10 | Spell Collector | Have 9 spells at once | 9 spell slots filled |
| 11 | Elementalist | Cast each spell type at least once in a run | All 7 spells cast |
| 12 | Elite Crusher | Kill 10 elite enemies total | Lifetime 10 elite kills |
| 13 | Survivor | Reach wave 10 in survival mode | Wave 10 |
| 14 | Endurance | Survive for 5 minutes | 300s alive |
| 15 | Glass Cannon | Deal 1000 damage in a run without healing | 1000 dmg, 0 heal |
| 16 | No Spells Needed | Kill a boss using only sword attacks | Boss kill, 0 spells cast during fight |
| 17 | Demolition Expert | Kill 5 enemies with a single gravity well | 5 kills from one gravity well |
| 18 | Chain Lightning | Hit 4 enemies with one lightning chain | 4 targets in one chain |
| 19 | Speed Runner | Clear wave 5 in under 2 minutes | Wave 5, < 120s |
| 20 | Immortal | Complete 3 consecutive waves without dying | 3 waves, 0 deaths |

### Implementation

- **achievement.ts** (shared): Achievement definitions, condition checkers
- **achievement-tracker.ts** (game-logic): Process game events, check unlock conditions
- **AchievementStore** (Zustand): Track unlocked achievements, persist to localStorage
- **AchievementPopup** (UI): Toast notification sliding in from right when achievement unlocks — icon + name + description, auto-dismiss after 4s
- **AchievementPanel** (UI): Grid view accessible from main menu, locked/unlocked states, progress bars for count-based achievements

---

## Phase 13: Performance & Polish

**Goal**: Object pooling, spatial partitioning, gamepad support, mobile controls.

### 13A — Object Pooling

- Pool for enemies (pre-allocate 20, reuse on death/respawn)
- Pool for projectiles (pre-allocate 30)
- Pool for particles (already done for hit sparks / damage numbers — extend to all particle types)
- Pool for zone effects (pre-allocate 5)

### 13B — Spatial Partitioning

- Uniform grid (cell size ~200u for 2000x2000 arena = 10x10 grid)
- Insert all entities into grid cells based on position
- Collision checks only within same + adjacent cells
- Reduces O(n²) to ~O(n) for typical entity densities

### 13C — LOD System

- Distance-based detail reduction:
  - Near (<300u): Full detail, all particles, shadows
  - Mid (300-600u): Reduced particles, simpler geometry
  - Far (>600u): Billboard sprites, no particles

### 13D — Gamepad Support

- Left stick: movement (analog speed)
- Right stick: aim direction (replaces mouse)
- Right trigger: attack
- Left trigger: block/shield spell
- Bumpers: cycle spell slots
- Face buttons: dash (A), cast spell (X), interact/pickup (Y)
- Vibration feedback on hits, crits, damage taken

### 13E — Mobile Controls (stretch)

- Virtual joystick (left side): movement
- Virtual joystick (right side): aim
- Attack button (bottom right)
- Spell button row (top)
- Auto-targeting assist for mobile

---

## Implementation Order & Dependencies

```
Phase 1  (Spells + Drops)     ─── foundation for everything spell-related
Phase 2  (Critical Hits)       ─── independent, small scope
Phase 3  (Elite Modifiers)     ─── independent, builds on enemy system
Phase 4  (New Enemy Types)     ─── depends on Phase 3 (elites can apply to new types)
Phase 5  (Advanced AI)         ─── depends on Phase 4 (all enemy types need AI)
Phase 6  (Boss Expansion)      ─── depends on Phase 2 (crits), Phase 5 (telegraphs)
Phase 7  (Stats + Leaderboard) ─── depends on Phase 2-6 (needs all combat features to track)
Phase 8  (Co-op Mock UI)       ─── independent UI work
Phase 9  (Visual Effects)      ─── depends on Phase 1 (spell VFX), Phase 4 (spawn anim)
Phase 10 (Audio)               ─── depends on Phase 1-6 (needs all combat events)
Phase 11 (Settings)            ─── depends on Phase 10 (audio settings)
Phase 12 (Achievements)        ─── depends on Phase 1-7 (needs all features to define achievements)
Phase 13 (Performance)         ─── last, optimize what exists
```

**Recommended execution**: Phases 1→2→3→4→5→6 (core gameplay), then 7→8→9→10→11→12→13 (polish).

---

## Post-Implementation: Multiplayer Integration

> **CRITICAL NOTE**: After all features above are implemented, the next major milestone is Colyseus server integration. Key considerations:
> - All game-logic is already in pure TS (packages/game-logic) — this moves to server
> - Client becomes a dumb renderer that sends inputs and receives snapshots
> - Spell drops, combat stats, achievements need server-side validation
> - Co-op mock UI (Phase 8) gets wired to real lobby/room system
> - Leaderboard mock (Phase 7) gets wired to server-persisted scores
> - Enemy AI runs server-side only
> - Client prediction needed for responsive movement
> - Interpolation between server snapshots for smooth rendering
