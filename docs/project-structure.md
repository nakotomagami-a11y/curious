# Project Structure Reference

```
curious/
├── pnpm-workspace.yaml
├── package.json                    # Root: dev, build, lint scripts
├── tsconfig.base.json
├── docs/                           # Architecture & design docs
│
├── apps/
│   ├── web/                        # Next.js + R3F client
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # Mounts <Game />
│   │   ├── src/
│   │   │   ├── game/
│   │   │   │   ├── Game.tsx                # Canvas + scene router (JSX only)
│   │   │   │   ├── scenes/
│   │   │   │   │   ├── LandingScene.tsx
│   │   │   │   │   ├── CombatScene.tsx
│   │   │   │   │   └── DeathScene.tsx
│   │   │   │   ├── entities/
│   │   │   │   │   ├── PlayerPresentation.tsx     # JSX only
│   │   │   │   │   ├── RemotePlayerPresentation.tsx
│   │   │   │   │   ├── EnemyPresentation.tsx
│   │   │   │   │   ├── BossPresentation.tsx
│   │   │   │   │   ├── SwordPresentation.tsx
│   │   │   │   │   └── GroundPlane.tsx
│   │   │   │   ├── camera/
│   │   │   │   │   ├── CameraRig.tsx              # JSX only
│   │   │   │   │   └── camera-controller.ts       # Pure math logic
│   │   │   │   ├── vfx/
│   │   │   │   │   ├── VFXLayer.tsx
│   │   │   │   │   ├── SwordTrail.tsx
│   │   │   │   │   ├── HitFlash.tsx
│   │   │   │   │   ├── DissolveShader.tsx
│   │   │   │   │   ├── DeathParticles.tsx
│   │   │   │   │   ├── SlamIndicator.tsx
│   │   │   │   │   └── feedback-system.ts         # Event dispatcher (no JSX)
│   │   │   │   ├── ui/
│   │   │   │   │   ├── InWorldUI.tsx
│   │   │   │   │   ├── PlayerHUD.tsx
│   │   │   │   │   └── CustomCursor.tsx
│   │   │   │   ├── input/
│   │   │   │   │   ├── InputManager.ts            # Logic only
│   │   │   │   │   └── input-store.ts
│   │   │   │   ├── hooks/                         # Shared custom hooks
│   │   │   │   │   ├── useGameLoop.ts
│   │   │   │   │   ├── useEntityState.ts
│   │   │   │   │   └── useInput.ts
│   │   │   │   ├── audio/
│   │   │   │   │   ├── AudioSystem.ts
│   │   │   │   │   └── sounds.ts
│   │   │   │   └── shaders/
│   │   │   │       ├── dissolve.vert
│   │   │   │       ├── dissolve.frag
│   │   │   │       └── ground.frag
│   │   │   ├── network/
│   │   │   │   ├── network-client.ts
│   │   │   │   ├── network-store.ts
│   │   │   │   └── state-sync.ts
│   │   │   ├── stores/
│   │   │   │   ├── app-store.ts
│   │   │   │   ├── game-store.ts
│   │   │   │   └── event-bus.ts
│   │   │   └── simulation/
│   │   │       └── client-simulation.ts
│   │   ├── public/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── server/                     # Colyseus game server (Phase 11)
│       ├── src/
│       │   ├── index.ts
│       │   ├── rooms/
│       │   │   └── ArenaRoom.ts
│       │   ├── simulation/
│       │   │   ├── server-simulation.ts
│       │   │   ├── systems/
│       │   │   │   ├── movement-system.ts
│       │   │   │   ├── combat-system.ts
│       │   │   │   ├── enemy-ai-system.ts
│       │   │   │   ├── boss-ai-system.ts
│       │   │   │   ├── health-system.ts
│       │   │   │   ├── knockback-system.ts
│       │   │   │   ├── spawn-system.ts
│       │   │   │   └── cleanup-system.ts
│       │   │   └── collision.ts
│       │   ├── schema/
│       │   │   └── ArenaState.ts
│       │   └── config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                     # Types, constants, math (client + server)
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   ├── math.ts
│   │   │   ├── events.ts
│   │   │   └── validation.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── game-logic/                 # Pure simulation (no framework deps)
│       ├── src/
│       │   ├── combat.ts
│       │   ├── collision.ts
│       │   ├── knockback.ts
│       │   ├── health.ts
│       │   ├── enemy-behavior.ts
│       │   ├── boss-behavior.ts
│       │   └── spawning.ts
│       ├── package.json
│       └── tsconfig.json
│
└── tools/
```

## Package Dependencies
```
apps/web       → packages/shared, packages/game-logic
apps/server    → packages/shared, packages/game-logic
packages/game-logic → packages/shared
packages/shared → (no internal deps)
```

## Code Organization Rules
- JSX files = visual rendering ONLY
- Logic, hooks, functions = separate .ts files
- Stores = pure Zustand, no JSX
- Presentation components receive IDs, read from store
- useFrame updates use refs, not setState
```
