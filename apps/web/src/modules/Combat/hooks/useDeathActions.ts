import { useCallback } from 'react';
import { useAppStore } from '@lib/stores/app-store';
import { useGameStore } from '@lib/stores/game-store';
import { resetSimWorld } from '@modules/Combat/hooks/world-manager';
import { stopAll } from '@modules/Audio/audio-engine';
import { playUiConfirm } from '@modules/Audio/sounds';

export function useDeathActions() {
  const reset = useAppStore((s) => s.reset);
  const clearGameState = useGameStore((s) => s.clearGameState);

  const handleRestart = useCallback(() => {
    stopAll();
    playUiConfirm();
    resetSimWorld();
    clearGameState();
    reset();
  }, [clearGameState, reset]);

  return { handleRestart };
}
