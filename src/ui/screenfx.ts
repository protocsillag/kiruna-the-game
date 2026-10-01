import { damp } from '../world/noise';

const SHIVER_SECONDS = 7;

/** Full-screen warm glow (hot sauna) and frosty shiver (after a cold dip). */
export class ScreenFX {
  private warmEl = document.createElement('div');
  private coldEl = document.createElement('div');
  private warm = 0;
  private shiver = 0;

  constructor() {
    this.warmEl.className = 'fx fx-warm';
    this.coldEl.className = 'fx fx-cold';
    document.body.append(this.warmEl, this.coldEl);
  }

  triggerShiver(): void {
    this.shiver = 1;
  }

  /** Camera jitter in metres, strongest right after the dip. */
  get shake(): number {
    return this.shiver * this.shiver * 0.05;
  }

  get shivering(): boolean {
    return this.shiver > 0.05;
  }

  update(dt: number, warmTarget: number): void {
    this.shiver = Math.max(0, this.shiver - dt / SHIVER_SECONDS);
    this.warm += (warmTarget * (1 - this.shiver) - this.warm) * damp(1.5, dt);
    this.warmEl.style.opacity = this.warm.toFixed(3);
    this.coldEl.style.opacity = Math.min(1, this.shiver * 1.3).toFixed(3);
  }
}
