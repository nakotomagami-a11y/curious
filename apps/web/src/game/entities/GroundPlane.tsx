import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ARENA_WIDTH, ARENA_HEIGHT } from '@curious/shared';

/** Subtle grid ground shader with drifting dark cloud overlay. */
const gridShader = {
  uniforms: {
    uColor: { value: new THREE.Color('#1a1a2e') },
    uGridColor: { value: new THREE.Color('#252545') },
    uGridSize: { value: 100.0 },
    uLineWidth: { value: 0.02 },
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vWorldPos;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPosition.xz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uGridColor;
    uniform float uGridSize;
    uniform float uLineWidth;
    uniform float uTime;
    varying vec2 vWorldPos;

    // 2D hash-based value noise
    float hash2D(vec2 p) {
      p = fract(p * vec2(443.8975, 397.2973));
      p += dot(p, p.yx + 19.19);
      return fract(p.x * p.y);
    }

    float noise2D(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float n00 = hash2D(i);
      float n10 = hash2D(i + vec2(1.0, 0.0));
      float n01 = hash2D(i + vec2(0.0, 1.0));
      float n11 = hash2D(i + vec2(1.0, 1.0));

      return mix(mix(n00, n10, f.x), mix(n01, n11, f.x), f.y);
    }

    // Fractal Brownian Motion — 4 octaves
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise2D(p);
        p = p * 2.1 + vec2(1.7, 9.2);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      // Grid lines
      vec2 grid = abs(fract(vWorldPos / uGridSize - 0.5) - 0.5);
      float line = min(grid.x, grid.y);
      float gridMask = 1.0 - smoothstep(uLineWidth, uLineWidth + 0.01, line);

      // Fade grid at edges for vignette effect
      float dist = length(vWorldPos) / 800.0;
      float fade = 1.0 - smoothstep(0.5, 1.2, dist);
      gridMask *= fade * 0.5;

      vec3 color = mix(uColor, uGridColor, gridMask);

      // Dark drifting clouds
      vec2 cloudUV = vWorldPos * 0.0015 + uTime * vec2(0.015, 0.008);
      float cloud = fbm(cloudUV);
      cloud = smoothstep(0.35, 0.65, cloud);
      color = mix(color, vec3(0.03, 0.03, 0.08), cloud * 0.4);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function GroundPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const material = useMemo(
    () => new THREE.ShaderMaterial({ ...gridShader }),
    []
  );

  const shadowMat = useMemo(
    () => new THREE.ShadowMaterial({ opacity: 0.7 }),
    []
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group>
      {/* Visual ground — grid + clouds */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ARENA_WIDTH, ARENA_HEIGHT]} />
        <primitive object={material} ref={materialRef} attach="material" />
      </mesh>

      {/* Shadow overlay — transparent except where shadows fall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} receiveShadow>
        <planeGeometry args={[ARENA_WIDTH, ARENA_HEIGHT]} />
        <primitive object={shadowMat} attach="material" />
      </mesh>
    </group>
  );
}
