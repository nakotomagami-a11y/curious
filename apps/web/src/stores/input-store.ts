import { create } from 'zustand';
import type { Vec2 } from '@curious/shared';

type InputStore = {
  moveDir: Vec2;
  mouseWorldPos: Vec2;
  mouseDown: boolean;
  aimAngle: number;

  setMoveDir: (dir: Vec2) => void;
  setMouseWorldPos: (pos: Vec2) => void;
  setMouseDown: (down: boolean) => void;
  setAimAngle: (angle: number) => void;
};

export const useInputStore = create<InputStore>((set) => ({
  moveDir: { x: 0, z: 0 },
  mouseWorldPos: { x: 0, z: 0 },
  mouseDown: false,
  aimAngle: 0,

  setMoveDir: (dir) => set({ moveDir: dir }),
  setMouseWorldPos: (pos) => set({ mouseWorldPos: pos }),
  setMouseDown: (down) => set({ mouseDown: down }),
  setAimAngle: (angle) => set({ aimAngle: angle }),
}));
