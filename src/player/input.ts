/** Keyboard + mouse state. Mouse look uses pointer lock, with click-drag as a fallback. */
export class Input {
  private keys = new Set<string>();
  private dx = 0;
  private dy = 0;
  private wheel = 0;
  locked = false;

  constructor(private canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked || e.buttons & 1) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      }
    });
    addEventListener('wheel', (e) => (this.wheel += Math.sign(e.deltaY)), { passive: true });
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  requestLock(): void {
    const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch(() => {});
  }

  /** Returns and resets mouse movement accumulated since the last call. */
  consumeMouse(): { dx: number; dy: number; wheel: number } {
    const out = { dx: this.dx, dy: this.dy, wheel: this.wheel };
    this.dx = this.dy = this.wheel = 0;
    return out;
  }
}
