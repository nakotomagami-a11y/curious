/**
 * Module-level mutable state for per-frame magnetic cursor data.
 * Written by useTargeting (useFrame, 60fps). Read by Crosshair (rAF loop)
 * and CameraRig (useFrame).
 * NOT Zustand — follows "no React setState for 60fps updates" rule.
 */
export const targetingData = {
  magneticScreenX: 0,
  magneticScreenY: 0,
  magneticStrength: 0, // 0–1 (0 = no pull, 1 = snapped)
  hoveredEnemyId: null as string | null,

  // Camera focus — world-space position of the focus target (hover or selected)
  // Written by useTargeting so CameraRig doesn't need to look up enemies itself.
  focusWorldX: 0,
  focusWorldZ: 0,
  focusStrength: 0, // 0 = no focus, >0 = pull camera toward focusWorld position
};
