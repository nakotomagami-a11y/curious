import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { EnemySnapshot, EliteModifier } from "@curious/shared";
import { ENEMY_RADIUS, ELITE_GIANT_SCALE } from "@curious/shared";
import { vec2Angle } from "@curious/shared";
import "@modules/Effects/materials/dissolve-material";
import { DeathParticles } from "@modules/Effects/components/DeathParticles";

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

function getEliteRingColor(modifiers: EliteModifier[]): string {
  // Use primary modifier for color
  const primary = modifiers[0];
  switch (primary) {
    case 'vampiric': return '#cc2222';
    case 'thorns': return '#8833cc';
    case 'haste': return '#2288ff';
    case 'giant': return '#88aa44';
    case 'shielded': return '#ffcc22';
    case 'berserker': return '#ff6600';
    default: return '#ff44ff';
  }
}

function EliteRing({ modifiers, healthPct }: { modifiers: EliteModifier[]; healthPct: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const color = getEliteRingColor(modifiers);
  const isBerserkerLow = modifiers.includes('berserker') && healthPct < 0.3;

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z = clock.elapsedTime * 0.8;
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    const pulse = 0.3 + Math.sin(clock.elapsedTime * 3) * 0.1;
    mat.opacity = isBerserkerLow ? 0.6 + Math.sin(clock.elapsedTime * 6) * 0.2 : pulse;
  });

  return (
    <>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
        <ringGeometry args={[ENEMY_RADIUS + 2, ENEMY_RADIUS + 6, 32]} />
        <meshBasicMaterial color={isBerserkerLow ? '#ff2200' : color} transparent opacity={0.3} />
      </mesh>
      {/* Point light for elite glow */}
      <pointLight
        position={[0, 5, 0]}
        color={isBerserkerLow ? '#ff2200' : color}
        intensity={isBerserkerLow ? 40 : 15}
        distance={80}
        decay={2}
      />
    </>
  );
}

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

  const isCaster = snapshot.enemyType === 'caster';
  const isDasher = snapshot.enemyType === 'dasher';
  const isShielder = snapshot.enemyType === 'shielder';
  const isSummoner = snapshot.enemyType === 'summoner';
  const isBomber = snapshot.enemyType === 'bomber';
  const isTeleporter = snapshot.enemyType === 'teleporter';
  const isHealer = snapshot.enemyType === 'healer';
  const isElite = snapshot.eliteModifiers.length > 0;
  const isGiant = snapshot.eliteModifiers.includes('giant');
  const entityScale = isGiant ? ELITE_GIANT_SCALE : 1.0;
  const attacking = snapshot.aiState === "attacking";
  const isBurning = snapshot.buffs?.some(b => b.type === 'BURN') ?? false;
  const progress = snapshot.attackProgress;

  // Punch curve: quick extend to 0.5, hold briefly, retract
  const punchT = attacking && !isCaster ? Math.sin(progress * Math.PI) : 0;
  const punchForward = punchT * PUNCH_EXTEND;

  // Cast animation: hands raise upward
  const castT = attacking && isCaster ? Math.sin(progress * Math.PI) : 0;
  const castRaise = castT * 14; // how high hands lift

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    if (bodyRef.current) {
      bodyRef.current.position.y =
        BODY_HEIGHT / 2 + Math.sin(t * SWAY_SPEED) * SWAY_AMOUNT;
    }
    if (leftHandRef.current) {
      leftHandRef.current.position.y =
        HAND_OFFSET_Y + Math.sin(t * SWAY_SPEED + 0.4) * SWAY_AMOUNT * 0.5 + castRaise;
      // Caster: bring hands forward and inward during cast
      if (isCaster) {
        leftHandRef.current.position.z = HAND_OFFSET_FORWARD + castT * 10;
        leftHandRef.current.position.x = -HAND_OFFSET_SIDE + castT * 6;
      }
    }
    if (rightHandRef.current) {
      rightHandRef.current.position.y =
        HAND_OFFSET_Y + Math.sin(t * SWAY_SPEED + 0.8) * SWAY_AMOUNT * 0.5 + castRaise;
      if (isCaster) {
        // Caster: hands raise and come forward
        rightHandRef.current.position.z = HAND_OFFSET_FORWARD + castT * 10;
        rightHandRef.current.position.x = HAND_OFFSET_SIDE - castT * 6;
      } else {
        // Melee: punch forward
        rightHandRef.current.position.z = HAND_OFFSET_FORWARD + punchForward;
        rightHandRef.current.position.x = HAND_OFFSET_SIDE - punchT * 8;
      }
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

  // Color palette per enemy type
  const colorMap: Record<string, { body: [string, string]; hand: [string, string]; emissive: string; edge: string; bar: string; barBg: string; death: string; light: string }> = {
    melee:      { body: ['#ff6633', '#ee2233'], hand: ['#ff8855', '#ff4455'], emissive: '#ff6622', edge: '#ff6633', bar: '#cc3333', barBg: '#331111', death: '#cc4444', light: '#ff7733' },
    caster:     { body: ['#9966ff', '#6633cc'], hand: ['#bb88ff', '#8855ee'], emissive: '#7733ff', edge: '#9966ff', bar: '#7733cc', barBg: '#221133', death: '#8844cc', light: '#9955ff' },
    dasher:     { body: ['#ffaa33', '#dd8800'], hand: ['#ffcc55', '#ffbb44'], emissive: '#ff8800', edge: '#ff8800', bar: '#cc8800', barBg: '#332200', death: '#cc8844', light: '#ff9922' },
    shielder:   { body: ['#aabbcc', '#667788'], hand: ['#bbccdd', '#8899aa'], emissive: '#88aacc', edge: '#aabbcc', bar: '#668899', barBg: '#223344', death: '#8899aa', light: '#88aacc' },
    summoner:   { body: ['#8833aa', '#551177'], hand: ['#aa55cc', '#7733aa'], emissive: '#7722aa', edge: '#8833aa', bar: '#662299', barBg: '#220044', death: '#7733aa', light: '#8833cc' },
    bomber:     { body: ['#ff4422', '#cc2200'], hand: ['#ff6644', '#ee4422'], emissive: '#ff3300', edge: '#ff4422', bar: '#cc2200', barBg: '#440000', death: '#ff4422', light: '#ff4400' },
    teleporter: { body: ['#33dddd', '#119999'], hand: ['#55eeff', '#33ccdd'], emissive: '#22cccc', edge: '#33dddd', bar: '#22aaaa', barBg: '#003333', death: '#33cccc', light: '#33ddee' },
    healer:     { body: ['#44dd66', '#229944'], hand: ['#66ee88', '#44cc66'], emissive: '#33cc55', edge: '#44dd66', bar: '#33aa55', barBg: '#003311', death: '#44cc66', light: '#44ee66' },
  };
  const c = colorMap[snapshot.enemyType] ?? colorMap.melee;

  const bodyColor = flashing ? c.body[0] : c.body[1];
  const handColor = flashing ? c.hand[0] : c.hand[1];
  const flashEmissive = flashing ? c.emissive : '#000000';
  const flashIntensity = flashing ? 1.8 : 0;
  const edgeColor = c.edge;
  const healthBarColor = c.bar;
  const healthBarBg = c.barBg;
  const deathParticleColor = c.death;
  const flashLightColor = c.light;

  // Hide if dead
  if (snapshot.aiState === "dead") return null;

  const dissolving = snapshot.aiState === "dying";
  const dissolveProgress = dissolving ? snapshot.dissolveProgress : 0;

  return (
    <group position={[snapshot.position.x, 0, snapshot.position.z]} scale={[entityScale, entityScale, entityScale]}>
      {/* Elite ground ring — glowing colored ring */}
      {isElite && !dissolving && (
        <EliteRing modifiers={snapshot.eliteModifiers} healthPct={healthPct} />
      )}

      {/* Death particles — burst during dissolve */}
      {dissolving && (
        <DeathParticles position={[0, 0, 0]} color={deathParticleColor} count={20} />
      )}

      {/* Hit flash glow light — illuminates nearby entities */}
      {flashing && (
        <pointLight
          position={[0, BODY_HEIGHT / 2, 0]}
          color={flashLightColor}
          intensity={100}
          distance={160}
          decay={2}
        />
      )}

      {/* Burn glow — pulsing orange light when burning */}
      {isBurning && (
        <pointLight
          position={[0, BODY_HEIGHT / 2, 0]}
          color="#ff6600"
          intensity={30}
          distance={80}
          decay={2}
        />
      )}

      {/* Dasher telegraph line */}
      {isDasher && snapshot.aiState === 'telegraphing' && (
        <group rotation={[0, vec2Angle(snapshot.dashDirection), 0]}>
          <mesh position={[0, 2, 150]}>
            <boxGeometry args={[4, 2, 300]} />
            <meshBasicMaterial color="#ff6600" transparent opacity={0.35} />
          </mesh>
        </group>
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
                edgeColor={edgeColor}
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
                edgeColor={edgeColor}
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
                edgeColor={edgeColor}
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
            <meshBasicMaterial color={healthBarBg} transparent opacity={1.0} depthWrite={false} />
          </mesh>
          {/* White trailing damage bar — animated via ref */}
          <mesh ref={trailBarRef} position={[0, 0, 0.2]} renderOrder={1}>
            <planeGeometry args={[24, 2.4]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
          </mesh>
          {/* Red current health */}
          <mesh position={[(healthPct - 1) * 12, 0, 0.4]} renderOrder={2}>
            <planeGeometry args={[24 * healthPct, 2.4]} />
            <meshBasicMaterial color={healthBarColor} transparent opacity={1.0} depthWrite={false} />
          </mesh>
        </Billboard>
      )}
    </group>
  );
}
