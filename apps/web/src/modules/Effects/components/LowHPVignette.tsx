'use client';

import { useGameStore } from '@lib/stores/game-store';
import { PLAYER_MAX_HEALTH } from '@curious/shared';

export function LowHPVignette() {
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const players = useGameStore((s) => s.players);

  if (!localPlayerId) return null;
  const player = players[localPlayerId];
  if (!player || player.state !== 'alive') return null;

  const healthPct = player.health / PLAYER_MAX_HEALTH;
  if (healthPct >= 0.3) return null;

  // Intensity increases as health drops below 30%
  const intensity = 1 - healthPct / 0.3; // 0 at 30%, 1 at 0%
  const opacity = 0.15 + intensity * 0.25;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
        background: `radial-gradient(ellipse at center, transparent 40%, rgba(180, 20, 20, ${opacity}) 100%)`,
        animation: 'vignettePulse 1.5s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes vignettePulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
