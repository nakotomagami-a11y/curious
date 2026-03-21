import { create } from 'zustand';
import type { AppScene, EntityId, GameMode } from '@curious/shared';

type AppStore = {
  scene: AppScene;
  playerName: string;
  sessionId: EntityId | null;
  gameMode: GameMode | null;

  setScene: (scene: AppScene) => void;
  setPlayerName: (name: string) => void;
  setSessionId: (id: EntityId | null) => void;
  setGameMode: (mode: GameMode) => void;
  reset: () => void;
};

export const useAppStore = create<AppStore>((set) => ({
  scene: 'landing',
  playerName: '',
  sessionId: null,
  gameMode: null,

  setScene: (scene) => set({ scene }),
  setPlayerName: (name) => set({ playerName: name }),
  setSessionId: (id) => set({ sessionId: id }),
  setGameMode: (mode) => set({ gameMode: mode }),
  reset: () => set({ scene: 'landing', playerName: '', sessionId: null, gameMode: null }),
}));
