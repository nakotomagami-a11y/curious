import type { Vec2 } from '@curious/shared';
import { vec2Distance, vec2Sub, vec2Normalize, vec2Scale } from '@curious/shared';

export type Circle = {
  position: Vec2;
  radius: number;
};

/** Check if two circles overlap */
export function circlesOverlap(a: Circle, b: Circle): boolean {
  return vec2Distance(a.position, b.position) < a.radius + b.radius;
}

/** Get penetration depth between two circles (0 if no overlap) */
export function circlesPenetration(a: Circle, b: Circle): number {
  const dist = vec2Distance(a.position, b.position);
  const overlap = a.radius + b.radius - dist;
  return overlap > 0 ? overlap : 0;
}

/** Separate two circles by pushing them apart equally */
export function separateCircles(
  a: Circle,
  b: Circle
): { pushA: Vec2; pushB: Vec2 } | null {
  const dist = vec2Distance(a.position, b.position);
  const overlap = a.radius + b.radius - dist;
  if (overlap <= 0) return null;

  const dir = vec2Normalize(vec2Sub(a.position, b.position));
  const halfPush = overlap / 2;
  return {
    pushA: vec2Scale(dir, halfPush),
    pushB: vec2Scale(dir, -halfPush),
  };
}

/** Check if a point is inside a circle */
export function pointInCircle(point: Vec2, circle: Circle): boolean {
  return vec2Distance(point, circle.position) < circle.radius;
}
