import type { Vec2 } from '@curious/shared';
import { vec2Normalize } from '@curious/shared';

const keys = new Set<string>();

export function initKeyboard(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code);
    // Prevent Space from scrolling the page during gameplay
    // (but allow it inside text inputs so landing-screen name field works)
    if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    keys.clear();
  };
}

/** Read current WASD state as a normalized Vec2 direction on XZ plane. */
export function readMoveDir(): Vec2 {
  let x = 0;
  let z = 0;

  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;

  return vec2Normalize({ x, z });
}

export function isKeyDown(code: string): boolean {
  return keys.has(code);
}

/** Clear all pressed keys — call on window blur / visibility change. */
export function clearKeys(): void {
  keys.clear();
}
