'use client';
import { useGameStore } from '@lib/stores/game-store';
import { DungeonFloor } from './DungeonFloor';
import { DungeonWalls } from './DungeonWalls';
import { DungeonDoors } from './DungeonDoors';

export function DungeonRenderer() {
  const dungeonLayout = useGameStore((s) => s.dungeonLayout);
  const dungeonRoomStates = useGameStore((s) => s.dungeonRoomStates);
  const dungeonDoorStates = useGameStore((s) => s.dungeonDoorStates);
  if (!dungeonLayout) return null;

  return (
    <>
      <DungeonFloor layout={dungeonLayout} roomStates={dungeonRoomStates} />
      <DungeonWalls layout={dungeonLayout} doorStates={dungeonDoorStates} />
      <DungeonDoors layout={dungeonLayout} doorStates={dungeonDoorStates} />
    </>
  );
}
