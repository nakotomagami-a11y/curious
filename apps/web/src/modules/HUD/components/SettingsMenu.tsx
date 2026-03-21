'use client';

import { useState } from 'react';
import { useSettingsStore } from '@lib/stores/settings-store';
import { useAppStore } from '@lib/stores/app-store';

type Tab = 'audio' | 'video' | 'controls';

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 24px',
  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
  border: active ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
  borderRadius: 6,
  color: active ? '#fff' : 'rgba(255,255,255,0.5)',
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: "'Lexend', sans-serif",
  letterSpacing: 1,
  transition: 'all 0.15s ease',
});

const labelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.7)',
  fontSize: 13,
  minWidth: 140,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '6px 0',
};

const sliderStyle: React.CSSProperties = {
  width: 180,
  accentColor: '#4488ff',
  cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4,
  color: '#fff',
  fontSize: 13,
  padding: '4px 8px',
  fontFamily: "'Lexend', sans-serif",
  cursor: 'pointer',
  width: 180,
};

const toggleStyle = (on: boolean): React.CSSProperties => ({
  width: 40,
  height: 22,
  borderRadius: 11,
  background: on ? '#4488ff' : 'rgba(255,255,255,0.15)',
  border: 'none',
  cursor: 'pointer',
  position: 'relative',
  transition: 'background 0.15s ease',
  display: 'flex',
  alignItems: 'center',
  padding: 2,
});

const toggleKnobStyle = (on: boolean): React.CSSProperties => ({
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: '#fff',
  transition: 'transform 0.15s ease',
  transform: on ? 'translateX(18px)' : 'translateX(0)',
});

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button style={toggleStyle(value)} onClick={() => onChange(!value)}>
      <div style={toggleKnobStyle(value)} />
    </button>
  );
}

function AudioTab() {
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);
  const muted = useSettingsStore((s) => s.muted);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume);
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume);
  const toggleMute = useSettingsStore((s) => s.toggleMute);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={rowStyle}>
        <span style={labelStyle}>Master Volume</span>
        <input type="range" min={0} max={1} step={0.01} value={masterVolume} onChange={(e) => setMasterVolume(Number(e.target.value))} style={sliderStyle} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, width: 36, textAlign: 'right' }}>{Math.round(masterVolume * 100)}%</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Music Volume</span>
        <input type="range" min={0} max={1} step={0.01} value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} style={sliderStyle} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, width: 36, textAlign: 'right' }}>{Math.round(musicVolume * 100)}%</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>SFX Volume</span>
        <input type="range" min={0} max={1} step={0.01} value={sfxVolume} onChange={(e) => setSfxVolume(Number(e.target.value))} style={sliderStyle} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, width: 36, textAlign: 'right' }}>{Math.round(sfxVolume * 100)}%</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Mute All</span>
        <Toggle value={muted} onChange={toggleMute} />
      </div>
    </div>
  );
}

function VideoTab() {
  const qualityPreset = useSettingsStore((s) => s.qualityPreset);
  const postProcessing = useSettingsStore((s) => s.postProcessing);
  const shadowQuality = useSettingsStore((s) => s.shadowQuality);
  const particleDensity = useSettingsStore((s) => s.particleDensity);
  const showFps = useSettingsStore((s) => s.showFps);
  const setQualityPreset = useSettingsStore((s) => s.setQualityPreset);
  const setPostProcessing = useSettingsStore((s) => s.setPostProcessing);
  const setShadowQuality = useSettingsStore((s) => s.setShadowQuality);
  const setParticleDensity = useSettingsStore((s) => s.setParticleDensity);
  const setShowFps = useSettingsStore((s) => s.setShowFps);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={rowStyle}>
        <span style={labelStyle}>Quality Preset</span>
        <select value={qualityPreset} onChange={(e) => setQualityPreset(e.target.value as 'low' | 'medium' | 'high')} style={selectStyle}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Post-Processing</span>
        <Toggle value={postProcessing} onChange={setPostProcessing} />
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Shadow Quality</span>
        <select value={shadowQuality} onChange={(e) => setShadowQuality(e.target.value as 'off' | 'low' | 'high')} style={selectStyle}>
          <option value="off">Off</option>
          <option value="low">Low</option>
          <option value="high">High</option>
        </select>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Particle Density</span>
        <select value={particleDensity} onChange={(e) => setParticleDensity(e.target.value as 'low' | 'medium' | 'high')} style={selectStyle}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Show FPS</span>
        <Toggle value={showFps} onChange={setShowFps} />
      </div>
    </div>
  );
}

const keybindings = [
  { key: 'W A S D', action: 'Move' },
  { key: 'Space', action: 'Attack' },
  { key: 'Shift', action: 'Dash' },
  { key: '1 - 9', action: 'Spells' },
  { key: 'F', action: 'Pickup' },
];

function ControlsTab() {
  const mouseSensitivity = useSettingsStore((s) => s.mouseSensitivity);
  const setMouseSensitivity = useSettingsStore((s) => s.setMouseSensitivity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={rowStyle}>
        <span style={labelStyle}>Mouse Sensitivity</span>
        <input type="range" min={0.1} max={3.0} step={0.1} value={mouseSensitivity} onChange={(e) => setMouseSensitivity(Number(e.target.value))} style={sliderStyle} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, width: 36, textAlign: 'right' }}>{mouseSensitivity.toFixed(1)}</span>
      </div>

      <div style={{ marginTop: 8 }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Keybindings</span>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {keybindings.map(({ key, action }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{action}</span>
              <span style={{
                color: '#fff',
                fontSize: 12,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4,
                padding: '2px 10px',
                fontFamily: "'Lexend', sans-serif",
              }}>{key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsMenu() {
  const [tab, setTab] = useState<Tab>('audio');
  const toggleSettings = useAppStore((s) => s.toggleSettings);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        fontFamily: "'Lexend', sans-serif",
        userSelect: 'none',
      }}
    >
      {/* Close button */}
      <button
        onClick={toggleSettings}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6,
          color: '#fff',
          fontSize: 20,
          width: 36,
          height: 36,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Lexend', sans-serif",
          transition: 'all 0.15s ease',
        }}
      >
        X
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: 480 }}>
        {/* Title */}
        <h1 style={{
          color: '#fff',
          fontSize: 32,
          fontWeight: 300,
          letterSpacing: 6,
          margin: 0,
          fontFamily: "'Lexend', sans-serif",
        }}>
          SETTINGS
        </h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={tabStyle(tab === 'audio')} onClick={() => setTab('audio')}>Audio</button>
          <button style={tabStyle(tab === 'video')} onClick={() => setTab('video')}>Video</button>
          <button style={tabStyle(tab === 'controls')} onClick={() => setTab('controls')}>Controls</button>
        </div>

        {/* Tab content */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '24px 32px',
          width: '100%',
        }}>
          {tab === 'audio' && <AudioTab />}
          {tab === 'video' && <VideoTab />}
          {tab === 'controls' && <ControlsTab />}
        </div>
      </div>
    </div>
  );
}
