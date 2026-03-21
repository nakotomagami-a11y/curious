'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WALL_HEIGHT, WALL_THICKNESS } from '@curious/shared';
import type { DungeonLayout } from '@curious/shared';

type Props = {
  layout: DungeonLayout;
  doorStates: Record<string, string>;
};

export function DungeonWalls({ layout }: Props) {
  const geometry = useMemo(() => {
    const geometries: THREE.BoxGeometry[] = [];
    const matrix = new THREE.Matrix4();

    for (const wall of layout.walls) {
      const cx = (wall.ax + wall.bx) / 2;
      const cz = (wall.az + wall.bz) / 2;
      const dx = wall.bx - wall.ax;
      const dz = wall.bz - wall.az;
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length < 0.01) continue;

      const angle = Math.atan2(dx, dz);

      const box = new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS);
      matrix.identity();
      matrix.makeRotationY(angle);
      matrix.setPosition(cx, WALL_HEIGHT / 2, cz);
      box.applyMatrix4(matrix);
      geometries.push(box);
    }

    if (geometries.length === 0) return null;
    const merged = mergeGeometries(geometries, false);
    // Dispose individual geometries
    for (const g of geometries) g.dispose();
    return merged;
  }, [layout]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#333344" metalness={0.3} roughness={0.8} />
    </mesh>
  );
}
