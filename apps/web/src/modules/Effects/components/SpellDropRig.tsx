import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { SpellDropSnapshot, SpellId } from '@curious/shared';

function getSpellDropColor(spellId: SpellId): string {
  switch (spellId) {
    case 'fireball': return '#ff6622';
    case 'ice_lance': return '#66ccff';
    case 'lightning_chain': return '#ffee44';
    case 'heal_circle': return '#44dd66';
    case 'shield_bubble': return '#4488ff';
    case 'gravity_well': return '#aa44ff';
    case 'block_shield': return '#ffcc22';
  }
}

export function SpellDropRig({ snapshot }: { snapshot: SpellDropSnapshot }) {
  const meshRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  const color = getSpellDropColor(snapshot.spellId);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    // Bob up and down
    meshRef.current.position.y = 12 + Math.sin(t * 2.5) * 4;
    // Rotate
    meshRef.current.rotation.y = t * 1.5;

    // Glow pulse
    if (glowRef.current) {
      const scale = 1.2 + Math.sin(t * 3) * 0.2;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={[snapshot.position.x, 0, snapshot.position.z]}>
      {/* Glow ring on ground */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
        <ringGeometry args={[14, 20, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {/* Floating orb */}
      <mesh ref={meshRef} position={[0, 12, 0]}>
        <dodecahedronGeometry args={[6, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>

      {/* Point light */}
      <pointLight
        position={[0, 12, 0]}
        color={color}
        intensity={0.5}
        distance={60}
      />
    </group>
  );
}
