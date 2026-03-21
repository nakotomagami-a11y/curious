import { useRef } from "react";
import { GroundPlane } from "@modules/World/components/GroundPlane";
import { PlayerRig } from "@modules/Player/components/PlayerRig";
import type { PlayerRigHandle } from "@modules/Player/components/PlayerRig";
import { EnemyRig } from "@modules/Enemy/components/EnemyRig";
import { ProjectileRig } from "@modules/Enemy/components/ProjectileRig";
import { BossRig } from "@modules/Boss/components/BossRig";
import { SlashArc } from "@modules/Effects/components/SlashArc";
import { SwordSparks } from "@modules/Effects/components/SwordSparks";
import { SlamIndicator } from "@modules/Effects/components/SlamIndicator";
import { HitSparks } from "@modules/Effects/components/HitSparks";
import { DamageNumbers } from "@modules/Effects/components/DamageNumbers";
import { SelectionIndicator } from "@modules/Effects/components/SelectionBrackets";
import { PostProcessing } from "@modules/Effects/components/PostProcessing";
import { DashVFX } from "@modules/Effects/components/DashVFX";
import { FootstepDust } from "@modules/Effects/components/FootstepDust";
import { SpellDropRig } from "@modules/Effects/components/SpellDropRig";
import { ZoneRig } from "@modules/Effects/components/ZoneRig";
import { useGameStore } from "@lib/stores/game-store";
import { useSettingsStore } from "@lib/stores/settings-store";
import { useTargeting } from "@modules/Combat/hooks/useTargeting";
import type { PlayerSnapshot } from "@curious/shared";

function PlayerWithVFX({
  snapshot,
  isLocal,
}: {
  snapshot: PlayerSnapshot;
  isLocal: boolean;
}) {
  const rigRef = useRef<PlayerRigHandle>(null);
  return (
    <>
      <PlayerRig ref={rigRef} snapshot={snapshot} isLocal={isLocal} />
      <SlashArc rigRef={rigRef} snapshot={snapshot} />
      <SwordSparks rigRef={rigRef} snapshot={snapshot} />
      <DashVFX snapshot={snapshot} />
      <FootstepDust snapshot={snapshot} />
    </>
  );
}

export function CombatScene() {
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const players = useGameStore((s) => s.players);
  const enemies = useGameStore((s) => s.enemies);
  const projectiles = useGameStore((s) => s.projectiles);
  const spellDrops = useGameStore((s) => s.spellDrops);
  const zones = useGameStore((s) => s.zones);
  const boss = useGameStore((s) => s.boss);

  // Shadow quality from settings
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);
  const shadowMapSize = shadowQuality === 'high' ? 2048 : shadowQuality === 'low' ? 512 : 0;
  const castShadow = shadowQuality !== 'off';

  // Magnetic cursor + enemy selection
  useTargeting();

  return (
    <>
      {/* Lighting — 3-point: warm key + cool fill + blue rim */}
      <ambientLight intensity={0.3} color="#7788bb" />
      <directionalLight
        position={[200, 500, -200]}
        intensity={0.9}
        color="#fff0dd"
        castShadow={castShadow}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-left={-600}
        shadow-camera-right={600}
        shadow-camera-top={600}
        shadow-camera-bottom={-600}
        shadow-camera-near={100}
        shadow-camera-far={1200}
        shadow-bias={-0.001}
      />
      <directionalLight
        position={[-300, 200, -200]}
        intensity={0.2}
        color="#5577bb"
      />
      {/* Rim/back light — catches metallic edges */}
      <directionalLight
        position={[-100, 300, -400]}
        intensity={0.4}
        color="#aaccff"
      />
      <GroundPlane />

      {/* Render all players with VFX */}
      {Object.values(players).map((p) => (
        <PlayerWithVFX
          key={p.id}
          snapshot={p}
          isLocal={p.id === localPlayerId}
        />
      ))}

      {/* Render all enemies */}
      {Object.values(enemies).map((e) => (
        <EnemyRig key={e.id} snapshot={e} />
      ))}

      {/* Render projectiles */}
      {Object.values(projectiles).map((p) => (
        <ProjectileRig key={p.id} snapshot={p} />
      ))}

      {/* Render spell drops */}
      {Object.values(spellDrops).map((d) => (
        <SpellDropRig key={d.id} snapshot={d} />
      ))}

      {/* Render zones (heal circles, shield bubbles, gravity wells) */}
      {Object.values(zones).map((z) => (
        <ZoneRig key={z.id} snapshot={z} />
      ))}

      {/* Render boss */}
      {boss && <BossRig snapshot={boss} />}
      {boss && <SlamIndicator boss={boss} />}

      {/* Selection brackets (scene-level, moves between targets) */}
      <SelectionIndicator size={78} />

      {/* Hit impact sparks */}
      <HitSparks />

      {/* Floating damage numbers */}
      <DamageNumbers />

      {/* Post-processing */}
      <PostProcessing />
    </>
  );
}
