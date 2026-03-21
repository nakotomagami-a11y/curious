'use client';
import { useMemo } from 'react';
import { TILE_SIZE } from '@curious/shared';
import type { DungeonLayout, RoomState } from '@curious/shared';

const ROOM_COLORS: Record<RoomState, string> = {
  undiscovered: '#1a1122',
  active: '#2a1515',
  cleared: '#1a1a1a',
};

const CORRIDOR_COLOR = '#151518';

type Props = {
  layout: DungeonLayout;
  roomStates: Record<string, string>;
};

export function DungeonFloor({ layout, roomStates }: Props) {
  // Render each room's tileRects individually (not bounding box) for accurate L/T/cross shapes
  const roomTiles = useMemo(() => {
    const result: { key: string; x: number; z: number; w: number; h: number; color: string }[] = [];
    for (const [id, room] of layout.rooms) {
      const state = (roomStates[id] as RoomState) ?? room.state;
      const color = ROOM_COLORS[state];
      for (let i = 0; i < room.tileRects.length; i++) {
        const rect = room.tileRects[i];
        const x = (rect.col + rect.width / 2) * TILE_SIZE;
        const z = (rect.row + rect.height / 2) * TILE_SIZE;
        const w = rect.width * TILE_SIZE;
        const h = rect.height * TILE_SIZE;
        result.push({ key: `${id}-${i}`, x, z, w, h, color });
      }
    }
    return result;
  }, [layout, roomStates]);

  const corridorTiles = useMemo(() => {
    const result: { key: string; x: number; z: number; w: number; h: number }[] = [];
    for (const [cid, corridor] of layout.corridors) {
      for (let i = 0; i < corridor.tileRects.length; i++) {
        const rect = corridor.tileRects[i];
        const x = (rect.col + rect.width / 2) * TILE_SIZE;
        const z = (rect.row + rect.height / 2) * TILE_SIZE;
        const w = rect.width * TILE_SIZE;
        const h = rect.height * TILE_SIZE;
        result.push({ key: `${cid}-${i}`, x, z, w, h });
      }
    }
    return result;
  }, [layout]);

  return (
    <group>
      {/* Room floors — per tileRect for accurate shapes */}
      {roomTiles.map((r) => (
        <mesh key={r.key} rotation={[-Math.PI / 2, 0, 0]} position={[r.x, 0.1, r.z]} receiveShadow>
          <planeGeometry args={[r.w, r.h]} />
          <meshStandardMaterial color={r.color} />
        </mesh>
      ))}

      {/* Corridor floors */}
      {corridorTiles.map((t) => (
        <mesh key={t.key} rotation={[-Math.PI / 2, 0, 0]} position={[t.x, 0.1, t.z]} receiveShadow>
          <planeGeometry args={[t.w, t.h]} />
          <meshStandardMaterial color={CORRIDOR_COLOR} />
        </mesh>
      ))}
    </group>
  );
}
