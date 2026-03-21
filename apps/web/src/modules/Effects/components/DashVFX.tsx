import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlayerSnapshot } from '@curious/shared';

// ── Wind lines (long stretched streaks trailing the player) ──
const WIND_COUNT = 14;
const WIND_LIFE_MIN = 0.12;
const WIND_LIFE_MAX = 0.22;
const WIND_SIZE_MIN = 4;
const WIND_SIZE_MAX = 8;
const WIND_STRETCH_MIN = 3.0;
const WIND_STRETCH_MAX = 6.0;
const WIND_SPEED = 280;       // travel speed opposite to dash
const WIND_SPREAD = 50;       // perpendicular scatter
const WIND_EMIT_RATE = 3;     // per frame while dashing

// ── Burst particles (small dust puff at dash origin) ──
const BURST_COUNT = 16;
const BURST_LIFE_MIN = 0.15;
const BURST_LIFE_MAX = 0.35;
const BURST_SIZE_MIN = 2;
const BURST_SIZE_MAX = 5;
const BURST_SPEED_MIN = 30;
const BURST_SPEED_MAX = 90;

const TOTAL = WIND_COUNT + BURST_COUNT;

// ── Shader: stretch-capable soft glow ──
const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aStretch;
  attribute vec3 aVelocity;

  varying float vAlpha;
  varying vec2 vStretchDir;
  varying float vStretch;

  void main() {
    vAlpha = aAlpha;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);

    vec3 velView = mat3(modelViewMatrix) * aVelocity;
    float screenSpeed = length(velView.xy);

    if (screenSpeed > 0.5 && aStretch > 1.01) {
      vStretchDir = velView.xy / screenSpeed;
      vStretch = aStretch;
    } else {
      vStretchDir = vec2(1.0, 0.0);
      vStretch = 1.0;
    }

    gl_PointSize = aSize * vStretch * (500.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec2 vStretchDir;
  varying float vStretch;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    uv.y = -uv.y;

    vec2 perp = vec2(-vStretchDir.y, vStretchDir.x);
    float along = dot(uv, vStretchDir);
    float across = dot(uv, perp);

    float d = length(vec2(along, across * vStretch));
    if (d > 0.5) discard;
    float glow = 1.0 - smoothstep(0.0, 0.5, d);
    float core = smoothstep(0.3, 0.0, d);
    // White-blue wind color
    vec3 color = mix(vec3(0.6, 0.75, 1.0), vec3(1.0), core);
    gl_FragColor = vec4(color, glow * glow * vAlpha);
  }
`;

type Particle = {
  alive: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  baseSize: number;
  stretch: number;
};

type Props = {
  snapshot: PlayerSnapshot;
};

export function DashVFX({ snapshot }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const wasDashing = useRef(false);
  const nextWindSlot = useRef(0);

  const { positions, sizes, alphas, velocities, stretches, particles, geo, mat } = useMemo(() => {
    const positions = new Float32Array(TOTAL * 3);
    const sizes = new Float32Array(TOTAL);
    const alphas = new Float32Array(TOTAL);
    const velocities = new Float32Array(TOTAL * 3);
    const stretches = new Float32Array(TOTAL);
    const particles: Particle[] = [];
    for (let i = 0; i < TOTAL; i++) {
      particles.push({ alive: false, life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0, baseSize: 0, stretch: 1 });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('aStretch', new THREE.BufferAttribute(stretches, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { positions, sizes, alphas, velocities, stretches, particles, geo, mat };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const isDashing = snapshot.dashTimer > 0;
    const dx = snapshot.dashDirection?.x ?? 0;
    const dz = snapshot.dashDirection?.z ?? 0;
    const px = snapshot.position.x;
    const pz = snapshot.position.z;

    // ── Dash just started: spawn burst ──
    if (isDashing && !wasDashing.current) {
      for (let i = WIND_COUNT; i < TOTAL; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = BURST_SPEED_MIN + Math.random() * (BURST_SPEED_MAX - BURST_SPEED_MIN);
        const p = particles[i];
        const i3 = i * 3;

        positions[i3] = px;
        positions[i3 + 1] = 3 + Math.random() * 8;
        positions[i3 + 2] = pz;

        p.vx = Math.sin(angle) * speed;
        p.vy = Math.random() * 15;
        p.vz = Math.cos(angle) * speed;
        p.life = 0;
        p.maxLife = BURST_LIFE_MIN + Math.random() * (BURST_LIFE_MAX - BURST_LIFE_MIN);
        p.baseSize = BURST_SIZE_MIN + Math.random() * (BURST_SIZE_MAX - BURST_SIZE_MIN);
        p.stretch = 1.0;
        p.alive = true;
      }
    }

    // ── Emit wind lines while dashing ──
    if (isDashing) {
      // Perpendicular direction for spread
      const perpX = -dz;
      const perpZ = dx;

      for (let e = 0; e < WIND_EMIT_RATE; e++) {
        const slot = nextWindSlot.current;
        nextWindSlot.current = (slot + 1) % WIND_COUNT;

        const p = particles[slot];
        const i3 = slot * 3;

        // Spawn slightly behind & around the player
        const spreadAmt = (Math.random() - 0.5) * WIND_SPREAD;
        const behindAmt = Math.random() * 15;

        positions[i3] = px - dx * behindAmt + perpX * spreadAmt;
        positions[i3 + 1] = 6 + Math.random() * 24;
        positions[i3 + 2] = pz - dz * behindAmt + perpZ * spreadAmt;

        // Move opposite to dash direction (trail behind)
        p.vx = -dx * WIND_SPEED + perpX * (Math.random() - 0.5) * 30;
        p.vy = (Math.random() - 0.5) * 10;
        p.vz = -dz * WIND_SPEED + perpZ * (Math.random() - 0.5) * 30;
        p.life = 0;
        p.maxLife = WIND_LIFE_MIN + Math.random() * (WIND_LIFE_MAX - WIND_LIFE_MIN);
        p.baseSize = WIND_SIZE_MIN + Math.random() * (WIND_SIZE_MAX - WIND_SIZE_MIN);
        p.stretch = WIND_STRETCH_MIN + Math.random() * (WIND_STRETCH_MAX - WIND_STRETCH_MIN);
        p.alive = true;
      }
    }

    // ── Update all particles ──
    for (let i = 0; i < TOTAL; i++) {
      const p = particles[i];
      if (!p.alive) {
        alphas[i] = 0;
        sizes[i] = 0;
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.alive = false;
        alphas[i] = 0;
        sizes[i] = 0;
        continue;
      }

      const ratio = p.life / p.maxLife;
      const i3 = i * 3;

      // Physics (burst gets slight gravity, wind doesn't)
      if (i >= WIND_COUNT) {
        p.vy -= 30 * dt;
      }

      positions[i3] += p.vx * dt;
      positions[i3 + 1] += p.vy * dt;
      positions[i3 + 2] += p.vz * dt;

      // Fade out
      alphas[i] = (1.0 - ratio) * (1.0 - ratio);
      sizes[i] = p.baseSize * (1.0 - ratio * 0.4);

      // Velocity for stretch shader
      velocities[i3] = p.vx;
      velocities[i3 + 1] = p.vy;
      velocities[i3 + 2] = p.vz;
      stretches[i] = p.stretch;
    }

    // Upload to GPU
    geo.attributes.position.needsUpdate = true;
    (geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aVelocity as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aStretch as THREE.BufferAttribute).needsUpdate = true;

    wasDashing.current = isDashing;
  });

  // Speed buff aura ring
  const hasSpeedBuff = snapshot.buffs?.some(b => b.type === 'SPEED_BOOST') ?? false;

  if (snapshot.state === 'dead') return null;

  return (
    <>
      <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} />

      {hasSpeedBuff && (
        <mesh
          position={[snapshot.position.x, 1, snapshot.position.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[22, 30, 32]} />
          <meshBasicMaterial
            color="#4488ff"
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}
