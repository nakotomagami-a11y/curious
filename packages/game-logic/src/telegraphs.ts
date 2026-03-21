/**
 * Telegraph indicator data for enemy attack types.
 * Pure data module — no rendering logic.
 */

import type { EnemyType, Vec2 } from '@curious/shared';
import { vec2Sub, vec2Normalize, vec2Angle, vec2Distance } from '@curious/shared';
import {
  ENEMY_ATTACK_RANGE,
  SHIELDER_ATTACK_RANGE,
  CASTER_ATTACK_RANGE,
  BOMBER_EXPLODE_RADIUS,
  TELEPORTER_BLINK_RANGE,
} from '@curious/shared';

export type TelegraphShape = 'cone' | 'line' | 'circle';

export type TelegraphData = {
  type: TelegraphShape;
  position: Vec2;
  direction: number;   // angle in radians
  angle: number;       // arc width in radians (for cones)
  range: number;       // distance/radius
  duration: number;    // seconds the telegraph is visible
};

const DEG_TO_RAD = Math.PI / 180;

/**
 * Return telegraph shape data describing how an enemy's upcoming attack
 * should be visualised (by a renderer consuming this data).
 */
export function getAttackTelegraph(
  enemyType: EnemyType,
  position: Vec2,
  rotation: number,
  targetPos: Vec2,
): TelegraphData {
  const toTarget = vec2Sub(targetPos, position);
  const dir = vec2Angle(vec2Normalize(toTarget));

  switch (enemyType) {
    // Melee: 0.3s cone telegraph (60° arc, 80u range) before punch
    case 'melee':
      return {
        type: 'cone',
        position,
        direction: dir,
        angle: 60 * DEG_TO_RAD,
        range: 80,
        duration: 0.3,
      };

    // Caster: line preview toward target before projectile
    case 'caster':
      return {
        type: 'line',
        position,
        direction: dir,
        angle: 0,
        range: CASTER_ATTACK_RANGE,
        duration: 0.6,
      };

    // Dasher: ground line already handled — return data for consistency
    case 'dasher':
      return {
        type: 'line',
        position,
        direction: dir,
        angle: 0,
        range: vec2Distance(position, targetPos),
        duration: 0.8,
      };

    // Shielder: small cone telegraph before punch
    case 'shielder':
      return {
        type: 'cone',
        position,
        direction: dir,
        angle: 40 * DEG_TO_RAD,
        range: SHIELDER_ATTACK_RANGE + 20,
        duration: 0.3,
      };

    // Bomber: pulsing circle at current position showing explosion radius
    case 'bomber':
      return {
        type: 'circle',
        position,
        direction: 0,
        angle: 0,
        range: BOMBER_EXPLODE_RADIUS,
        duration: 1.0,
      };

    // Teleporter: circle at blink destination
    case 'teleporter': {
      const dist = vec2Distance(position, targetPos);
      const blinkDist = Math.min(dist, TELEPORTER_BLINK_RANGE);
      const normDir = vec2Normalize(toTarget);
      const blinkDest: Vec2 = {
        x: position.x + normDir.x * blinkDist,
        z: position.z + normDir.z * blinkDist,
      };
      return {
        type: 'circle',
        position: blinkDest,
        direction: 0,
        angle: 0,
        range: 30,
        duration: 0.3,
      };
    }

    // Summoner / healer: no offensive telegraph — return a small circle indicator
    case 'summoner':
    case 'healer':
      return {
        type: 'circle',
        position,
        direction: 0,
        angle: 0,
        range: 40,
        duration: 0.5,
      };

    default:
      return {
        type: 'cone',
        position,
        direction: dir,
        angle: 60 * DEG_TO_RAD,
        range: ENEMY_ATTACK_RANGE + 30,
        duration: 0.3,
      };
  }
}
