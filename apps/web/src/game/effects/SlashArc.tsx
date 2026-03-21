import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerRigHandle } from "../entities/PlayerRig";
import type { PlayerSnapshot } from "@curious/shared";
import { assetUrl } from "@/utils/asset-url";

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

/** Sprite sheet layout */
const COLS = 6;
const ROWS = 3;
const TOTAL_FRAMES = COLS * ROWS;

/** World-unit size of the flipbook quad (sword is ~28 units long) */
const QUAD_SIZE = 130;

// Embers
const MAX_EMBERS = 128;
const EMBER_GRAVITY = 7.5;
const EMBER_DRAG = 5.4;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Props = {
  rigRef: React.RefObject<PlayerRigHandle | null>;
  snapshot: PlayerSnapshot;
};

type EmberPool = {
  mesh: THREE.InstancedMesh | null;
  positions: Float32Array;
  velocities: Float32Array;
  sizes: Float32Array;
  ages: Float32Array;
  lifetimes: Float32Array;
  heats: Float32Array;
  angles: Float32Array;
  spins: Float32Array;
  alive: Uint8Array;
  cursor: number;
};

// ─────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// ─────────────────────────────────────────────────────────────
// Chip texture (procedural, for ember particles)
// ─────────────────────────────────────────────────────────────

function createChipTexture(): THREE.Texture {
  if (typeof document === "undefined") {
    const data = new Uint8Array([255, 255, 255, 255]);
    const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const w = 64,
    h = 64;

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,110,44,0.95)";
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.08);
  ctx.lineTo(w * 0.88, h * 0.5);
  ctx.lineTo(w * 0.5, h * 0.92);
  ctx.lineTo(w * 0.12, h * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,248,232,1.0)";
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.22);
  ctx.lineTo(w * 0.72, h * 0.5);
  ctx.lineTo(w * 0.5, h * 0.78);
  ctx.lineTo(w * 0.28, h * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(w * 0.05, h * 0.05, 10, 6);
  ctx.fillRect(w * 0.78, h * 0.22, 8, 7);
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ─────────────────────────────────────────────────────────────
// Shared temps (module-level, reused each frame)
// ─────────────────────────────────────────────────────────────

const _tmpX = new THREE.Vector3();
const _tmpY = new THREE.Vector3();
const _tmpZ = new THREE.Vector3();
const _tmpRight = new THREE.Vector3();
const _tmpUp = new THREE.Vector3();
const _tmpFwd = new THREE.Vector3();
const _tmpScale = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpMat = new THREE.Matrix4();
const _tmpBasis = new THREE.Matrix4();
const _tmpColor = new THREE.Color();
const _tmpColorB = new THREE.Color();
const _bladeDir = new THREE.Vector3();
const _tangent = new THREE.Vector3();

// ─────────────────────────────────────────────────────────────
// Instance card helper (billboard quad for embers)
// ─────────────────────────────────────────────────────────────

function setInstanceCard(
  mesh: THREE.InstancedMesh,
  index: number,
  position: THREE.Vector3,
  xAxis: THREE.Vector3,
  yAxis: THREE.Vector3,
  scaleX: number,
  scaleY: number,
  color: THREE.Color,
) {
  _tmpX.copy(xAxis).normalize();
  _tmpY.copy(yAxis);

  _tmpZ.crossVectors(_tmpX, _tmpY);
  if (_tmpZ.lengthSq() < 1e-8) {
    _tmpZ.set(0, 0, 1);
  } else {
    _tmpZ.normalize();
  }

  _tmpY.crossVectors(_tmpZ, _tmpX).normalize();

  _tmpBasis.makeBasis(_tmpX, _tmpY, _tmpZ);
  _tmpQuat.setFromRotationMatrix(_tmpBasis);
  _tmpScale.set(scaleX, scaleY, 1);
  _tmpMat.compose(position, _tmpQuat, _tmpScale);

  mesh.setMatrixAt(index, _tmpMat);
  mesh.setColorAt(index, color);
}

function commitLayer(mesh: THREE.InstancedMesh | null, count: number) {
  if (!mesh) return;
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// ─────────────────────────────────────────────────────────────
// Ember system
// ─────────────────────────────────────────────────────────────

function createEmberPool(): EmberPool {
  return {
    mesh: null,
    positions: new Float32Array(MAX_EMBERS * 3),
    velocities: new Float32Array(MAX_EMBERS * 3),
    sizes: new Float32Array(MAX_EMBERS),
    ages: new Float32Array(MAX_EMBERS),
    lifetimes: new Float32Array(MAX_EMBERS),
    heats: new Float32Array(MAX_EMBERS),
    angles: new Float32Array(MAX_EMBERS),
    spins: new Float32Array(MAX_EMBERS),
    alive: new Uint8Array(MAX_EMBERS),
    cursor: 0,
  };
}

function spawnEmber(
  pool: EmberPool,
  px: number,
  py: number,
  pz: number,
  vx: number,
  vy: number,
  vz: number,
  size: number,
  life: number,
  heat: number,
) {
  const i = pool.cursor++ % MAX_EMBERS;
  const ii = i * 3;

  pool.positions[ii] = px;
  pool.positions[ii + 1] = py;
  pool.positions[ii + 2] = pz;

  pool.velocities[ii] = vx;
  pool.velocities[ii + 1] = vy;
  pool.velocities[ii + 2] = vz;

  pool.sizes[i] = size;
  pool.ages[i] = 0;
  pool.lifetimes[i] = life;
  pool.heats[i] = heat;
  pool.angles[i] = Math.random() * Math.PI * 2;
  pool.spins[i] = (Math.random() - 0.5) * 12.0;
  pool.alive[i] = 1;
}

function emitEmbersFromSword(
  pool: EmberPool,
  tip: THREE.Vector3,
  base: THREE.Vector3,
  prevTip: THREE.Vector3,
  progress: number,
) {
  _bladeDir.subVectors(tip, base);
  const bladeLen = _bladeDir.length();
  if (bladeLen < 0.001) return;
  _bladeDir.divideScalar(bladeLen);

  _tangent.subVectors(tip, prevTip);
  const tangentLen = _tangent.length();
  if (tangentLen > 0.001) _tangent.divideScalar(tangentLen);
  else _tangent.set(1, 0, 0);

  const count = progress > 0.6 ? 4 : 2;
  const energy = 0.85 + smoothstep(0.35, 1.0, progress) * 0.9;

  for (let k = 0; k < count; k++) {
    const t = 0.6 + Math.random() * 0.4;
    const px = base.x + _bladeDir.x * bladeLen * t;
    const py = base.y + _bladeDir.y * bladeLen * t;
    const pz = base.z + _bladeDir.z * bladeLen * t;

    const outward = 1.2 + Math.random() * 1.6;
    const forward = 1.1 + Math.random() * 1.8;
    const up = 0.35 + Math.random() * 1.0;

    spawnEmber(
      pool,
      px + (Math.random() - 0.5) * 0.06,
      py + (Math.random() - 0.5) * 0.06,
      pz + (Math.random() - 0.5) * 0.06,
      _bladeDir.x * outward * energy +
        _tangent.x * forward * energy +
        (Math.random() - 0.5) * 0.4,
      _bladeDir.y * outward * energy + _tangent.y * forward * energy + up,
      _bladeDir.z * outward * energy +
        _tangent.z * forward * energy +
        (Math.random() - 0.5) * 0.4,
      0.035 + Math.random() * 0.05,
      0.1 + Math.random() * 0.12,
      0.62 + Math.random() * 0.38,
    );
  }

  // Big spark from tip
  if (Math.random() > 0.4) {
    spawnEmber(
      pool,
      tip.x,
      tip.y,
      tip.z,
      _bladeDir.x * 3.2 * energy + _tangent.x * 3.4 * energy,
      _bladeDir.y * 3.2 * energy + _tangent.y * 3.4 * energy + 1.1,
      _bladeDir.z * 3.2 * energy + _tangent.z * 3.4 * energy,
      0.055 + Math.random() * 0.04,
      0.08 + Math.random() * 0.05,
      0.95,
    );
  }
}

function updateEmbers(pool: EmberPool, dt: number, camera: THREE.Camera) {
  const mesh = pool.mesh;
  if (!mesh) return;

  camera.matrixWorld.extractBasis(_tmpRight, _tmpUp, _tmpFwd);
  _tmpRight.normalize();
  _tmpUp.normalize();

  let drawCount = 0;

  for (let i = 0; i < MAX_EMBERS; i++) {
    if (!pool.alive[i]) continue;

    pool.ages[i] += dt;
    const age = pool.ages[i];
    const life = pool.lifetimes[i];

    if (age >= life) {
      pool.alive[i] = 0;
      continue;
    }

    const t = 1.0 - age / life;
    const ii = i * 3;

    const drag = Math.exp(-EMBER_DRAG * dt);
    pool.velocities[ii] *= drag;
    pool.velocities[ii + 1] *= drag;
    pool.velocities[ii + 2] *= drag;
    pool.velocities[ii + 1] -= EMBER_GRAVITY * dt;

    pool.positions[ii] += pool.velocities[ii] * dt;
    pool.positions[ii + 1] += pool.velocities[ii + 1] * dt;
    pool.positions[ii + 2] += pool.velocities[ii + 2] * dt;

    pool.angles[i] += pool.spins[i] * dt;

    const c = Math.cos(pool.angles[i]);
    const s = Math.sin(pool.angles[i]);

    _tmpX.copy(_tmpRight).multiplyScalar(c).addScaledVector(_tmpUp, s);
    _tmpY.copy(_tmpUp).multiplyScalar(c).addScaledVector(_tmpRight, -s);

    const size = pool.sizes[i] * (0.55 + t * 0.45);

    _tmpColor
      .set("#ff541d")
      .lerp(_tmpColorB.set("#fff1d2"), pool.heats[i] * (0.28 + t * 0.5));
    _tmpColor.multiplyScalar(0.85 + t * 0.55);

    setInstanceCard(
      mesh,
      drawCount++,
      new THREE.Vector3(
        pool.positions[ii],
        pool.positions[ii + 1],
        pool.positions[ii + 2],
      ),
      _tmpX,
      _tmpY,
      size,
      size,
      _tmpColor,
    );
  }

  commitLayer(mesh, drawCount);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function SlashArc({ rigRef, snapshot }: Props) {
  // Flipbook sprite sheet
  const spriteSheet = useMemo(() => {
    const tex = new THREE.TextureLoader().load(
      assetUrl("/textures/slash-spritesheet.png"),
      () => console.log("[SlashArc] sprite sheet loaded OK"),
      undefined,
      (err) => console.error("[SlashArc] sprite sheet FAILED", err),
    );
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Slash material — ShaderMaterial ignores texture alpha,
  // uses pure additive blending (ONE+ONE) so black = transparent.
  const slashMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: spriteSheet },
          uOffset: { value: new THREE.Vector2(0, (ROWS - 1) / ROWS) },
          uRepeat: { value: new THREE.Vector2(1 / COLS, 1 / ROWS) },
          uOpacity: { value: 1.0 },
        },
        vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
        fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec2 uOffset;
        uniform vec2 uRepeat;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec2 uv = uOffset + vUv * uRepeat;
          vec3 texel = texture2D(uMap, uv).rgb;
          gl_FragColor = vec4(texel * uOpacity, 1.0);
        }
      `,
        transparent: true,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [spriteSheet],
  );

  // Ember material + texture
  const chipTex = useMemo(() => createChipTexture(), []);
  const emberMat = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: chipTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    mat.depthTest = false;
    return mat;
  }, [chipTex]);

  // Geometry
  const slashGeo = useMemo(
    () => new THREE.PlaneGeometry(QUAD_SIZE, QUAD_SIZE),
    [],
  );
  const emberGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Ember pool
  const embers = useMemo(() => createEmberPool(), []);

  // Refs
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const lightIntensity = useRef(0);
  const prevSwingId = useRef(-1);
  const lastFrame = useRef(0);
  const prevTipPos = useRef(new THREE.Vector3());
  const hasPrevTip = useRef(false);
  const frozenPos = useRef(new THREE.Vector3());

  // World-space scratch (per-component, safe from multi-instance conflicts)
  const tmpTip = useMemo(() => new THREE.Vector3(), []);
  const tmpBase = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const vfx = rigRef.current?.slashVfxState?.current;
    const mesh = meshRef.current;

    // Always tick embers (they may be in flight after swing ended)
    updateEmbers(embers, dt, state.camera);

    if (!vfx || !mesh) return;

    const isActive = vfx.active && vfx.progress > 0;
    const isFading =
      !vfx.active && vfx.fadeProgress > 0 && vfx.fadeProgress < 1;

    // New swing started — capture player body center as pivot
    if (isActive && vfx.swingId !== prevSwingId.current) {
      prevSwingId.current = vfx.swingId;
      hasPrevTip.current = false;

      const baseObj = rigRef.current?.swordBaseRef?.current;
      if (baseObj) {
        // Walk up to the PlayerRig root group (top-level <group>)
        let root: THREE.Object3D = baseObj;
        while (root.parent && root.parent.type !== "Scene") {
          root = root.parent;
        }
        root.updateWorldMatrix(true, false);
        root.getWorldPosition(frozenPos.current);
        // Offset Y to body center (BODY_HEIGHT / 2 ≈ 25)
        frozenPos.current.y += 25;
      }
    }

    // Nothing to show — fade out light even when idle
    if (!isActive && !isFading) {
      mesh.visible = false;
      hasPrevTip.current = false;
      if (lightRef.current && lightIntensity.current > 0) {
        lightIntensity.current *= Math.max(0, 1 - 18 * dt);
        if (lightIntensity.current < 1) lightIntensity.current = 0;
        lightRef.current.intensity = lightIntensity.current;
      }
      return;
    }

    mesh.visible = true;

    // ── Frame selection ──────────────────────────────────────
    let frame: number;
    if (isActive) {
      frame = Math.min(
        Math.floor(vfx.progress * TOTAL_FRAMES),
        TOTAL_FRAMES - 1,
      );
      lastFrame.current = frame;
    } else {
      frame = lastFrame.current;
    }

    const col = frame % COLS;
    const row = Math.floor(frame / COLS);

    // ── UV offset (image row 0 = top = UV y high) ───────────
    const flipX = vfx.direction < 0;
    const u = slashMat.uniforms;
    if (flipX) {
      u.uRepeat.value.set(-1 / COLS, 1 / ROWS);
      u.uOffset.value.set((col + 1) / COLS, (ROWS - 1 - row) / ROWS);
    } else {
      u.uRepeat.value.set(1 / COLS, 1 / ROWS);
      u.uOffset.value.set(col / COLS, (ROWS - 1 - row) / ROWS);
    }

    // ── Position (always use frozen pivot from swing start) ──
    mesh.position.copy(frozenPos.current);

    // Emit embers from live sword position
    if (isActive) {
      const tipObj = rigRef.current?.swordTipRef?.current;
      const baseObj = rigRef.current?.swordBaseRef?.current;
      if (tipObj && baseObj) {
        tipObj.updateWorldMatrix(true, false);
        baseObj.updateWorldMatrix(true, false);
        tipObj.getWorldPosition(tmpTip);
        baseObj.getWorldPosition(tmpBase);

        emitEmbersFromSword(
          embers,
          tmpTip,
          tmpBase,
          hasPrevTip.current ? prevTipPos.current : tmpTip,
          vfx.progress,
        );
        prevTipPos.current.copy(tmpTip);
        hasPrevTip.current = true;
      }
    }

    // Billboard to camera, then rotate by player facing + base offset
    mesh.quaternion.copy(state.camera.quaternion);
    const baseAngle = 5 * (Math.PI / 180);
    _tmpQuat.setFromAxisAngle(_tmpUp.set(0, 0, 1), baseAngle + snapshot.rotation);
    mesh.quaternion.multiply(_tmpQuat);

    // ── Opacity ──────────────────────────────────────────────
    slashMat.uniforms.uOpacity.value = isFading
      ? clamp01(1 - vfx.fadeProgress)
      : 1.0;

    // ── Slash light ─────────────────────────────────────────
    if (lightRef.current) {
      const targetIntensity = isActive ? 800 : 0;
      lightIntensity.current += (targetIntensity - lightIntensity.current) * Math.min(1, 18 * dt);
      if (lightIntensity.current < 1) lightIntensity.current = 0;
      lightRef.current.intensity = lightIntensity.current;
      lightRef.current.position.copy(frozenPos.current);
      lightRef.current.position.y = 35; // above ground for wider spread
    }
  });

  return (
    <>
      <pointLight
        ref={lightRef}
        color="#5588ff"
        intensity={0}
        distance={300}
        decay={1.5}
      />
      <mesh
        ref={meshRef}
        geometry={slashGeo}
        material={slashMat}
        visible={false}
        frustumCulled={false}
        renderOrder={10}
      />
      <instancedMesh
        ref={(el) => {
          embers.mesh = el;
          if (el) {
            el.count = 0;
            el.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            el.frustumCulled = false;
          }
        }}
        args={[emberGeo, emberMat, MAX_EMBERS]}
        frustumCulled={false}
        visible
        renderOrder={16}
      />
    </>
  );
}
