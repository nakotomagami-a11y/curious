# Confirmed Design Decisions

All decisions confirmed by user. Reference this before implementing any system.

## Arena & World
- **Arena size**: 2000x2000 units (small, tight, constant encounters)
- **Boundaries**: invisible walls (AABB clamp, no visual barrier)
- **Camera angle**: slightly angled like League of Legends (~60-70°), NOT pure 90° top-down
- **Ground**: dark, moody, cloudy/smoky, stylized

## Player Character
- **Sword hand**: LEFT hand holds sword
- **Right hand**: animates during slash (recoil/follow-through)
- **Speed while attacking**: reduced by 1.4x (speed / 1.4)
- **Combo reset**: resets to slash 1 after 1.5s of no attacks
- **Health regen**: slow passive regeneration
- **Health bar**: HUD only (top-left corner), NO above-head bar for local player
- **Death animation**: cylinder rotates down to ground → delay → dissolve effect
- **Death visibility**: other players see the death animation + dissolve

## Other Players (Multiplayer)
- **Names**: displayed above heads
- **Visual treatment**: treated as a different enemy type (not ally)
- **Health bars**: NOT shown above their heads (just names)
- **PvP**: enabled — players CAN damage each other

## Combat
- **Hit detection**: sword trail / arc determines hits
- **Multi-hit**: multiple players can hit same enemy simultaneously (stacking damage)
- **i-frames**: brief invulnerability after taking a hit (prevents instant multi-frame kills)
- **Sword damage**: dynamic value (stored as property, future-proof for different weapons)
- **Trail color**: neutral white/silver

## Enemies
- **Aggro behavior**: leash/aggro range (stop chasing if player runs too far)
- **Count**: spawner maintains 2 active, architecture supports up to 10
- **Respawn**: 1 second after dissolve completes

## Boss
- **Size**: 1.5x regular enemy scale
- **Respawn**: YES, with longer timer than regular enemies
- **Respawn display**: world-visible countdown timer at boss spawn location
- **Slam**: telegraphed ground indicator → jump → area damage

## UI / Visual
- **Custom cursor**: transparent circle with border (not crosshair, not dot)
- **Local player HUD**: health bar at top-left corner
- **Other player labels**: name above head only (no health bar)
- **Enemy labels**: health bar above head (no name)
- **Player list/count**: not needed — seeing characters in arena is enough

## Code Patterns
- **JSX = visual only**: separate files for hooks, functions, logic
- **Testing workflow**: stop after each phase, test, approve before next phase
