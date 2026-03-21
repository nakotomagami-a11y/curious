import { useStatsStore } from '@lib/stores/stats-store';
import type { LeaderboardEntry } from '@curious/shared';

const MOCK_ENTRIES: LeaderboardEntry[] = [
  { playerName: 'Aethon', score: 8420, wavesCleared: 12, timeSurvived: 342, date: '2026-03-15' },
  { playerName: 'Brynhild', score: 7150, wavesCleared: 10, timeSurvived: 298, date: '2026-03-14' },
  { playerName: 'Corvus', score: 6300, wavesCleared: 9, timeSurvived: 275, date: '2026-03-13' },
  { playerName: 'Duskweaver', score: 5480, wavesCleared: 8, timeSurvived: 240, date: '2026-03-12' },
  { playerName: 'Embera', score: 4720, wavesCleared: 7, timeSurvived: 210, date: '2026-03-11' },
  { playerName: 'Fenrix', score: 3900, wavesCleared: 6, timeSurvived: 185, date: '2026-03-10' },
  { playerName: 'Grimweld', score: 3200, wavesCleared: 5, timeSurvived: 160, date: '2026-03-09' },
  { playerName: 'Helios', score: 2650, wavesCleared: 4, timeSurvived: 138, date: '2026-03-08' },
  { playerName: 'Iskra', score: 1800, wavesCleared: 3, timeSurvived: 102, date: '2026-03-07' },
  { playerName: 'Jareth', score: 950, wavesCleared: 2, timeSurvived: 65, date: '2026-03-06' },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type LeaderboardPanelProps = {
  onBack: () => void;
};

export function LeaderboardPanel({ onBack }: LeaderboardPanelProps) {
  const storedEntries = useStatsStore((s) => s.leaderboard);

  // Merge stored entries with mock entries, sort, take top 10
  const allEntries = [...storedEntries, ...MOCK_ENTRIES]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

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
