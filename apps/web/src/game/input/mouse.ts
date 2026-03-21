import * as THREE from 'three';
import type { Vec2 } from '@curious/shared';

const raycaster = new THREE.Raycaster();
const screenCoord = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // XZ plane at y=0
const intersection = new THREE.Vector3();

/** Project screen mouse position onto XZ ground plane. */
export function projectMouseToGround(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  domElement: HTMLElement
): Vec2 | null {
  const rect = domElement.getBoundingClientRect();
  screenCoord.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  screenCoord.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(screenCoord, camera);
  const hit = raycaster.ray.intersectPlane(groundPlane, intersection);
  if (!hit) return null;

  return { x: intersection.x, z: intersection.z };
}
