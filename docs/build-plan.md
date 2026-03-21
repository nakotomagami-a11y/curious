# Build Plan (14 Phases)

## Workflow Rule
Stop after each phase. Test. Get approval. Only then proceed.

## Phase Order
foundation → game flow → simulation core → local player/camera → character presentation → player combat → enemies → spawner loop → death/dissolve → boss → audio → multiplayer → UI/readability → juice → cleanup/perf

---

## Phase 0 — Project Foundation ✓
- [x] Create frontend app (Next.js + R3F + Drei)
- [ ] Create server app (Colyseus) — deferred to Phase 11
- [x] Create shared packages (types, constants, math)
- [x] Define folder structure
- [x] Define naming conventions
- [x] Define state boundaries (app/simulation/network/presentation)
- [x] Build minimum scene shell (Canvas, camera rig shell, lighting, dark ground, arena bounds)
- [x] Define core constants
- **Deliverable**: clean structure, scene shell running, dark arena visible

## Phase 1 — Game Flow Shell ✓
- [x] Implement FSM: landing → combat → dead → restart
- [x] Build landing scene inside canvas (name input, "drop in" action, transition)
- [x] Build death/restart shell ("You Died", restart button, clean state reset)
- **Deliverable**: full flow loop works (open → name → arena → death → restart)

## Phase 2 — Core Simulation Foundation ✓
- [x] Entity model with shared fields (PlayerSnapshot from shared/types)
- [x] Simulation tick/update pattern on XZ plane (tickWorld with dt cap)
- [x] Event emission model (world.events array, eventBus singleton)
- [x] Collision primitives (circle-circle overlap, penetration, separation)
- [x] Simulation-to-render snapshot shape (SimWorld → Zustand game-store per frame)
- **Deliverable**: world update loop, planar entity logic, collision helpers, snapshots

## Phase 3 — Local Player + Camera Feel ✓
- [x] Input system (WASD keyboard tracking, mouse→XZ projection, mouse down/up)
- [x] Player movement (normalized diagonal, speed × dt, boundary clamp)
- [x] Cursor-facing rotation (mouse world pos → aim angle → player Y rotation)
- [x] Camera rig (65° angle, soft exponential lag, directional look-ahead)
- [x] Tested movement + camera together (WASD, diagonal, camera follow)
- [ ] Attack input, custom cursor, accel/decel smoothing, shake system — deferred to combat phases
- **Deliverable**: player moves well, faces cursor, feels good under camera

## Phase 4 — Character Presentation Rigs ✓
- [x] Player visual: blue cylinder, circle hands, sword on LEFT hand, name anchor
- [x] Enemy visual: red cylinder, circle hands, health bar above head
- [x] Boss visual: green, 1.5x scale, health bar
- [x] Idle sway on all rigs (body bob, hand counter-sway)
- [ ] Punch support, attack offsets, flash, dissolve, knockback — deferred to combat/death phases
- **Deliverable**: all unit types visible with correct identity

## Phase 5 — Player Combat System ✓
- [x] Attack state machine (idle → active → cooldown, combo L/R alternation, 1.5s reset)
- [x] Sword slash animation (LEFT hand pivot + RIGHT hand follow-through at 40%)
- [x] Arc-based hit detection (range + angle check, once per target per attack via Set)
- [x] Hit result pipeline (damage 25, knockback, white flash, i-frames 0.3s)
- [x] Boss hit with 0.5x knockback resistance
- [x] Dying → dead transition via dissolveProgress timer
- [x] Boss timer/knockback tick in simulation
- [x] Sword trail visual (ribbon mesh, additive blending, auto-fade)
- [x] Camera shake on successful hit (store-driven, random XZ offset, decay)
- [ ] Sound — deferred to audio phase
- **Deliverable**: combat loop works — slash, trail, hit, damage, knockback, shake, death

## Phase 6 — Enemy AI + Combat ✓
- [x] Enemy simulation (idle/chase/attack/dead, target selection, leash/aggro range)
- [x] Chase behavior (nearest target, simple pursuit, slower than player, no jitter)
- [x] Punch attack (hand extend, timing, short-range hit, damage + i-frames)
- [x] Enemy health + health bars (above-head, hide on death/full health)
- [x] Enemy hit reaction (flash, knockback — from Phase 5 combat system)
- [x] Player hit flash + death from enemy damage
- **Deliverable**: working enemies, chase, punch, health, bidirectional combat

## Phase 7 — Enemy Spawner Loop ✓
- [x] Regular spawner (spawn 2, track active, respawn 1s after death)
- [x] Respawn handling (clean reset, avoid doubles)
- [x] Tune sandbox density (MIN_SPAWN_DIST_FROM_PLAYER=300, SPAWN_MARGIN=100)
- **Deliverable**: kill → dissolve → respawn 1s → constant sandbox

## Phase 8 — Death, Dissolve, Particles ✓
- [x] Enemy death flow (dying state, disable AI, dissolve, delay removal)
- [x] Dissolve shader (noise mask, edge glow, fragment discard via custom ShaderMaterial)
- [x] Death particles (burst, color-matched: red/green/blue per entity type)
- [x] Player death (tilt forward 0.3s → pause 0.5s → dissolve 0.5s → dead)
- [x] Player death screen + restart flow
- **Deliverable**: enemies die cleanly, player death completes loop

## Phase 9 — Boss System ✓
- [x] Boss AI state machine (idle/chase/telegraph/jump/slam/recover)
- [x] Slam telegraph (red ground circle indicator, pulsing during telegraph)
- [x] Jump + slam (lerp to target, sin arc Y, AoE 35 damage, knockback 200)
- [x] Recovery (1.5s pause, then resumes chase)
- [x] Boss respawn (10s countdown after death, floating number, full reset)
- [x] Camera shake on slam (1.5x stronger than sword hit)
- [x] Boss rig: jump Y arc, squash on landing
- **Deliverable**: second combat texture, memorable slam, respawn timer

## Phase 10 — Audio System ✓
- [x] Audio event layer (central trigger, event → sound mapping)
- [x] Core sounds (slash, hit, punch, hurt, death, boss telegraph, slam, UI, ambience)
- [x] Tune mix
- **Deliverable**: game feels significantly more real

## Phase 11 — Multiplayer
- [ ] Create Colyseus server app
- [ ] Session model (guest join, temp identity, room)
- [ ] Sync player presence (connect/disconnect, names, positions)
- [ ] Authority model (client prediction movement, server authority everything else)
- [ ] Sync combat (attacks, hits, deaths, spawns, boss)
- [ ] Multiplayer smoothing (interpolation, correction)
- [ ] PvP damage
- **Deliverable**: named players in arena, synced combat, PvP

## Phase 12 — UI / Readability Pass ✓
- [x] Other player names (above-head, readable)
- [x] Enemy health bars polish (billboard facing camera)
- [x] Boss readability (screen-space health bar, removed 3D bar)
- [x] Landing + death polish
- [x] Local player HUD (top-left health bar)
- [x] Removed debug die button
- **Deliverable**: immediately readable for first-time player

## Phase 13 — Feel / Juice Pass (NOT OPTIONAL) ✓
- [x] Camera juice (slash impulse, hit bump, boss shake, drift)
- [x] Combat juice (trail, flash curve, knockback tilt, hit sparks, sound alignment)
- [x] Motion polish (body lean on movement, knockback recoil, boss bounce weight)
- [x] Scene polish (grid ground shader, warm/cool lighting, fog atmosphere)
- **Deliverable**: prototype feels premium

## Phase 14 — Stability / Cleanup / Performance ✓
- [x] Architecture cleanup (removed DEBUG window exposures)
- [x] Performance pass (geometry memoization, counter resets)
- [x] Edge cases (page visibility/blur input clearing)
- [x] Final polish (verify full flow end-to-end)
- **Deliverable**: stable prototype

## Phase 15 — Visual & Gameplay Upgrade ✓
- [x] Post-processing (EffectComposer, Bloom, Vignette, ACES Filmic tone mapping)
- [x] Lighting & shadows (2048 shadow map, shadow camera bounds, warm key + cool ambient/fill)
- [x] Ground dark-cloud effect (FBM noise, animated drift, atmospheric darkening)
- [x] Capsule migration (CapsuleGeometry for player, enemy, boss bodies)
- [x] Billboard nameplates/health bars (verified, Y offsets adjusted)
- [x] Enemy AI spacing (stop distance 80u, separation force between enemies)
- [x] Hit feedback polish (hitstop 50ms, stronger knockback tilt, scale squash on enemies)
- [x] Camera zoom (height 450→350, angle 65°→60°, tighter framing)
- [x] Camera feel (trauma-based shake, differentiated per event type, aim lead, tighter follow)
- **Deliverable**: premium indie action game feel
