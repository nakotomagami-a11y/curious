import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useInputStore } from '@lib/stores/input-store';
import { useAppStore } from '@lib/stores/app-store';
import { initKeyboard, readMoveDir, clearKeys } from '@/input/keyboard';
import { pollGamepad, getGamepadState, isGamepadConnected } from '@/input/gamepad';
import { projectMouseToGround } from '@/input/mouse';
import { vec2Angle, vec2Sub, vec2Length } from '@curious/shared';

/** Captures keyboard and mouse input, writes to input-store each frame. */
export function useInput() {
  const { camera, gl } = useThree();
  const scene = useAppStore((s) => s.scene);
  const mouseClientRef = useRef({ x: 0, y: 0 });

  // Init keyboard listeners + page visibility
  useEffect(() => {
    const cleanupKeyboard = initKeyboard();

    // Clear inputs when tab loses focus to prevent stuck keys/mouse
    const onVisibilityChange = () => {
      if (document.hidden) {
        clearKeys();
        const store = useInputStore.getState();
        store.setMoveDir({ x: 0, z: 0 });
        store.setMouseDown(false);
      }
    };
    const onBlur = () => {
      clearKeys();
      const store = useInputStore.getState();
      store.setMoveDir({ x: 0, z: 0 });
      store.setMouseDown(false);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      cleanupKeyboard();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Track mouse position
  useEffect(() => {
    const domElement = gl.domElement;

    const onMouseMove = (e: MouseEvent) => {
      mouseClientRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) useInputStore.getState().setMouseDown(true);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) useInputStore.getState().setMouseDown(false);
    };

    domElement.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('mousedown', onMouseDown);
    domElement.addEventListener('mouseup', onMouseUp);

    return () => {
      domElement.removeEventListener('mousemove', onMouseMove);
      domElement.removeEventListener('mousedown', onMouseDown);
      domElement.removeEventListener('mouseup', onMouseUp);
    };
  }, [gl.domElement]);

  // Each frame: read inputs, update store
  useFrame(() => {
    if (scene !== 'combat') return;

    const inputStore = useInputStore.getState();

    // Poll gamepad state
    pollGamepad();

    // WASD
    let moveDir = readMoveDir();

    // Override moveDir with gamepad left stick if significant
    if (isGamepadConnected()) {
      const gp = getGamepadState();
      if (Math.abs(gp.leftStick.x) > 0.01 || Math.abs(gp.leftStick.z) > 0.01) {
        moveDir = gp.leftStick;
      }
    }

    inputStore.setMoveDir(moveDir);

    // Mouse → ground projection → aim angle
    const mouseWorld = projectMouseToGround(
      mouseClientRef.current.x,
      mouseClientRef.current.y,
      camera,
      gl.domElement
    );

    if (mouseWorld) {
      inputStore.setMouseWorldPos(mouseWorld);
    }
  });
}
