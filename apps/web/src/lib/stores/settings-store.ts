import { create } from 'zustand';

type QualityPreset = 'low' | 'medium' | 'high';
type ShadowQuality = 'off' | 'low' | 'high';
type ParticleDensity = 'low' | 'medium' | 'high';

type SettingsStore = {
  // Audio
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  // Video
  qualityPreset: QualityPreset;
  postProcessing: boolean;
  shadowQuality: ShadowQuality;
  particleDensity: ParticleDensity;
  showFps: boolean;
  // Controls
  mouseSensitivity: number;
  // Actions
  setMasterVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  toggleMute: () => void;
  setQualityPreset: (q: QualityPreset) => void;
  setPostProcessing: (v: boolean) => void;
  setShadowQuality: (q: ShadowQuality) => void;
  setParticleDensity: (d: ParticleDensity) => void;
  setShowFps: (v: boolean) => void;
  setMouseSensitivity: (s: number) => void;
};

const STORAGE_KEY = 'curious-settings';

function loadFromStorage(): Partial<SettingsStore> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function saveToStorage(state: SettingsStore) {
  if (typeof window === 'undefined') return;
  try {
    const { masterVolume, musicVolume, sfxVolume, muted, qualityPreset, postProcessing, shadowQuality, particleDensity, showFps, mouseSensitivity } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ masterVolume, musicVolume, sfxVolume, muted, qualityPreset, postProcessing, shadowQuality, particleDensity, showFps, mouseSensitivity }));
  } catch {
    // ignore
  }
}

const defaults = {
  masterVolume: 0.7,
  musicVolume: 0.7,
  sfxVolume: 0.7,
  muted: false,
  qualityPreset: 'medium' as QualityPreset,
  postProcessing: true,
  shadowQuality: 'low' as ShadowQuality,
  particleDensity: 'medium' as ParticleDensity,
  showFps: false,
  mouseSensitivity: 1.0,
};

const saved = loadFromStorage();

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...defaults,
  ...saved,

  setMasterVolume: (v) => { set({ masterVolume: v }); saveToStorage(get()); },
  setMusicVolume: (v) => { set({ musicVolume: v }); saveToStorage(get()); },
  setSfxVolume: (v) => { set({ sfxVolume: v }); saveToStorage(get()); },
  toggleMute: () => { set((s) => ({ muted: !s.muted })); saveToStorage(get()); },
  setQualityPreset: (q) => { set({ qualityPreset: q }); saveToStorage(get()); },
  setPostProcessing: (v) => { set({ postProcessing: v }); saveToStorage(get()); },
  setShadowQuality: (q) => { set({ shadowQuality: q }); saveToStorage(get()); },
  setParticleDensity: (d) => { set({ particleDensity: d }); saveToStorage(get()); },
  setShowFps: (v) => { set({ showFps: v }); saveToStorage(get()); },
  setMouseSensitivity: (s) => { set({ mouseSensitivity: s }); saveToStorage(get()); },
}));
