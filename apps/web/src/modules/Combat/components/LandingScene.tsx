import { Html } from '@react-three/drei';
import { useLandingActions } from '../hooks/useLandingActions';

export function LandingScene() {
  const { name, setName, handleSubmit, canSubmit } = useLandingActions();

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
            gap: '16px',
            userSelect: 'none',
          }}
        >
          <h1
            style={{
              color: '#fff',
              fontSize: '56px',
              fontWeight: 300,
              letterSpacing: '8px',
              margin: 0,
              fontFamily: "'Matemasie', Georgia, serif",
            }}
          >
            Curious
          </h1>
          <p
            style={{
              color: '#666',
              fontSize: '14px',
              margin: '0 0 12px 0',
              letterSpacing: '2px',
            }}
          >
            enter your name and drop in
          </p>
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="your name"
              maxLength={16}
              autoFocus
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '18px',
                padding: '10px 20px',
                textAlign: 'center',
                outline: 'none',
                width: '220px',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                background: canSubmit
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${canSubmit ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '6px',
                color: canSubmit ? '#fff' : '#444',
                fontSize: '16px',
                padding: '8px 36px',
                cursor: canSubmit ? 'pointer' : 'default',
                fontFamily: 'inherit',
                letterSpacing: '2px',
                transition: 'all 0.15s ease',
              }}
            >
              drop in
            </button>
          </form>

          {/* Controls */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginTop: '32px',
              alignItems: 'flex-start',
            }}
          >
            {/* WASD */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ControlKey label="W" />
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <ControlKey label="A" />
                <ControlKey label="S" />
                <ControlKey label="D" />
              </div>
              <span style={{ color: '#555', fontSize: '11px', marginTop: '4px', letterSpacing: '1px' }}>move</span>
            </div>

            {/* Shift */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <ControlKey label="⇧" wide />
              <span style={{ color: '#555', fontSize: '11px', marginTop: '4px', letterSpacing: '1px' }}>dash</span>
            </div>

            {/* Space */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <ControlKey label="Space" wide />
              <span style={{ color: '#555', fontSize: '11px', marginTop: '4px', letterSpacing: '1px' }}>attack</span>
            </div>

            {/* LMB */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <MouseIcon />
              <span style={{ color: '#555', fontSize: '11px', marginTop: '4px', letterSpacing: '1px' }}>select</span>
            </div>
          </div>
        </div>
      </Html>
    </>
  );
}

function MouseIcon() {
  return (
    <svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mouse body */}
      <rect x="1" y="1" width="28" height="40" rx="14" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="rgba(255,255,255,0.06)" />
      {/* Left button highlight */}
      <path d="M15 1 L15 18 L1.5 18 L1.5 15 Q1.5 1 15 1 Z" fill="rgba(255,255,255,0.1)" />
      {/* Divider line */}
      <line x1="15" y1="1" x2="15" y2="18" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* Scroll wheel */}
      <rect x="13" y="8" width="4" height="7" rx="2" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none" />
    </svg>
  );
}

function ControlKey({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <div
      style={{
        width: wide ? '77px' : '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '5px',
        color: '#888',
        fontSize: '14px',
        fontFamily: 'inherit',
        fontWeight: 500,
      }}
    >
      {label}
    </div>
  );
}
