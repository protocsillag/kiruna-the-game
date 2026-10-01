import type { DayClock } from '../sky/clock';

/** Small clock in the corner; shows when time is paused. */
export class Hud {
  private el = document.createElement('div');
  private text = '';
  private flashText = '';
  private flashUntil = 0;

  constructor() {
    this.el.id = 'hud';
    document.body.appendChild(this.el);
  }

  /** Briefly show a message under the clock. */
  flash(text: string): void {
    this.flashText = text;
    this.flashUntil = performance.now() + 2000;
  }

  update(clock: DayClock): void {
    let text = clock.label() + (clock.paused ? '  ·  time paused (P)' : '');
    if (performance.now() < this.flashUntil) text += '\n' + this.flashText;
    if (text === this.text) return;
    this.text = text;
    this.el.textContent = text;
  }
}
