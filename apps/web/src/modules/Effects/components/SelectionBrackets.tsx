import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@lib/stores/game-store';

// ── Sizing ─────────────────────────────────────────────────
const THICKNESS = 1.5;
const BRACKET_FRAC = 0.1;
const COLOR = '#ffffff';
const OPACITY = 0.6;
const Y_OFFSET = 21;
const WIDTH_SCALE = 0.5;   // 50% of size
const HEIGHT_SCALE = 0.7;  // 70% of size

// ── Animation ──────────────────────────────────────────────
const FLY_DURATION = 0.25;   // seconds for fly-in and fly-out
const SPREAD_MULT = 4;       // how far corners start/end on fly
const MOVE_LERP_SPEED = 12;  // position lerp speed when switching targets

/**
 * Scene-level selection indicator.
 * Renders once — reads selectedEnemyId from store and positions itself.
 * First selection: corners fly in from spread.
 * Switching target: smoothly moves world position to the new enemy.
 * Deselection: corners fly back out to spread and fade out.
 */
export function SelectionIndicator({ size }: { size: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const tlRef = useRef<THREE.Mesh>(null);
  const trRef = useRef<THREE.Mesh>(null);
  const blRef = useRef<THREE.Mesh>(null);
  const brRef = useRef<THREE.Mesh>(null);

  // World position tracking
  const currentX = useRef(0);
  const currentZ = useRef(0);
  const posInitialized = useRef(false);

  // Animation: 0 = fully spread/hidden, 1 = fully settled/visible
  const flyProgress = useRef(0);
  const flyDirection = useRef<'in' | 'out' | 'idle'>('idle');
  const prevSelectedId = useRef<string | null>(null);
  const active = useRef(false); // has a target

  const halfW = (size * WIDTH_SCALE) / 2;
  const halfH = (size * HEIGHT_SCALE) / 2;

  // Single L-bracket geometry (arms extend right & down from corner at 0,0)
  const cornerGeo = useMemo(() => {
    const armW = size * WIDTH_SCALE * BRACKET_FRAC;
    const armH = size * HEIGHT_SCALE * BRACKET_FRAC;
    const t = THICKNESS;

    const verts: number[] = [];
    const quad = (x0: number, y0: number, x1: number, y1: number) => {
      verts.push(x0, y0, 0);
      verts.push(x1, y0, 0);
      verts.push(x0, y1, 0);
      verts.push(x1, y0, 0);
      verts.push(x1, y1, 0);
      verts.push(x0, y1, 0);
    };

    quad(0, -t, armW, 0);   // horizontal arm
    quad(0, -armH, t, 0);   // vertical arm

    const positions = new Float32Array(verts);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [size]);

  // Shared material
  const mat = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: COLOR,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const { selectedEnemyId, enemies, boss } = useGameStore.getState();

    // ── Find target position ───────────────────────────
    let targetX = 0;
    let targetZ = 0;
    let hasTarget = false;

    if (selectedEnemyId) {
      const enemy = enemies[selectedEnemyId];
      const bossMatch = boss?.id === selectedEnemyId ? boss : null;
      const target = enemy ?? bossMatch;
      if (target && target.aiState !== 'dead' && target.aiState !== 'dying') {
        targetX = target.position.x;
        targetZ = target.position.z;
        hasTarget = true;
      }
    }

    // ── State transitions ────────────────────────────
    if (hasTarget && !active.current) {
      // Just gained a target
      active.current = true;
      if (groupRef.current) groupRef.current.visible = true;

      if (prevSelectedId.current === null) {
        // First selection ever or after full fly-out: fly in
        flyProgress.current = 0;
        flyDirection.current = 'in';
        currentX.current = targetX;
        currentZ.current = targetZ;
        posInitialized.current = true;
      } else {
        // Re-selecting after partial fly-out: reverse to fly in
        flyDirection.current = 'in';
      }
      prevSelectedId.current = selectedEnemyId;
    } else if (hasTarget && selectedEnemyId !== prevSelectedId.current) {
      // Switching targets: just lerp position, no fly animation reset
      prevSelectedId.current = selectedEnemyId;
    } else if (!hasTarget && active.current) {
      // Lost target: start fly-out
      active.current = false;
      flyDirection.current = 'out';
    }

    // ── Fly-out complete: fully hidden ───────────────
    if (flyDirection.current === 'out' && flyProgress.current <= 0) {
      flyDirection.current = 'idle';
      prevSelectedId.current = null;
      posInitialized.current = false;
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    // Nothing to render
    if (flyDirection.current === 'idle' && !active.current) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    // ── Advance fly animation ────────────────────────
    if (flyDirection.current === 'in') {
      flyProgress.current = Math.min(flyProgress.current + dt / FLY_DURATION, 1);
      if (flyProgress.current >= 1) flyDirection.current = 'idle';
    } else if (flyDirection.current === 'out') {
      flyProgress.current = Math.max(flyProgress.current - dt / FLY_DURATION, 0);
    }

    // ── Lerp world position toward target ──────────────
    if (hasTarget) {
      if (!posInitialized.current) {
        currentX.current = targetX;
        currentZ.current = targetZ;
        posInitialized.current = true;
      } else {
        const t = 1 - Math.exp(-MOVE_LERP_SPEED * dt);
        currentX.current += (targetX - currentX.current) * t;
        currentZ.current += (targetZ - currentZ.current) * t;
      }
    }

    if (groupRef.current) {
      groupRef.current.position.x = currentX.current;
      groupRef.current.position.z = currentZ.current;
    }

    // ── Apply ease to corner positions + opacity ─────
    const p = flyProgress.current;
    const ease = 1 - (1 - p) * (1 - p) * (1 - p); // ease-out cubic

    const sx = halfW * SPREAD_MULT;
    const sy = halfH * SPREAD_MULT;

    if (tlRef.current) {
      tlRef.current.position.x = -sx + (-halfW - (-sx)) * ease;
      tlRef.current.position.y = sy + (halfH - sy) * ease;
    }
    if (trRef.current) {
      trRef.current.position.x = sx + (halfW - sx) * ease;
      trRef.current.position.y = sy + (halfH - sy) * ease;
    }
    if (blRef.current) {
      blRef.current.position.x = -sx + (-halfW - (-sx)) * ease;
      blRef.current.position.y = -sy + (-halfH - (-sy)) * ease;
    }
    if (brRef.current) {
      brRef.current.position.x = sx + (halfW - sx) * ease;
      brRef.current.position.y = -sy + (-halfH - (-sy)) * ease;
    }

    mat.opacity = OPACITY * ease;
  });

  return (
    <group ref={groupRef} visible={false}>
      <Billboard position={[0, Y_OFFSET, 0]}>
        <mesh ref={tlRef} geometry={cornerGeo} material={mat} position={[-halfW * SPREAD_MULT, halfH * SPREAD_MULT, 0]} />
        <mesh ref={trRef} geometry={cornerGeo} material={mat} position={[halfW * SPREAD_MULT, halfH * SPREAD_MULT, 0]} scale={[-1, 1, 1]} />
        <mesh ref={blRef} geometry={cornerGeo} material={mat} position={[-halfW * SPREAD_MULT, -halfH * SPREAD_MULT, 0]} scale={[1, -1, 1]} />
        <mesh ref={brRef} geometry={cornerGeo} material={mat} position={[halfW * SPREAD_MULT, -halfH * SPREAD_MULT, 0]} scale={[-1, -1, 1]} />
      </Billboard>
    </group>
  );
}
