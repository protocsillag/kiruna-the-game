import { audio } from './context';

/** Hiss of sled runners on snow: band-passed noise that swells with speed. */
export class Runners {
  private gain?: GainNode;
  private timer = 0;

  update(dt: number, active: boolean, speed: number): void {
    if (!active && !this.gain) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.05;
    if (!this.gain) this.build();
    const level = active ? Math.min(speed / 7, 1) * 0.16 : 0;
    this.gain!.gain.setTargetAtTime(level, audio().currentTime, 0.15);
  }

  private build(): void {
    const ctx = audio();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1900;
    band.Q.value = 0.7;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    src.connect(band).connect(this.gain).connect(ctx.destination);
    src.start();
  }
}
