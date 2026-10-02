/**
 * Keyboard + mouse state, plus virtual input from the touch controls (ui/touch.ts).
 * Mouse look uses pointer lock, with click-drag as a fallback.
 */
export class Input {
  private keys = new Set<string>();
  /** Virtual keys held down by touch buttons (e.g. Jog). */
  private held = new Set<string>();
  private presses = new Set<string>();
  private stick = { x: 0, y: 0 };
  private dx = 0;
  private dy = 0;
  private wheel = 0;
  locked = false;

  constructor(private canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (!e.repeat) this.presses.add(e.code);
    });
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
    return this.keys.has(code) || this.held.has(code);
  }

  /** True once per physical key press (or touch tap). */
  pressed(code: string): boolean {
    return this.presses.delete(code);
  }

  /**
   * Movement from WASD and/or the touch stick: `fwd` +1 = forward (W), `side` +1 = right (D).
   * Keys give full deflection; the stick is analog. Length is at most 1.
   */
  move(): { fwd: number; side: number } {
    let fwd = (this.down('KeyW') ? 1 : 0) - (this.down('KeyS') ? 1 : 0) + this.stick.y;
    let side = (this.down('KeyD') ? 1 : 0) - (this.down('KeyA') ? 1 : 0) + this.stick.x;
    const len = Math.hypot(fwd, side);
    if (len > 1) {
      fwd /= len;
      side /= len;
    }
    return { fwd, side };
  }

  // --- hooks for the touch controls ---
  setStick(x: number, y: number): void {
    this.stick.x = x;
    this.stick.y = y;
  }

  setHeld(code: string, on: boolean): void {
    if (on) this.held.add(code);
    else this.held.delete(code);
  }

  tap(code: string): void {
    this.presses.add(code);
  }

  look(dx: number, dy: number): void {
    this.dx += dx;
    this.dy += dy;
  }

  zoom(steps: number): void {
    this.wheel += steps;
  }

  /** Forget presses nothing asked about this frame (so a stray E can't fire later). */
  endFrame(): void {
    this.presses.clear();
  }

  requestLock(): void {
    if (!this.canvas.requestPointerLock) return; // e.g. iPhone Safari has no pointer lock
    const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch(() => {});
  }

  /** Returns and resets mouse/touch look movement accumulated since the last call. */
  consumeMouse(): { dx: number; dy: number; wheel: number } {
    const out = { dx: this.dx, dy: this.dy, wheel: this.wheel };
    this.dx = this.dy = this.wheel = 0;
    return out;
  }
}
