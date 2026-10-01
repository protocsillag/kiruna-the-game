import { damp } from '../world/noise';
import { audio } from './context';

/**
 * Ambient wind synthesised with Web Audio (no sound files): a low rumble plus a faint
 * whistle, both swelling with random gusts. `gust` (0..1) also drives the snowfall drift.
 */
export class Wind {
  gust = 0.3;
  private target = 0.3;
  private timer = 0;
  private ctx?: AudioContext;
  private rumble?: GainNode;
  private whistle?: GainNode;
  private whistleFilter?: BiquadFilterNode;

  /** Must be called from a user gesture (browsers block audio before one). */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = audio();
    void ctx.resume();
    this.ctx = ctx;

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown-ish noise
      data[i] = last * 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 380;
    this.rumble = ctx.createGain();
    source.connect(low).connect(this.rumble).connect(master);

    this.whistleFilter = ctx.createBiquadFilter();
    this.whistleFilter.type = 'bandpass';
    this.whistleFilter.frequency.value = 700;
    this.whistleFilter.Q.value = 5;
    this.whistle = ctx.createGain();
    source.connect(this.whistleFilter).connect(this.whistle).connect(master);

    this.applyGust(0.1);
    source.start();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 2 + Math.random() * 5;
      this.target = 0.1 + Math.random() * 0.9;
      this.applyGust(1.5);
    }
    this.gust += (this.target - this.gust) * damp(0.6, dt);
  }

  private applyGust(timeConstant: number): void {
    if (!this.ctx || !this.rumble || !this.whistle || !this.whistleFilter) return;
    const now = this.ctx.currentTime;
    const g = this.target;
    this.rumble.gain.setTargetAtTime(0.25 + g * 0.55, now, timeConstant);
    this.whistle.gain.setTargetAtTime(0.02 + g * g * 0.1, now, timeConstant);
    this.whistleFilter.frequency.setTargetAtTime(550 + g * 700, now, timeConstant);
  }
}
