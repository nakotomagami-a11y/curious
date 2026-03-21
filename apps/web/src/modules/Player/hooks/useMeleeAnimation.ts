import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { AttackState } from "@curious/shared";

// ── Timing ────────────────────────────────────────────────
const SWING_DURATION = 0.18; // each slash
const RECOVER_DURATION = 0.25; // return-to-idle

// ── Sword hand angles ─────────────────────────────────────
// Sword hand sits at (10, 18, -10). Rotation.y sweeps it across
// the front arc. Positive = left sweep, negative = right sweep.
const SWING_TARGET_ANGLE = (240 * Math.PI) / 180; // 100° from center — wide sweep

// ── Sword tilt during swing ───────────────────────────────
const SWORD_REST_PITCH = -0.3;
const SWORD_REST_YAW = 2.5;
const SWORD_SWING_TILT = 0.5;
const SWORD_SWING_PITCH = 0.2;

// ── Forward push ──────────────────────────────────────────
// With dir=-1 (negative angle), the rotation naturally sweeps the hand
// forward in local -Z space throughout the swing. No translational push
// needed — the arc itself keeps the hand in front of the character.
const SWING_FORWARD_PUSH = 0;

// ── Lerp rate for returning to rest ───────────────────────
const REST_LERP_RATE = 12;

// ── Easing ────────────────────────────────────────────────
function easeOutQuad(t: number): number {
  return t * (2 - t);
}
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── Visual States ─────────────────────────────────────────
//
//  idle ──[attack]──► swing(opener) ──[done]──► hold ──[timeout]──► recover ──[done]──► idle
//                                                │
//                                             [attack]
//                                                ▼
//                                          swing(combo) ──[done]──► idle
//
//  Opener: always left-to-right, ends at held pose
//  Combo:  right-held → default (attack feel + VFX), ends sequence
//  Recovery: held → default (calm, no VFX)
//
type VisualState = "idle" | "swing" | "hold" | "recover";

export type SlashVfxState = {
  active: boolean;
  direction: number; // +1 or -1
  progress: number; // 0-1 through current swing
  fadeProgress: number; // 0-1 post-swing fade
  swingId: number; // monotonically increasing — changes on each new swing
};

export type MeleeAnimationOutput = {
  /** Rotation.y for the sword-hand group (radians). */
  swordArmAngle: React.RefObject<number>;
  /** Rotation.x for the sword mesh group. */
  swordPitch: React.RefObject<number>;
  /** Rotation.y for the sword mesh group. */
  swordYaw: React.RefObject<number>;
  /** Forward push for the sword-hand group (position.z offset). */
  swordHandPushZ: React.RefObject<number>;
  /** VFX synchronization data. */
  slashVfxState: React.RefObject<SlashVfxState>;
};

export function useMeleeAnimation(
  attackState: AttackState | null,
  isDying: boolean,
): MeleeAnimationOutput {
  // ── Output refs ─────────────────────────────────────────
  const swordArmAngle = useRef(0);
  const swordPitch = useRef(SWORD_REST_PITCH);
  const swordYaw = useRef(SWORD_REST_YAW);
  const swordHandPushZ = useRef(0);
  const slashVfxState = useRef<SlashVfxState>({
    active: false,
    direction: 1,
    progress: 0,
    fadeProgress: 1,
    swingId: 0,
  });

  // ── Internal state ──────────────────────────────────────
  const visualState = useRef<VisualState>("idle");
  const stateTimer = useRef(0);
  const swingDirection = useRef(1);
  const swingStartAngle = useRef(0);
  const swingEndAngle = useRef(0);
  const recoverStartAngle = useRef(0);
  const prevStartTime = useRef(0);
  const prevAttackState = useRef<AttackState | null>(null);
  const isComboSwing = useRef(false);
  const swingIdCounter = useRef(0);
  const swingStartPush = useRef(0);
  const swingEndPush = useRef(0);
  const recoverStartPush = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (isDying) return;

    const state = visualState.current;

    // ── Transition detection ────────────────────────────
    //
    // We watch attackState changes from the game logic:
    // - null → non-null:    new attack started
    // - non-null, startTime changed: combo continuation or new chain
    // - non-null → null:    attack expired (hold timed out)

    if (attackState !== null && prevAttackState.current === null) {
      // New attack from nothing — only respond in idle
      if (state === "idle") {
        enterSwing(attackState, false);
      }
    } else if (attackState !== null && prevAttackState.current !== null) {
      // Still attacking — check for combo (startTime changed)
      if (attackState.startTime !== prevStartTime.current) {
        if (state === "hold") {
          // Combo continuation from hold
          enterSwing(attackState, true);
        } else if (state === "idle") {
          // New opener after combo completed — infinite chain
          enterSwing(attackState, false);
        }
        // In swing/recover: ignore (visual catches up when state allows)
      }
    } else if (attackState === null && prevAttackState.current !== null) {
      // Attack expired — enter recover if we're still animating
      if (state === "hold" || state === "swing") {
        visualState.current = "recover";
        stateTimer.current = 0;
        recoverStartAngle.current = swordArmAngle.current;
        recoverStartPush.current = swordHandPushZ.current;
      }
    }

    prevAttackState.current = attackState;

    function enterSwing(atk: AttackState, fromHold: boolean) {
      swingIdCounter.current++;
      visualState.current = "swing";
      stateTimer.current = 0;
      swingStartAngle.current = swordArmAngle.current;
      prevStartTime.current = atk.startTime;

      if (fromHold) {
        // Combo: return from held position to default as an attack
        isComboSwing.current = true;
        swingDirection.current = 1; // opposite dir for VFX
        swingEndAngle.current = 0; // return to default pose
        swingStartPush.current = swordHandPushZ.current;
        swingEndPush.current = 0;
      } else {
        // Opener: always left-to-right in world view
        isComboSwing.current = false;
        swingDirection.current = -1;
        swingEndAngle.current = -1 * SWING_TARGET_ANGLE;
        swingStartPush.current = 0;
        swingEndPush.current = SWING_FORWARD_PUSH;
      }
    }

    // ── State machine tick ──────────────────────────────
    stateTimer.current += dt;

    switch (visualState.current) {
      case "idle": {
        // Lerp to rest
        swordArmAngle.current +=
          (0 - swordArmAngle.current) * Math.min(1, REST_LERP_RATE * dt);
        swordPitch.current +=
          (SWORD_REST_PITCH - swordPitch.current) *
          Math.min(1, REST_LERP_RATE * dt);
        swordYaw.current +=
          (SWORD_REST_YAW - swordYaw.current) *
          Math.min(1, REST_LERP_RATE * dt);
        swordHandPushZ.current +=
          (0 - swordHandPushZ.current) * Math.min(1, REST_LERP_RATE * dt);

        slashVfxState.current = {
          active: false,
          direction: swingDirection.current,
          progress: 0,
          fadeProgress: 1,
          swingId: swingIdCounter.current,
        };
        break;
      }

      case "swing": {
        const t = Math.min(stateTimer.current / SWING_DURATION, 1);
        const eased = easeOutQuad(t);

        // Sword hand sweeps from current to target
        swordArmAngle.current =
          swingStartAngle.current +
          (swingEndAngle.current - swingStartAngle.current) * eased;

        // Interpolate push: opener 0→PUSH, combo PUSH→0
        swordHandPushZ.current =
          swingStartPush.current +
          (swingEndPush.current - swingStartPush.current) * eased;

        // Sword tilt — bell curve peaks mid-swing
        const bell = Math.sin(t * Math.PI);
        const dir = swingDirection.current;
        swordPitch.current = SWORD_REST_PITCH - SWORD_SWING_PITCH * bell;
        swordYaw.current = SWORD_REST_YAW + dir * SWORD_SWING_TILT * bell;

        slashVfxState.current = {
          active: true,
          direction: dir,
          progress: t,
          fadeProgress: 0,
          swingId: swingIdCounter.current,
        };

        if (t >= 1) {
          if (isComboSwing.current) {
            // Combo ends at default — sequence complete
            visualState.current = "idle";
            stateTimer.current = 0;
            swordArmAngle.current = 0;
            swordHandPushZ.current = 0;
          } else {
            // Opener ends — wait for combo input
            visualState.current = "hold";
            stateTimer.current = 0;
          }
        }
        break;
      }

      case "hold": {
        // Hold at end position — wait for combo input or attack expiry.
        // No internal timeout — the game logic controls when the attack
        // expires (sets attackState to null), which triggers recover above.
        swordArmAngle.current = swingEndAngle.current;
        swordHandPushZ.current = SWING_FORWARD_PUSH;

        // Sword tilt returns to rest during hold
        swordPitch.current +=
          (SWORD_REST_PITCH - swordPitch.current) *
          Math.min(1, REST_LERP_RATE * dt);
        swordYaw.current +=
          (SWORD_REST_YAW - swordYaw.current) *
          Math.min(1, REST_LERP_RATE * dt);

        // VFX fades during hold
        const holdFade = Math.min(stateTimer.current / 0.12, 1);
        slashVfxState.current = {
          active: false,
          direction: swingDirection.current,
          progress: 1,
          fadeProgress: holdFade,
          swingId: swingIdCounter.current,
        };
        break;
      }

      case "recover": {
        const t = Math.min(stateTimer.current / RECOVER_DURATION, 1);
        const eased = easeInOutQuad(t);

        // Smooth return from wherever we were to rest (0)
        swordArmAngle.current = recoverStartAngle.current * (1 - eased);
        swordHandPushZ.current = recoverStartPush.current * (1 - eased);

        // Sword tilt returns to rest
        swordPitch.current +=
          (SWORD_REST_PITCH - swordPitch.current) *
          Math.min(1, REST_LERP_RATE * dt);
        swordYaw.current +=
          (SWORD_REST_YAW - swordYaw.current) *
          Math.min(1, REST_LERP_RATE * dt);

        slashVfxState.current = {
          active: false,
          direction: swingDirection.current,
          progress: 0,
          fadeProgress: 1,
          swingId: swingIdCounter.current,
        };

        if (t >= 1) {
          visualState.current = "idle";
          stateTimer.current = 0;
          swordArmAngle.current = 0;
        }
        break;
      }
    }
  });

  return { swordArmAngle, swordPitch, swordYaw, swordHandPushZ, slashVfxState };
}
