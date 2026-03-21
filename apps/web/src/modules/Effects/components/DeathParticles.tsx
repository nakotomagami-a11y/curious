import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Props = {
  position: [number, number, number];
  color: string;
  count?: number;
};

// ── Shard config ───────────────────────────────────────────
const SHARD_LIFETIME = 0.7;
const SHARD_GRAVITY = 120;
const SHARD_SIZE_MIN = 3;
const SHARD_SIZE_MAX = 7;
const SHARD_OUTWARD_MIN = 30;
const SHARD_OUTWARD_MAX = 100;
const SHARD_UPWARD_MIN = 50;
const SHARD_UPWARD_MAX = 150;
const SHARD_STRETCH_CHANCE = 0.4;
const SHARD_STRETCH_MIN = 1.5;
const SHARD_STRETCH_MAX = 2.8;

// ── Vortex config ──────────────────────────────────────────
const VORTEX_LIFETIME = 1.2;
const VORTEX_RADIUS_MIN = 5;
const VORTEX_RADIUS_MAX = 25;
const VORTEX_ANGULAR_VEL_MIN = 3;
const VORTEX_ANGULAR_VEL_MAX = 7;
const VORTEX_Y_MIN = 5;
const VORTEX_Y_MAX = 30;
const VORTEX_RISE_MIN = 10;
const VORTEX_RISE_MAX = 25;
const VORTEX_SIZE_MIN = 3;
const VORTEX_SIZE_MAX = 8;
const VORTEX_RADIUS_DECAY = 0.97; // per-frame multiplier
const VORTEX_HOLD_TIME = 0.5;    // hold full brightness before fade
const VORTEX_COLOR_BOOST = 1.2;  // slightly brighter than shards

// ── Shard shader (stretch-capable rectangular sprites) ──────
const shardVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aStretch;
  attribute vec3 aVelocity;

  varying vec3 vColor;
  varying vec2 vStretchDir;
  varying float vStretch;

  void main() {
    vColor = color;
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

    gl_PointSize = aSize * vStretch * (250.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const shardFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying vec2 vStretchDir;
  varying float vStretch;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    uv.y = -uv.y;

    vec2 perp = vec2(-vStretchDir.y, vStretchDir.x);
    float across = abs(dot(uv, perp));
    if (across > 0.5 / vStretch) discard;
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

// ── Vortex shader (circular soft-glow sprites) ─────────────
const vortexVertexShader = /* glsl */ `
  attribute float aSize;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (250.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const vortexFragmentShader = /* glsl */ `
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float alpha = 1.0 - smoothstep(0.25, 0.5, d);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// ── Vortex per-particle state ──────────────────────────────
type VortexState = {
  angles: Float32Array;
  radii: Float32Array;
  angularVels: Float32Array;
  ys: Float32Array;
  riseSpeeds: Float32Array;
  sizes: Float32Array;
};

export function DeathParticles({ position, color, count = 24 }: Props) {
  const shardRef = useRef<THREE.Points>(null);
  const vortexRef = useRef<THREE.Points>(null);
  const startTimeRef = useRef(-1);

  const shardCount = Math.ceil(count * 0.6);
  const vortexCount = count - shardCount;

  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  // ── Shard init ─────────────────────────────────────────
  const shard = useMemo(() => {
    const pos = new Float32Array(shardCount * 3);
    const col = new Float32Array(shardCount * 3);
    const sizes = new Float32Array(shardCount);
    const vel = new Float32Array(shardCount * 3);
    const stretchArr = new Float32Array(shardCount);

    for (let i = 0; i < shardCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 1] = 10 + Math.random() * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;

      const angle = Math.random() * Math.PI * 2;
      const outward = SHARD_OUTWARD_MIN + Math.random() * (SHARD_OUTWARD_MAX - SHARD_OUTWARD_MIN);
      vel[i * 3] = Math.cos(angle) * outward;
      vel[i * 3 + 1] = SHARD_UPWARD_MIN + Math.random() * (SHARD_UPWARD_MAX - SHARD_UPWARD_MIN);
      vel[i * 3 + 2] = Math.sin(angle) * outward;

      sizes[i] = SHARD_SIZE_MIN + Math.random() * (SHARD_SIZE_MAX - SHARD_SIZE_MIN);

      stretchArr[i] = Math.random() < SHARD_STRETCH_CHANCE
        ? SHARD_STRETCH_MIN + Math.random() * (SHARD_STRETCH_MAX - SHARD_STRETCH_MIN)
        : 1.0;

      col[i * 3] = baseColor.r;
      col[i * 3 + 1] = baseColor.g;
      col[i * 3 + 2] = baseColor.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aStretch', new THREE.BufferAttribute(stretchArr, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: shardVertexShader,
      fragmentShader: shardFragmentShader,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geo, mat, pos, col, vel, sizes };
  }, [shardCount, baseColor]);

  // ── Vortex init ────────────────────────────────────────
  const vortex = useMemo(() => {
    const pos = new Float32Array(vortexCount * 3);
    const col = new Float32Array(vortexCount * 3);
    const sizes = new Float32Array(vortexCount);

    const state: VortexState = {
      angles: new Float32Array(vortexCount),
      radii: new Float32Array(vortexCount),
      angularVels: new Float32Array(vortexCount),
      ys: new Float32Array(vortexCount),
      riseSpeeds: new Float32Array(vortexCount),
      sizes: new Float32Array(vortexCount),
    };

    for (let i = 0; i < vortexCount; i++) {
      state.angles[i] = Math.random() * Math.PI * 2;
      state.radii[i] = VORTEX_RADIUS_MIN + Math.random() * (VORTEX_RADIUS_MAX - VORTEX_RADIUS_MIN);
      // Mixed CW/CCW: randomly negate angular velocity
      const speed = VORTEX_ANGULAR_VEL_MIN + Math.random() * (VORTEX_ANGULAR_VEL_MAX - VORTEX_ANGULAR_VEL_MIN);
      state.angularVels[i] = Math.random() < 0.5 ? speed : -speed;
      state.ys[i] = VORTEX_Y_MIN + Math.random() * (VORTEX_Y_MAX - VORTEX_Y_MIN);
      state.riseSpeeds[i] = VORTEX_RISE_MIN + Math.random() * (VORTEX_RISE_MAX - VORTEX_RISE_MIN);
      state.sizes[i] = VORTEX_SIZE_MIN + Math.random() * (VORTEX_SIZE_MAX - VORTEX_SIZE_MIN);

      // Initial position from polar coords
      pos[i * 3] = Math.cos(state.angles[i]) * state.radii[i];
      pos[i * 3 + 1] = state.ys[i];
      pos[i * 3 + 2] = Math.sin(state.angles[i]) * state.radii[i];

      // Boosted color for energy glow
      col[i * 3] = Math.min(baseColor.r * VORTEX_COLOR_BOOST, 1.0);
      col[i * 3 + 1] = Math.min(baseColor.g * VORTEX_COLOR_BOOST, 1.0);
      col[i * 3 + 2] = Math.min(baseColor.b * VORTEX_COLOR_BOOST, 1.0);

      sizes[i] = state.sizes[i];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: vortexVertexShader,
      fragmentShader: vortexFragmentShader,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geo, mat, pos, col, sizes, state };
  }, [vortexCount, baseColor]);

  // ── Per-frame update ───────────────────────────────────
  useFrame((clock, delta) => {
    const dt = Math.min(delta, 0.05);

    if (startTimeRef.current < 0) startTimeRef.current = clock.clock.elapsedTime;
    const elapsed = clock.clock.elapsedTime - startTimeRef.current;

    // ── Update shards ──────────────────────────────────
    if (shardRef.current && elapsed < SHARD_LIFETIME) {
      const fadeProgress = Math.min(elapsed / SHARD_LIFETIME, 1);
      const alpha = 1 - fadeProgress;

      for (let i = 0; i < shardCount; i++) {
        // Physics
        shard.pos[i * 3] += shard.vel[i * 3] * dt;
        shard.pos[i * 3 + 1] += shard.vel[i * 3 + 1] * dt;
        shard.pos[i * 3 + 2] += shard.vel[i * 3 + 2] * dt;
        shard.vel[i * 3 + 1] -= SHARD_GRAVITY * dt;

        // Fade via vertex color (additive blending)
        shard.col[i * 3] = baseColor.r * alpha;
        shard.col[i * 3 + 1] = baseColor.g * alpha;
        shard.col[i * 3 + 2] = baseColor.b * alpha;
      }

      const posAttr = shard.geo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = shard.geo.getAttribute('color') as THREE.BufferAttribute;
      const velAttr = shard.geo.getAttribute('aVelocity') as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      velAttr.needsUpdate = true;
    } else if (shardRef.current) {
      shardRef.current.visible = false;
    }

    // ── Update vortex ──────────────────────────────────
    if (vortexRef.current && elapsed < VORTEX_LIFETIME) {
      const fadeProgress = elapsed < VORTEX_HOLD_TIME
        ? 0
        : (elapsed - VORTEX_HOLD_TIME) / (VORTEX_LIFETIME - VORTEX_HOLD_TIME);
      const alpha = 1 - Math.min(fadeProgress, 1);

      // Size shrink in final 30%
      const lifeFrac = elapsed / VORTEX_LIFETIME;
      const sizeMul = lifeFrac < 0.7 ? 1.0 : 1.0 - (lifeFrac - 0.7) / 0.3;

      const vs = vortex.state;

      for (let i = 0; i < vortexCount; i++) {
        // Vortex motion
        vs.angles[i] += vs.angularVels[i] * dt;
        vs.radii[i] *= VORTEX_RADIUS_DECAY;
        vs.ys[i] += vs.riseSpeeds[i] * dt;

        // Position from polar coords
        vortex.pos[i * 3] = Math.cos(vs.angles[i]) * vs.radii[i];
        vortex.pos[i * 3 + 1] = vs.ys[i];
        vortex.pos[i * 3 + 2] = Math.sin(vs.angles[i]) * vs.radii[i];

        // Fade via vertex color
        const boost = VORTEX_COLOR_BOOST;
        vortex.col[i * 3] = Math.min(baseColor.r * boost, 1.0) * alpha;
        vortex.col[i * 3 + 1] = Math.min(baseColor.g * boost, 1.0) * alpha;
        vortex.col[i * 3 + 2] = Math.min(baseColor.b * boost, 1.0) * alpha;

        // Size shrink
        vortex.sizes[i] = vs.sizes[i] * sizeMul;
      }

      const posAttr = vortex.geo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = vortex.geo.getAttribute('color') as THREE.BufferAttribute;
      const sizeAttr = vortex.geo.getAttribute('aSize') as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    } else if (vortexRef.current) {
      vortexRef.current.visible = false;
    }
  });

  return (
    <group position={position}>
      {/* Layer 1: Square shard fragments */}
      <points ref={shardRef} geometry={shard.geo} material={shard.mat} frustumCulled={false} />

      {/* Layer 2: Circular vortex energy */}
      <points ref={vortexRef} geometry={vortex.geo} material={vortex.mat} frustumCulled={false} />
    </group>
  );
}
