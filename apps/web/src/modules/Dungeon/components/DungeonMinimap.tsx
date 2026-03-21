'use client';
import { useMemo } from 'react';
import { useGameStore } from '@lib/stores/game-store';
import type { DungeonLayout, RoomState } from '@curious/shared';

const MINIMAP_SIZE = 200;
const PADDING = 10;

const ROOM_COLORS: Record<RoomState, string> = {
  undiscovered: '#555555',
  active: '#cc3333',
  cleared: '#33aa33',
};

export function DungeonMinimap() {
  const dungeonLayout = useGameStore((s) => s.dungeonLayout) as DungeonLayout | null;
  const dungeonRoomStates = useGameStore((s) => s.dungeonRoomStates);
  const currentDungeonRoom = useGameStore((s) => s.currentDungeonRoom);
  const players = useGameStore((s) => s.players);
  const localPlayerId = useGameStore((s) => s.localPlayerId);

  const bounds = useMemo(() => {
    if (!dungeonLayout) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [, room] of dungeonLayout.rooms) {
      minX = Math.min(minX, room.worldBounds.minX);
      maxX = Math.max(maxX, room.worldBounds.maxX);
      minZ = Math.min(minZ, room.worldBounds.minZ);
      maxZ = Math.max(maxZ, room.worldBounds.maxZ);
    }
    return { minX, maxX, minZ, maxZ, width: maxX - minX, height: maxZ - minZ };
  }, [dungeonLayout]);

  if (!dungeonLayout || !bounds || bounds.width === 0 || bounds.height === 0) return null;

  const drawArea = MINIMAP_SIZE - PADDING * 2;
  const scale = Math.min(drawArea / bounds.width, drawArea / bounds.height);

  const toScreen = (worldX: number, worldZ: number) => ({
    x: PADDING + (worldX - bounds.minX) * scale,
    y: PADDING + (worldZ - bounds.minZ) * scale,
  });

  // Player position
  const localPlayer = localPlayerId ? players[localPlayerId] : null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: MINIMAP_SIZE,
        height: MINIMAP_SIZE,
        background: 'rgba(0, 0, 0, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        zIndex: 10,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Corridors */}
      {Array.from(dungeonLayout.corridors.values()).map((corridor) => {
        const [roomAId, roomBId] = corridor.connectsRooms;
        const roomA = dungeonLayout.rooms.get(roomAId);
        const roomB = dungeonLayout.rooms.get(roomBId);
        if (!roomA || !roomB) return null;
        const a = toScreen(roomA.center.x, roomA.center.z);
        const b = toScreen(roomB.center.x, roomB.center.z);
        return (
          <div
            key={corridor.id}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: MINIMAP_SIZE,
              height: MINIMAP_SIZE,
            }}
          >
            <svg width={MINIMAP_SIZE} height={MINIMAP_SIZE} style={{ position: 'absolute', left: 0, top: 0 }}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={2}
              />
            </svg>
          </div>
        );
      })}

      {/* Rooms */}
      {Array.from(dungeonLayout.rooms.entries()).map(([id, room]) => {
        const state = (dungeonRoomStates[id] as RoomState) ?? room.state;
        const wb = room.worldBounds;
        const topLeft = toScreen(wb.minX, wb.minZ);
        const bottomRight = toScreen(wb.maxX, wb.maxZ);
        const w = bottomRight.x - topLeft.x;
        const h = bottomRight.y - topLeft.y;
        const isCurrent = id === currentDungeonRoom;
        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: topLeft.x,
              top: topLeft.y,
              width: Math.max(w, 4),
              height: Math.max(h, 4),
              background: ROOM_COLORS[state],
              border: isCurrent ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
              borderRadius: 2,
              boxSizing: 'border-box',
            }}
          />
        );
      })}

      {/* Player dot */}
      {localPlayer && (() => {
        const pos = toScreen(localPlayer.position.x, localPlayer.position.z);
        return (
          <div
            style={{
              position: 'absolute',
              left: pos.x - 3,
              top: pos.y - 3,
              width: 6,
              height: 6,
              background: '#ffcc00',
              borderRadius: '50%',
              boxShadow: '0 0 4px #ffcc00',
            }}
          />
        );
      })()}
    </div>
  );
}
