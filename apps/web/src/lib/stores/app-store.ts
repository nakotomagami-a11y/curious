import { create } from 'zustand';
import type { AppScene, EntityId } from '@curious/shared';

type AppStore = {
  scene: AppScene;
  playerName: string;
  sessionId: EntityId | null;

  setScene: (scene: AppScene) => void;
  setPlayerName: (name: string) => void;
  setSessionId: (id: EntityId | null) => void;
  reset: () => void;
};

export const useAppStore = create<AppStore>((set) => ({
  scene: 'landing',
  playerName: '',
  sessionId: null,

  setScene: (scene) => set({ scene }),
  setPlayerName: (name) => set({ playerName: name }),
  setSessionId: (id) => set({ sessionId: id }),
  reset: () => set({ scene: 'landing', playerName: '', sessionId: null }),
}));
