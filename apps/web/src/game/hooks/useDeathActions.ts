import { useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useGameStore } from '@/stores/game-store';
import { resetSimWorld } from '../simulation/world-manager';
import { stopAll } from '@/audio/audio-engine';
import { playUiConfirm } from '@/audio/sounds';

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
