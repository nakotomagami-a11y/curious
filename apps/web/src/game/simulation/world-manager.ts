import type { SimWorld } from '@curious/game-logic';
import { createWorld, resetEntityIdCounter } from '@curious/game-logic';

/** Singleton simulation world — lives outside React to avoid re-render coupling. */
let world: SimWorld | null = null;

export function getSimWorld(): SimWorld {
  if (!world) {
    world = createWorld();
  }
  return world;
}

export function resetSimWorld(): void {
  world = null;
  resetEntityIdCounter();
}
