# Curious — Combat Sandbox

A top-down multiplayer browser combat arena built with Three.js and React. Fight waves of enemies, collect spell drops, defeat bosses, and climb the leaderboard.

![Status](https://img.shields.io/badge/status-prototype-orange)
![Tech](https://img.shields.io/badge/stack-Next.js%20%2B%20Three.js%20%2B%20Supabase-blue)

## Gameplay

- **WASD** movement with mouse aim — strafe freely while facing your cursor
- **Space** to attack with sword combos (alternating left/right slashes)
- **Shift** to dash — brief burst of speed with i-frames
- **1-9** to cast spells from your inventory
- Kill enemies to collect spell drops (20% chance per kill, single-use)
- Survive waves of increasingly difficult enemies in Survival mode
- Dev Playground for sandbox testing with infinite resources

## Features

### Combat
- Sword combo system with knockback, hit-stop, and camera shake
- 7 spell types: Fireball, Ice Lance (piercing), Lightning Chain (bounces between enemies), Heal Circle (AoE regen), Shield Bubble (blocks projectiles), Gravity Well (pulls + DPS), Block Shield (personal damage absorb)
- Critical hit system — 15% base, +30% backstab bonus, guaranteed during enemy telegraphs
- Spell drop pickups — up to 9 spell slots, dropped by enemies on death

### Enemies (8 types)
| Type | Behavior |
|------|----------|
| **Melee** | Chases and punches at close range |
| **Caster** | Maintains distance, fires projectiles |
| **Dasher** | Telegraphs then dashes through at high speed |
| **Shielder** | Frontal shield blocks damage, must be flanked |
| **Summoner** | Stays back, spawns minion waves |
| **Bomber** | Rushes player, explodes on contact or timer |
| **Teleporter** | Blinks around the arena, attacks after teleporting |
| **Healer** | Heals lowest-HP ally, flees from player |

### Elite Modifiers
15% of enemies spawn as elites with 1-2 random modifiers:
- **Vampiric** — heals 20% of damage dealt
- **Thorns** — reflects 30% damage to attacker
- **Haste** — 2x movement and attack speed
- **Giant** — 1.8x scale, 2x HP, 1.5x damage
- **Shielded** — 50% damage reduction from frontal attacks
- **Berserker** — below 30% HP: 2x damage, 1.5x speed

### Bosses (3 types)
- **Guardian** — slam attack with jump arc and AoE knockback
- **Hydra** — multi-head bite, attacks scale with phase
- **Mage** — teleports, fires projectile spreads, bullet-hell spiral bursts

All bosses have a 3-phase system (50% / 25% HP thresholds) with increasing speed and damage, plus rage mode at 20% HP.

### Game Modes
- **Dev Playground** — infinite health/mana/stamina, all spells, sandbox
- **Survival Waves** — progressive enemy waves with scaling difficulty, mega boss at wave 5
- **Co-op Survival** — 2-4 player rooms via Supabase Realtime (host-authoritative)

### Polish
- Post-processing (bloom, vignette, ACES tone mapping)
- Dissolve shader on death with particle burst
- Camera shake, hit-stop, damage numbers (with crit callouts)
- Lightning chain VFX with jagged bolts and side branches
- Footstep dust, low-HP vignette, kill streak overlays
- Procedural audio — all sounds synthesized via Web Audio API
- 20 achievements with toast notifications
- Leaderboard persisted to Supabase
- Settings menu (audio/video/controls) with ESC toggle
- Gamepad support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, static export) |
| Rendering | Three.js + React Three Fiber + Drei |
| State | Zustand |
| Game Logic | Pure TypeScript (no framework deps) |
| Backend | Supabase (Realtime + Postgres) |
| Language | TypeScript 5.7 |

## Project Structure

```
curious/
├── apps/web/                     # Next.js client
│   ├── app/                      # Pages
│   └── src/
│       ├── input/                # Keyboard, mouse, gamepad
│       ├── lib/                  # Stores (Zustand), services, Supabase client
│       └── modules/
│           ├── Audio/            # Procedural sound synthesis
│           ├── Boss/             # Boss rendering
│           ├── Camera/           # Camera rig with shake
│           ├── Combat/           # Scene, simulation loop, hooks
│           ├── Effects/          # VFX (particles, lightning, dust, zones)
│           ├── Enemy/            # Enemy rendering
│           ├── HUD/              # UI overlays (health, spells, settings, achievements)
│           ├── Player/           # Player rendering + input
│           └── World/            # Game scene, ground, router
├── packages/
│   ├── shared/                   # Types, constants, events, math, achievements
│   └── game-logic/               # Pure simulation (no rendering)
│       └── src/
│           ├── ai/               # Enemy + boss AI (14 files)
│           ├── combat/           # Damage, crits, projectiles, collision
│           ├── entities/         # Player, enemy, boss, buffs, elite modifiers
│           ├── spells/           # Spell casting, drops, zones
│           ├── spawning/         # Enemy spawner, survival waves
│           ├── stats/            # Combat stats tracking
│           └── utils/            # Object pool, spatial grid
├── supabase/                     # DB schema
└── docs/                         # Design docs
```

## Getting Started

```bash
# Install dependencies
yarn install

# Set up environment
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with your Supabase credentials:
#   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Run the Supabase schema (requires supabase CLI linked)
# Or paste supabase/schema.sql into the Supabase SQL Editor

# Start dev server
yarn workspace @curious/web dev

# Open http://localhost:3000/lab/curious
```

## Architecture

The game logic is fully separated from rendering:

- **`packages/game-logic`** — pure TypeScript simulation. Runs `tickWorld()` at 60fps, handles all combat, AI, physics, and spawning. No React, no Three.js — could run on a server.
- **`packages/shared`** — types, constants, events, math utilities shared between logic and rendering.
- **`apps/web`** — React Three Fiber client. Reads game state snapshots from Zustand stores and renders them. Input is captured and fed into the simulation each frame.

### Multiplayer

Co-op uses Supabase Realtime broadcast channels:
- **Host** runs the full simulation and broadcasts world snapshots at ~10Hz
- **Clients** send input (movement, aim, attack) via broadcast
- **Host** processes remote inputs and includes them in the simulation
- **Presence** tracks room membership, ready state, and host designation
- Room sessions stored in `game_sessions` table for discovery

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| Mouse | Aim |
| Space | Attack (sword) |
| Shift | Dash |
| 1-9 | Cast spell in slot |
| ESC | Settings |
| Gamepad Left Stick | Move |
| Gamepad Right Stick | Aim |
| RT | Attack |
| A | Dash |
| X | Cast spell |
