import type { Input } from '../player/input';

/** A touchscreen with no mouse: phones and tablets. Desktop (even with a touchscreen) is excluded. */
export const isTouchDevice = () => matchMedia('(hover: none) and (pointer: coarse)').matches;

const STICK_R = 60; // px of thumb travel for full deflection
const DEAD = 0.12;
const LOOK_GAIN = 1.4;
const PINCH_STEP = 40; // px of pinch per zoom step

function el(tag: string, cls: string, parent: HTMLElement, text = ''): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  parent.append(e);
  return e;
}

/**
 * On-screen controls for phones: a floating joystick under the left thumb, drag-to-look and
 * pinch-to-zoom on the right, and a few buttons. Only created on touch devices.
 */
export class TouchControls {
  private layer = el('div', 'touch-layer', document.body);
  private base = el('div', 'stick-base idle', this.layer);
  private knob = el('div', 'stick-knob', this.base);
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private looks = new Map<number, { x: number; y: number }>();
  private pinch = 0;

  constructor(private input: Input, onPause: () => void) {
    const bar = el('div', 'touch-bar', document.body);
    this.button(bar, '❚❚', 'pause the game', onPause);
    this.button(bar, '◷', 'pause time', () => input.tap('KeyP'));
    this.button(bar, '+1h', 'forward time', () => input.tap('KeyF'));
    this.button(bar, 'HQ', 'quality', () => input.tap('KeyQ'));
    let jogging = false;
    const jog = this.button(document.body, 'Jog', 'jog', () => {
      jogging = !jogging;
      input.setHeld('ShiftLeft', jogging);
      jog.classList.toggle('on', jogging);
    });
    jog.classList.add('touch-jog');

    this.layer.addEventListener('pointerdown', (e) => this.down(e));
    this.layer.addEventListener('pointermove', (e) => this.move(e));
    this.layer.addEventListener('pointerup', (e) => this.up(e));
    this.layer.addEventListener('pointercancel', (e) => this.up(e));
  }

  private button(parent: HTMLElement, text: string, title: string, onTap: () => void): HTMLElement {
    const b = el('button', 'touch-btn', parent, text);
    b.setAttribute('aria-label', title);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onTap();
    });
    return b;
  }

  private down(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    this.layer.setPointerCapture(e.pointerId);
    if (this.stickId === null && e.clientX < innerWidth * 0.45) {
      // Joystick appears wherever the left thumb lands.
      this.stickId = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      this.base.classList.remove('idle');
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      return;
    }
    this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.looks.size === 2) this.pinch = this.spread();
  }

  private move(e: PointerEvent): void {
    if (e.pointerId === this.stickId) {
      let dx = e.clientX - this.origin.x;
      let dy = e.clientY - this.origin.y;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) {
        dx *= STICK_R / len;
        dy *= STICK_R / len;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const mag = Math.min(len / STICK_R, 1);
      const scale = mag < DEAD ? 0 : (mag - DEAD) / (1 - DEAD) / (mag || 1);
      this.input.setStick((dx / STICK_R) * scale, (-dy / STICK_R) * scale);
      return;
    }
    const prev = this.looks.get(e.pointerId);
    if (!prev) return;
    if (this.looks.size === 1) {
      this.input.look((e.clientX - prev.x) * LOOK_GAIN, (e.clientY - prev.y) * LOOK_GAIN);
    }
    prev.x = e.clientX;
    prev.y = e.clientY;
    if (this.looks.size === 2) {
      const d = this.spread();
      this.input.zoom((this.pinch - d) / PINCH_STEP); // spread fingers → zoom in
      this.pinch = d;
    }
  }

  private up(e: PointerEvent): void {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.input.setStick(0, 0);
      this.knob.style.transform = '';
      this.base.classList.add('idle');
      this.base.style.left = '';
      this.base.style.top = '';
      return;
    }
    this.looks.delete(e.pointerId);
    if (this.looks.size === 2) this.pinch = this.spread();
  }

  private spread(): number {
    const [a, b] = [...this.looks.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
