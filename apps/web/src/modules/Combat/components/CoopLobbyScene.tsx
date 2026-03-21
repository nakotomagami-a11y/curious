import { useState } from 'react';
import { Html } from '@react-three/drei';
import { useAppStore } from '@lib/stores/app-store';

export function CoopLobbyScene() {
  const playerName = useAppStore((s) => s.playerName);
  const setScene = useAppStore((s) => s.setScene);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);

  const roomCode = 'ABCD-1234';

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <ambientLight intensity={0.3} />
      <Html fullscreen>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            userSelect: 'none',
            fontFamily: "'Lexend', sans-serif",
          }}
        >
          {/* Title */}
          <h2
            style={{
              color: '#fff',
              fontSize: '28px',
              fontWeight: 400,
              letterSpacing: '4px',
              margin: 0,
            }}
          >
            CO-OP LOBBY
          </h2>

          {/* Room Code */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '12px 20px',
            }}
          >
            <span style={{ color: '#888', fontSize: '13px', letterSpacing: '1px' }}>
              ROOM CODE
            </span>
            <span
              style={{
                color: '#4488ff',
                fontSize: '20px',
                fontWeight: 500,
                letterSpacing: '3px',
              }}
            >
              {roomCode}
            </span>
            <button
              onClick={handleCopy}
              style={{
                background: 'rgba(68,136,255,0.15)',
                border: '1px solid rgba(68,136,255,0.3)',
                borderRadius: '4px',
                color: '#4488ff',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 10px',
                fontFamily: "'Lexend', sans-serif",
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Player Slots */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '340px',
            }}
          >
            {[
              { name: playerName || 'Player 1', isLocal: true },
              { name: 'Waiting...', isLocal: false },
              { name: 'Waiting...', isLocal: false },
              { name: 'Waiting...', isLocal: false },
            ].map((slot, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: slot.isLocal
                    ? 'rgba(68,136,255,0.08)'
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${slot.isLocal ? 'rgba(68,136,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '6px',
                  padding: '10px 14px',
                }}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: slot.isLocal ? '#4488ff' : 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: slot.isLocal ? '#fff' : '#555',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    color: slot.isLocal ? '#fff' : '#555',
                    fontSize: '14px',
                    flex: 1,
                  }}
                >
                  {slot.name}
                </span>
                {slot.isLocal && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: ready ? '#4488ff' : '#888',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={ready}
                      onChange={(e) => setReady(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    Ready
                  </label>
                )}
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={() => setScene('mode-select')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '10px 24px',
                fontFamily: "'Lexend', sans-serif",
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
            >
              Back
            </button>
            <button
              disabled
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                color: '#555',
                cursor: 'not-allowed',
                fontSize: '14px',
                padding: '10px 24px',
                fontFamily: "'Lexend', sans-serif",
              }}
            >
              Waiting for players...
            </button>
          </div>

          {/* Note */}
          <span
            style={{
              color: '#555',
              fontSize: '11px',
              letterSpacing: '0.5px',
              marginTop: '12px',
            }}
          >
            Multiplayer coming soon — currently in development
          </span>
        </div>
      </Html>
    </>
  );
}
