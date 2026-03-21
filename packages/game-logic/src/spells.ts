import type { PlayerSnapshot, SpellId, GameEvent, Vec2 } from '@curious/shared';
import {
  FIREBALL_COOLDOWN,
  FIREBALL_MANA_COST,
  FIREBALL_SPEED,
  FIREBALL_RADIUS,
  FIREBALL_DAMAGE,
  FIREBALL_LIFETIME,
  PLAYER_RADIUS,
} from '@curious/shared';
import { vec2Normalize, vec2Scale, vec2Add, vec2Length } from '@curious/shared';
import type { SimWorld } from './simulation';
import { generateEntityId } from './simulation';

export function tryCastSpell(
  player: PlayerSnapshot,
  spellSlot: number,
  aimDirection: Vec2,
  world: SimWorld,
): GameEvent[] {
  const spellId = getSpellForSlot(spellSlot);
  if (!spellId) return [];

  switch (spellId) {
    case 'fireball':
      return tryCastFireball(player, aimDirection, world);
    default:
      return [];
  }
}

function getSpellForSlot(slot: number): SpellId | null {
  switch (slot) {
    case 0: return 'fireball';
    default: return null;
  }
}

function tryCastFireball(
  player: PlayerSnapshot,
  aimDirection: Vec2,
  world: SimWorld,
): GameEvent[] {
  if (player.state !== 'alive') return [];
  if (player.stunTimer > 0) return [];
  if (player.mana < FIREBALL_MANA_COST) return [];

  const cooldown = player.spellCooldowns['fireball'] ?? 0;
  if (cooldown > 0) return [];

  if (vec2Length(aimDirection) < 0.01) return [];

  // Deduct mana and set cooldown
  player.mana -= FIREBALL_MANA_COST;
  player.spellCooldowns['fireball'] = FIREBALL_COOLDOWN;

  // Spawn projectile
  const dir = vec2Normalize(aimDirection);
  const spawnPos = vec2Add(player.position, vec2Scale(dir, PLAYER_RADIUS + 5));
  const velocity = vec2Scale(dir, FIREBALL_SPEED);

  const projId = generateEntityId('fireball');
  world.projectiles.set(projId, {
    id: projId,
    ownerId: player.id,
    ownerType: 'player',
    position: { ...spawnPos },
    velocity: { ...velocity },
    radius: FIREBALL_RADIUS,
    damage: FIREBALL_DAMAGE,
    lifetime: FIREBALL_LIFETIME,
    isFireball: true,
  });

  return [
    {
      type: 'SPELL_CAST',
      playerId: player.id,
      spellId: 'fireball',
      direction: { ...dir },
    },
    {
      type: 'PROJECTILE_SPAWNED',
      projectileId: projId,
      ownerId: player.id,
      position: { ...spawnPos },
      velocity: { ...velocity },
    },
  ];
}
