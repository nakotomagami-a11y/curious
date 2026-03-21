import { useAppStore } from '@lib/stores/app-store';
import { LandingScene } from '@modules/Combat/components/LandingScene';
import { ModeSelectScene } from '@modules/Combat/components/ModeSelectScene';
import { CombatScene } from '@modules/Combat/components/CombatScene';
import { CameraRig } from '@modules/Camera/components/CameraRig';
import { useSimulation } from '@modules/Combat/hooks/useSimulation';
import { useInput } from '@modules/Player/hooks/useInput';

export function SceneRouter() {
  const scene = useAppStore((s) => s.scene);
  useInput();
  useSimulation();

  return (
    <>
      <CameraRig />
      {scene === 'landing' && <LandingScene />}
      {scene === 'mode-select' && <ModeSelectScene />}
      {(scene === 'combat' || scene === 'dead') && <CombatScene />}
    </>
  );
}
