import { audio } from './context';

/** A crunchy thud: a burst of filtered noise plus a low knock, synthesised (no sound file). */
export function playCrash(): void {
  const ctx = audio();
  const now = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.9);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, now);
  filter.frequency.exponentialRampToValueAtTime(300, now + 0.8);
  const ng = ctx.createGain();
  ng.gain.value = 0.9;
  noise.connect(filter).connect(ng).connect(ctx.destination);
  const knock = ctx.createOscillator();
  knock.frequency.setValueAtTime(110, now);
  knock.frequency.exponentialRampToValueAtTime(38, now + 0.35);
  const kg = ctx.createGain();
  kg.gain.setValueAtTime(0.8, now);
  kg.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  knock.connect(kg).connect(ctx.destination);
  noise.start(now);
  knock.start(now);
  knock.stop(now + 0.5);
}
