import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, type HitSpark } from '@/stores/game-store';

// ── Tuning ─────────────────────────────────────────────────
const SPARK_COUNT = 9; // tuned burst count
const SPARK_LIFETIME = 0.9; // long enough to see full arc + landing

// Horizontal burst speed
const HORIZ_SPEED_MIN = 40;
const HORIZ_SPEED_MAX = 140;

// Upward launch velocity — slight bias upward for initial lift
const UP_SPEED_MIN = 60;
const UP_SPEED_MAX = 160;

// Gravity — strong enough that particles don't hover
const GRAVITY = 350;

// Air drag — slight deceleration so they don't fly too far
const DRAG = 1.5;

// Size
const SPARK_SIZE_MIN = 2.0;
const SPARK_SIZE_MAX = 5.4;

// Spawn height — mid-body of enemy
const SPAWN_Y = 20;

// Stretch (elongated streaks)
const STRETCH_CHANCE = 0.4;
const STRETCH_MIN = 1.5;
const STRETCH_MAX = 2.8;

// ── Streak-capable point shader ─────────────────────────────
const sparkVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aStretch;
  attribute vec3 aVelocity;

  varying vec3 vColor;
  varying vec2 vStretchDir;
  varying float vStretch;

  void main() {
    vColor = color;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);

    // Velocity → view-space screen direction
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

const sparkFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying vec2 vStretchDir;
  varying float vStretch;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    uv.y = -uv.y; // flip to match view-space Y-up

    // Decompose into along-velocity and perpendicular
    vec2 perp = vec2(-vStretchDir.y, vStretchDir.x);
    float along = dot(uv, vStretchDir);
    float across = dot(uv, perp);

    // Scale perpendicular by stretch → keeps width constant, length grows
    float d = length(vec2(along, across * vStretch));
    float alpha = 1.0 - smoothstep(0.3, 0.5, d);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// ── Types ──────────────────────────────────────────────────
type SparkInstance = {
  spark: HitSpark;
  positions: Float32Array; // x,y,z per particle
  velocities: Float32Array;
  sizes: Float32Array;
  stretches: Float32Array; // 1.0 = circle, >1 = elongated streak
  grounded: Uint8Array; // 1 if particle has landed
  born: number;
};

export function HitSparks() {
  const instances = useRef<SparkInstance[]>([]);
  const meshRef = useRef<THREE.Points>(null);

  const MAX_PARTICLES = 128;

  const { posArr, colArr, sizeArr, velArr, stretchArr, geo, mat } = useMemo(() => {
    const p = new Float32Array(MAX_PARTICLES * 3);
    const c = new Float32Array(MAX_PARTICLES * 3);
    const s = new Float32Array(MAX_PARTICLES);
    const v = new Float32Array(MAX_PARTICLES * 3);
    const st = new Float32Array(MAX_PARTICLES);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
    g.setAttribute('aVelocity', new THREE.BufferAttribute(v, 3));
    g.setAttribute('aStretch', new THREE.BufferAttribute(st, 1));
    g.setDrawRange(0, 0);

    const m = new THREE.ShaderMaterial({
      vertexShader: sparkVertexShader,
      fragmentShader: sparkFragmentShader,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { posArr: p, colArr: c, sizeArr: s, velArr: v, stretchArr: st, geo: g, mat: m };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = performance.now();
    const sparks = useGameStore.getState().hitSparks;

    // ── Spawn new bursts ─────────────────────────────────
    for (const spark of sparks) {
      const positions = new Float32Array(SPARK_COUNT * 3);
      const velocities = new Float32Array(SPARK_COUNT * 3);
      const sizes = new Float32Array(SPARK_COUNT);
      const stretches = new Float32Array(SPARK_COUNT);
      const grounded = new Uint8Array(SPARK_COUNT);

      for (let i = 0; i < SPARK_COUNT; i++) {
        // Start at impact point, mid-body height
        positions[i * 3] = spark.x;
        positions[i * 3 + 1] = SPAWN_Y;
        positions[i * 3 + 2] = spark.z;

        // Radial horizontal direction — omnidirectional burst
        const angle = Math.random() * Math.PI * 2;
        const horizSpeed = HORIZ_SPEED_MIN + Math.random() * (HORIZ_SPEED_MAX - HORIZ_SPEED_MIN);
        velocities[i * 3] = Math.cos(angle) * horizSpeed;
        velocities[i * 3 + 2] = Math.sin(angle) * horizSpeed;

        // Upward launch — varied so some pop higher, some stay low
        velocities[i * 3 + 1] = UP_SPEED_MIN + Math.random() * (UP_SPEED_MAX - UP_SPEED_MIN);

        // Random size per particle
        sizes[i] = SPARK_SIZE_MIN + Math.random() * (SPARK_SIZE_MAX - SPARK_SIZE_MIN);

        // Some particles are elongated streaks
        stretches[i] = Math.random() < STRETCH_CHANCE
          ? STRETCH_MIN + Math.random() * (STRETCH_MAX - STRETCH_MIN)
          : 1.0;
      }

      instances.current.push({ spark, positions, velocities, sizes, stretches, grounded, born: now });
    }

    if (sparks.length > 0) {
      useGameStore.setState({ hitSparks: [] });
    }

    // ── Simulate + render ────────────────────────────────
    let vi = 0;
    const toRemove: number[] = [];

    for (let idx = 0; idx < instances.current.length; idx++) {
      const inst = instances.current[idx];
      const age = (now - inst.born) / 1000;

      if (age > SPARK_LIFETIME) {
        toRemove.push(idx);
        continue;
      }

      // Opacity: hold full brightness briefly then fade
      const fadeStart = 0.5; // start fading at 55% of lifetime
      const alpha = age < fadeStart ? 1.0 : 1.0 - (age - fadeStart) / (SPARK_LIFETIME - fadeStart);

      for (let i = 0; i < SPARK_COUNT; i++) {
        if (vi >= MAX_PARTICLES) break;

        // Skip grounded particles that have fully faded
        if (inst.grounded[i] && alpha < 0.1) continue;

        if (!inst.grounded[i]) {
          // Air drag — exponential decay on horizontal velocity
          const dragFactor = 1.0 / (1.0 + DRAG * dt);
          inst.velocities[i * 3] *= dragFactor;
          inst.velocities[i * 3 + 2] *= dragFactor;

          // Gravity — pulls Y velocity down continuously
          inst.velocities[i * 3 + 1] -= GRAVITY * dt;

          // Integrate position
          inst.positions[i * 3] += inst.velocities[i * 3] * dt;
          inst.positions[i * 3 + 1] += inst.velocities[i * 3 + 1] * dt;
          inst.positions[i * 3 + 2] += inst.velocities[i * 3 + 2] * dt;

          // Ground collision — particle lands
          if (inst.positions[i * 3 + 1] <= 0) {
            inst.positions[i * 3 + 1] = 0;
            inst.velocities[i * 3] = 0;
            inst.velocities[i * 3 + 1] = 0;
            inst.velocities[i * 3 + 2] = 0;
            inst.grounded[i] = 1;
          }
        }

        // Write to render buffers
        posArr[vi * 3] = inst.positions[i * 3];
        posArr[vi * 3 + 1] = inst.positions[i * 3 + 1];
        posArr[vi * 3 + 2] = inst.positions[i * 3 + 2];

        // Color: green for boss, orange-white for enemies
        if (inst.spark.isBoss) {
          colArr[vi * 3] = alpha * 0.2;
          colArr[vi * 3 + 1] = alpha;
          colArr[vi * 3 + 2] = alpha * 0.15;
        } else {
          colArr[vi * 3] = alpha;
          colArr[vi * 3 + 1] = alpha * 0.65;
          colArr[vi * 3 + 2] = alpha * 0.25;
        }

        // Size: stays mostly constant during flight, shrinks near end
        const sizeFade = age < SPARK_LIFETIME * 0.6 ? 1.0 : alpha;
        sizeArr[vi] = inst.sizes[i] * sizeFade;

        // Velocity + stretch for elongated streaks
        velArr[vi * 3] = inst.velocities[i * 3];
        velArr[vi * 3 + 1] = inst.velocities[i * 3 + 1];
        velArr[vi * 3 + 2] = inst.velocities[i * 3 + 2];
        stretchArr[vi] = inst.stretches[i];

        vi++;
      }
    }

    // Remove expired
    for (let i = toRemove.length - 1; i >= 0; i--) {
      instances.current.splice(toRemove[i], 1);
    }

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute;
    const velAttr = geo.getAttribute('aVelocity') as THREE.BufferAttribute;
    const stretchAttr = geo.getAttribute('aStretch') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    velAttr.needsUpdate = true;
    stretchAttr.needsUpdate = true;
    geo.setDrawRange(0, vi);
  });

  return (
    <points ref={meshRef} geometry={geo} material={mat} frustumCulled={false} />
  );
}
