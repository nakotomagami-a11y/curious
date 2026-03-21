/**
 * Event → sound bridge.
 * Maps GameEvent types to procedural sound calls.
 */

import type { GameEvent } from '@curious/shared';
import {
  playSlash,
  playHit,
  playPunch,
  playHurt,
  playDeath,
  playBossTelegraph,
  playBossSlam,
} from './sounds';

/**
 * Process game events and trigger corresponding sounds.
 * Called each frame after tickWorld().
 */
export function processAudioEvents(
  events: GameEvent[],
  localPlayerId: string | null
): void {
  for (const event of events) {
    switch (event.type) {
      case 'ATTACK_START':
        playSlash();
        break;

      case 'ATTACK_HIT':
        playHit();
        break;

      case 'DAMAGE_TAKEN':
        // Only play hurt sound for the local player
        if (event.entityId === localPlayerId) {
          playHurt();
        }
        break;

      case 'ENTITY_DIED':
        playDeath();
        break;

      case 'BOSS_TELEGRAPH':
        playBossTelegraph();
        break;

      case 'BOSS_SLAM':
        playBossSlam();
        break;
    }
  }
}
