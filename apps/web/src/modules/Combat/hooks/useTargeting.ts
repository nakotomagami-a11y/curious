import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useInputStore } from '@lib/stores/input-store';
import { useGameStore } from '@lib/stores/game-store';
import { vec2Distance } from '@curious/shared';
import type { Vec2 } from '@curious/shared';
import { targetingData } from '@modules/Combat/hooks/targeting-state';

// ── Config ──────────────────────────────────────────────
const MAGNETIC_WORLD_RADIUS = 110; // ~3.5× ENEMY_RADIUS
const TARGET_PROJECT_HEIGHT = 20; // approximate enemy center-of-mass Y for screen projection

// ── Reusable temp vector (avoids GC) ────────────────────
const tmpVec = new THREE.Vector3();

/**
 * Runs inside Canvas. Each frame:
 * 1. Finds the closest alive enemy/boss to the mouse world position
 * 2. If within magnetic range, projects it to screen and writes to targetingData
 * 3. Handles click → select (rising edge) and death → deselect
 *
 * Visual-only — does NOT affect mouseWorldPos used for aim/combat.
 */
export function useTargeting() {
  const { camera, gl } = useThree();
  const prevMouseDown = useRef(false);
  const mouseClient = useRef({ x: 0, y: 0 });

  // Track raw mouse client position for screen-space projection
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: MouseEvent) => {
      mouseClient.current.x = e.clientX;
      mouseClient.current.y = e.clientY;
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, [gl.domElement]);

  useFrame(() => {
    const mouseWorldPos = useInputStore.getState().mouseWorldPos;
    const mouseDown = useInputStore.getState().mouseDown;
    const { enemies, boss, selectedEnemyId, setSelectedEnemyId } =
      useGameStore.getState();

    // ── Find closest alive target to mouse world pos ────
    let closestId: string | null = null;
    let closestDist = Infinity;
    let closestPos: Vec2 | null = null;

    for (const e of Object.values(enemies)) {
      if (e.aiState === 'dead' || e.aiState === 'dying') continue;
      const d = vec2Distance(mouseWorldPos, e.position);
      if (d < closestDist) {
        closestDist = d;
        closestId = e.id;
        closestPos = e.position;
      }
    }

    // Also check boss
    if (boss && boss.aiState !== 'dead' && boss.aiState !== 'dying') {
      const d = vec2Distance(mouseWorldPos, boss.position);
      if (d < closestDist) {
        closestDist = d;
        closestId = boss.id;
        closestPos = boss.position;
      }
    }

    // ── Compute magnetic pull ───────────────────────────
    if (closestId && closestPos && closestDist < MAGNETIC_WORLD_RADIUS) {
      // Project target world pos → screen pixels
      tmpVec.set(closestPos.x, TARGET_PROJECT_HEIGHT, closestPos.z);
      tmpVec.project(camera);
      const screenX =
        ((tmpVec.x + 1) / 2) * gl.domElement.clientWidth;
      const screenY =
        ((1 - tmpVec.y) / 2) * gl.domElement.clientHeight;

      // Quadratic falloff: stronger the closer
      const t = 1 - closestDist / MAGNETIC_WORLD_RADIUS;
      const strength = t * t;

      targetingData.magneticScreenX = screenX;
      targetingData.magneticScreenY = screenY;
      targetingData.magneticStrength = strength;
      targetingData.hoveredEnemyId = closestId;
    } else {
      targetingData.magneticStrength = 0;
      targetingData.hoveredEnemyId = null;
    }

    // ── Click handling (rising edge only) ────────────────
    if (mouseDown && !prevMouseDown.current) {
      if (targetingData.hoveredEnemyId) {
        setSelectedEnemyId(targetingData.hoveredEnemyId);
      } else {
        setSelectedEnemyId(null);
      }
    }
    prevMouseDown.current = mouseDown;

    // ── Clear selection if target died or disappeared ────
    if (selectedEnemyId) {
      const enemy = enemies[selectedEnemyId];
      const bossMatch =
        boss?.id === selectedEnemyId ? boss : null;
      const target = enemy ?? bossMatch;
      if (
        !target ||
        target.aiState === 'dead' ||
        target.aiState === 'dying'
      ) {
        setSelectedEnemyId(null);
      }
    }

    // ── Write camera focus target (selected > hovered) ────
    // CameraRig reads these directly — no enemy lookup needed there.
    const selId = useGameStore.getState().selectedEnemyId;
    if (selId) {
      const selEnemy = enemies[selId];
      const selBoss = boss?.id === selId ? boss : null;
      const selTarget = selEnemy ?? selBoss;
      if (selTarget && selTarget.aiState !== 'dead' && selTarget.aiState !== 'dying') {
        targetingData.focusWorldX = selTarget.position.x;
        targetingData.focusWorldZ = selTarget.position.z;
        targetingData.focusStrength = 1.0;
      } else {
        targetingData.focusStrength = 0;
      }
    } else if (closestId && closestPos && closestDist < MAGNETIC_WORLD_RADIUS) {
      // Hovered enemy — use magnetic strength for smooth ramp-in
      targetingData.focusWorldX = closestPos.x;
      targetingData.focusWorldZ = closestPos.z;
      targetingData.focusStrength = targetingData.magneticStrength;
    } else {
      targetingData.focusStrength = 0;
    }
  });
}
