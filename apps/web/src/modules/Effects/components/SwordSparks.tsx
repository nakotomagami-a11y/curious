import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlayerRigHandle } from '@modules/Player/components/PlayerRig';
import type { PlayerSnapshot } from '@curious/shared';

// ── Pool ────────────────────────────────────────────────
const MAX_PARTICLES = 26;
const EMIT_PER_FRAME = 2;

// ── Lifetime ────────────────────────────────────────────
const LIFE_MIN = 0.15;
const LIFE_MAX = 0.45;

// ── Motion ──────────────────────────────────────────────
const TIP_VEL_INHERIT = 0.25;  // subtle directional bias
const RANDOM_SPREAD = 18;      // random jitter on top
const GRAVITY = -40;

// ── Size ────────────────────────────────────────────────
const SIZE_MIN = 3.4;
const SIZE_MAX = 6.75;

// ── Stretch (elongated streaks) ─────────────────────────
const STRETCH_CHANCE = 0.4;
const STRETCH_MIN = 1.5;
const STRETCH_MAX = 2.8;

// ── Shared temp vectors (module-level, zero-alloc) ──────
const _tip = new THREE.Vector3();
const _base = new THREE.Vector3();
const _spawn = new THREE.Vector3();
const _prevTip = new THREE.Vector3();
const _tipVel = new THREE.Vector3();

// ── Shader ──────────────────────────────────────────────
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
    float core = smoothstep(0.25, 0.0, d);
    vec3 color = mix(vec3(0.65, 0.82, 1.0), vec3(1.0), core);
    gl_FragColor = vec4(color, glow * glow * vAlpha);
  }
`;

// ── Per-particle CPU state ──────────────────────────────
type Spark = {
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
  rigRef: React.RefObject<PlayerRigHandle | null>;
  snapshot: PlayerSnapshot;
};

export function SwordSparks({ rigRef, snapshot }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const nextSlot = useRef(0);
  const hasPrevTip = useRef(false);
  const prevTipPos = useRef(new THREE.Vector3());

  // Allocate once, reuse forever
  const { positions, sizes, alphas, velocities, stretches, sparks, geo, mat } = useMemo(() => {
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const sizes = new Float32Array(MAX_PARTICLES);
    const alphas = new Float32Array(MAX_PARTICLES);
    const velocities = new Float32Array(MAX_PARTICLES * 3);
    const stretches = new Float32Array(MAX_PARTICLES);
    const sparks: Spark[] = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      sparks.push({ alive: false, life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0, baseSize: 0, stretch: 1 });
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

    return { positions, sizes, alphas, velocities, stretches, sparks, geo, mat };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const rig = rigRef.current;
    if (!rig) return;

    const slash = rig.slashVfxState?.current;
    const tipObj = rig.swordTipRef?.current;
    const baseObj = rig.swordBaseRef?.current;

    // ── Emit during active swing ──────────────────────────
    if (slash?.active && tipObj && baseObj) {
      tipObj.updateWorldMatrix(true, false);
      baseObj.updateWorldMatrix(true, false);
      tipObj.getWorldPosition(_tip);
      baseObj.getWorldPosition(_base);

      // Compute tip velocity from frame-to-frame delta
      if (hasPrevTip.current && dt > 0.001) {
        _tipVel.subVectors(_tip, prevTipPos.current).divideScalar(dt);
      } else {
        _tipVel.set(0, 0, 0);
      }
      prevTipPos.current.copy(_tip);
      hasPrevTip.current = true;

      for (let e = 0; e < EMIT_PER_FRAME; e++) {
        const slot = nextSlot.current;
        nextSlot.current = (slot + 1) % MAX_PARTICLES;

        // Spawn biased toward tip: t ∈ [0.5, 1.0] with quadratic bias toward 1
        const r = Math.random();
        const t = 0.5 + 0.5 * (1.0 - r * r);
        _spawn.lerpVectors(_base, _tip, t);

        const i3 = slot * 3;
        positions[i3] = _spawn.x;
        positions[i3 + 1] = _spawn.y;
        positions[i3 + 2] = _spawn.z;

        // Inherit tip velocity + small random jitter
        const angle = Math.random() * Math.PI * 2;
        const s = sparks[slot];
        s.vx = _tipVel.x * TIP_VEL_INHERIT + Math.cos(angle) * RANDOM_SPREAD;
        s.vy = _tipVel.y * TIP_VEL_INHERIT + Math.abs(Math.sin(angle)) * RANDOM_SPREAD;
        s.vz = _tipVel.z * TIP_VEL_INHERIT + Math.sin(angle) * RANDOM_SPREAD;
        s.life = 0;
        s.maxLife = LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN);
        s.baseSize = SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN);
        s.stretch = Math.random() < STRETCH_CHANCE
          ? STRETCH_MIN + Math.random() * (STRETCH_MAX - STRETCH_MIN)
          : 1.0;
        s.alive = true;
      }
    } else {
      hasPrevTip.current = false;
    }

    // ── Update all particles ────────────────────────────────
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const s = sparks[i];
      if (!s.alive) {
        alphas[i] = 0;
        sizes[i] = 0;
        continue;
      }

      s.life += dt;
      if (s.life >= s.maxLife) {
        s.alive = false;
        alphas[i] = 0;
        sizes[i] = 0;
        continue;
      }

      const ratio = s.life / s.maxLife;
      const i3 = i * 3;

      // Physics
      s.vy += GRAVITY * dt;
      positions[i3] += s.vx * dt;
      positions[i3 + 1] += s.vy * dt;
      positions[i3 + 2] += s.vz * dt;

      // Fade out (quadratic) + shrink
      alphas[i] = (1.0 - ratio) * (1.0 - ratio);
      sizes[i] = s.baseSize * (1.0 - ratio * 0.6);

      // Velocity + stretch for elongated streaks
      velocities[i3] = s.vx;
      velocities[i3 + 1] = s.vy;
      velocities[i3 + 2] = s.vz;
      stretches[i] = s.stretch;
    }

    // ── Upload to GPU ───────────────────────────────────────
    geo.attributes.position.needsUpdate = true;
    (geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aVelocity as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aStretch as THREE.BufferAttribute).needsUpdate = true;
  });

  if (snapshot.state === 'dead') return null;

  return <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} />;
}
