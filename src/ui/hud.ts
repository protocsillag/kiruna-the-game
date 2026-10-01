import type { DayClock } from '../sky/clock';

/** Small clock in the corner; shows when time is paused. */
export class Hud {
  private el = document.createElement('div');
  private text = '';

  constructor() {
    this.el.id = 'hud';
    document.body.appendChild(this.el);
  }

  update(clock: DayClock): void {
    const text = clock.label() + (clock.paused ? '  ·  time paused (P)' : '');
    if (text === this.text) return;
    this.text = text;
    this.el.textContent = text;
  }
}
