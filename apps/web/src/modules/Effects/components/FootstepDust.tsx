import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlayerSnapshot } from '@curious/shared';
import { vec2Length } from '@curious/shared';

const MAX_PARTICLES = 32;
const PARTICLE_LIFETIME = 0.6;
const SPAWN_INTERVAL = 0.18; // seconds between dust puffs while moving
const DASH_BURST_COUNT = 8;

type DustParticle = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  size: number;
};

export function FootstepDust({ snapshot }: { snapshot: PlayerSnapshot }) {
  const particles = useRef<DustParticle[]>(
    Array.from({ length: MAX_PARTICLES }, () => ({
      active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, size: 2,
    }))
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const spawnTimer = useRef(0);
  const wasDashing = useRef(false);
  const dummy = useRef(new THREE.Object3D());
  const color = useRef(new THREE.Color('#aa9977'));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const isMoving = snapshot.isMoving && snapshot.state === 'alive';
    const isDashing = snapshot.dashTimer > 0;

    // Spawn dust on dash start
    if (isDashing && !wasDashing.current) {
      for (let i = 0; i < DASH_BURST_COUNT; i++) {
        spawnParticle(particles.current, snapshot.position.x, snapshot.position.z, 4);
      }
    }
    wasDashing.current = isDashing;

    // Spawn footstep dust while moving
    if (isMoving && !isDashing) {
      spawnTimer.current += dt;
      if (spawnTimer.current >= SPAWN_INTERVAL) {
        spawnTimer.current = 0;
        spawnParticle(particles.current, snapshot.position.x, snapshot.position.z, 2);
      }
    } else {
      spawnTimer.current = 0;
    }

    // Update particles
    if (!meshRef.current) return;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles.current[i];
      if (!p.active) {
        dummy.current.scale.setScalar(0);
        dummy.current.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.current.matrix);
        continue;
      }

      p.age += dt;
      if (p.age >= PARTICLE_LIFETIME) {
        p.active = false;
        dummy.current.scale.setScalar(0);
        dummy.current.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.current.matrix);
        continue;
      }

      // Physics
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 30 * dt; // gravity
      if (p.y < 0) { p.y = 0; p.vy = 0; }

      // Scale: grow then shrink
      const t = p.age / PARTICLE_LIFETIME;
      const scale = p.size * (t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7);

      dummy.current.position.set(p.x, p.y, p.z);
      dummy.current.scale.setScalar(Math.max(0.01, scale));
      dummy.current.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.current.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#aa9977" transparent opacity={0.4} />
    </instancedMesh>
  );
}

function spawnParticle(particles: DustParticle[], x: number, z: number, size: number) {
  const p = particles.find(p => !p.active);
  if (!p) return;
  p.active = true;
  p.x = x + (Math.random() - 0.5) * 10;
  p.y = 0.5;
  p.z = z + (Math.random() - 0.5) * 10;
  p.vx = (Math.random() - 0.5) * 20;
  p.vy = 8 + Math.random() * 12;
  p.vz = (Math.random() - 0.5) * 20;
  p.age = 0;
  p.size = size + Math.random() * size * 0.5;
}
