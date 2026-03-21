/**
 * Audio engine — singleton managing Web Audio API context.
 * Lazy-inits on first user gesture to comply with browser autoplay policy.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientSource: AudioBufferSourceNode | null = null;
let ambientGain: GainNode | null = null;

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

/** Stop all active sounds and ambient. */
export function stopAll(): void {
  stopAmbient();
}
