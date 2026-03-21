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
  playIceLance,
  playLightningChain,
  playHealCircle,
  playShieldBubble,
  playGravityWell,
  playBlockShield,
  playShieldBlock,
  playCriticalHit,
  playSpellPickup,
  playWaveComplete,
  playComboHit,
} from './sounds';

let lastComboIndex = 0;

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
        lastComboIndex = event.comboIndex;
        break;

      case 'ATTACK_HIT':
        if (event.isCritical) {
          playCriticalHit();
        } else {
          playComboHit(lastComboIndex);
        }
        break;

      case 'DAMAGE_TAKEN':
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

      case 'SPELL_CAST':
        switch (event.spellId) {
          case 'fireball': break; // Fireball uses the default slash-like sound
          case 'ice_lance': playIceLance(); break;
          case 'lightning_chain': playLightningChain(); break;
          case 'heal_circle': playHealCircle(); break;
          case 'shield_bubble': playShieldBubble(); break;
          case 'gravity_well': playGravityWell(); break;
          case 'block_shield': playBlockShield(); break;
        }
        break;

      case 'SHIELD_BLOCK':
        playShieldBlock();
        break;

      case 'SPELL_PICKED_UP':
        if (event.playerId === localPlayerId) {
          playSpellPickup();
        }
        break;

      case 'WAVE_COMPLETE':
        playWaveComplete();
        break;
    }
  }
}
