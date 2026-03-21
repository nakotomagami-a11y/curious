'use client';

import { useGameStore } from '@lib/stores/game-store';
import { useAppStore } from '@lib/stores/app-store';
import { PLAYER_MAX_HEALTH, PLAYER_MAX_MANA, PLAYER_MAX_STAMINA, MAX_SPELL_SLOTS } from '@curious/shared';
import type { BuffType, SpellId } from '@curious/shared';

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
    case 'FREEZE': return 'rgba(100, 200, 255, 0.6)';
    case 'BLOCK_SHIELD': return 'rgba(255, 215, 0, 0.6)';
  }
}
function getBuffIcon(type: BuffType): string {
  switch (type) {
    case 'SPEED_BOOST': return '\u26A1';
    case 'BURN': return '\uD83D\uDD25';
    case 'FREEZE': return '\u2744\uFE0F';
    case 'BLOCK_SHIELD': return '\uD83D\uDEE1\uFE0F';
  }
}
function getBuffTooltip(type: BuffType): string {
  switch (type) {
    case 'SPEED_BOOST': return 'Speed Boost: 1.5x movement speed for 2s';
    case 'BURN': return 'Burn: 3 damage per second for 3s';
    case 'FREEZE': return 'Freeze: 50% movement speed for 2s';
    case 'BLOCK_SHIELD': return 'Block Shield: absorbs up to 40 damage';
  }
}

function getSpellIcon(spellId: SpellId): string {
  switch (spellId) {
    case 'fireball': return '\uD83D\uDD25';
    case 'ice_lance': return '\u2744\uFE0F';
    case 'lightning_chain': return '\u26A1';
    case 'heal_circle': return '\uD83D\uDC9A';
    case 'shield_bubble': return '\uD83D\uDD35';
    case 'gravity_well': return '\uD83C\uDF00';
    case 'block_shield': return '\uD83D\uDEE1\uFE0F';
  }
}

function getSpellColor(spellId: SpellId): string {
  switch (spellId) {
    case 'fireball': return 'rgba(255, 100, 30, 0.3)';
    case 'ice_lance': return 'rgba(100, 200, 255, 0.3)';
    case 'lightning_chain': return 'rgba(200, 200, 50, 0.3)';
    case 'heal_circle': return 'rgba(50, 200, 80, 0.3)';
    case 'shield_bubble': return 'rgba(80, 140, 255, 0.3)';
    case 'gravity_well': return 'rgba(150, 50, 200, 0.3)';
    case 'block_shield': return 'rgba(200, 180, 50, 0.3)';
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

  const spellSlots = player.spellSlots ?? [];

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

      {/* Spell slots — dynamic, up to 9 */}
      <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap', maxWidth: 280 }}>
        {Array.from({ length: MAX_SPELL_SLOTS }).map((_, slot) => {
          const spellId = spellSlots[slot] ?? null;

          return (
            <div key={slot} style={{
              width: 28,
              height: 28,
              border: `1px solid ${spellId ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 4,
              background: spellId ? getSpellColor(spellId) : 'rgba(255,255,255,0.03)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              pointerEvents: 'auto',
              opacity: spellId ? 1 : 0.4,
            }}>
              <span style={{ fontSize: 7, color: '#666', position: 'absolute', top: 1, left: 3 }}>
                {slot + 1}
              </span>
              {spellId && (
                <span style={{ fontSize: 11 }}>
                  {getSpellIcon(spellId)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Hint when no spells */}
      {spellSlots.length === 0 && (
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
          Kill enemies for spell drops
        </span>
      )}

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
