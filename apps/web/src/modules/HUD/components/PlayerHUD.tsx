'use client';

import { useGameStore } from '@lib/stores/game-store';
import { useAppStore } from '@lib/stores/app-store';
import { PLAYER_MAX_HEALTH } from '@curious/shared';

export function PlayerHUD() {
  const scene = useAppStore((s) => s.scene);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const players = useGameStore((s) => s.players);

  if (scene !== 'combat' || !localPlayerId) return null;
  const player = players[localPlayerId];
  if (!player || player.state === 'dead') return null;

  const healthPct = Math.max(0, player.health / PLAYER_MAX_HEALTH);
  const isLow = healthPct < 0.3;

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        pointerEvents: 'none',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* Player name */}
      <span
        style={{
          color: '#8ab4f8',
          fontSize: 13,
          fontFamily: "'Matemasie', Georgia, serif",
          letterSpacing: 1,
        }}
      >
        {player.name}
      </span>

      {/* Health bar container */}
      <div
        style={{
          width: 160,
          height: 10,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 999,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {/* Health fill */}
        <div
          style={{
            width: `${healthPct * 100}%`,
            height: '100%',
            background: isLow
              ? 'linear-gradient(90deg, #cc3333, #ff4444)'
              : 'linear-gradient(90deg, #3366cc, #4488ff)',
            borderRadius: 999,
            transition: 'width 0.1s ease-out',
          }}
        />
      </div>

      {/* HP text */}
      <span
        style={{
          color: isLow ? '#ff6666' : 'rgba(255,255,255,0.4)',
          fontSize: 10,
          fontFamily: "'Matemasie', Georgia, serif",
        }}
      >
        {Math.ceil(player.health)} / {PLAYER_MAX_HEALTH}
      </span>
    </div>
  );
}
