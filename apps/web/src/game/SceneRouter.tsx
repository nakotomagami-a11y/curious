import { useAppStore } from '@/stores/app-store';
import { LandingScene } from './scenes/LandingScene';
import { CombatScene } from './scenes/CombatScene';
import { CameraRig } from './camera/CameraRig';
import { useSimulation } from './hooks/useSimulation';
import { useInput } from './hooks/useInput';

export function SceneRouter() {
  const scene = useAppStore((s) => s.scene);
  useInput();
  useSimulation();

  return (
    <>
      <CameraRig />
      {scene === 'landing' && <LandingScene />}
      {(scene === 'combat' || scene === 'dead') && <CombatScene />}
    </>
  );
}
