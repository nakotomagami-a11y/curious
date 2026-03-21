import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOSS_SLAM_RADIUS } from '@curious/shared';
import type { BossSnapshot } from '@curious/shared';

type Props = {
  boss: BossSnapshot;
};

const slamVertexShader = /* glsl */ `
  varying vec2 vUV;

  void main() {
    vUV = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const slamFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;

  varying vec2 vUV;

  float hash2D(vec2 p) {
    p = fract(p * vec2(443.897, 397.297));
    p += dot(p, p.yx + 19.19);
    return fract(p.x * p.y);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash2D(i);
    float b = hash2D(i + vec2(1.0, 0.0));
    float c = hash2D(i + vec2(0.0, 1.0));
    float d = hash2D(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 centered = vUV * 2.0 - 1.0;
    float dist = length(centered);

    // Thin ring shape (~9% of radius width, 5x thinner than before)
    float innerRadius = 0.91;
    float outerRadius = 1.0;

    // Noise-based edge breakup
    float angle = atan(centered.y, centered.x);
    float n = noise2D(vec2(angle * 3.0 + uTime * 0.5, dist * 4.0)) * 0.02;
    float n2 = noise2D(vec2(angle * 6.0 - uTime * 1.0, dist * 8.0)) * 0.01;

    float ring = smoothstep(innerRadius - 0.01 + n, innerRadius + 0.01 + n, dist)
               * smoothstep(outerRadius + 0.01 - n2, outerRadius - 0.01 - n2, dist);

    if (ring < 0.01) discard;

    // Red gradient for the ring
    float ringT = clamp((dist - innerRadius) / (outerRadius - innerRadius), 0.0, 1.0);
    vec3 innerColor = vec3(0.4, 0.0, 0.0);
    vec3 midColor = vec3(1.0, 0.1, 0.05);
    vec3 outerColor = vec3(0.5, 0.0, 0.0);

    vec3 color;
    if (ringT < 0.4) {
      color = mix(innerColor, midColor, ringT / 0.4);
    } else {
      color = mix(midColor, outerColor, (ringT - 0.4) / 0.6);
    }

    // Pulse animation — stronger throb
    float pulse = 1.0 + sin(uTime * 10.0) * 0.5 * uPulse;

    float alpha = ring * 0.85 * pulse;

    gl_FragColor = vec4(color * pulse, alpha);
  }
`;

export function SlamIndicator({ boss }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 1.0 },
      },
      vertexShader: slamVertexShader,
      fragmentShader: slamFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  const showIndicator =
    (boss.aiState === 'telegraphing' || boss.aiState === 'jumping') &&
    boss.slamTargetPosition !== null;

  useFrame((state) => {
    if (!showIndicator) return;

    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPulse.value = boss.aiState === 'telegraphing' ? 1.0 : 0.0;
  });

  if (!showIndicator || !boss.slamTargetPosition) return null;

  return (
    <mesh
      ref={meshRef}
      position={[boss.slamTargetPosition.x, 0.2, boss.slamTargetPosition.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
    >
      <circleGeometry args={[BOSS_SLAM_RADIUS, 48]} />
    </mesh>
  );
}
