import { useState, useEffect } from 'react';
import { useDeathActions } from '@modules/Combat/hooks/useDeathActions';
import { useStatsStore } from '@lib/stores/stats-store';
import { useAppStore } from '@lib/stores/app-store';
import { useAchievementStore } from '@lib/stores/achievement-store';
import { LeaderboardPanel } from './LeaderboardPanel';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const statLabels: { key: string; label: string }[] = [
  { key: 'damageDealt', label: 'Damage Dealt' },
  { key: 'damageTaken', label: 'Damage Taken' },
  { key: 'enemiesKilled', label: 'Enemies Killed' },
  { key: 'bossesKilled', label: 'Bosses Killed' },
  { key: 'elitesKilled', label: 'Elites Killed' },
  { key: 'spellsCast', label: 'Spells Cast' },
  { key: 'criticalHits', label: 'Critical Hits' },
  { key: 'highestCombo', label: 'Highest Combo' },
  { key: 'wavesCleared', label: 'Waves Cleared' },
  { key: 'timeSurvived', label: 'Time Survived' },
];

export function DeathStatsScreen() {
  const { handleRestart } = useDeathActions();
  const stats = useStatsStore((s) => s.currentStats);
  const getScore = useStatsStore((s) => s.getScore);
  const resetStats = useStatsStore((s) => s.resetStats);
  const checkAchievements = useAchievementStore((s) => s.checkAchievements);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Check achievements on mount with final combat stats
  useEffect(() => {
    checkAchievements(stats);
  }, []);

  const score = Math.round(getScore());

  const onTryAgain = () => {
    resetStats();
    handleRestart();
  };

  const onMainMenu = () => {
    resetStats();
    useAppStore.getState().setScene('landing');
  };

  if (showLeaderboard) {
    return <LeaderboardPanel onBack={() => setShowLeaderboard(false)} />;
  }

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
        DEFEATED
      </h1>

      {/* Score */}
      <div
        style={{
          color: '#f0c040',
          fontSize: '28px',
          fontWeight: 600,
          letterSpacing: '3px',
          fontFamily: 'Georgia, serif',
        }}
      >
        SCORE: {score.toLocaleString()}
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px 40px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '20px 32px',
          maxWidth: '460px',
          width: '100%',
        }}
      >
        {statLabels.map(({ key, label }) => {
          const value = stats[key as keyof typeof stats];
          const display = key === 'timeSurvived' ? formatTime(value) : Math.round(value).toLocaleString();
          return (
            <div
              key={key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{label}</span>
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{display}</span>
            </div>
          );
        })}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
        <button
          onClick={onTryAgain}
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
        <button
          onClick={onMainMenu}
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
          main menu
        </button>
        <button
          onClick={() => setShowLeaderboard(true)}
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
          leaderboard
        </button>
      </div>
    </div>
  );
}
