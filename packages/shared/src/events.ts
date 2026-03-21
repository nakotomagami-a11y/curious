import type { EntityId, Vec2 } from './types';

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
  | { type: 'PLAYER_JOINED'; playerId: EntityId; name: string }
  | { type: 'PLAYER_LEFT'; playerId: EntityId };
