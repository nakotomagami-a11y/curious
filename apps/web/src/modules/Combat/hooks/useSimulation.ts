import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '@lib/stores/app-store';
import { useGameStore } from '@lib/stores/game-store';
import { useInputStore } from '@lib/stores/input-store';
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
import { initAudio } from '@modules/Audio/audio-engine';
import { processAudioEvents } from '@modules/Audio/game-audio';

/** Runs the simulation tick every frame during combat. */
export function useSimulation() {
  const scene = useAppStore((s) => s.scene);
  // Track which enemies have been hit during current attack to avoid multi-hits
  const hitThisAttack = useRef<Set<string>>(new Set());
  // Spell key debouncing — fire on key-down edge only
  const spellKeyState = useRef<boolean[]>([false, false, false]);

  useFrame((_, delta) => {
    if (scene !== 'combat') return;

    // Hitstop micro-freeze: pause simulation briefly on hit
    const hitstop = useGameStore.getState().hitstopTimer;
    if (hitstop > 0) {
      useGameStore.getState().setHitstopTimer(Math.max(0, hitstop - delta));
      return;
    }

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

          // Spell keys: 1, 2, 3
          const aimDir = vec2Length(toTarget) > 1 ? vec2Normalize(toTarget) : { x: 0, z: 1 };
          for (let slot = 0; slot < 3; slot++) {
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
              const damage = randomizeDamage(player.swordDamage, DAMAGE_VARIANCE);
              const events = applyHitToEnemy(enemy, damage, player.position);
              world.events.push(...events);
              store.addHitSpark(enemy.position.x, enemy.position.z);
              store.addDamageNumber(enemy.position.x, enemy.position.z, damage);
              hitLanded = true;
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
              const damage = randomizeDamage(player.swordDamage, DAMAGE_VARIANCE);
              const events = applyHitToBoss(world.boss, damage, player.position);
              world.events.push(...events);
              store.addHitSpark(world.boss.position.x, world.boss.position.z, true);
              store.addDamageNumber(world.boss.position.x, world.boss.position.z, damage);
              hitLanded = true;
            }
          }

          // Camera shake + hitstop on hit
          if (hitLanded) {
            store.setCameraShake(0.9);
            store.setHitstopTimer(0.05);
          }
        }
      }
    }

    tickWorld(world, dt);

    // Ensure audio context is initialized (requires prior user gesture)
    initAudio();

    // Process audio events
    processAudioEvents(world.events, localPlayerId);

    // Camera shake from world events
    for (const event of world.events) {
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

    // Sync survival state
    if (world.survival) {
      store.setSurvival(world.survival.wave, world.survival.enemiesRemaining);
    }
  });
}
