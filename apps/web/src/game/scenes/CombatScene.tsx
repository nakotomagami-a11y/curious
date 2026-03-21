import { useRef } from "react";
import { GroundPlane } from "../entities/GroundPlane";
import { PlayerRig } from "../entities/PlayerRig";
import type { PlayerRigHandle } from "../entities/PlayerRig";
import { EnemyRig } from "../entities/EnemyRig";
import { BossRig } from "../entities/BossRig";
import { SlashArc } from "../effects/SlashArc";
import { SwordSparks } from "../effects/SwordSparks";
import { SlamIndicator } from "../effects/SlamIndicator";
import { HitSparks } from "../effects/HitSparks";
import { DamageNumbers } from "../effects/DamageNumbers";
import { SelectionIndicator } from "../effects/SelectionBrackets";
import { PostProcessing } from "../effects/PostProcessing";
import { useGameStore } from "@/stores/game-store";
import { useTargeting } from "../hooks/useTargeting";
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
    </>
  );
}

export function CombatScene() {
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const players = useGameStore((s) => s.players);
  const enemies = useGameStore((s) => s.enemies);
  const boss = useGameStore((s) => s.boss);

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
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
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
