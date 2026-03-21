import { useCallback } from 'react';
import { useAppStore } from '@lib/stores/app-store';
import { useGameStore } from '@lib/stores/game-store';
import { createPlayer, createBoss, generateEntityId, resetSpawner, initSurvivalWave, generateDungeon } from '@curious/game-logic';
import { vec2 } from '@curious/shared';
import type { GameMode } from '@curious/shared';
import { getSimWorld, resetSimWorld } from '@modules/Combat/hooks/world-manager';
import { startAmbient } from '@modules/Audio/audio-engine';
import { playUiConfirm } from '@modules/Audio/sounds';

export function useModeSelectActions() {
  const playerName = useAppStore((s) => s.playerName);
  const setScene = useAppStore((s) => s.setScene);
  const setGameMode = useAppStore((s) => s.setGameMode);

  const handleModeSelect = useCallback(
    (mode: GameMode) => {
      playUiConfirm();

      // Reset sim world for fresh session
      resetSimWorld();
      resetSpawner();
      const world = getSimWorld();

      // Spawn local player entity
      const playerId = generateEntityId('player');
      const player = createPlayer(playerId, playerName);
      world.players.set(playerId, player);

      if (mode === 'dev-playground') {
        // Sandbox: spawn boss, enemies auto-spawn via tickSpawner
        world.devMode = true;
        const boss = createBoss(generateEntityId('boss'), vec2(0, -250));
        world.boss = boss;

        // Dev mode: give all spells (infinite use)
        player.spellSlots = [
          'fireball', 'ice_lance', 'lightning_chain', 'heal_circle',
          'shield_bubble', 'gravity_well', 'block_shield',
        ];
      } else if (mode === 'dungeon') {
        // Dungeon: generate layout and initialize state
        const dungeonLayout = generateDungeon();
        world.dungeon = dungeonLayout;
        world.dungeonState = {
          currentRoomId: dungeonLayout.spawnRoomId,
          roomStates: {},
          doorStates: {},
          roomsCleared: 0,
          totalRooms: dungeonLayout.rooms.size,
          activeRoomEnemyIds: [],
          complete: false,
        };

        // Initialize room states
        for (const [id] of dungeonLayout.rooms) {
          world.dungeonState.roomStates[id] = id === dungeonLayout.spawnRoomId ? 'cleared' : 'undiscovered';
        }
        // Initialize door states
        for (const [id] of dungeonLayout.doors) {
          const spawnRoom = dungeonLayout.rooms.get(dungeonLayout.spawnRoomId);
          const isSpawnDoor = spawnRoom?.doorIds.includes(id);
          world.dungeonState.doorStates[id] = isSpawnDoor ? 'open' : 'unlocked';
        }

        // Spawn player at spawn room center
        const spawnRoom = dungeonLayout.rooms.get(dungeonLayout.spawnRoomId)!;
        player.position = { ...spawnRoom.center };
      } else {
        // Survival: init wave system, spawn wave 1
        world.survival = {
          wave: 1,
          enemiesRemaining: 0,
          enemiesTotal: 0,
          waveActive: false,
          megaBossSpawned: false,
        };
        initSurvivalWave(world, 1);
      }

      // Start audio
      startAmbient();

      // Update stores
      setGameMode(mode);
      useGameStore.getState().setLocalPlayerId(playerId);
      setScene('combat');
    },
    [playerName, setScene, setGameMode]
  );

  return { handleModeSelect };
}
