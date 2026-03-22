/**
 * Audio engine — singleton managing Web Audio API context.
 * Lazy-inits on first user gesture to comply with browser autoplay policy.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientSource: AudioBufferSourceNode | null = null;
let ambientGain: GainNode | null = null;

// --- Music ---
let musicElement: HTMLAudioElement | null = null;
let musicGain: GainNode | null = null;
let musicSource: MediaElementAudioSourceNode | null = null;

export function getAudioContext(): AudioContext | null {
  return ctx;
}

export function getMasterGain(): GainNode | null {
  return masterGain;
}

/** Initialize audio context. Call after a user gesture (click/keypress). */
export function initAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }

  ctx = new AudioContext();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);
}

export function setMasterVolume(v: number): void {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
}

/** Apply volume settings from the settings store (master + mute). */
export function applyVolumeSettings(master: number, muted: boolean): void {
  if (masterGain) {
    masterGain.gain.value = muted ? 0 : Math.max(0, Math.min(1, master));
  }
}

/** Create a white noise buffer. */
export function createNoiseBuffer(duration: number): AudioBuffer | null {
  if (!ctx) return null;
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Start the ambient noise loop. */
export function startAmbient(): void {
  if (!ctx || !masterGain) return;
  stopAmbient();

  const buffer = createNoiseBuffer(2);
  if (!buffer) return;

  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0.03;

  // Low-pass filter for soft rumble
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;

  ambientSource = ctx.createBufferSource();
  ambientSource.buffer = buffer;
  ambientSource.loop = true;
  ambientSource.connect(filter);
  filter.connect(ambientGain);
  ambientGain.connect(masterGain);
  ambientSource.start();
}

/** Stop ambient loop. */
export function stopAmbient(): void {
  if (ambientSource) {
    try { ambientSource.stop(); } catch {}
    ambientSource.disconnect();
    ambientSource = null;
  }
  if (ambientGain) {
    ambientGain.disconnect();
    ambientGain = null;
  }
}

// --- Music playback ---

import { assetUrl } from '@lib/utils/asset-url';

const MUSIC_FADE_MS = 1500;

/** Start looping background music. Safe to call repeatedly — no-ops if already playing. */
export function startMusic(): void {
  if (!ctx || !masterGain) return;
  if (musicElement && !musicElement.paused) return;

  if (!musicElement) {
    musicElement = new Audio(assetUrl('/music/The Battle.mp3'));
    musicElement.loop = true;
    musicElement.preload = 'auto';
    musicSource = ctx.createMediaElementSource(musicElement);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicSource.connect(musicGain);
    musicGain.connect(masterGain);
  }

  musicElement.play().catch(() => {});
  // Fade in
  if (musicGain && ctx) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(1, ctx.currentTime + MUSIC_FADE_MS / 1000);
  }
}

/** Stop background music with a fade out. */
export function stopMusic(): void {
  if (!musicGain || !musicElement || !ctx) return;
  if (musicElement.paused) return;

  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
  musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + MUSIC_FADE_MS / 1000);

  setTimeout(() => {
    if (musicElement) {
      musicElement.pause();
      musicElement.currentTime = 0;
    }
  }, MUSIC_FADE_MS);
}

/** Set music volume (0-1). Applied on top of master volume. */
export function setMusicVolume(v: number): void {
  if (musicGain) musicGain.gain.value = Math.max(0, Math.min(1, v));
}

/** Stop all active sounds and ambient. */
export function stopAll(): void {
  stopAmbient();
  stopMusic();
}
