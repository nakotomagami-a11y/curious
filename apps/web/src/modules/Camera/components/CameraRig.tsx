import { useThree, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@lib/stores/game-store';
import { useInputStore } from '@lib/stores/input-store';
import {
  CAMERA_HEIGHT,
  CAMERA_ANGLE_DEG,
  CAMERA_LOOK_AHEAD_DISTANCE,
} from '@curious/shared';
import { vec2Length, vec2Normalize, vec2Sub } from '@curious/shared';
import { targetingData } from '@modules/Combat/hooks/targeting-state';

const CAMERA_ANGLE_RAD = (CAMERA_ANGLE_DEG * Math.PI) / 180;
const OFFSET_Z = CAMERA_HEIGHT / Math.tan(CAMERA_ANGLE_RAD);

// Smooth lag: higher = snappier, lower = floatier
const LAG_SPEED = 3.5;

// Aim lead: camera slightly leads toward where player looks
const AIM_LEAD_DISTANCE = 40;

// Enemy focus: camera subtly drifts toward hovered/selected enemy
const HOVER_PULL_DISTANCE = 45; // world units camera shifts toward hovered enemy
const SELECT_PULL_DISTANCE = 65; // world units camera shifts toward selected enemy
const ENEMY_FOCUS_MAX_DIST = 300; // beyond this from player, pull fades out
const FOCUS_LERP_SPEED = 3; // how smoothly focus offset transitions

// Trauma-based camera shake
const MAX_SHAKE_OFFSET = 38;
const SHAKE_MIN = 0.005;

export function CameraRig() {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const currentPos = useRef(new THREE.Vector3(0, 0, 0));
  const initialized = useRef(false);

  // Enemy focus offset (smoothed)
  const focusOffsetX = useRef(0);
  const focusOffsetZ = useRef(0);

  // Trauma shake state
  const shakeTrauma = useRef(0);
  const shakeFreq = useRef(25);
  const shakeDuration = useRef(0.15);
  const shakeElapsed = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const gameStore = useGameStore.getState();
    const localPlayerId = gameStore.localPlayerId;
    const players = gameStore.players;
    const moveDir = useInputStore.getState().moveDir;
    const mouseWorldPos = useInputStore.getState().mouseWorldPos;

    // Pick up new shake triggers
    if (gameStore.cameraShake > 0) {
      const incoming = gameStore.cameraShake;
      gameStore.setCameraShake(0);

      // Map incoming intensity to trauma/freq/duration
      if (incoming >= 1.5) {
        // Boss slam — heavy, slow, long
        shakeTrauma.current = Math.max(shakeTrauma.current, 0.85);
        shakeFreq.current = 15;
        shakeDuration.current = 0.45;
      } else if (incoming >= 1.0) {
        // Sword hit on enemy — punchy, snappy
        shakeTrauma.current = Math.max(shakeTrauma.current, 0.8);
        shakeFreq.current = 25;
        shakeDuration.current = 0.18;
      } else if (incoming >= 0.5) {
        // Player takes damage — medium
        shakeTrauma.current = Math.max(shakeTrauma.current, 0.65);
        shakeFreq.current = 20;
        shakeDuration.current = 0.25;
      } else {
        // Generic
        shakeTrauma.current = Math.max(shakeTrauma.current, incoming * 0.3);
        shakeFreq.current = 20;
        shakeDuration.current = 0.2;
      }
      shakeElapsed.current = 0;
    }

    const localPlayer = localPlayerId ? players[localPlayerId] : null;

    // Target = player position + movement look-ahead + aim lead
    let tx = 0;
    let tz = 0;

    if (localPlayer) {
      tx = localPlayer.position.x;
      tz = localPlayer.position.z;

      // Directional lead: nudge camera ahead of movement
      if (vec2Length(moveDir) > 0.1) {
        tx += moveDir.x * CAMERA_LOOK_AHEAD_DISTANCE;
        tz += moveDir.z * CAMERA_LOOK_AHEAD_DISTANCE;
      }

      // Aim lead: camera slightly ahead of where player is looking
      const toMouse = vec2Sub(mouseWorldPos, localPlayer.position);
      if (vec2Length(toMouse) > 1) {
        const aimDir = vec2Normalize(toMouse);
        tx += aimDir.x * AIM_LEAD_DISTANCE;
        tz += aimDir.z * AIM_LEAD_DISTANCE;
      }

      // Enemy focus: drift camera toward hovered or selected enemy.
      // useTargeting writes focusWorldX/Z/Strength directly — no lookup needed.
      let goalFocusX = 0;
      let goalFocusZ = 0;

      const fStr = targetingData.focusStrength;
      if (fStr > 0) {
        const dx = targetingData.focusWorldX - localPlayer.position.x;
        const dz = targetingData.focusWorldZ - localPlayer.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 1 && dist < ENEMY_FOCUS_MAX_DIST) {
          const nx = dx / dist;
          const nz = dz / dist;

          // Fade out near max range (smooth falloff in outer 40%)
          const distFade = dist < ENEMY_FOCUS_MAX_DIST * 0.6
            ? 1.0
            : 1 - (dist - ENEMY_FOCUS_MAX_DIST * 0.6) / (ENEMY_FOCUS_MAX_DIST * 0.4);

          // Selected → full pull, hovered → scaled by magnetic strength
          const pullDist = fStr >= 1.0 ? SELECT_PULL_DISTANCE
            : HOVER_PULL_DISTANCE * fStr;

          goalFocusX = nx * pullDist * distFade;
          goalFocusZ = nz * pullDist * distFade;
        }
      }

      // Smoothly lerp focus offset for elegant transitions
      const focusT = 1 - Math.exp(-FOCUS_LERP_SPEED * dt);
      focusOffsetX.current += (goalFocusX - focusOffsetX.current) * focusT;
      focusOffsetZ.current += (goalFocusZ - focusOffsetZ.current) * focusT;

      tx += focusOffsetX.current;
      tz += focusOffsetZ.current;
    }

    targetPos.current.set(tx, 0, tz);

    // Soft lag interpolation
    if (!initialized.current) {
      currentPos.current.copy(targetPos.current);
      initialized.current = true;
    } else {
      const t = 1 - Math.exp(-LAG_SPEED * dt);
      currentPos.current.lerp(targetPos.current, t);
    }

    // Compute trauma-based shake (Squirrel Eiserloh technique)
    let shakeX = 0;
    let shakeZ = 0;
    let shakeY = 0;

    if (shakeTrauma.current > SHAKE_MIN) {
      shakeElapsed.current += dt;

      // Quadratic falloff — makes shake feel punchier
      const shake = shakeTrauma.current * shakeTrauma.current;
      const time = state.clock.elapsedTime;
      const freq = shakeFreq.current;

      // Use sine waves with different frequencies for organic feel
      shakeX = shake * MAX_SHAKE_OFFSET * Math.sin(time * freq * 1.0);
      shakeZ = shake * MAX_SHAKE_OFFSET * Math.sin(time * freq * 1.7);
      shakeY = shake * MAX_SHAKE_OFFSET * 0.3 * Math.sin(time * freq * 2.3);

      // Time-based decay
      shakeTrauma.current = Math.max(0, shakeTrauma.current - dt / shakeDuration.current);
      if (shakeTrauma.current < SHAKE_MIN) shakeTrauma.current = 0;
    }

    // Apply camera position: offset by angle + shake
    camera.position.set(
      currentPos.current.x + shakeX,
      CAMERA_HEIGHT + shakeY,
      currentPos.current.z + OFFSET_Z + shakeZ
    );
    camera.lookAt(
      currentPos.current.x,
      0,
      currentPos.current.z
    );
  });

  return null;
}
