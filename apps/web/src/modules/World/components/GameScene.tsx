"use client";

import { Canvas, GLProps } from "@react-three/fiber";
import { SceneRouter } from "./SceneRouter";
import { PlayerHUD } from "@modules/HUD/components/PlayerHUD";
import { BossHealthBar } from "@modules/HUD/components/BossHealthBar";
import { Crosshair } from "@modules/HUD/components/Crosshair";
import { DeathStatsScreen } from "@modules/HUD/components/DeathStatsScreen";
import { SettingsMenu } from "@modules/HUD/components/SettingsMenu";
import { FpsCounterOverlay } from "@modules/HUD/components/FpsCounter";
import { AchievementPopup } from "@modules/HUD/components/AchievementPopup";
import { KillStreakOverlay } from "@modules/Effects/components/KillStreakOverlay";
import { LowHPVignette } from "@modules/Effects/components/LowHPVignette";
import { DungeonMinimap } from "@modules/Dungeon/components/DungeonMinimap";
import { useAppStore } from "@lib/stores/app-store";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";

export function Game() {
  const scene = useAppStore((s) => s.scene);
  const gameMode = useAppStore((s) => s.gameMode);
  const showSettings = useAppStore((s) => s.showSettings);
  const toggleSettings = useAppStore((s) => s.toggleSettings);
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
      {scene === 'dead' && <DeathStatsScreen />}
      {(scene === 'combat' || scene === 'landing') && (
        <button
          onClick={toggleSettings}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            pointerEvents: 'auto',
            fontFamily: "'Lexend', sans-serif",
            transition: 'all 0.15s ease',
          }}
          title="Settings"
        >
          {'\u2699'}
        </button>
      )}
      {showSettings && <SettingsMenu />}
      <FpsCounterOverlay />
      <AchievementPopup />
      <KillStreakOverlay />
      <LowHPVignette />
      {gameMode === 'dungeon' && <DungeonMinimap />}
    </div>
  );
}
