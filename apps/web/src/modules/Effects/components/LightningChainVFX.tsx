import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@lib/stores/game-store';

const MAX_BOLTS = 8;
const BOLT_LIFETIME = 0.4;
const SEGMENTS = 12;
const JITTER = 14;
const BOLT_Y = 28;
const FLICKER_RATE = 0.12;

type BoltSlot = {
  active: boolean;
  points: { x: number; z: number }[];
  born: number;
  lastJitter: number;
};

function jaggedLine(fx: number, fz: number, tx: number, tz: number): THREE.Vector3[] {
  const result: THREE.Vector3[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const x = fx + (tx - fx) * t;
    const z = fz + (tz - fz) * t;
    const edgeFade = Math.sin(t * Math.PI);
    result.push(new THREE.Vector3(
      x + (Math.random() - 0.5) * JITTER * 2 * edgeFade,
      BOLT_Y + (Math.random() - 0.5) * 8 * edgeFade,
      z + (Math.random() - 0.5) * JITTER * 2 * edgeFade,
    ));
  }
  return result;
}

function buildChainGeometry(points: { x: number; z: number }[]): THREE.BufferGeometry {
  const verts: THREE.Vector3[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    verts.push(...jaggedLine(points[i].x, points[i].z, points[i + 1].x, points[i + 1].z));
  }
  return new THREE.BufferGeometry().setFromPoints(verts);
}

function buildBranchGeometry(points: { x: number; z: number }[]): THREE.BufferGeometry {
  const verts: THREE.Vector3[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 20;
    const mz = (a.z + b.z) / 2 + (Math.random() - 0.5) * 20;
    const angle = Math.random() * Math.PI * 2;
    const len = 15 + Math.random() * 25;
    verts.push(
      new THREE.Vector3(mx, BOLT_Y, mz),
      new THREE.Vector3(
        mx + Math.sin(angle) * len + (Math.random() - 0.5) * 8,
        BOLT_Y + (Math.random() - 0.5) * 10,
        mz + Math.cos(angle) * len + (Math.random() - 0.5) * 8,
      ),
    );
  }
  return new THREE.BufferGeometry().setFromPoints(verts);
}

export function LightningChainVFX() {
  const groupRef = useRef<THREE.Group>(null);
  const slots = useRef<BoltSlot[]>(
    Array.from({ length: MAX_BOLTS }, () => ({
      active: false, points: [], born: 0, lastJitter: 0,
    }))
  );
  const mainLines = useRef<THREE.Line[]>([]);
  const glowLines = useRef<THREE.Line[]>([]);
  const branchLines = useRef<THREE.LineSegments[]>([]);
  const flashLight = useRef<THREE.PointLight>(null);
  const flashTime = useRef(0);

  // Create line objects once
  useEffect(() => {
    if (!groupRef.current) return;
    const mainMat = new THREE.LineBasicMaterial({ color: '#99ddff', transparent: true, opacity: 1, depthWrite: false });
    const glowMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });
    const branchMat = new THREE.LineBasicMaterial({ color: '#6699cc', transparent: true, opacity: 0.4, depthWrite: false });

    for (let i = 0; i < MAX_BOLTS; i++) {
      const emptyGeo = new THREE.BufferGeometry();

      const main = new THREE.Line(emptyGeo.clone(), mainMat.clone());
      main.visible = false;
      main.frustumCulled = false;
      groupRef.current.add(main);
      mainLines.current.push(main);

      const glow = new THREE.Line(emptyGeo.clone(), glowMat.clone());
      glow.visible = false;
      glow.frustumCulled = false;
      groupRef.current.add(glow);
      glowLines.current.push(glow);

      const branch = new THREE.LineSegments(emptyGeo.clone(), branchMat.clone());
      branch.visible = false;
      branch.frustumCulled = false;
      groupRef.current.add(branch);
      branchLines.current.push(branch);
    }

    return () => {
      mainLines.current.forEach(l => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); });
      glowLines.current.forEach(l => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); });
      branchLines.current.forEach(l => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); });
      mainLines.current = [];
      glowLines.current = [];
      branchLines.current = [];
    };
  }, []);

  useFrame(() => {
    const now = performance.now() / 1000;
    const bolts = useGameStore.getState().lightningBolts;

    // Drain new bolts from store
    if (bolts.length > 0) {
      for (const bolt of bolts) {
        const slot = slots.current.find(s => !s.active);
        if (!slot) continue;
        slot.active = true;
        slot.points = bolt.points;
        slot.born = bolt.time / 1000;
        slot.lastJitter = 0;

        // Flash at origin
        if (bolt.points.length > 0 && flashLight.current) {
          flashLight.current.position.set(bolt.points[0].x, BOLT_Y, bolt.points[0].z);
          flashTime.current = now;
        }
      }
      useGameStore.setState({ lightningBolts: [] });
    }

    // Update each bolt
    for (let i = 0; i < MAX_BOLTS; i++) {
      const slot = slots.current[i];
      const main = mainLines.current[i];
      const glow = glowLines.current[i];
      const branch = branchLines.current[i];
      if (!main || !glow || !branch) continue;

      if (!slot.active) {
        main.visible = false;
        glow.visible = false;
        branch.visible = false;
        continue;
      }

      const age = now - slot.born;
      if (age > BOLT_LIFETIME) {
        slot.active = false;
        main.visible = false;
        glow.visible = false;
        branch.visible = false;
        continue;
      }

      // Re-jitter periodically for crackling
      if (now - slot.lastJitter > FLICKER_RATE) {
        slot.lastJitter = now;

        main.geometry.dispose();
        main.geometry = buildChainGeometry(slot.points);

        glow.geometry.dispose();
        glow.geometry = buildChainGeometry(slot.points);

        branch.geometry.dispose();
        branch.geometry = buildBranchGeometry(slot.points);
      }

      const fade = 1 - age / BOLT_LIFETIME;
      const flicker = 0.5 + Math.random() * 0.5;

      main.visible = true;
      glow.visible = true;
      branch.visible = true;
      (main.material as THREE.LineBasicMaterial).opacity = fade * flicker;
      (glow.material as THREE.LineBasicMaterial).opacity = fade * flicker * 0.6;
      (branch.material as THREE.LineBasicMaterial).opacity = fade * flicker * 0.3;
    }

    // Flash light decay
    if (flashLight.current) {
      const flashAge = now - flashTime.current;
      if (flashAge < 0.25) {
        flashLight.current.intensity = 200 * (1 - flashAge / 0.25) * (0.5 + Math.random() * 0.5);
      } else {
        flashLight.current.intensity = 0;
      }
    }
  });

  return (
    <>
      <group ref={groupRef} />
      <pointLight ref={flashLight} color="#88ccff" intensity={0} distance={300} decay={2} />
    </>
  );
}
