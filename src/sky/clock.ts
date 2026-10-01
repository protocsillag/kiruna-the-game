import * as THREE from 'three';

/** Real minutes per in-game day. */
const DAY_MINUTES = 24;
const DEG = Math.PI / 180;

/**
 * In-game time of day. The sun follows Kiruna in mid-January (lat 67.85°, decl −21°):
 * it peaks around +1° at noon and sinks to about −43° at midnight.
 */
export class DayClock {
  paused = false;

  constructor(public hours: number) {}

  update(dt: number): void {
    if (this.paused) return;
    this.hours = (this.hours + (dt / 60) * (24 / DAY_MINUTES)) % 24;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  /** Sun elevation in degrees. */
  sunElevation(): number {
    return -21 + 22.15 * Math.cos(((this.hours - 12) * Math.PI) / 12);
  }

  /** Unit vector toward the sun. South is −Z (over the lake), east is −X. */
  sunDirection(out: THREE.Vector3): THREE.Vector3 {
    const az = (this.hours - 12) * 15 * DEG;
    const el = this.sunElevation() * DEG;
    return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  }

  /** Moonlight direction: roughly opposite the sun, fairly high. */
  moonDirection(out: THREE.Vector3): THREE.Vector3 {
    const az = (this.hours - 12) * 15 * DEG + Math.PI;
    const el = 32 * DEG;
    return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  }

  label(): string {
    const h = Math.floor(this.hours);
    const m = Math.floor((this.hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
