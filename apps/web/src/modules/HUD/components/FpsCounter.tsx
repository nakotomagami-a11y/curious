'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSettingsStore } from '@lib/stores/settings-store';

/**
 * FPS counter rendered as an R3F component (uses useFrame).
 * Renders an HTML overlay via a portal-free approach.
 */
export function FpsCounter() {
  const showFps = useSettingsStore((s) => s.showFps);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const [fps, setFps] = useState(0);

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    if (now - lastTime.current >= 500) {
      const elapsed = (now - lastTime.current) / 1000;
      setFps(Math.round(frameCount.current / elapsed));
      frameCount.current = 0;
      lastTime.current = now;
    }
  });

  if (!showFps) return null;

  return (
    <group>
      {/* Use Html from drei if available, otherwise render nothing in 3D */}
      <mesh visible={false}>
        <boxGeometry args={[0, 0, 0]} />
      </mesh>
    </group>
  );
}

/**
 * HTML overlay version of the FPS counter, placed outside Canvas.
 */
export function FpsCounterOverlay() {
  const showFps = useSettingsStore((s) => s.showFps);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const [fps, setFps] = useState(0);

  // We can't use useFrame outside Canvas, so use requestAnimationFrame
  const rafRef = useRef<number | null>(null);
  const started = useRef(false);

  if (!started.current && typeof window !== 'undefined') {
    started.current = true;
    const tick = () => {
      frameCount.current++;
      const now = performance.now();
      if (now - lastTime.current >= 500) {
        const elapsed = (now - lastTime.current) / 1000;
        setFps(Math.round(frameCount.current / elapsed));
        frameCount.current = 0;
        lastTime.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  if (!showFps) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.4)',
        fontFamily: 'monospace',
        pointerEvents: 'none',
        zIndex: 1000,
        userSelect: 'none',
      }}
    >
      {fps} FPS
    </div>
  );
}
