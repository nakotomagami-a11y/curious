import { create } from 'zustand';
import type { MultiplayerPlayer, WorldSnapshotPayload, PlayerInputPayload } from '@lib/services/multiplayer-service';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  setReady,
  broadcastGameStart,
  broadcastWorldSnapshot,
  sendPlayerInput,
  setCallbacks,
  getIsHost,
  getRoomCode,
  getLocalPlayerId,
} from '@lib/services/multiplayer-service';

type MultiplayerStore = {
  connected: boolean;
  roomCode: string | null;
  players: MultiplayerPlayer[];
  isHost: boolean;
  localPlayerId: string | null;
  /** Latest world snapshot received from host (clients only) */
  latestSnapshot: WorldSnapshotPayload | null;
  /** Pending remote inputs to process (host only) */
  remoteInputs: PlayerInputPayload[];

  createRoom: (playerName: string) => Promise<string>;
  joinRoom: (roomCode: string, playerName: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  startGame: () => void;
  broadcastSnapshot: (snapshot: WorldSnapshotPayload) => void;
  sendInput: (input: PlayerInputPayload) => void;
  consumeRemoteInputs: () => PlayerInputPayload[];
};

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => {
  // Wire up callbacks from the multiplayer service
  setCallbacks({
    onPlayersChanged: (players) => {
      set({ players });
    },
    onWorldSnapshot: (snapshot) => {
      set({ latestSnapshot: snapshot });
    },
    onPlayerInput: (input) => {
      set((s) => ({ remoteInputs: [...s.remoteInputs, input] }));
    },
    onGameStart: () => {
      // Clients will handle this in the UI layer
      // The co-op lobby listens for this
    },
  });

  return {
    connected: false,
    roomCode: null,
    players: [],
    isHost: false,
    localPlayerId: null,
    latestSnapshot: null,
    remoteInputs: [],

    createRoom: async (playerName: string) => {
      const code = await createRoom(playerName);
      set({
        connected: true,
        roomCode: code,
        isHost: true,
        localPlayerId: getLocalPlayerId(),
      });
      return code;
    },

    joinRoom: async (roomCode: string, playerName: string) => {
      const success = await joinRoom(roomCode, playerName);
      if (success) {
        set({
          connected: true,
          roomCode,
          isHost: false,
          localPlayerId: getLocalPlayerId(),
        });
      }
      return success;
    },

    leaveRoom: async () => {
      await leaveRoom();
      set({
        connected: false,
        roomCode: null,
        players: [],
        isHost: false,
        localPlayerId: null,
        latestSnapshot: null,
        remoteInputs: [],
      });
    },

    setReady: async (ready: boolean) => {
      await setReady(ready);
    },

    startGame: () => {
      broadcastGameStart();
    },

    broadcastSnapshot: (snapshot: WorldSnapshotPayload) => {
      broadcastWorldSnapshot(snapshot);
    },

    sendInput: (input: PlayerInputPayload) => {
      sendPlayerInput(input);
    },

    consumeRemoteInputs: () => {
      const inputs = get().remoteInputs;
      set({ remoteInputs: [] });
      return inputs;
    },
  };
});
