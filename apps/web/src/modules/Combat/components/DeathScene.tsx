import { useDeathActions } from '../hooks/useDeathActions';

/** Rendered as a regular DOM overlay (outside R3F Canvas) so it stays centered. */
export function DeathScene() {
  const { handleRestart } = useDeathActions();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        background: 'rgba(0,0,0,0.6)',
        userSelect: 'none',
        zIndex: 50,
      }}
    >
      <h1
        style={{
          color: '#cc3333',
          fontSize: '52px',
          fontWeight: 300,
          letterSpacing: '6px',
          margin: 0,
          fontFamily: 'Georgia, serif',
        }}
      >
        You Died
      </h1>
      <button
        onClick={handleRestart}
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '6px',
          color: '#fff',
          fontSize: '16px',
          padding: '10px 36px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: '2px',
          transition: 'all 0.15s ease',
        }}
      >
        try again
      </button>
    </div>
  );
}
