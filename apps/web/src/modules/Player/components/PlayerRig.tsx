import { useRef, forwardRef, useImperativeHandle, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { PlayerSnapshot } from "@curious/shared";
import { PLAYER_RADIUS, DEATH_ROTATE_DURATION } from "@curious/shared";
import "@modules/Effects/materials/dissolve-material";
import { DeathParticles } from "@modules/Effects/components/DeathParticles";
import { useMeleeAnimation } from "@modules/Player/hooks/useMeleeAnimation";
import type { SlashVfxState } from "@modules/Player/hooks/useMeleeAnimation";
import { assetUrl } from "@lib/utils/asset-url";

type Props = {
  snapshot: PlayerSnapshot;
  isLocal: boolean;
};

// ── Body ──────────────────────────────────────────────
const BODY_HEIGHT = 51;
const BODY_RADIUS = PLAYER_RADIUS * 0.4;

// ── Hands (shared) ────────────────────────────────────
const HAND_RADIUS = 5;

// ── Sword hand (right) position ──────────────────────
const SWORD_HAND_X = 10;
const SWORD_HAND_Y = 18;
const SWORD_HAND_Z = -10;

// ── Off-hand (left) position ─────────────────────────
const OFF_HAND_X = -14;
const OFF_HAND_Y = 23;
const OFF_HAND_Z = -3;

// ── Sword geometry ────────────────────────────────────
const SWORD_LENGTH = 28;
const SWORD_GLB_URL = assetUrl("/glb/stylized_sword_wow.glb");

// ── Sword pivot (relative to sword-hand group) ───────
const SWORD_PIVOT_X = SWORD_HAND_X - 1; // slightly inward from hand
const SWORD_PIVOT_Y = SWORD_HAND_Y;
const SWORD_PIVOT_Z = SWORD_HAND_Z - -1; // behind hand

// ── Off-hand rest rotation ────────────────────────────
const OFF_HAND_REST_ANGLE = Math.PI / 6;

// ── Off-hand follow: position-based ───────────────────
// The off-hand sits at (-14, 23, -3). Y-rotation causes massive
// backward drift because |X|=14 >> |Z|=3. Instead we displace the
// mesh in body-space lateral direction, transformed into the
// off-hand group's rotated local space.
const OFF_HAND_FOLLOW_FACTOR = 3.5; // radians → world units
const OFF_HAND_REST_COS = Math.cos(OFF_HAND_REST_ANGLE);
const OFF_HAND_REST_SIN = Math.sin(OFF_HAND_REST_ANGLE);

// ── Idle sway ─────────────────────────────────────────
const SWAY_SPEED = 2.5;
const SWAY_AMOUNT = 0.8;

// ── Movement lean ─────────────────────────────────────
const LEAN_ANGLE = 0.15;
const LEAN_SPEED = 8;
const LEAN_VELOCITY_FACTOR = 0.003;

// ── Knockback tilt ────────────────────────────────────
const KB_TILT_MAX = 0.25;
const KB_TILT_FACTOR = 0.003;

/** Refs exposed via forwardRef for VFX to read sword world positions. */
export type PlayerRigHandle = {
  swordTipRef: React.RefObject<THREE.Object3D | null>;
  swordBaseRef: React.RefObject<THREE.Object3D | null>;
  slashVfxState: React.RefObject<SlashVfxState>;
};

export const PlayerRig = forwardRef<PlayerRigHandle, Props>(function PlayerRig(
  { snapshot, isLocal },
  ref,
) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const swordHandRef = useRef<THREE.Group>(null);
  const offHandRef = useRef<THREE.Group>(null);
  const offHandMeshRef = useRef<THREE.Mesh>(null);
  const swordGroupRef = useRef<THREE.Group>(null);
  const tiltGroupRef = useRef<THREE.Group>(null);
  const leanX = useRef(0);
  const prevPos = useRef({
    x: snapshot.position.x,
    z: snapshot.position.z,
  });

  // Sword world-position markers for VFX
  const swordTipRef = useRef<THREE.Object3D>(null);
  const swordBaseRef = useRef<THREE.Object3D>(null);

  // Load sword GLB — clone scene so each player gets its own instance
  const { scene: swordScene } = useGLTF(SWORD_GLB_URL);
  const swordModel = useMemo(() => swordScene.clone(true), [swordScene]);

  // Expose marker refs so SlashArc can read world positions
  useImperativeHandle(ref, () => ({
    swordTipRef,
    swordBaseRef,
    slashVfxState,
  }));

  const isDying = snapshot.state === "dying";
  const isDead = snapshot.state === "dead";

  // Animation hook — drives sword hand rotation + sword tilt + forward push
  const { swordArmAngle, swordPitch, swordYaw, swordHandPushZ, slashVfxState } =
    useMeleeAnimation(snapshot.attackState, isDying);

  const deathTiltProgress = isDying
    ? Math.min(snapshot.deathTimer / DEATH_ROTATE_DURATION, 1)
    : 0;
  const deathTiltAngle = deathTiltProgress * (Math.PI / 2);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // Idle body sway
    if (bodyRef.current && !isDying && !isDead) {
      bodyRef.current.position.y =
        BODY_HEIGHT / 2 + Math.sin(t * SWAY_SPEED) * SWAY_AMOUNT;
    }

    // Movement lean / death tilt
    if (tiltGroupRef.current) {
      if (isDying) {
        tiltGroupRef.current.rotation.x = deathTiltAngle;
      } else {
        const dx = snapshot.position.x - prevPos.current.x;
        const dz = snapshot.position.z - prevPos.current.z;
        const speed = Math.sqrt(dx * dx + dz * dz);
        const targetLean = Math.min(speed * LEAN_VELOCITY_FACTOR, LEAN_ANGLE);

        const kbx = snapshot.knockbackVelocity?.x ?? 0;
        const kbz = snapshot.knockbackVelocity?.z ?? 0;
        const kbMag = Math.sqrt(kbx * kbx + kbz * kbz);
        const kbTilt = -Math.min(kbMag * KB_TILT_FACTOR, KB_TILT_MAX);

        const finalTarget = targetLean + kbTilt;
        leanX.current +=
          (finalTarget - leanX.current) * Math.min(1, LEAN_SPEED * dt);
        tiltGroupRef.current.rotation.x = leanX.current;
      }
      prevPos.current = {
        x: snapshot.position.x,
        z: snapshot.position.z,
      };
    }

    // ── Sword hand: apply arm rotation + forward push from hook ──
    if (swordHandRef.current) {
      swordHandRef.current.rotation.y = swordArmAngle.current;
      swordHandRef.current.position.z = swordHandPushZ.current;
    }

    // ── Off-hand: position-based lateral follow ──
    // The group stays at its rest rotation (π/6). We displace the
    // MESH in the group's local space to follow the slash laterally
    // in body space, avoiding the backward drift that Y-rotation causes.
    if (offHandRef.current) {
      offHandRef.current.rotation.y = OFF_HAND_REST_ANGLE;
    }
    if (offHandMeshRef.current) {
      // Body-space lateral offset: negative arm angle → positive lateral
      // (sword swings left with +angle, off-hand follows left = more -X)
      const lateralOffset = -swordArmAngle.current * OFF_HAND_FOLLOW_FACTOR;
      // Transform body-space lateral into group's rotated local space
      offHandMeshRef.current.position.x =
        OFF_HAND_X + lateralOffset * OFF_HAND_REST_COS;
      offHandMeshRef.current.position.z =
        OFF_HAND_Z + lateralOffset * OFF_HAND_REST_SIN;
    }

    // ── Sword tilt from hook ──
    if (swordGroupRef.current) {
      swordGroupRef.current.rotation.x = swordPitch.current;
      swordGroupRef.current.rotation.y = swordYaw.current;
    }
  });

  if (isDead) return null;

  const flashing = snapshot.hitFlashTimer > 0;
  const bodyColor = flashing ? "#5599ff" : "#2266ff";
  const handColor = flashing ? "#77bbff" : "#4488ff";
  const flashEmissive = flashing ? "#4477ff" : "#000000";
  const flashIntensity = flashing ? 1.8 : 0;
  const dissolveProgress = isDying ? snapshot.dissolveProgress : 0;

  return (
    <group
      ref={groupRef}
      position={[snapshot.position.x, 0, snapshot.position.z]}
    >
      {isDying && snapshot.dissolveProgress > 0 && (
        <DeathParticles position={[0, 0, 0]} color="#4488ff" count={24} />
      )}

      {/* Hit flash glow light — illuminates nearby entities */}
      {flashing && (
        <pointLight
          position={[0, BODY_HEIGHT / 2, 0]}
          color="#5588ff"
          intensity={40}
          distance={120}
          decay={2}
        />
      )}

      {/* Rotation group — faces aim direction */}
      <group rotation={[0, snapshot.rotation, 0]}>
        {/* Tilt group — leans forward on movement, rotates on death */}
        <group ref={tiltGroupRef}>
          {/* Body */}
          <mesh ref={bodyRef} position={[0, BODY_HEIGHT / 2, 0]} castShadow receiveShadow>
            <capsuleGeometry
              args={[BODY_RADIUS, BODY_HEIGHT - BODY_RADIUS * 2, 8, 16]}
            />
            <dissolveMaterial
              color={bodyColor}
              dissolveProgress={dissolveProgress}
              edgeColor="#6699ff"
              marbleStrength={0}
              emissive={flashEmissive}
              emissiveIntensity={flashIntensity}
            />
          </mesh>

          {/* Off-hand (left) — group stays at rest rotation,
                mesh position displaced by useFrame for follow */}
          <group ref={offHandRef}>
            <mesh
              ref={offHandMeshRef}
              position={[OFF_HAND_X, OFF_HAND_Y, OFF_HAND_Z]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[HAND_RADIUS, 12, 12]} />
              <dissolveMaterial
                color={handColor}
                dissolveProgress={dissolveProgress}
                edgeColor="#6699ff"
                emissive={flashEmissive}
                emissiveIntensity={flashIntensity}
              />
            </mesh>
          </group>

          {/* Sword hand (right) + sword */}
          <group ref={swordHandRef}>
            <mesh
              position={[SWORD_HAND_X, SWORD_HAND_Y, SWORD_HAND_Z]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[HAND_RADIUS, 12, 12]} />
              <dissolveMaterial
                color={handColor}
                dissolveProgress={dissolveProgress}
                edgeColor="#6699ff"
                emissive={flashEmissive}
                emissiveIntensity={flashIntensity}
              />
            </mesh>

            {/* Sword — position is static, rotation is dynamic via hook */}
            <group position={[SWORD_PIVOT_X, SWORD_PIVOT_Y, SWORD_PIVOT_Z]}>
              <group ref={swordGroupRef}>
                {/* GLB sword model — rotated so model X-axis → game Z-axis
                       Tweak these to adjust sword appearance:
                       - scale: uniform size (was 6.4, now 12.8 = 2x bigger)
                       - position: [lateral, vertical, forward] relative to pivot
                       - rotation: [pitch, yaw, roll] — yaw=-PI/2 maps model X→Z */}
                <primitive
                  object={swordModel}
                  scale={[12.8, 12.8, 12.8]}
                  position={[0, 0, HAND_RADIUS + SWORD_LENGTH / 2]}
                  rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
                />

                {/* Invisible markers for VFX — read via getWorldPosition() */}
                <object3D
                  ref={swordTipRef}
                  position={[0, 0, SWORD_LENGTH + HAND_RADIUS]}
                />
                <object3D ref={swordBaseRef} position={[0, 0, HAND_RADIUS]} />
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* Name — billboard, hide for local player and when dying */}
      {!isLocal && !isDying && (
        <Billboard position={[0, BODY_HEIGHT + 8, 0]}>
          <Text
            fontSize={9}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.5}
            outlineColor="#000000"
          >
            {snapshot.name}
          </Text>
        </Billboard>
      )}
    </group>
  );
});

useGLTF.preload(SWORD_GLB_URL);
