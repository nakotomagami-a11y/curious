import { create } from 'zustand';
import type {
  EntityId,
  PlayerSnapshot,
  EnemySnapshot,
  BossSnapshot,
} from '@curious/shared';

export type HitSpark = {
  id: number;
  x: number;
  z: number;
  time: number;
  isBoss: boolean;
};

export type DamageNumber = {
  id: number;
  x: number;
  z: number;
  amount: number;
  time: number;
};

type GameStore = {
  localPlayerId: EntityId | null;
  players: Record<EntityId, PlayerSnapshot>;
  enemies: Record<EntityId, EnemySnapshot>;
  boss: BossSnapshot | null;
  hitstopTimer: number;
  cameraShake: number;
  hitSparks: HitSpark[];
  damageNumbers: DamageNumber[];
  selectedEnemyId: EntityId | null;

  setLocalPlayerId: (id: EntityId | null) => void;
  setPlayers: (players: Record<EntityId, PlayerSnapshot>) => void;
  setEnemies: (enemies: Record<EntityId, EnemySnapshot>) => void;
  setBoss: (boss: BossSnapshot | null) => void;
  setHitstopTimer: (t: number) => void;
  setCameraShake: (intensity: number) => void;
  addHitSpark: (x: number, z: number, isBoss?: boolean) => void;
  addDamageNumber: (x: number, z: number, amount: number) => void;
  setSelectedEnemyId: (id: EntityId | null) => void;
  clearGameState: () => void;
};

let sparkIdCounter = 0;
let damageNumberIdCounter = 0;

export const useGameStore = create<GameStore>((set) => ({
  localPlayerId: null,
  players: {},
  enemies: {},
  boss: null,
  hitstopTimer: 0,
  cameraShake: 0,
  hitSparks: [],
  damageNumbers: [],
  selectedEnemyId: null,

  setLocalPlayerId: (id) => set({ localPlayerId: id }),
  setPlayers: (players) => set({ players }),
  setEnemies: (enemies) => set({ enemies }),
  setBoss: (boss) => set({ boss }),
  setHitstopTimer: (t) => set({ hitstopTimer: t }),
  setCameraShake: (intensity) => set({ cameraShake: intensity }),
  addHitSpark: (x, z, isBoss = false) =>
    set((s) => ({
      hitSparks: [...s.hitSparks, { id: ++sparkIdCounter, x, z, time: performance.now(), isBoss }],
    })),
  addDamageNumber: (x, z, amount) =>
    set((s) => ({
      damageNumbers: [...s.damageNumbers, { id: ++damageNumberIdCounter, x, z, amount, time: performance.now() }],
    })),
  setSelectedEnemyId: (id) => set({ selectedEnemyId: id }),
  clearGameState: () => {
    sparkIdCounter = 0;
    damageNumberIdCounter = 0;
    set({ localPlayerId: null, players: {}, enemies: {}, boss: null, hitstopTimer: 0, cameraShake: 0, hitSparks: [], damageNumbers: [], selectedEnemyId: null });
  },
}));
