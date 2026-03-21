/**
 * Procedural sound generators — all sounds synthesized via Web Audio API.
 * Each function schedules oscillators/noise that auto-cleanup after playing.
 */

import { getAudioContext, getMasterGain, createNoiseBuffer } from './audio-engine';

// --- Helpers ---

function rng(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function playNoiseBurst(
  duration: number,
  volume: number,
  filterFreq: number,
  filterType: BiquadFilterType = 'bandpass'
): void {
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master) return;

  const buffer = createNoiseBuffer(duration);
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = 1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();
  source.stop(ctx.currentTime + duration);
}

function playSine(
  freq: number,
  duration: number,
  volume: number,
  freqEnd?: number
): void {
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master) return;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(freqEnd, 20),
      ctx.currentTime + duration
    );
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(master);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// --- Sound Definitions ---

/** Sword slash — white noise whoosh + freq sweep down */
export function playSlash(): void {
  const pitch = rng(0.9, 1.1);
  playNoiseBurst(0.1, 0.15, 3000 * pitch, 'highpass');
  playSine(800 * pitch, 0.08, 0.06, 300 * pitch);
}

/** Hit impact — mid noise thump + sine bass */
export function playHit(): void {
  playNoiseBurst(0.08, 0.25, 1500, 'bandpass');
  playSine(200, 0.1, 0.15, 80);
}

/** Enemy punch — low thud */
export function playPunch(): void {
  playNoiseBurst(0.1, 0.12, 800, 'lowpass');
  playSine(150, 0.1, 0.1, 60);
}

/** Player hurt — filtered noise + pitch drop */
export function playHurt(): void {
  playNoiseBurst(0.15, 0.2, 2000, 'bandpass');
  playSine(500, 0.15, 0.1, 150);
}

/** Entity death — long low sweep + noise fade */
export function playDeath(): void {
  playNoiseBurst(0.6, 0.15, 600, 'lowpass');
  playSine(200, 0.6, 0.12, 60);
}

/** Boss telegraph — rising sine sweep, ominous */
export function playBossTelegraph(): void {
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master) return;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.8);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.8);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.85);
}

/** Boss slam — heavy sub-bass hit + noise burst */
export function playBossSlam(): void {
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master) return;

  // Sub-bass thump
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.3);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);

  // Noise burst
  playNoiseBurst(0.2, 0.3, 500, 'lowpass');

  // High crack
  playNoiseBurst(0.05, 0.2, 4000, 'highpass');
}

/** UI confirm — two ascending pips */
export function playUiConfirm(): void {
  playSine(600, 0.08, 0.1);

  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master) return;

  // Second pip, slightly delayed and higher
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 900;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.setValueAtTime(0.1, ctx.currentTime + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(master);
  osc.start(ctx.currentTime + 0.08);
  osc.stop(ctx.currentTime + 0.15);
}
