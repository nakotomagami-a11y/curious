'use client';
import { useMemo } from 'react';
import { WALL_HEIGHT, WALL_THICKNESS } from '@curious/shared';
import type { DungeonLayout, DoorState } from '@curious/shared';

type Props = {
  layout: DungeonLayout;
  doorStates: Record<string, string>;
};

const DOOR_MATERIALS: Record<DoorState, { color: string; emissive?: string; opacity: number; transparent: boolean }> = {
  locked: { color: '#882222', emissive: '#ff2222', opacity: 1, transparent: false },
  unlocked: { color: '#666666', emissive: undefined, opacity: 0.5, transparent: true },
  open: { color: '#224422', emissive: '#22ff22', opacity: 0.1, transparent: true },
};

export function DungeonDoors({ layout, doorStates }: Props) {
  const doors = useMemo(() => {
    const result: {
      key: string;
      x: number;
      z: number;
      width: number;
      rotationY: number;
      state: DoorState;
    }[] = [];

    for (const [id, door] of layout.doors) {
      const state = (doorStates[id] as DoorState) ?? door.state;
      const rotationY = door.direction === 'horizontal' ? 0 : Math.PI / 2;
      result.push({
        key: id,
        x: door.position.x,
        z: door.position.z,
        width: door.width,
        rotationY,
        state,
      });
    }
    return result;
  }, [layout, doorStates]);

  return (
    <group>
      {doors.map((d) => {
        const mat = DOOR_MATERIALS[d.state];
        return (
          <mesh
            key={d.key}
            position={[d.x, WALL_HEIGHT / 2, d.z]}
            rotation={[0, d.rotationY, 0]}
          >
            <boxGeometry args={[d.width, WALL_HEIGHT, WALL_THICKNESS]} />
            <meshStandardMaterial
              color={mat.color}
              emissive={mat.emissive ?? '#000000'}
              emissiveIntensity={mat.emissive ? 0.4 : 0}
              opacity={mat.opacity}
              transparent={mat.transparent}
            />
          </mesh>
        );
      })}
    </group>
  );
}
