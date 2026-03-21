import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@lib/stores/game-store';
import { assetUrl } from '@lib/utils/asset-url';

// ── Pool ─────────────────────────────────────────────────
const POOL_SIZE = 16;

// ── Animation ────────────────────────────────────────────
const LIFETIME = 0.8;             // seconds before fully faded
const RISE_SPEED = 60;            // world units/sec upward
const SPAWN_Y = 55;               // above enemy body + health bar
const HORIZ_JITTER = 12;          // random X/Z offset to prevent stacking

// ── Scale pop ────────────────────────────────────────────
const SCALE_POP_DURATION = 0.1;   // seconds for overshoot
const SCALE_POP_PEAK = 1.3;       // peak scale

// ── Fade ─────────────────────────────────────────────────
const FADE_START = 0.4;           // fraction of lifetime before fade begins

// ── Text ─────────────────────────────────────────────────
const FONT_SIZE = 8;
const FONT_URL = assetUrl('/fonts/Matemasie/Matemasie-Regular.ttf');

// ── Per-slot state (ref-based, no React state) ───────────
type Slot = {
  active: boolean;
  x: number;
  z: number;
  amount: number;
  born: number;       // performance.now() timestamp
  offsetX: number;    // random jitter
  offsetZ: number;
  isCrit: boolean;
};

function createSlot(): Slot {
  return { active: false, x: 0, z: 0, amount: 0, born: 0, offsetX: 0, offsetZ: 0, isCrit: false };
}

export function DamageNumbers() {
  const slots = useRef<Slot[]>(
    Array.from({ length: POOL_SIZE }, () => createSlot())
  );
  const groupRefs = useRef<(THREE.Group | null)[]>(Array(POOL_SIZE).fill(null));
  const textRefs = useRef<(any | null)[]>(Array(POOL_SIZE).fill(null));

  useFrame(() => {
    const now = performance.now();
    const damageNumbers = useGameStore.getState().damageNumbers;

    // ── Drain new damage numbers from store ──────────────
    if (damageNumbers.length > 0) {
      for (const dn of damageNumbers) {
        // Find free slot (or oldest active slot if pool is full)
        let slot = slots.current.find((s) => !s.active);
        if (!slot) {
          // Pool full — recycle oldest
          let oldest = slots.current[0];
          for (let i = 1; i < POOL_SIZE; i++) {
            if (slots.current[i].born < oldest.born) oldest = slots.current[i];
          }
          slot = oldest;
        }

        slot.active = true;
        slot.x = dn.x;
        slot.z = dn.z;
        slot.amount = dn.amount;
        slot.born = dn.time;
        slot.isCrit = dn.isCrit ?? false;
        slot.offsetX = (Math.random() - 0.5) * HORIZ_JITTER * 2;
        slot.offsetZ = (Math.random() - 0.5) * HORIZ_JITTER * 2;

        // Update text content and color via ref
        const idx = slots.current.indexOf(slot);
        const textObj = textRefs.current[idx];
        if (textObj) {
          textObj.text = slot.isCrit ? `CRIT! ${dn.amount}` : String(dn.amount);
          textObj.color = slot.isCrit ? '#ffcc00' : '#ffffff';
          textObj.fontSize = slot.isCrit ? FONT_SIZE * 1.4 : FONT_SIZE;
        }
      }
      useGameStore.setState({ damageNumbers: [] });
    }

    // ── Animate all slots ────────────────────────────────
    for (let i = 0; i < POOL_SIZE; i++) {
      const slot = slots.current[i];
      const group = groupRefs.current[i];
      if (!group) continue;

      if (!slot.active) {
        group.visible = false;
        continue;
      }

      const age = (now - slot.born) / 1000;

      // Expired
      if (age > LIFETIME) {
        slot.active = false;
        group.visible = false;
        continue;
      }

      group.visible = true;

      // Position: rise upward
      const currentY = SPAWN_Y + age * RISE_SPEED;
      group.position.set(
        slot.x + slot.offsetX,
        currentY,
        slot.z + slot.offsetZ,
      );

      // Scale: pop in then settle (bigger pop on crit)
      const popPeak = slot.isCrit ? SCALE_POP_PEAK * 1.5 : SCALE_POP_PEAK;
      let scale: number;
      if (age < SCALE_POP_DURATION) {
        const t = age / SCALE_POP_DURATION;
        scale = 1.0 + (popPeak - 1.0) * Math.sin(t * Math.PI);
      } else {
        scale = 1.0;
      }
      group.scale.setScalar(scale);

      // Opacity: hold full then fade
      const fadeStart = LIFETIME * FADE_START;
      const opacity = age < fadeStart
        ? 1.0
        : 1.0 - (age - fadeStart) / (LIFETIME - fadeStart);

      // Update text opacity via ref
      const textObj = textRefs.current[i];
      if (textObj) {
        textObj.fillOpacity = opacity;
        textObj.outlineOpacity = opacity;
      }
    }
  });

  // Pre-mount pool — all invisible, animated via refs
  return (
    <>
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        <group
          key={i}
          ref={(el) => { groupRefs.current[i] = el; }}
          visible={false}
        >
          <Billboard>
            <Text
              ref={(el: any) => { textRefs.current[i] = el; }}
              font={FONT_URL}
              fontSize={FONT_SIZE}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.6}
              outlineColor="#000000"
              fillOpacity={0}
              outlineOpacity={0}
            >
              {'0'}
            </Text>
          </Billboard>
        </group>
      ))}
    </>
  );
}
