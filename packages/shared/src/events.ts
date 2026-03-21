import type { EntityId, Vec2, BuffType, SpellId } from './types';

export type GameEvent =
  | { type: 'ATTACK_START'; playerId: EntityId; comboIndex: number }
  | {
      type: 'ATTACK_HIT';
      attackerId: EntityId;
      targetId: EntityId;
      damage: number;
      knockback: Vec2;
      isCritical: boolean;
    }
  | {
      type: 'DAMAGE_TAKEN';
      entityId: EntityId;
      amount: number;
      newHealth: number;
    }
  | {
      type: 'ENTITY_DIED';
      entityId: EntityId;
      entityType: 'player' | 'enemy' | 'boss';
    }
  | {
      type: 'ENTITY_SPAWNED';
      entityId: EntityId;
      entityType: 'enemy' | 'boss';
      position: Vec2;
    }
  | { type: 'BOSS_TELEGRAPH'; bossId: EntityId; targetPosition: Vec2 }
  | { type: 'BOSS_SLAM'; bossId: EntityId; position: Vec2; radius: number }
  | { type: 'BOSS_RESPAWN_TICK'; remainingSeconds: number }
  | {
      type: 'PROJECTILE_SPAWNED';
      projectileId: EntityId;
      ownerId: EntityId;
      position: Vec2;
      velocity: Vec2;
    }
  | {
      type: 'PROJECTILE_HIT';
      projectileId: EntityId;
      targetId: EntityId;
      damage: number;
      position: Vec2;
    }
  | { type: 'RESOURCE_DEPLETED'; playerId: EntityId; resource: 'stamina' | 'mana' }
  | { type: 'BUFF_APPLIED'; entityId: EntityId; buffType: BuffType; duration: number }
  | { type: 'BUFF_EXPIRED'; entityId: EntityId; buffType: BuffType }
  | { type: 'BURN_TICK'; entityId: EntityId; damage: number }
  | { type: 'DASHER_TELEGRAPH'; enemyId: EntityId; direction: Vec2; duration: number }
  | { type: 'DASHER_DASH_START'; enemyId: EntityId; direction: Vec2 }
  | { type: 'PLAYER_STUNNED'; playerId: EntityId; duration: number }
  | { type: 'SPELL_CAST'; playerId: EntityId; spellId: SpellId; direction: Vec2 }
  | { type: 'FIREBALL_EXPLOSION'; position: Vec2 }
  | { type: 'WAVE_START'; wave: number; enemyCount: number }
  | { type: 'WAVE_COMPLETE'; wave: number; nextWave: number }
  | { type: 'PLAYER_JOINED'; playerId: EntityId; name: string }
  | { type: 'PLAYER_LEFT'; playerId: EntityId }
  // --- Spell Drop events ---
  | { type: 'SPELL_DROPPED'; spellId: SpellId; position: Vec2 }
  | { type: 'SPELL_PICKED_UP'; playerId: EntityId; spellId: SpellId }
  | { type: 'SPELL_SLOT_FULL'; playerId: EntityId }
  // --- Shield events ---
  | { type: 'SHIELD_BLOCK'; entityId: EntityId; damageAbsorbed: number }
  | { type: 'SHIELD_BREAK'; entityId: EntityId }
  // --- Zone events ---
  | { type: 'ZONE_SPAWNED'; zoneId: EntityId; zoneType: string; position: Vec2; radius: number }
  | { type: 'ZONE_EXPIRED'; zoneId: EntityId }
  | { type: 'HEAL_TICK'; entityId: EntityId; amount: number }
  // --- Lightning chain ---
  | { type: 'LIGHTNING_CHAIN'; sourceId: EntityId; targetIds: EntityId[]; damage: number }
  // --- Ice lance ---
  | { type: 'ICE_LANCE_HIT'; targetId: EntityId; position: Vec2 }
  // --- Dungeon ---
  | { type: 'ROOM_ENTERED'; roomId: string }
  | { type: 'ROOM_CLEARED'; roomId: string }
  | { type: 'DOOR_LOCKED'; doorId: string }
  | { type: 'DOOR_UNLOCKED'; doorId: string }
  | { type: 'DUNGEON_COMPLETE' };
