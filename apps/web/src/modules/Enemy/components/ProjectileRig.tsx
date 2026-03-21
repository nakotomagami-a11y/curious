import type { ProjectileSnapshot } from '@curious/shared';

type Props = {
  snapshot: ProjectileSnapshot;
};

export function ProjectileRig({ snapshot }: Props) {
  const isFireball = snapshot.isFireball;

  const color = isFireball ? '#ff6600' : '#9944ff';
  const emissiveColor = isFireball ? '#ff4400' : '#7722dd';
  const lightColor = isFireball ? '#ff5500' : '#9944ff';
  const lightIntensity = isFireball ? 80 : 40;
  const lightDistance = isFireball ? 120 : 80;

  return (
    <group position={[snapshot.position.x, 20, snapshot.position.z]}>
      <mesh>
        <sphereGeometry args={[snapshot.radius, isFireball ? 12 : 8, isFireball ? 12 : 8]} />
        <meshStandardMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={isFireball ? 3 : 2}
        />
      </mesh>
      <pointLight color={lightColor} intensity={lightIntensity} distance={lightDistance} decay={2} />
    </group>
  );
}
