# Game Description (Source of Truth)

## Core Identity
- Multiplayer browser-based top-down combat sandbox prototype
- Built with Three.js, React Three Fiber, Drei
- **"Simple systems, excellent sensation"**
- Feel > complexity. Always.

## Priority Stack (if time is limited)
1. Player movement feel
2. Cursor-facing feel
3. Sword slash feel
4. Trail readability
5. Hit confirmation
6. Camera follow
7. Camera shake
8. Hit flash
9. Enemy knockback
10. Boss slam telegraph + impact
11. Dissolve death polish
12. Fast name-entry-to-game flow

## Design Pillars
1. **Feel over complexity** — don't add complexity unless it improves feel
2. **Immediate clarity** — player understands everything instantly
3. **Strong combat juice** — combat feels way better than mechanics suggest
4. **Stylized simplicity** — primitive forms are a feature, not weakness
5. **Fast entry, low friction** — type name, get in
6. **Multiplayer presence** — seeing other named players makes world alive

## Player Experience Flow
1. Open website → immediately inside stylized 3D canvas
2. In-canvas landing: enter name, confirm
3. Scene transitions to combat arena
4. Blue character with name above head
5. Other players visible with names
6. WASD move, mouse aim, always face cursor
7. Left click = sword slash (cooldown, alternating combo)
8. 2 enemies always maintained by spawner
9. Enemy dies → dissolve → respawn 1s later
10. Boss exists as separate encounter
11. Enemies hurt players, players hurt enemies, players hurt players
12. Player death → "You Died" → restart → back to name entry

## Visual Direction
### Arena
- 2000x2000 units, invisible walls
- Dark ground: moody, cloudy/smoky, stylized, readable under effects
- Minimal clutter

### Characters (shared silhouette language)
- **Player**: blue cylinder body, circular hands, sword on LEFT hand, name above head
- **Enemy**: red cylinder, circular hands, no sword, health bar above head
- **Boss**: green, same shape family, 1.5x scale, visually distinct

## Camera System (CRITICAL)
- Slightly angled (~60-70° like LoL), NOT pure top-down
- Soft positional lag, floaty in a polished way
- Reacts to movement direction subtly
- Slash = light shake, boss slam = strong shake
- Never chaotic, never interferes with aiming

## Controls
- Desktop-first (WASD + mouse)
- Custom cursor (transparent circle with border)
- Movement direction ≠ facing direction (strafe while facing cursor)
- Left click = cooldown-based attack
- Speed reduced 1.4x while attacking (not fully rooted)

## Sword Combat
- Cooldown-based, alternating combo (left-to-right → right-to-left)
- Combo resets after 1.5s idle
- Sword clearly hand-attached (LEFT hand)
- Right hand animates during slash
- Trail determines hits (neutral white/silver)
- On hit: damage + emissive flash + knockback + camera shake + audio
- Sword damage is dynamic value (future-proof)

## Health & Damage
- Both players and enemies have health
- i-frames after taking hit (brief invulnerability)
- Player health regenerates slowly
- Local player: HUD health bar (top-left), no above-head bar
- Other players: names above heads only
- Enemies: health bars above heads
- PvP enabled — players can damage each other
- Multiple players can stack damage on same enemy

## Death
- Enemy: dissolve shader + particles → respawn 1s later
- Player: cylinder rotates to ground → delay → dissolve (visible to others)
- Player death → "You Died" → restart → name entry
- Boss: dissolve → world-visible respawn countdown timer

## What Must Stay Simple
- Enemy AI, progression, scoring, inventory, abilities
- Menus, stats, game modes, story, map complexity
- Loot, crafting, account systems
