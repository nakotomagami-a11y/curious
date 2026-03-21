'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@lib/stores/game-store';

const KILL_WINDOW = 3.0; // seconds between kills to count as streak
const STREAK_THRESHOLDS = [
  { count: 3, text: 'TRIPLE KILL', color: '#ffcc44' },
  { count: 5, text: 'RAMPAGE', color: '#ff8844' },
  { count: 10, text: 'UNSTOPPABLE', color: '#ff4444' },
];

export function KillStreakOverlay() {
  const [streakText, setStreakText] = useState<string | null>(null);
  const [streakColor, setStreakColor] = useState('#ffcc44');
  const [opacity, setOpacity] = useState(0);
  const killCount = useRef(0);
  const lastKillTime = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEnemies = useRef<Record<string, any>>({});

  const enemies = useGameStore((s) => s.enemies);

  useEffect(() => {
    // Detect kills by comparing enemy counts (enemies that went from alive to dying/dead)
    const now = performance.now() / 1000;
    let newKills = 0;

    for (const [id, prev] of Object.entries(prevEnemies.current)) {
      const curr = enemies[id];
      if (prev && prev.aiState !== 'dying' && prev.aiState !== 'dead') {
        if (!curr || curr.aiState === 'dying' || curr.aiState === 'dead') {
          newKills++;
        }
      }
    }

    prevEnemies.current = { ...enemies };

    if (newKills > 0) {
      // Check if within streak window
      if (now - lastKillTime.current > KILL_WINDOW) {
        killCount.current = 0;
      }
      killCount.current += newKills;
      lastKillTime.current = now;

      // Check thresholds (reverse to get highest)
      for (let i = STREAK_THRESHOLDS.length - 1; i >= 0; i--) {
        if (killCount.current >= STREAK_THRESHOLDS[i].count) {
          setStreakText(STREAK_THRESHOLDS[i].text);
          setStreakColor(STREAK_THRESHOLDS[i].color);
          setOpacity(1);

          if (hideTimer.current) clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => {
            setOpacity(0);
            setTimeout(() => setStreakText(null), 500);
          }, 2000);
          break;
        }
      }
    }
  }, [enemies]);

  if (!streakText) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        pointerEvents: 'none',
        opacity,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      <span
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: streakColor,
          textShadow: `0 0 20px ${streakColor}, 0 2px 4px rgba(0,0,0,0.8)`,
          fontFamily: "'Lexend', sans-serif",
          letterSpacing: 4,
        }}
      >
        {streakText}
      </span>
    </div>
  );
}
