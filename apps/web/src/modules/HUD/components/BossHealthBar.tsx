'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '@lib/stores/game-store';
import { useAppStore } from '@lib/stores/app-store';
import { BOSS_MAX_HEALTH } from '@curious/shared';

// Trailing damage bar — matches EnemyRig timing
const TRAIL_HOLD = 0.05;           // brief pause before shrink (seconds)
const TRAIL_SHRINK_DURATION = 0.25; // fixed catch-up duration (seconds)

export function BossHealthBar() {
  const scene = useAppStore((s) => s.scene);
  const boss = useGameStore((s) => s.boss);

  const trailBarRef = useRef<HTMLDivElement>(null);
  const trailingHealth = useRef(1.0);
  const trailFrom = useRef(1.0);
  const trailTarget = useRef(1.0);
  const trailTimer = useRef(-1);  // <0 = idle, >=0 = animating
  const lastTime = useRef(0);
  const rafRef = useRef(0);

  const animate = useCallback(() => {
    const now = performance.now() / 1000;
    const dt = Math.min(now - lastTime.current, 0.05);
    lastTime.current = now;

    // Advance hold → shrink animation
    if (trailTimer.current >= 0) {
      trailTimer.current += dt;

      if (trailTimer.current <= TRAIL_HOLD) {
        trailingHealth.current = trailFrom.current;
      } else {
        const t = Math.min(
          (trailTimer.current - TRAIL_HOLD) / TRAIL_SHRINK_DURATION,
          1,
        );
        const eased = t * (2 - t); // easeOutQuad
        trailingHealth.current =
          trailFrom.current +
          (trailTarget.current - trailFrom.current) * eased;

        if (t >= 1) {
          trailingHealth.current = trailTarget.current;
          trailTimer.current = -1;
        }
      }
    }

    // Update trail bar element
    if (trailBarRef.current) {
      const tPct = Math.max(0, trailingHealth.current);
      const currentPct = trailTarget.current;
      const visible = trailingHealth.current > currentPct + 0.005;
      trailBarRef.current.style.width = `${tPct * 100}%`;
      trailBarRef.current.style.display = visible ? 'block' : 'none';

      // Fade opacity during shrink
      if (trailTimer.current >= TRAIL_HOLD) {
        const fadeT = Math.min(
          (trailTimer.current - TRAIL_HOLD) / TRAIL_SHRINK_DURATION,
          1,
        );
        trailBarRef.current.style.opacity = `${0.9 - fadeT * 0.4}`;
      } else {
        trailBarRef.current.style.opacity = '0.9';
      }
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  // Start/stop animation loop
  useEffect(() => {
    lastTime.current = performance.now() / 1000;
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  // React to health changes
  const currentPct = boss ? Math.max(0, boss.health / BOSS_MAX_HEALTH) : 1;

  // Health went up (respawn) — snap trailing instantly
  if (currentPct > trailingHealth.current) {
    trailingHealth.current = currentPct;
    trailFrom.current = currentPct;
    trailTarget.current = currentPct;
    trailTimer.current = -1;
  }

  // New damage detected — (re)start animation from current visual position
  if (currentPct < trailTarget.current) {
    trailFrom.current = trailingHealth.current;
    trailTarget.current = currentPct;
    trailTimer.current = 0;
  }

  if (scene !== 'combat' || !boss) return null;
  if (boss.aiState === 'dead') return null;

  const healthPct = Math.max(0, boss.health / BOSS_MAX_HEALTH);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Boss name */}
      <span
        style={{
          color: '#66cc66',
          fontSize: 12,
          fontFamily: "'Matemasie', Georgia, serif",
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        guardian
      </span>

      {/* Health bar container */}
      <div
        style={{
          width: 280,
          height: 8,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 999,
          overflow: 'hidden',
          border: '1px solid rgba(68,170,68,0.25)',
          position: 'relative',
        }}
      >
        {/* White trailing damage bar */}
        <div
          ref={trailBarRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: '#ffffff',
            opacity: 0.9,
            borderRadius: 999,
            display: 'none',
          }}
        />
        {/* Green health fill */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${healthPct * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #338833, #44cc44)',
            borderRadius: 999,
            transition: 'width 0.15s ease-out',
          }}
        />
      </div>
    </div>
  );
}
