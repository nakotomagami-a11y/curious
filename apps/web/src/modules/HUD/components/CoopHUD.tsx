const teammates = [
  { name: 'Player 2', health: 75, maxHealth: 100, color: '#44cc66', downed: false },
  { name: 'Player 3', health: 100, maxHealth: 100, color: '#cc8844', downed: false },
  { name: 'Player 4', health: 0, maxHealth: 100, color: '#cc4466', downed: true },
];

export function CoopHUD() {
  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '16px',
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: "'Lexend', sans-serif",
      }}
    >
      {teammates.map((t) => (
        <div
          key={t.name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            minWidth: '100px',
          }}
        >
          {/* Name */}
          <span
            style={{
              fontSize: '10px',
              color: t.downed ? '#cc4466' : '#ccc',
              letterSpacing: '0.5px',
            }}
          >
            {t.name}
          </span>

          {/* Health bar container */}
          <div
            style={{
              width: '100px',
              height: '6px',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: '3px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div
              style={{
                width: `${(t.health / t.maxHealth) * 100}%`,
                height: '100%',
                background: t.downed ? '#cc4466' : t.color,
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* Downed state */}
          {t.downed && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: '#cc4466',
                  letterSpacing: '1px',
                }}
              >
                DOWNED
              </span>
              <span
                style={{
                  fontSize: '9px',
                  color: '#888',
                }}
              >
                Hold F to revive
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
