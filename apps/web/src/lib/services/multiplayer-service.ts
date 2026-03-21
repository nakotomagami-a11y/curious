import { supabase } from '@lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Vec2 } from '@curious/shared';

// --- Types ---

export type MultiplayerPlayer = {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
};

export type PlayerInputPayload = {
  playerId: string;
  moveDir: Vec2;
  aimAngle: number;
  attacking: boolean;
  dash: boolean;
  spellSlot: number | null; // null = not casting
  timestamp: number;
};

export type WorldSnapshotPayload = {
  players: Record<string, any>;
  enemies: Record<string, any>;
  projectiles: Record<string, any>;
  spellDrops: Record<string, any>;
  zones: Record<string, any>;
  boss: any | null;
  survivalWave: number | null;
  survivalRemaining: number;
  time: number;
};

// --- Room code generator ---

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += '-';
  for (let i = 0; i < 4; i++) code += digits[Math.floor(Math.random() * digits.length)];
  return code;
}

// --- Multiplayer Manager ---

let channel: RealtimeChannel | null = null;
let currentRoomCode: string | null = null;
let localPlayerId: string | null = null;
let isHost = false;

// Callbacks
let onPlayersChanged: ((players: MultiplayerPlayer[]) => void) | null = null;
let onWorldSnapshot: ((snapshot: WorldSnapshotPayload) => void) | null = null;
let onPlayerInput: ((input: PlayerInputPayload) => void) | null = null;
let onGameStart: (() => void) | null = null;

export function setCallbacks(cbs: {
  onPlayersChanged?: (players: MultiplayerPlayer[]) => void;
  onWorldSnapshot?: (snapshot: WorldSnapshotPayload) => void;
  onPlayerInput?: (input: PlayerInputPayload) => void;
  onGameStart?: () => void;
}) {
  if (cbs.onPlayersChanged) onPlayersChanged = cbs.onPlayersChanged;
  if (cbs.onWorldSnapshot) onWorldSnapshot = cbs.onWorldSnapshot;
  if (cbs.onPlayerInput) onPlayerInput = cbs.onPlayerInput;
  if (cbs.onGameStart) onGameStart = cbs.onGameStart;
}

export function getIsHost(): boolean {
  return isHost;
}

export function getRoomCode(): string | null {
  return currentRoomCode;
}

export function getLocalPlayerId(): string | null {
  return localPlayerId;
}

/** Create a new room as host. */
export async function createRoom(playerName: string): Promise<string> {
  const roomCode = generateRoomCode();
  localPlayerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  isHost = true;
  currentRoomCode = roomCode;

  // Insert session into DB
  await supabase.from('game_sessions').insert({
    id: roomCode,
    host_name: playerName,
    game_mode: 'coop-survival',
    player_count: 1,
    state: 'lobby',
  });

  // Join realtime channel
  await joinChannel(roomCode, playerName);

  return roomCode;
}

/** Join an existing room. */
export async function joinRoom(roomCode: string, playerName: string): Promise<boolean> {
  // Verify room exists
  const { data } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', roomCode)
    .single();

  if (!data) {
    console.error('Room not found:', roomCode);
    return false;
  }

  if (data.state !== 'lobby') {
    console.error('Game already in progress');
    return false;
  }

  if (data.player_count >= data.max_players) {
    console.error('Room is full');
    return false;
  }

  localPlayerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  isHost = false;
  currentRoomCode = roomCode;

  await joinChannel(roomCode, playerName);

  return true;
}

async function joinChannel(roomCode: string, playerName: string): Promise<void> {
  channel = supabase.channel(`room:${roomCode}`, {
    config: {
      presence: { key: localPlayerId! },
      broadcast: { self: false },
    },
  });

  // Presence: track who's in the room
  channel.on('presence', { event: 'sync' }, () => {
    const presenceState = channel!.presenceState();
    const players: MultiplayerPlayer[] = [];

    for (const [_key, presences] of Object.entries(presenceState)) {
      const p = (presences as any[])[0];
      if (p) {
        players.push({
          id: p.playerId,
          name: p.playerName,
          ready: p.ready ?? false,
          isHost: p.isHost ?? false,
        });
      }
    }

    // Update session player count
    if (isHost) {
      supabase
        .from('game_sessions')
        .update({ player_count: players.length, updated_at: new Date().toISOString() })
        .eq('id', roomCode)
        .then(() => {});
    }

    onPlayersChanged?.(players);
  });

  // Broadcast: world snapshots from host
  channel.on('broadcast', { event: 'world_snapshot' }, ({ payload }) => {
    if (!isHost) {
      onWorldSnapshot?.(payload as WorldSnapshotPayload);
    }
  });

  // Broadcast: player inputs from clients
  channel.on('broadcast', { event: 'player_input' }, ({ payload }) => {
    if (isHost) {
      onPlayerInput?.(payload as PlayerInputPayload);
    }
  });

  // Broadcast: game start signal
  channel.on('broadcast', { event: 'game_start' }, () => {
    onGameStart?.();
  });

  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel!.track({
        playerId: localPlayerId,
        playerName,
        ready: false,
        isHost,
      });
    }
  });
}

/** Update ready state in presence. */
export async function setReady(ready: boolean): Promise<void> {
  if (!channel) return;
  const current = channel.presenceState()[localPlayerId!];
  const existing = current ? (current as any[])[0] : {};
  await channel.track({ ...existing, ready });
}

/** Host broadcasts world snapshot to all clients. */
export function broadcastWorldSnapshot(snapshot: WorldSnapshotPayload): void {
  if (!channel || !isHost) return;
  channel.send({
    type: 'broadcast',
    event: 'world_snapshot',
    payload: snapshot,
  });
}

/** Client sends input to host. */
export function sendPlayerInput(input: PlayerInputPayload): void {
  if (!channel || isHost) return;
  channel.send({
    type: 'broadcast',
    event: 'player_input',
    payload: input,
  });
}

/** Host signals game start. */
export function broadcastGameStart(): void {
  if (!channel || !isHost) return;

  // Update DB session state
  if (currentRoomCode) {
    supabase
      .from('game_sessions')
      .update({ state: 'playing', updated_at: new Date().toISOString() })
      .eq('id', currentRoomCode)
      .then(() => {});
  }

  channel.send({
    type: 'broadcast',
    event: 'game_start',
    payload: {},
  });
}

/** Leave the current room and clean up. */
export async function leaveRoom(): Promise<void> {
  if (channel) {
    await channel.untrack();
    supabase.removeChannel(channel);
    channel = null;
  }

  // If host, delete the session
  if (isHost && currentRoomCode) {
    await supabase.from('game_sessions').delete().eq('id', currentRoomCode);
  }

  currentRoomCode = null;
  localPlayerId = null;
  isHost = false;
}
