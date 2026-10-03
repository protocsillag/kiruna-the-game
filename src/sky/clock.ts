import * as THREE from 'three';

/** Real minutes per in-game day. */
const DAY_MINUTES = 24;
const DEG = Math.PI / 180;
/** Hours with the midday glow (sun above about −5°), skipped while `nightOnly`. */
const DAY_FROM = 9.1;
const DAY_TO = 14.9;

/**
 * In-game time of day. The sun follows Kiruna in mid-January (lat 67.85°, decl −21°):
 * it peaks around +1° at noon and sinks to about −43° at midnight.
 */
export class DayClock {
  paused = false;
  /** Story mode until the finale: only blue hour and night. */
  nightOnly = false;

  constructor(public hours: number) {}

  update(dt: number): void {
    if (this.paused) return;
    this.hours = (this.hours + (dt / 60) * (24 / DAY_MINUTES)) % 24;
    this.skipDay();
  }

  /** Jumps the clock forward (works while paused too). */
  advance(hours: number): void {
    this.hours = (this.hours + hours) % 24;
    this.skipDay();
  }

  private skipDay(): void {
    if (this.nightOnly && this.hours > DAY_FROM && this.hours < DAY_TO) this.hours = DAY_TO;
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
