import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type SpawnAnimProps = {
  position: [number, number, number];
  color?: string;
  onComplete?: () => void;
};

/**
 * Enemy spawn animation: ground circle expands -> entity rises -> circle fades.
 * Mount this component when an enemy spawns, unmount when animation completes.
 */
export function SpawnAnimation({ position, color = '#ff4444', onComplete }: SpawnAnimProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const pillarsRef = useRef<THREE.Group>(null);
  const age = useRef(0);
  const DURATION = 0.5;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    age.current += dt;
    const t = Math.min(age.current / DURATION, 1);

    if (ringRef.current) {
      // Ring expands from 0 to full size
      const scale = t < 0.5 ? t * 2 : 1;
      ringRef.current.scale.setScalar(scale);

      // Fade out in second half
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = t < 0.5 ? 0.4 : 0.4 * (1 - (t - 0.5) * 2);
    }

    if (pillarsRef.current) {
      // Rising particles
      for (let i = 0; i < pillarsRef.current.children.length; i++) {
        const child = pillarsRef.current.children[i] as THREE.Mesh;
        const offset = i / pillarsRef.current.children.length;
        const localT = Math.max(0, t - offset * 0.3);
        child.position.y = localT * 30;
        child.scale.setScalar(Math.max(0, 1 - localT));
        const mat = child.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 1 - localT * 1.5);
      }
    }

    if (t >= 1 && onComplete) {
      onComplete();
    }
  });

  return (
    <group position={position}>
      {/* Ground ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
        <ringGeometry args={[15, 30, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Rising particles */}
      <group ref={pillarsRef}>
        {Array.from({ length: 6 }, (_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.sin(angle) * 20;
          const z = Math.cos(angle) * 20;
          return (
            <mesh key={i} position={[x, 0, z]}>
              <boxGeometry args={[2, 8, 2]} />
              <meshBasicMaterial color={color} transparent opacity={0.6} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
