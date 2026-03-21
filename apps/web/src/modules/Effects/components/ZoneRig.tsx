import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { ZoneSnapshot } from '@curious/shared';

export function ZoneRig({ snapshot }: { snapshot: ZoneSnapshot }) {
  const ringRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);

  const { zoneType, radius } = snapshot;

  const color = zoneType === 'heal' ? '#44dd66'
    : zoneType === 'shield_bubble' ? '#4488ff'
    : '#aa44ff'; // gravity_well

  const emissive = zoneType === 'heal' ? '#22aa44'
    : zoneType === 'shield_bubble' ? '#2266cc'
    : '#7722cc';

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
      // Pulse opacity based on remaining duration
      const mat = ringRef.current.material as any;
      if (mat) {
        mat.opacity = 0.15 + Math.sin(t * 3) * 0.05;
      }
    }
    if (innerRef.current) {
      const mat = innerRef.current.material as any;
      if (mat) {
        mat.opacity = 0.08 + Math.sin(t * 2) * 0.03;
      }
    }
  });

  // Shield bubble renders as a sphere, others as ground circles
  if (zoneType === 'shield_bubble') {
    return (
      <group position={[snapshot.position.x, 0, snapshot.position.z]}>
        <mesh ref={ringRef}>
          <sphereGeometry args={[radius, 24, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={0.3}
            transparent
            opacity={0.12}
            wireframe
          />
        </mesh>
        <mesh ref={innerRef}>
          <sphereGeometry args={[radius * 0.98, 24, 16]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.06}
          />
        </mesh>
        <pointLight color={color} intensity={0.3} distance={radius * 1.5} position={[0, radius * 0.5, 0]} />
      </group>
    );
  }

  return (
    <group position={[snapshot.position.x, 0.5, snapshot.position.z]}>
      {/* Outer ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.9, radius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>

      {/* Inner fill */}
      <mesh ref={innerRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.9, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} />
      </mesh>

      {/* Center glow */}
      <pointLight color={color} intensity={0.4} distance={radius * 1.2} position={[0, 5, 0]} />
    </group>
  );
}
