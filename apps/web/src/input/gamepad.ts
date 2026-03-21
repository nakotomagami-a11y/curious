import type { Vec2 } from '@curious/shared';

export type GamepadState = {
  connected: boolean;
  leftStick: Vec2;   // Movement (x, z)
  rightStick: Vec2;  // Aim (x, z)
  attack: boolean;      // Right trigger
  dash: boolean;        // A button
  castSpell: boolean;   // X button
  interact: boolean;    // Y button
  prevSpell: boolean;   // Left bumper
  nextSpell: boolean;   // Right bumper
};

const DEADZONE = 0.15;

let state: GamepadState = {
  connected: false,
  leftStick: { x: 0, z: 0 },
  rightStick: { x: 0, z: 0 },
  attack: false,
  dash: false,
  castSpell: false,
  interact: false,
  prevSpell: false,
  nextSpell: false,
};

function applyDeadzone(value: number): number {
  return Math.abs(value) < DEADZONE ? 0 : value;
}

export function pollGamepad(): void {
  const gamepads = navigator.getGamepads();
  const gp = gamepads[0] ?? gamepads[1] ?? gamepads[2] ?? gamepads[3];

  if (!gp || !gp.connected) {
    if (state.connected) {
      state = {
        connected: false,
        leftStick: { x: 0, z: 0 },
        rightStick: { x: 0, z: 0 },
        attack: false,
        dash: false,
        castSpell: false,
        interact: false,
        prevSpell: false,
        nextSpell: false,
      };
    }
    return;
  }

  state.connected = true;

  // Axes: 0=left X, 1=left Y, 2=right X, 3=right Y
  state.leftStick = {
    x: applyDeadzone(gp.axes[0] ?? 0),
    z: applyDeadzone(gp.axes[1] ?? 0),
  };
  state.rightStick = {
    x: applyDeadzone(gp.axes[2] ?? 0),
    z: applyDeadzone(gp.axes[3] ?? 0),
  };

  // Standard gamepad mapping:
  // buttons[0] = A (South), buttons[2] = X (West), buttons[3] = Y (North)
  // buttons[4] = Left bumper, buttons[5] = Right bumper
  // buttons[7] = Right trigger
  state.dash = gp.buttons[0]?.pressed ?? false;
  state.castSpell = gp.buttons[2]?.pressed ?? false;
  state.interact = gp.buttons[3]?.pressed ?? false;
  state.prevSpell = gp.buttons[4]?.pressed ?? false;
  state.nextSpell = gp.buttons[5]?.pressed ?? false;
  state.attack = gp.buttons[7]?.pressed ?? false;
}

export function getGamepadState(): GamepadState {
  return state;
}

export function isGamepadConnected(): boolean {
  return state.connected;
}
