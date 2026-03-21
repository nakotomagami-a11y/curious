"use client";

import { Canvas, GLProps } from "@react-three/fiber";
import { SceneRouter } from "./SceneRouter";
import { PlayerHUD } from "@modules/HUD/components/PlayerHUD";
import { BossHealthBar } from "@modules/HUD/components/BossHealthBar";
import { Crosshair } from "@modules/HUD/components/Crosshair";
import { DeathScene } from "@modules/Combat/components/DeathScene";
import { useAppStore } from "@lib/stores/app-store";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";

export function Game() {
  const scene = useAppStore((s) => s.scene);
  const gl: GLProps = {
    antialias: true,
    alpha: false,
    toneMapping: ACESFilmicToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: SRGBColorSpace,
  };
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        cursor: "none",
      }}
    >
      <Canvas gl={gl} shadows>
        <SceneRouter />
      </Canvas>
      <PlayerHUD />
      <BossHealthBar />
      <Crosshair />
      {scene === 'dead' && <DeathScene />}
    </div>
  );
}
