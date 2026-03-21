import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { EnemySnapshot } from "@curious/shared";
import { ENEMY_RADIUS } from "@curious/shared";
import "../materials/dissolve-material";
import { DeathParticles } from "../effects/DeathParticles";

type Props = {
  snapshot: EnemySnapshot;
};

const BODY_HEIGHT = 42; // 28 * 1.5
const BODY_RADIUS = ENEMY_RADIUS * 0.4; // 12
const HAND_RADIUS = 5;
const HAND_OFFSET_Y = 24; // 16 * 1.5
const HAND_OFFSET_SIDE = 15;
const HAND_OFFSET_FORWARD = 6; // +Z = forward

const SWAY_SPEED = 2.0;
const SWAY_AMOUNT = 0.6;

// Punch animation: hand extends forward
const PUNCH_EXTEND = 18; // how far the fist reaches forward

// Knockback tilt
const KB_TILT_MAX = 1.4; // max radians (~80°)
const KB_TILT_SPEED = 12; // snappier response

// Hit squash
const SQUASH_RETURN_SPEED = 10;

// Trailing damage bar
const TRAIL_HOLD = 0.05;           // brief pause before shrink (seconds)
const TRAIL_SHRINK_DURATION = 0.25; // fixed catch-up duration (seconds)

export function EnemyRig({ snapshot }: Props) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const leftHandRef = useRef<THREE.Mesh>(null);
  const rightHandRef = useRef<THREE.Mesh>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const squashRef = useRef<THREE.Group>(null);
  const tiltX = useRef(0);
  const squashY = useRef(1);
  const trailBarRef = useRef<THREE.Mesh>(null);
  const trailingHealth = useRef(1.0);
  const trailFrom = useRef(1.0);    // value when shrink animation started
  const trailTarget = useRef(1.0);  // health value we're catching up to
  const trailTimer = useRef(-1);    // <0 = idle, >=0 = animating (hold+shrink)

  const attacking = snapshot.aiState === "attacking";
  const progress = snapshot.attackProgress;

  // Punch curve: quick extend to 0.5, hold briefly, retract
  const punchT = attacking ? Math.sin(progress * Math.PI) : 0;
  const punchForward = punchT * PUNCH_EXTEND;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    if (bodyRef.current) {
      bodyRef.current.position.y =
        BODY_HEIGHT / 2 + Math.sin(t * SWAY_SPEED) * SWAY_AMOUNT;
    }
    if (leftHandRef.current) {
      leftHandRef.current.position.y =
        HAND_OFFSET_Y + Math.sin(t * SWAY_SPEED + 0.4) * SWAY_AMOUNT * 0.5;
    }
    if (rightHandRef.current) {
      rightHandRef.current.position.y =
        HAND_OFFSET_Y + Math.sin(t * SWAY_SPEED + 0.8) * SWAY_AMOUNT * 0.5;
      // Punch: extend right hand forward
      rightHandRef.current.position.z = HAND_OFFSET_FORWARD + punchForward;
      // Bring right hand inward during punch for a straight jab
      rightHandRef.current.position.x = HAND_OFFSET_SIDE - punchT * 8;
    }

    // Knockback tilt — tilt backward when hit
    if (tiltRef.current) {
      const kbx = snapshot.knockbackVelocity?.x ?? 0;
      const kbz = snapshot.knockbackVelocity?.z ?? 0;
      const kbMag = Math.sqrt(kbx * kbx + kbz * kbz);
      const target = -Math.min(kbMag * 0.02, KB_TILT_MAX);
      tiltX.current +=
        (target - tiltX.current) * Math.min(1, KB_TILT_SPEED * dt);
      tiltRef.current.rotation.x = tiltX.current;
    }

    // Hit squash — squeeze on hit, return smoothly
    if (squashRef.current) {
      const targetSquash = snapshot.hitFlashTimer > 0 ? 0.85 : 1.0;
      squashY.current +=
        (targetSquash - squashY.current) *
        Math.min(1, SQUASH_RETURN_SPEED * dt);
      const stretchXZ = 1 + (1 - squashY.current) * 0.5; // conserve volume
      squashRef.current.scale.set(stretchXZ, squashY.current, stretchXZ);
    }

    // Trailing damage bar — white segment that lingers then shrinks
    const currentPct = snapshot.health / snapshot.maxHealth;

    // Health went up (regen/respawn) — snap trailing instantly
    if (currentPct > trailingHealth.current) {
      trailingHealth.current = currentPct;
      trailFrom.current = currentPct;
      trailTarget.current = currentPct;
      trailTimer.current = -1;
    }

    // New damage detected — (re)start animation from current visual position
    if (currentPct < trailTarget.current) {
      trailFrom.current = trailingHealth.current;
      trailTarget.current = currentPct;
      trailTimer.current = 0;
    }

    // Advance hold → shrink animation
    if (trailTimer.current >= 0) {
      trailTimer.current += dt;

      if (trailTimer.current <= TRAIL_HOLD) {
        // Hold phase — trailing stays put
        trailingHealth.current = trailFrom.current;
      } else {
        // Shrink phase — easeOutQuad for smooth deceleration
        const t = Math.min(
          (trailTimer.current - TRAIL_HOLD) / TRAIL_SHRINK_DURATION,
          1,
        );
        const eased = t * (2 - t);
        trailingHealth.current =
          trailFrom.current +
          (trailTarget.current - trailFrom.current) * eased;

        if (t >= 1) {
          trailingHealth.current = trailTarget.current;
          trailTimer.current = -1;
        }
      }
    }

    // Update trail bar mesh (scale + position + opacity fade)
    if (trailBarRef.current) {
      const tPct = Math.max(0.001, trailingHealth.current);
      trailBarRef.current.scale.x = tPct;
      trailBarRef.current.position.x = (tPct - 1) * 12;
      trailBarRef.current.visible = trailingHealth.current > currentPct + 0.005;

      // Fade opacity during shrink for polish
      const mat = trailBarRef.current.material as THREE.MeshBasicMaterial;
      if (trailTimer.current >= TRAIL_HOLD) {
        const fadeT = Math.min(
          (trailTimer.current - TRAIL_HOLD) / TRAIL_SHRINK_DURATION,
          1,
        );
        mat.opacity = 0.9 - fadeT * 0.4; // 0.9 → 0.5
      } else {
        mat.opacity = 0.9;
      }
    }

  });

  const healthPct = snapshot.health / snapshot.maxHealth;
  const flashing = snapshot.hitFlashTimer > 0;
  const bodyColor = flashing ? "#ff6633" : "#ee2233";
  const handColor = flashing ? "#ff8855" : "#ff4455";
  const flashEmissive = flashing ? "#ff6622" : "#000000";
  const flashIntensity = flashing ? 1.8 : 0;

  // Hide if dead
  if (snapshot.aiState === "dead") return null;

  const dissolving = snapshot.aiState === "dying";
  const dissolveProgress = dissolving ? snapshot.dissolveProgress : 0;

  return (
    <group position={[snapshot.position.x, 0, snapshot.position.z]}>
      {/* Death particles — burst during dissolve */}
      {dissolving && (
        <DeathParticles position={[0, 0, 0]} color="#cc4444" count={20} />
      )}

      {/* Hit flash glow light — illuminates nearby entities */}
      {flashing && (
        <pointLight
          position={[0, BODY_HEIGHT / 2, 0]}
          color="#ff7733"
          intensity={100}
          distance={160}
          decay={2}
        />
      )}

      {/* Rotation group */}
      <group rotation={[0, snapshot.rotation, 0]}>
        {/* Tilt group — knockback recoil */}
        <group ref={tiltRef}>
          {/* Squash group — hit impact */}
          <group ref={squashRef}>
            {/* Body — red capsule with marble veining */}
            <mesh ref={bodyRef} position={[0, BODY_HEIGHT / 2, 0]} castShadow receiveShadow>
              <capsuleGeometry
                args={[BODY_RADIUS, BODY_HEIGHT - BODY_RADIUS * 2, 8, 16]}
              />
              <dissolveMaterial
                color={bodyColor}
                dissolveProgress={dissolveProgress}
                edgeColor="#ff6633"
                marbleStrength={0}
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
                edgeColor="#ff6633"
                emissive={flashEmissive}
                emissiveIntensity={flashIntensity}
              />
            </mesh>

            {/* Right hand (punching hand) */}
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
                edgeColor="#ff6633"
                emissive={flashEmissive}
                emissiveIntensity={flashIntensity}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* Health bar — billboard, hide when dying/full health */}
      {!dissolving && healthPct < 1 && (
        <Billboard position={[0, BODY_HEIGHT + 8, 0]}>
          {/* Background */}
          <mesh renderOrder={0}>
            <planeGeometry args={[24, 3]} />
            <meshBasicMaterial color="#331111" transparent opacity={1.0} depthWrite={false} />
          </mesh>
          {/* White trailing damage bar — animated via ref */}
          <mesh ref={trailBarRef} position={[0, 0, 0.2]} renderOrder={1}>
            <planeGeometry args={[24, 2.4]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
          </mesh>
          {/* Red current health */}
          <mesh position={[(healthPct - 1) * 12, 0, 0.4]} renderOrder={2}>
            <planeGeometry args={[24 * healthPct, 2.4]} />
            <meshBasicMaterial color="#cc3333" transparent opacity={1.0} depthWrite={false} />
          </mesh>
        </Billboard>
      )}
    </group>
  );
}
