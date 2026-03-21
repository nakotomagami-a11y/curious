import { useEffect } from 'react';
import { useStatsStore } from '@lib/stores/stats-store';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type LeaderboardPanelProps = {
  onBack: () => void;
};

export function LeaderboardPanel({ onBack }: LeaderboardPanelProps) {
  const allEntries = useStatsStore((s) => s.leaderboard);
  const loading = useStatsStore((s) => s.leaderboardLoading);
  const loadLeaderboard = useStatsStore((s) => s.loadLeaderboard);

  // Load from Supabase on mount
  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const cellStyle: React.CSSProperties = {
    padding: '6px 12px',
    textAlign: 'left',
    fontSize: '13px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  };

  const headerStyle: React.CSSProperties = {
    ...cellStyle,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 600,
    fontSize: '11px',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    borderBottom: '1px solid rgba(255,255,255,0.15)',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        background: 'rgba(0,0,0,0.75)',
        userSelect: 'none',
        zIndex: 50,
      }}
    >
      <h2
        style={{
          color: '#f0c040',
          fontSize: '32px',
          fontWeight: 300,
          letterSpacing: '6px',
          margin: 0,
          fontFamily: 'Georgia, serif',
        }}
      >
        LEADERBOARD
      </h2>

      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <table style={{ borderCollapse: 'collapse', minWidth: '520px' }}>
          <thead>
            <tr>
              <th style={headerStyle}>Rank</th>
              <th style={headerStyle}>Name</th>
              <th style={{ ...headerStyle, textAlign: 'right' }}>Score</th>
              <th style={{ ...headerStyle, textAlign: 'right' }}>Waves</th>
              <th style={{ ...headerStyle, textAlign: 'right' }}>Time</th>
              <th style={headerStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {allEntries.map((entry, i) => (
              <tr key={i} style={{ color: i < 3 ? '#f0c040' : '#fff' }}>
                <td style={cellStyle}>{i + 1}</td>
                <td style={cellStyle}>{entry.playerName}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{entry.score.toLocaleString()}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{entry.wavesCleared}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{formatTime(entry.timeSurvived)}</td>
                <td style={cellStyle}>{entry.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={onBack}
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
        back
      </button>
    </div>
  );
}
