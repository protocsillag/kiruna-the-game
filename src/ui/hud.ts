import type { DayClock } from '../sky/clock';

/** Small clock in the corner; shows when time is paused. Story mode adds the objective line. */
export class Hud {
  private el = document.createElement('div');
  private objectiveEl = document.createElement('div');
  private chapterEl = document.createElement('div');
  private text = '';
  private objectiveText = '';
  private flashText = '';
  private flashUntil = 0;
  private chapterTimer = 0;

  constructor() {
    this.el.id = 'hud';
    this.objectiveEl.id = 'objective';
    this.chapterEl.id = 'chapter';
    document.body.append(this.el, this.objectiveEl, this.chapterEl);
  }

  /** Briefly show a message under the clock. */
  flash(text: string): void {
    this.flashText = text;
    this.flashUntil = performance.now() + 2000;
  }

  /** The one sentence at the top of the screen (null hides it). */
  objective(text: string | null): void {
    const t = text ?? '';
    if (t === this.objectiveText) return;
    this.objectiveText = t;
    this.objectiveEl.textContent = t;
    this.objectiveEl.classList.toggle('visible', !!text);
  }

  /** "Chapter 1 · The Ice Hostel" across the middle of the screen for a few seconds. */
  chapter(n: number, title: string): void {
    this.chapterEl.innerHTML = '';
    const small = document.createElement('small');
    small.textContent = `Chapter ${n}`;
    this.chapterEl.append(small, document.createTextNode(title));
    this.chapterEl.classList.add('visible');
    clearTimeout(this.chapterTimer);
    this.chapterTimer = window.setTimeout(() => this.chapterEl.classList.remove('visible'), 4500);
  }

  update(clock: DayClock): void {
    let text = clock.label() + (clock.paused ? '  ·  time paused (P)' : '');
    if (performance.now() < this.flashUntil) text += '\n' + this.flashText;
    if (text === this.text) return;
    this.text = text;
    this.el.textContent = text;
  }
}
