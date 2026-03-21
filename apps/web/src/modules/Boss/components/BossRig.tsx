import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { BossSnapshot } from '@curious/shared';
import { BOSS_SCALE, BOSS_RADIUS } from '@curious/shared';
import '@modules/Effects/materials/dissolve-material';
import { DeathParticles } from '@modules/Effects/components/DeathParticles';
import { assetUrl } from '@lib/utils/asset-url';

type Props = {
  snapshot: BossSnapshot;
};

const BODY_HEIGHT = 42 * BOSS_SCALE; // 28 * 1.5
const BODY_RADIUS = 12 * BOSS_SCALE;
const HAND_RADIUS = 5 * BOSS_SCALE;
const HAND_OFFSET_Y = 24 * BOSS_SCALE; // 16 * 1.5
const HAND_OFFSET_SIDE = 15 * BOSS_SCALE;
const HAND_OFFSET_FORWARD = 6 * BOSS_SCALE; // +Z = forward

const SWAY_SPEED = 1.5; // slower, heavier feel
const SWAY_AMOUNT = 1.0;

// Jump arc height
const JUMP_ARC_HEIGHT = 80;

// Knockback tilt — heavier, less reactive than enemies
const KB_TILT_MAX = 0.2; // max radians (~11°)
const KB_TILT_SPEED = 6;

export function BossRig({ snapshot }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const leftHandRef = useRef<THREE.Mesh>(null);
  const rightHandRef = useRef<THREE.Mesh>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const tiltX = useRef(0);

  const isJumping = snapshot.aiState === 'jumping';
  const isRecovering = snapshot.aiState === 'recovering';

  // Jump Y: sin arc during jump
  const jumpY = isJumping ? Math.sin(snapshot.slamProgress * Math.PI) * JUMP_ARC_HEIGHT : 0;
  // Brief squash on slam recovery start
  const squashY = isRecovering && snapshot.slamProgress < 0.15 ? 0.8 : 1.0;
  const stretchY = isRecovering && snapshot.slamProgress < 0.15 ? 1.2 : 1.0;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    if (bodyRef.current) {
      bodyRef.current.position.y = BODY_HEIGHT / 2 + Math.sin(t * SWAY_SPEED) * SWAY_AMOUNT;
    }
    if (leftHandRef.current) {
      leftHandRef.current.position.y = HAND_OFFSET_Y + Math.sin(t * SWAY_SPEED + 0.3) * SWAY_AMOUNT * 0.5;
    }
    if (rightHandRef.current) {
      rightHandRef.current.position.y = HAND_OFFSET_Y + Math.sin(t * SWAY_SPEED + 0.6) * SWAY_AMOUNT * 0.5;
    }

    // Knockback tilt — tilt backward when hit
    if (tiltRef.current) {
      const kbx = snapshot.knockbackVelocity?.x ?? 0;
      const kbz = snapshot.knockbackVelocity?.z ?? 0;
      const kbMag = Math.sqrt(kbx * kbx + kbz * kbz);
      const target = -Math.min(kbMag * 0.003, KB_TILT_MAX);
      tiltX.current += (target - tiltX.current) * Math.min(1, KB_TILT_SPEED * dt);
      tiltRef.current.rotation.x = tiltX.current;
    }

  });

  const flashing = snapshot.hitFlashTimer > 0;
  const bodyColor = flashing ? '#55cc55' : '#22bb22';
  const handColor = flashing ? '#77dd77' : '#44dd44';
  const flashEmissive = flashing ? '#335522' : '#000000';
  const flashIntensity = flashing ? 0.6 : 0;

  // Show respawn countdown when dead
  if (snapshot.aiState === 'dead') {
    if (snapshot.respawnTimer > 0) {
      return (
        <group position={[snapshot.position.x, 0, snapshot.position.z]}>
          <Billboard position={[0, 30, 0]}>
            <Text
              font={assetUrl("/fonts/Matemasie/Matemasie-Regular.ttf")}
              fontSize={16}
              color="#44aa44"
              anchorX="center"
              anchorY="middle"
              outlineWidth={1}
              outlineColor="#000000"
            >
              {Math.ceil(snapshot.respawnTimer)}
            </Text>
          </Billboard>
        </group>
      );
    }
    return null;
  }

  const dissolving = snapshot.aiState === 'dying';
  const dissolveProgress = dissolving ? snapshot.dissolveProgress : 0;

  return (
    <group position={[snapshot.position.x, jumpY, snapshot.position.z]}>
      {/* Death particles */}
      {dissolving && (
        <DeathParticles position={[0, 0, 0]} color="#44aa44" count={36} />
      )}

      {/* Hit flash glow light — illuminates nearby entities */}
      {flashing && (
        <pointLight
          position={[0, BODY_HEIGHT / 2, 0]}
          color="#77dd33"
          intensity={60}
          distance={160}
          decay={2}
        />
      )}

      {/* Rotation group */}
      <group rotation={[0, snapshot.rotation, 0]}>
        {/* Tilt group — knockback recoil */}
        <group ref={tiltRef}>
        {/* Squash/stretch group */}
        <group scale={[stretchY, squashY, stretchY]}>
          {/* Body — green capsule, 1.5x scale */}
          <mesh ref={bodyRef} position={[0, BODY_HEIGHT / 2, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[BODY_RADIUS, BODY_HEIGHT - BODY_RADIUS * 2, 8, 16]} />
            <dissolveMaterial
              color={bodyColor}
              dissolveProgress={dissolveProgress}
              edgeColor="#88ff44"
              emissive={flashEmissive}
              emissiveIntensity={flashIntensity}
            />
          </mesh>

          {/* Left hand */}
          <mesh
            ref={leftHandRef}
            position={[-HAND_OFFSET_SIDE, HAND_OFFSET_Y, HAND_OFFSET_FORWARD]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[HAND_RADIUS, 12, 12]} />
            <dissolveMaterial
              color={handColor}
              dissolveProgress={dissolveProgress}
              edgeColor="#88ff44"
              emissive={flashEmissive}
              emissiveIntensity={flashIntensity}
            />
          </mesh>

          {/* Right hand */}
          <mesh
            ref={rightHandRef}
            position={[HAND_OFFSET_SIDE, HAND_OFFSET_Y, HAND_OFFSET_FORWARD]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[HAND_RADIUS, 12, 12]} />
            <dissolveMaterial
              color={handColor}
              dissolveProgress={dissolveProgress}
              edgeColor="#88ff44"
              emissive={flashEmissive}
              emissiveIntensity={flashIntensity}
            />
          </mesh>
        </group>
        </group>
      </group>

      {/* Boss health shown in screen-space HUD */}
    </group>
  );
}
