'use client';

import { useGameStore } from '@lib/stores/game-store';
import { useAppStore } from '@lib/stores/app-store';
import { PLAYER_MAX_HEALTH, PLAYER_MAX_MANA, PLAYER_MAX_STAMINA } from '@curious/shared';
import type { BuffType } from '@curious/shared';

function ResourceBar({
  pct,
  gradient,
  height = 8,
}: {
  pct: number;
  gradient: string;
  height?: number;
}) {
  return (
    <div
      style={{
        width: 160,
        height,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 999,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          width: `${Math.max(0, pct) * 100}%`,
          height: '100%',
          background: gradient,
          borderRadius: 999,
          transition: 'width 0.1s ease-out',
        }}
      />
    </div>
  );
}

function getBuffColor(type: BuffType): string {
  switch (type) {
    case 'SPEED_BOOST': return 'rgba(66, 165, 245, 0.6)';
    case 'BURN': return 'rgba(255, 87, 34, 0.6)';
  }
}
function getBuffIcon(type: BuffType): string {
  switch (type) { case 'SPEED_BOOST': return '\u26A1'; case 'BURN': return '\uD83D\uDD25'; }
}
function getBuffTooltip(type: BuffType): string {
  switch (type) {
    case 'SPEED_BOOST': return 'Speed Boost: 1.5x movement speed for 2s';
    case 'BURN': return 'Burn: 3 damage per second for 3s';
  }
}

export function PlayerHUD() {
  const scene = useAppStore((s) => s.scene);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const players = useGameStore((s) => s.players);
  const survivalWave = useGameStore((s) => s.survivalWave);
  const survivalRemaining = useGameStore((s) => s.survivalRemaining);

  if (scene !== 'combat' || !localPlayerId) return null;
  const player = players[localPlayerId];
  if (!player || player.state === 'dead') return null;

  const healthPct = Math.max(0, player.health / PLAYER_MAX_HEALTH);
  const manaPct = Math.max(0, player.mana / PLAYER_MAX_MANA);
  const staminaPct = Math.max(0, player.stamina / PLAYER_MAX_STAMINA);
  const isLow = healthPct < 0.3;

  const fireballCd = player.spellCooldowns['fireball'] ?? 0;

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
        gap: 3,
        fontFamily: "'Lexend', sans-serif",
      }}
    >
      {/* Player name */}
      <span style={{ color: '#8ab4f8', fontSize: 13, letterSpacing: 1 }}>
        {player.name}
      </span>

      {/* Health bar */}
      <div style={{ width: 160, height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{
          width: `${healthPct * 100}%`,
          height: '100%',
          background: isLow ? 'linear-gradient(90deg, #cc3333, #ff4444)' : 'linear-gradient(90deg, #3366cc, #4488ff)',
          borderRadius: 999,
          transition: 'width 0.1s ease-out',
        }} />
      </div>

      {/* HP text */}
      <span style={{ color: isLow ? '#ff6666' : 'rgba(255,255,255,0.4)', fontSize: 9 }}>
        {Math.ceil(player.health)} / {PLAYER_MAX_HEALTH}
      </span>

      {/* Mana bar */}
      <ResourceBar pct={manaPct} gradient="linear-gradient(90deg, #2244aa, #3366dd)" />

      {/* Stamina bar */}
      <ResourceBar pct={staminaPct} gradient="linear-gradient(90deg, #aa8800, #ddaa22)" />

      {/* Buff icons */}
      {player.buffs && player.buffs.length > 0 && (
        <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
          {player.buffs.map((buff, i) => (
            <div
              key={`${buff.type}-${i}`}
              title={getBuffTooltip(buff.type)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 3,
                background: getBuffColor(buff.type),
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: '#fff',
                pointerEvents: 'auto',
                cursor: 'default',
              }}
            >
              {getBuffIcon(buff.type)}
            </div>
          ))}
        </div>
      )}

      {/* Spell slots */}
      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
        {[0, 1, 2].map(slot => {
          const spellId = slot === 0 ? 'fireball' : null;
          const cooldown = slot === 0 ? fireballCd : 0;
          const onCooldown = cooldown > 0;

          return (
            <div key={slot} style={{
              width: 30,
              height: 30,
              border: `1px solid ${onCooldown ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)'}`,
              borderRadius: 4,
              background: onCooldown ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              pointerEvents: 'auto',
            }}>
              <span style={{ fontSize: 7, color: '#666', position: 'absolute', top: 1, left: 3 }}>
                {slot + 1}
              </span>
              {spellId && (
                <span style={{ fontSize: 12, opacity: onCooldown ? 0.4 : 1 }}>
                  {'\uD83D\uDD25'}
                </span>
              )}
              {onCooldown && (
                <span style={{ fontSize: 8, color: '#ff6666', position: 'absolute', bottom: 1 }}>
                  {cooldown.toFixed(1)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Survival wave info */}
      {survivalWave !== null && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, color: '#ff8844', fontWeight: 500 }}>
            Wave {survivalWave}
          </span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
            {survivalRemaining} {survivalRemaining === 1 ? 'enemy' : 'enemies'} remaining
          </span>
        </div>
      )}
    </div>
  );
}
