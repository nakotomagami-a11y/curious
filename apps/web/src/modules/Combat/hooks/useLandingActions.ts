import { useState, useCallback, FormEvent } from 'react';
import { useAppStore } from '@lib/stores/app-store';
import { useGameStore } from '@lib/stores/game-store';
import { createPlayer, createBoss, generateEntityId, resetSpawner } from '@curious/game-logic';
import { vec2 } from '@curious/shared';
import { getSimWorld, resetSimWorld } from '@modules/Combat/hooks/world-manager';
import { initAudio, startAmbient } from '@modules/Audio/audio-engine';
import { playUiConfirm } from '@modules/Audio/sounds';

const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 16;

function sanitizeName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_ -]/g, '').trim();
}

export function useLandingActions() {
  const [name, setName] = useState('');
  const setPlayerName = useAppStore((s) => s.setPlayerName);
  const setScene = useAppStore((s) => s.setScene);

  const sanitized = sanitizeName(name);
  const canSubmit = sanitized.length >= MIN_NAME_LENGTH && sanitized.length <= MAX_NAME_LENGTH;

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;

      // Reset sim world for fresh session
      resetSimWorld();
      resetSpawner();
      const world = getSimWorld();

      // Spawn local player entity
      const playerId = generateEntityId('player');
      const player = createPlayer(playerId, sanitized);
      world.players.set(playerId, player);

      // Enemies are auto-spawned by the spawner in tickWorld

      // Spawn boss
      const boss = createBoss(generateEntityId('boss'), vec2(0, -250));
      world.boss = boss;

      // Start audio
      initAudio();
      playUiConfirm();
      startAmbient();

      // Update stores
      setPlayerName(sanitized);
      useGameStore.getState().setLocalPlayerId(playerId);
      setScene('combat');
    },
    [canSubmit, sanitized, setPlayerName, setScene]
  );

  return { name, setName, handleSubmit, canSubmit };
}
