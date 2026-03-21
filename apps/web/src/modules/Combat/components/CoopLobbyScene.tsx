import { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useAppStore } from '@lib/stores/app-store';
import { useMultiplayerStore } from '@lib/stores/multiplayer-store';
import { setCallbacks } from '@lib/services/multiplayer-service';

export function CoopLobbyScene() {
  const playerName = useAppStore((s) => s.playerName);
  const setScene = useAppStore((s) => s.setScene);

  const connected = useMultiplayerStore((s) => s.connected);
  const roomCode = useMultiplayerStore((s) => s.roomCode);
  const players = useMultiplayerStore((s) => s.players);
  const isHost = useMultiplayerStore((s) => s.isHost);
  const mpCreateRoom = useMultiplayerStore((s) => s.createRoom);
  const mpJoinRoom = useMultiplayerStore((s) => s.joinRoom);
  const mpLeaveRoom = useMultiplayerStore((s) => s.leaveRoom);
  const mpSetReady = useMultiplayerStore((s) => s.setReady);
  const mpStartGame = useMultiplayerStore((s) => s.startGame);

  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [mode, setMode] = useState<'choose' | 'hosting' | 'joining'>('choose');

  // Listen for game start
  useEffect(() => {
    setCallbacks({
      onGameStart: () => {
        setScene('combat');
      },
    });
  }, [setScene]);

  // Auto-create room when entering lobby as host
  const handleCreate = async () => {
    setMode('hosting');
    await mpCreateRoom(playerName || 'Player 1');
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoinError('');
    const success = await mpJoinRoom(joinCode.trim().toUpperCase(), playerName || 'Player 1');
    if (success) {
      setMode('joining');
    } else {
      setJoinError('Room not found or full');
    }
  };

  const handleBack = async () => {
    if (connected) await mpLeaveRoom();
    setMode('choose');
    setScene('mode-select');
  };

  const handleReady = (r: boolean) => {
    setReady(r);
    mpSetReady(r);
  };

  const handleCopy = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const allReady = players.length >= 2 && players.every((p) => p.ready || p.isHost);

  const handleStart = () => {
    mpStartGame();
    setScene('combat');
  };

  // Render: choose create or join
  if (mode === 'choose') {
    return (
      <>
        <ambientLight intensity={0.3} />
        <Html fullscreen>
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, userSelect: 'none', fontFamily: "'Lexend', sans-serif" }}>
            <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 400, letterSpacing: 4, margin: 0 }}>CO-OP SURVIVAL</h2>

            <div style={{ display: 'flex', gap: 16 }}>
              <button onClick={handleCreate} style={btnStyle('#4488ff')}>
                Create Room
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Room code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={9}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: 14,
                      padding: '10px 14px',
                      fontFamily: "'Lexend', sans-serif",
                      letterSpacing: 2,
                      width: 140,
                      outline: 'none',
                    }}
                  />
                  <button onClick={handleJoin} style={btnStyle('#44aa66')}>
                    Join
                  </button>
                </div>
                {joinError && <span style={{ color: '#ff6644', fontSize: 12 }}>{joinError}</span>}
              </div>
            </div>

            <button onClick={handleBack} style={{ ...btnStyle('transparent'), color: '#888', border: '1px solid rgba(255,255,255,0.15)' }}>
              Back
            </button>
          </div>
        </Html>
      </>
    );
  }

  // Render: lobby (hosting or joined)
  return (
    <>
      <ambientLight intensity={0.3} />
      <Html fullscreen>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, userSelect: 'none', fontFamily: "'Lexend', sans-serif" }}>
          <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 400, letterSpacing: 4, margin: 0 }}>
            {isHost ? 'HOSTING' : 'JOINED'}
          </h2>

          {/* Room Code */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 20px' }}>
            <span style={{ color: '#888', fontSize: 13, letterSpacing: 1 }}>ROOM</span>
            <span style={{ color: '#4488ff', fontSize: 20, fontWeight: 500, letterSpacing: 3 }}>{roomCode}</span>
            <button onClick={handleCopy} style={{ background: 'rgba(68,136,255,0.15)', border: '1px solid rgba(68,136,255,0.3)', borderRadius: 4, color: '#4488ff', cursor: 'pointer', fontSize: 12, padding: '4px 10px', fontFamily: "'Lexend', sans-serif" }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Player Slots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 340 }}>
            {Array.from({ length: 4 }, (_, i) => {
              const player = players[i];
              const hasPlayer = !!player;

              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: hasPlayer ? 'rgba(68,136,255,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${hasPlayer ? 'rgba(68,136,255,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 6, padding: '10px 14px' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: hasPlayer ? '#4488ff' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: hasPlayer ? '#fff' : '#555', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ color: hasPlayer ? '#fff' : '#555', fontSize: 14, flex: 1 }}>
                    {player?.name ?? 'Waiting...'}
                  </span>
                  {player?.isHost && <span style={{ fontSize: 10, color: '#f0c040', letterSpacing: 1 }}>HOST</span>}
                  {player?.ready && <span style={{ fontSize: 10, color: '#44dd66', letterSpacing: 1 }}>READY</span>}
                </div>
              );
            })}
          </div>

          {/* Ready / Start */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleBack} style={{ ...btnStyle('transparent'), color: '#888', border: '1px solid rgba(255,255,255,0.15)' }}>
              Leave
            </button>
            {!isHost && (
              <button onClick={() => handleReady(!ready)} style={btnStyle(ready ? '#44dd66' : '#4488ff')}>
                {ready ? 'Unready' : 'Ready'}
              </button>
            )}
            {isHost && (
              <button onClick={handleStart} disabled={!allReady} style={{ ...btnStyle(allReady ? '#44dd66' : '#555'), cursor: allReady ? 'pointer' : 'not-allowed', opacity: allReady ? 1 : 0.5 }}>
                {allReady ? 'Start Game' : `Waiting (${players.filter(p => p.ready || p.isHost).length}/${players.length})`}
              </button>
            )}
          </div>

          <span style={{ color: '#555', fontSize: 11, letterSpacing: 0.5, marginTop: 12 }}>
            Share the room code with friends to join
          </span>
        </div>
      </Html>
    </>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg === 'transparent' ? 'rgba(255,255,255,0.04)' : bg,
    border: `1px solid ${bg === 'transparent' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.2)'}`,
    borderRadius: 6,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    padding: '10px 24px',
    fontFamily: "'Lexend', sans-serif",
    transition: 'all 0.2s ease',
  };
}
