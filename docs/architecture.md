# Architecture Deep Reference

## Layer Diagram
```
┌─────────────────────────────────────┐
│  Rendering Layer (R3F / Three.js)   │  Reads state, never mutates
├─────────────────────────────────────┤
│  Game Simulation Layer (pure TS)    │  Owns all gameplay logic
├─────────────────────────────────────┤
│  Network Layer (Colyseus)           │  Syncs authoritative state
└─────────────────────────────────────┘
```

## Store Architecture (Zustand)
| Store | Purpose | Lifetime |
|---|---|---|
| `app-store` | FSM state (landing/joining/combat/dead), playerName, loading | Persists across room joins |
| `game-store` | Entity snapshots (players, enemies, boss), local prediction state, combo | Cleared on room leave |
| `network-store` | Connection status, room ref, latency, sessionId | Tied to connection |
| `input-store` | Current WASD, mouse world position, mouse buttons | Always active |

## App FSM Flow
```
BOOTING → LANDING → JOINING → IN_GAME → DEAD → RESTARTING → LANDING
```
- Canvas is ALWAYS mounted (never unmount/remount — prevents WebGL context loss)
- Scene transitions = swapping which scene component renders inside Canvas

## Server Simulation Loop (20Hz / 50ms tick)
```
1. processInputs()      — queued player inputs → movement
2. updateEnemyAI()      — chase/attack state machines
3. updateBossAI()       — idle/telegraph/jump/slam/recover
4. updateCombat()       — active attacks, hit arc generation
5. resolveCollisions()  — entity-entity, entity-boundary
6. resolveHits()        — arc-circle, circle-circle intersection
7. applyDamage()        — from resolved hits
8. applyKnockback()     — apply + decay knockback velocities
9. checkDeaths()        — mark dead, start death timers
10. updateSpawns()      — respawn timers, spawn new entities
11. broadcastState()    — Colyseus auto-syncs schema changes
```

## Client Frame Loop (60fps via requestAnimationFrame)
```
1. readInput()           — sample WASD + mouse
2. predictMovement()     — apply input to local player immediately
3. interpolateRemote()   — lerp remote entities toward server snapshot
4. updateVisuals()       — R3F re-renders from store
5. updateFeedback()      — process event queue for VFX/audio/camera
```

## Collision Model (all XZ plane)
- All entities = circles with radius (player: 30, enemy: 30, boss: 45)
- Sword hit = arc sector (origin: player pos, reach: sword length ~60, sweep: ~120°)
- Arc-circle test: (1) is enemy center within reach? (2) is angle within arc range? → hit
- Punch = small circle in front of enemy, circle-circle overlap
- Boss slam = circle AoE at landing position
- Arena bounds = AABB clamp (2000x2000), invisible walls

## Knockback Formula
```
On hit:
  knockbackDir = normalize(target.pos - source.pos)
  target.knockbackVelocity = knockbackDir * knockbackStrength
Each tick:
  entity.pos += entity.knockbackVelocity * dt
  entity.knockbackVelocity *= 0.85
  if length < 0.01 → zero out
```

## R3F Rendering Patterns
- ONE presentation component per entity type
- JSX is purely visual — logic/hooks in separate files
- Position/rotation updates via useFrame + refs (NOT React state)
- React re-renders only for structural changes (add/remove entity, scene swap)
- Feedback system maps GameEvents → camera shake + particles + flash + audio

## Camera System
```
CameraRig layers (additive):
  Base target    → player position
  Lag            → lerp(current, target, 1 - pow(lagFactor, dt))
  Shake          → sum of active ShakeInstances (intensity * decay^elapsed * sin/cos)
  Look-ahead     → normalize(cursor - player) * lookAheadDistance
  Final          → sum of all layers → camera transform

Angle: ~60-70° (LoL-style), NOT pure top-down
```

### Shake Presets
| Event | Intensity | Decay | Frequency |
|---|---|---|---|
| Sword hit | 2.0 | 0.05 | 30 |
| Player damaged | 3.0 | 0.03 | 25 |
| Enemy death | 1.5 | 0.1 | 20 |
| Boss slam | 8.0 | 0.02 | 15 |

## Hitstop (CLIENT-ONLY)
- On significant hits: set hitstopTimer = 0.05s
- Client simulation skips position updates while timer > 0
- Server simulation never pauses

## Sword Slash / Combo
- LEFT hand holds sword
- Combo alternates: index 0 = left-to-right, index 1 = right-to-left
- Combo resets after 1.5s idle
- Speed reduced by 1.4x while attacking
- Arc sweeps over ~200ms with ease-out-back
- Trail = ribbon mesh, neutral white/silver, additive blend
- Trail geometry doubles as hit detection arc

## Network Sync Strategy
| System | Rate | Strategy |
|---|---|---|
| Movement | 20Hz broadcast | Client predicts at 60fps, reconciles at 20Hz via lerp |
| Aim/rotation | 20Hz | Client sends, server relays, others interpolate |
| Attacks | Event-based | Client sends attack msg, server processes next tick |
| Health | Event-based | Server broadcasts damage + new health |
| Enemies | 20Hz | Server broadcasts, clients interpolate |
| Boss | Events + 20Hz pos | State transitions = events, position interpolated |

## UI Strategy
| Element | Implementation | Reason |
|---|---|---|
| Name entry input | Drei Html (DOM in canvas) | Real input element needed |
| Death screen buttons | Drei Html | Real button clicks |
| Other player names | Drei Billboard + Text | In-world labels |
| Enemy health bars | Billboard + colored quads | In-world |
| Local player health | DOM overlay (top-left HUD) | Crisper, simpler |
| Custom cursor | CSS (cursor:none + circle div with border) | Zero latency |
| Boss respawn timer | In-world at spawn location | World-visible countdown |
