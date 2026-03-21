import type { Vec2 } from './types';

export function vec2(x: number, z: number): Vec2 {
  return { x, z };
}

export const Vec2Zero: Vec2 = { x: 0, z: 0 };

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, z: v.z * s };
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.z * v.z);
}

export function vec2Normalize(v: Vec2): Vec2 {
  const len = vec2Length(v);
  if (len < 0.0001) return Vec2Zero;
  return { x: v.x / len, z: v.z / len };
}

export function vec2Distance(a: Vec2, b: Vec2): number {
  return vec2Length(vec2Sub(a, b));
}

export function vec2Dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z;
}

export function vec2Lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function vec2Angle(v: Vec2): number {
  return Math.atan2(v.x, v.z);
}

export function vec2FromAngle(angle: number): Vec2 {
  return { x: Math.sin(angle), z: Math.cos(angle) };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampVec2ToArena(
  pos: Vec2,
  halfWidth: number,
  halfHeight: number,
  entityRadius: number
): Vec2 {
  return {
    x: clamp(pos.x, -halfWidth + entityRadius, halfWidth - entityRadius),
    z: clamp(pos.z, -halfHeight + entityRadius, halfHeight - entityRadius),
  };
}

export function angleDifference(a: number, b: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDifference(a, b) * t;
}

export function randomizeDamage(base: number, variance: number): number {
  const min = base * (1 - variance);
  const max = base * (1 + variance);
  return Math.round(min + Math.random() * (max - min));
}
