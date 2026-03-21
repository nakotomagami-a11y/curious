import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '@lib/stores/app-store';
import { useGameStore } from '@lib/stores/game-store';
import { useInputStore } from '@lib/stores/input-store';
import { useStatsStore } from '@lib/stores/stats-store';
import { useMultiplayerStore } from '@lib/stores/multiplayer-store';
import {
  tickWorld,
  applyPlayerMovement,
  setPlayerRotation,
  tryStartAttack,
  tryStartDash,
  tickAttack,
  checkSlashHit,
  applyHitToEnemy,
  applyHitToBoss,
  getSpeedMultiplier,
  tryCastSpell,
  rollCritical,
  getThornsReflect,
  rollSpellDrop,
} from '@curious/game-logic';
import {
  PLAYER_SPEED,
  PLAYER_ATTACK_SPEED_MULTIPLIER,
  DASH_SPEED,
  DAMAGE_VARIANCE,
  ENEMY_RADIUS,
  BOSS_RADIUS,
} from '@curious/shared';
import { vec2Length, vec2Sub, vec2Angle, vec2Normalize, randomizeDamage } from '@curious/shared';
import { isKeyDown } from '@/input/keyboard';
import { getSimWorld } from '@modules/Combat/hooks/world-manager';
import { initAudio, applyVolumeSettings } from '@modules/Audio/audio-engine';
import { processAudioEvents } from '@modules/Audio/game-audio';
import { useAchievementStore } from '@lib/stores/achievement-store';
import { useSettingsStore } from '@lib/stores/settings-store';

/** Runs the simulation tick every frame during combat. */
export function useSimulation() {
  const scene = useAppStore((s) => s.scene);
  // Track which enemies have been hit during current attack to avoid multi-hits
  const hitThisAttack = useRef<Set<string>>(new Set());
  // Spell key debouncing — fire on key-down edge only (9 slots)
  const spellKeyState = useRef<boolean[]>([false, false, false, false, false, false, false, false, false]);
  // Multiplayer broadcast throttle
  const broadcastCounter = useRef(0);
  const escWasDown = useRef(false);
  // Achievement check throttle (~1 second at 60fps)
  const achievementCheckCounter = useRef(0);

  useFrame((_, delta) => {
    // Toggle settings on Escape key edge
    const escPressed = isKeyDown('Escape');
    if (escPressed && !escWasDown.current) {
      useAppStore.getState().toggleSettings();
    }
    escWasDown.current = escPressed;

    if (scene !== 'combat') return;

    // Hitstop micro-freeze: pause simulation briefly on hit
    const hitstop = useGameStore.getState().hitstopTimer;
    if (hitstop > 0) {
      useGameStore.getState().setHitstopTimer(Math.max(0, hitstop - delta));
      return;
    }

    // Apply audio settings every frame (negligible cost — single property set)
    const settings = useSettingsStore.getState();
    applyVolumeSettings(settings.masterVolume, settings.muted);

    const world = getSimWorld();
    const dt = Math.min(delta, 0.05);
    const input = useInputStore.getState();
    const localPlayerId = useGameStore.getState().localPlayerId;

    // Apply local player input before world tick
    if (localPlayerId) {
      const player = world.players.get(localPlayerId);
      if (player && player.state === 'alive') {
        // Set isMoving for stamina regen rate
        player.isMoving = vec2Length(input.moveDir) > 0.01;

        // Stun blocks all player actions
        const isStunned = player.stunTimer > 0;

        if (!isStunned) {
          // Dash: Shift + movement direction
          if (isKeyDown('ShiftLeft') || isKeyDown('ShiftRight')) {
            if (vec2Length(input.moveDir) > 0.01) {
              tryStartDash(player, input.moveDir);
            }
          }

          // Movement — dash overrides normal movement
          if (player.dashTimer > 0) {
            applyPlayerMovement(player, player.dashDirection, DASH_SPEED, dt);
          } else {
            const baseSpeed = player.attackState
              ? PLAYER_SPEED * PLAYER_ATTACK_SPEED_MULTIPLIER
              : PLAYER_SPEED;
            const speed = baseSpeed * getSpeedMultiplier(player.buffs);
            applyPlayerMovement(player, input.moveDir, speed, dt);
          }

          // Rotation: face toward selected enemy, or mouse if none selected
          let faceTarget = input.mouseWorldPos;
          const selId = useGameStore.getState().selectedEnemyId;
          if (selId) {
            const selEnemy = world.enemies.get(selId);
            const selBoss = world.boss?.id === selId ? world.boss : null;
            const selTarget = selEnemy ?? selBoss;
            if (selTarget && selTarget.aiState !== 'dying' && selTarget.aiState !== 'dead') {
              faceTarget = selTarget.position;
            }
          }
          const toTarget = vec2Sub(faceTarget, player.position);
          if (vec2Length(toTarget) > 1) {
            const desiredAngle = vec2Angle(toTarget);
            // Smooth rotation — lerp via shortest arc
            let diff = desiredAngle - player.rotation;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            const smoothed = player.rotation + diff * Math.min(1, 18 * dt);
            setPlayerRotation(player, smoothed);
          }

          // Attack: spacebar (blocked during dash)
          if (isKeyDown('Space') && player.dashTimer <= 0) {
            const started = tryStartAttack(player, world.time);
            if (started) {
              hitThisAttack.current.clear();
              world.events.push({
                type: 'ATTACK_START',
                playerId: localPlayerId,
                comboIndex: player.attackState!.comboIndex,
              });
            }
          }

          // Spell keys: 1-9 (dynamic spell slots from pickups)
          const aimDir = vec2Length(toTarget) > 1 ? vec2Normalize(toTarget) : { x: 0, z: 1 };
          for (let slot = 0; slot < 9; slot++) {
            const keyCode = `Digit${slot + 1}`;
            const pressed = isKeyDown(keyCode);
            if (pressed && !spellKeyState.current[slot]) {
              const spellEvents = tryCastSpell(player, slot, aimDir, world);
              world.events.push(...spellEvents);
            }
            spellKeyState.current[slot] = pressed;
          }
        } else {
          // Stunned: cancel attack, no voluntary actions
          player.attackState = null;
        }

        // Tick attack progress (always, even if stunned — lets swing finish)
        tickAttack(player, dt, world.time);

        // If attack ended, clear hit tracking
        if (!player.attackState) {
          hitThisAttack.current.clear();
        }

        // Hit detection during active attack
        if (player.attackState) {
          let hitLanded = false;
          const store = useGameStore.getState();

          // Check enemies
          let anyCrit = false;
          for (const enemy of world.enemies.values()) {
            if (enemy.aiState === 'dying' || enemy.aiState === 'dead') continue;
            if (hitThisAttack.current.has(enemy.id)) continue;
            if (checkSlashHit(
              player.position,
              player.rotation,
              player.attackState,
              enemy.position,
              ENEMY_RADIUS
            )) {
              hitThisAttack.current.add(enemy.id);
              const crit = rollCritical(player.position, enemy.position, enemy.rotation, enemy.aiState);
              const baseDamage = randomizeDamage(player.swordDamage, DAMAGE_VARIANCE);
              const damage = Math.round(baseDamage * crit.multiplier);
              const events = applyHitToEnemy(enemy, damage, player.position);
              world.events.push(...events);
              // Elite: thorns reflect damage back to player
              const thornsDmg = getThornsReflect(enemy, damage);
              if (thornsDmg > 0) {
                player.health -= thornsDmg;
                world.events.push({
                  type: 'DAMAGE_TAKEN',
                  entityId: player.id,
                  amount: thornsDmg,
                  newHealth: player.health,
                });
                if (player.health <= 0) {
                  player.health = 0;
                  player.state = 'dying';
                  world.events.push({ type: 'ENTITY_DIED', entityId: player.id, entityType: 'player' });
                }
              }
              store.addHitSpark(enemy.position.x, enemy.position.z);
              store.addDamageNumber(enemy.position.x, enemy.position.z, damage, crit.isCrit);
              if (crit.isCrit) anyCrit = true;
              hitLanded = true;
              // Roll spell drop on sword kill (events from here get cleared by tickWorld)
              if (enemy.health <= 0) {
                const dropEvents = rollSpellDrop(enemy.position, world);
                world.events.push(...dropEvents);
              }
            }
          }

          // Check boss
          if (world.boss && world.boss.aiState !== 'dying' && world.boss.aiState !== 'dead' && !hitThisAttack.current.has(world.boss.id)) {
            if (checkSlashHit(
              player.position,
              player.rotation,
              player.attackState,
              world.boss.position,
              BOSS_RADIUS
            )) {
              hitThisAttack.current.add(world.boss.id);
              const crit = rollCritical(player.position, world.boss.position, world.boss.rotation, world.boss.aiState);
              const baseDamage = randomizeDamage(player.swordDamage, DAMAGE_VARIANCE);
              const damage = Math.round(baseDamage * crit.multiplier);
              const events = applyHitToBoss(world.boss, damage, player.position);
              world.events.push(...events);
              store.addHitSpark(world.boss.position.x, world.boss.position.z, true);
              store.addDamageNumber(world.boss.position.x, world.boss.position.z, damage, crit.isCrit);
              if (crit.isCrit) anyCrit = true;
              hitLanded = true;
            }
          }

          // Camera shake + hitstop on hit (amplified on crit)
          if (hitLanded) {
            store.setCameraShake(anyCrit ? 1.4 : 0.9);
            store.setHitstopTimer(anyCrit ? 0.08 : 0.05);
          }
        }
      }
    }

    // --- Multiplayer: host processes remote player inputs ---
    const mpState = useMultiplayerStore.getState();
    if (mpState.connected && mpState.isHost) {
      const remoteInputs = mpState.consumeRemoteInputs();
      for (const ri of remoteInputs) {
        const remotePlayer = world.players.get(ri.playerId);
        if (!remotePlayer || remotePlayer.state !== 'alive') continue;

        remotePlayer.isMoving = vec2Length(ri.moveDir) > 0.01;

        if (remotePlayer.stunTimer <= 0) {
          if (ri.dash && vec2Length(ri.moveDir) > 0.01) {
            tryStartDash(remotePlayer, ri.moveDir);
          }
          if (remotePlayer.dashTimer > 0) {
            applyPlayerMovement(remotePlayer, remotePlayer.dashDirection, DASH_SPEED, dt);
          } else {
            const baseSpeed = remotePlayer.attackState
              ? PLAYER_SPEED * PLAYER_ATTACK_SPEED_MULTIPLIER
              : PLAYER_SPEED;
            const speed = baseSpeed * getSpeedMultiplier(remotePlayer.buffs);
            applyPlayerMovement(remotePlayer, ri.moveDir, speed, dt);
          }
          setPlayerRotation(remotePlayer, ri.aimAngle);

          if (ri.attacking && remotePlayer.dashTimer <= 0) {
            tryStartAttack(remotePlayer, world.time);
          }
          if (ri.spellSlot !== null) {
            const dir = { x: Math.sin(ri.aimAngle), z: Math.cos(ri.aimAngle) };
            const spellEvents = tryCastSpell(remotePlayer, ri.spellSlot, dir, world);
            world.events.push(...spellEvents);
          }
        }
        tickAttack(remotePlayer, dt, world.time);
      }
    }

    // Capture pre-tick events (spell casts, sword hits) before tickWorld clears them
    const preTrickEvents = [...world.events];

    tickWorld(world, dt);

    // Merge pre-tick events with events generated during tick
    const allEvents = [...preTrickEvents, ...world.events];

    // Ensure audio context is initialized (requires prior user gesture)
    initAudio();

    // Process audio events
    processAudioEvents(allEvents, localPlayerId);

    // Camera shake from world events
    for (const event of allEvents) {
      if (event.type === 'BOSS_SLAM') {
        useGameStore.getState().setCameraShake(1.5); // heavy shake
      }
      // Shake when local player takes damage (enemy punch, projectile, burn)
      if (event.type === 'DAMAGE_TAKEN' && event.entityId === localPlayerId) {
        useGameStore.getState().setCameraShake(0.5); // medium shake
      }
      // Fireball explosion VFX
      if (event.type === 'FIREBALL_EXPLOSION') {
        const store = useGameStore.getState();
        store.addHitSpark(event.position.x, event.position.z);
        store.setCameraShake(0.6);
      }
      // Lightning chain VFX
      if (event.type === 'LIGHTNING_CHAIN') {
        const store = useGameStore.getState();
        // Build chain points: source player → each target
        const chainPoints: { x: number; z: number }[] = [];
        const sourcePlayer = localPlayerId ? world.players.get(localPlayerId) : null;
        if (sourcePlayer) {
          chainPoints.push({ x: sourcePlayer.position.x, z: sourcePlayer.position.z });
        }
        for (const targetId of event.targetIds) {
          const enemy = world.enemies.get(targetId);
          if (enemy) {
            chainPoints.push({ x: enemy.position.x, z: enemy.position.z });
          } else if (world.boss && world.boss.id === targetId) {
            chainPoints.push({ x: world.boss.position.x, z: world.boss.position.z });
          }
        }
        if (chainPoints.length >= 2) {
          store.addLightningBolt(chainPoints);
        }
        store.setCameraShake(0.8);
      }
    }

    // Track combat stats
    const statsStore = useStatsStore.getState();
    statsStore.updateTimeSurvived(dt);
    for (const event of allEvents) {
      statsStore.processEvent(event);
    }

    // Check achievements every ~1 second (60 frames) to avoid spam
    if (achievementCheckCounter.current++ >= 60) {
      achievementCheckCounter.current = 0;
      useAchievementStore.getState().checkAchievements(statsStore.currentStats);
    }

    // Check if local player death animation finished
    if (localPlayerId) {
      const player = world.players.get(localPlayerId);
      if (player && player.state === 'dead') {
        useAppStore.getState().setScene('dead');
      }
    }

    // Push snapshots to Zustand for rendering
    const store = useGameStore.getState();

    const players: Record<string, any> = {};
    for (const [id, p] of world.players) {
      players[id] = p;
    }
    store.setPlayers(players);

    const enemies: Record<string, any> = {};
    for (const [id, e] of world.enemies) {
      enemies[id] = e;
    }
    store.setEnemies(enemies);

    const projectiles: Record<string, any> = {};
    for (const [id, p] of world.projectiles) {
      projectiles[id] = p;
    }
    store.setProjectiles(projectiles);

    store.setBoss(world.boss ? { ...world.boss } : null);

    // Sync spell drops
    const spellDrops: Record<string, any> = {};
    for (const [id, d] of world.spellDrops) {
      spellDrops[id] = d;
    }
    store.setSpellDrops(spellDrops);

    // Sync zones
    const zones: Record<string, any> = {};
    for (const [id, z] of world.zones) {
      zones[id] = z;
    }
    store.setZones(zones);

    // Sync survival state
    if (world.survival) {
      store.setSurvival(world.survival.wave, world.survival.enemiesRemaining);
    }

    // Sync dungeon state
    if (world.dungeonState && world.dungeon) {
      store.setDungeonLayout(world.dungeon);
      store.setDungeonRoomStates(world.dungeonState.roomStates);
      store.setDungeonDoorStates(world.dungeonState.doorStates);
      store.setCurrentDungeonRoom(world.dungeonState.currentRoomId);
    }

    // --- Multiplayer: host broadcasts world snapshot ---
    const mp = useMultiplayerStore.getState();
    if (mp.connected && mp.isHost) {
      // Broadcast at ~10Hz (every 6 frames at 60fps)
      broadcastCounter.current++;
      if (broadcastCounter.current >= 6) {
        broadcastCounter.current = 0;
        mp.broadcastSnapshot({
          players,
          enemies,
          projectiles,
          spellDrops,
          zones,
          boss: world.boss ? { ...world.boss } : null,
          survivalWave: world.survival?.wave ?? null,
          survivalRemaining: world.survival?.enemiesRemaining ?? 0,
          time: world.time,
        });
      }
    }

    // --- Multiplayer: client applies received snapshots ---
    if (mp.connected && !mp.isHost && mp.latestSnapshot) {
      const snap = mp.latestSnapshot;
      store.setPlayers(snap.players);
      store.setEnemies(snap.enemies);
      store.setProjectiles(snap.projectiles);
      store.setSpellDrops(snap.spellDrops);
      store.setZones(snap.zones);
      store.setBoss(snap.boss);
      if (snap.survivalWave !== null) {
        store.setSurvival(snap.survivalWave, snap.survivalRemaining);
      }
    }

    // --- Multiplayer: client sends local input to host ---
    if (mp.connected && !mp.isHost && localPlayerId) {
      const input = useInputStore.getState();
      const toTarget = vec2Sub(input.mouseWorldPos, { x: 0, z: 0 });
      mp.sendInput({
        playerId: localPlayerId,
        moveDir: input.moveDir,
        aimAngle: vec2Length(toTarget) > 1 ? Math.atan2(toTarget.x, toTarget.z) : 0,
        attacking: isKeyDown('Space'),
        dash: isKeyDown('ShiftLeft') || isKeyDown('ShiftRight'),
        spellSlot: null,
        timestamp: Date.now(),
      });
    }
  });
}
