import { Html } from '@react-three/drei';
import { useModeSelectActions } from '../hooks/useModeSelectActions';
import { useAppStore } from '@lib/stores/app-store';

export function ModeSelectScene() {
  const { handleModeSelect } = useModeSelectActions();
  const playerName = useAppStore((s) => s.playerName);

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
            gap: '24px',
            userSelect: 'none',
            fontFamily: "'Lexend', sans-serif",
          }}
        >
          <span style={{ color: '#666', fontSize: '13px', letterSpacing: '1px' }}>
            welcome, {playerName}
          </span>
          <h2
            style={{
              color: '#fff',
              fontSize: '28px',
              fontWeight: 400,
              letterSpacing: '4px',
              margin: 0,
            }}
          >
            choose your mode
          </h2>

          <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
            {/* Dev Playground */}
            <ModeCard
              title="Dev Playground"
              description="Sandbox with respawning enemies and boss. No pressure, just combat."
              icon="🛠️"
              color="#4488ff"
              onClick={() => handleModeSelect('dev-playground')}
            />

            {/* Survival Waves */}
            <ModeCard
              title="Survival Waves"
              description="Escalating waves of enemies. They get stronger. Mega boss at wave 5."
              icon="⚔️"
              color="#ff6633"
              onClick={() => handleModeSelect('survival')}
            />
          </div>
        </div>
      </Html>
    </>
  );
}

function ModeCard({
  title,
  description,
  icon,
  color,
  onClick,
}: {
  title: string;
  description: string;
  icon: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '220px',
        padding: '28px 20px',
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}33`,
        borderRadius: '10px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        transition: 'all 0.2s ease',
        fontFamily: "'Lexend', sans-serif",
        color: '#fff',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.borderColor = `${color}88`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.borderColor = `${color}33`;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <span style={{ fontSize: '32px' }}>{icon}</span>
      <span
        style={{
          fontSize: '16px',
          fontWeight: 500,
          letterSpacing: '1px',
          color,
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: '12px',
          color: '#888',
          lineHeight: '1.4',
          textAlign: 'center',
        }}
      >
        {description}
      </span>
    </button>
  );
}
