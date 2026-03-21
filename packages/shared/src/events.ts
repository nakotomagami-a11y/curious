import type { EntityId, Vec2, BuffType, SpellId } from './types';

export type GameEvent =
  | { type: 'ATTACK_START'; playerId: EntityId; comboIndex: number }
  | {
      type: 'ATTACK_HIT';
      attackerId: EntityId;
      targetId: EntityId;
      damage: number;
      knockback: Vec2;
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
  | { type: 'PLAYER_LEFT'; playerId: EntityId };
