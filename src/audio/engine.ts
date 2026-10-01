import { audio } from './context';

const UPDATE_EVERY = 0.05; // seconds between audio parameter updates

/** Two-stroke snowmobile engine synthesised from detuned saw + square through soft clipping. */
export class Engine {
  private osc?: OscillatorNode;
  private sub?: OscillatorNode;
  private filter?: BiquadFilterNode;
  private gain?: GainNode;
  private timer = 0;

  update(dt: number, running: boolean, throttle: number, speed: number): void {
    if (!running && !this.gain) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = UPDATE_EVERY;
    if (!this.gain) this.build();

    const ctx = audio();
    const now = ctx.currentTime;
    const rpm = 0.25 + Math.max(0, throttle) * 0.3 + Math.min(Math.abs(speed) / 24, 1) * 0.55;
    const f = 32 + rpm * 72;
    this.osc!.frequency.setTargetAtTime(f, now, 0.08);
    this.sub!.frequency.setTargetAtTime(f * 0.502, now, 0.08);
    this.filter!.frequency.setTargetAtTime(280 + rpm * 1500, now, 0.1);
    const level = running ? 0.05 + Math.abs(throttle) * 0.07 + rpm * 0.05 : 0;
    this.gain!.gain.setTargetAtTime(level, now, running ? 0.1 : 0.5);
  }

  private build(): void {
    const ctx = audio();
    this.osc = ctx.createOscillator();
    this.osc.type = 'sawtooth';
    this.sub = ctx.createOscillator();
    this.sub.type = 'square';
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh(((i / 255) * 2 - 1) * 2.5);
    shaper.curve = curve;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 2;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    this.osc.connect(mix);
    this.sub.connect(mix);
    mix.connect(shaper).connect(this.filter).connect(this.gain).connect(ctx.destination);
    this.osc.start();
    this.sub.start();
  }
}
