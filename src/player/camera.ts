import * as THREE from 'three';
import RAPIER, { type Collider, type World } from '@dimforge/rapier3d-compat';
import { clamp, damp } from '../world/noise';
import { groundHeight } from '../world/terrain';

const SENSITIVITY = 0.0025;
const LOOK_HEIGHT = 1.5;

/** Third-person orbit camera that trails the player, GTA-style. */
export class OrbitCamera {
  yaw = 0;
  pitch = 0.22;
  distance = 6;
  private zoom = 6;
  /** Distance allowed by obstacles; snaps in, eases back out. */
  private clear = 6;
  /** Random jitter in metres (cold-dip shiver). */
  shake = 0;
  private idle = 0;
  private target = new THREE.Vector3();
  private initialised = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  look(dx: number, dy: number, wheel: number): void {
    if (dx || dy) this.idle = 0;
    this.yaw -= dx * SENSITIVITY;
    this.pitch = clamp(this.pitch + dy * SENSITIVITY, -0.3, 1.2);
    this.zoom = clamp(this.zoom + wheel * 0.8, 2.5, 14);
  }

  setZoom(z: number): void {
    this.zoom = z;
  }

  /** GTA-style: when the mouse is idle, swing round behind a moving vehicle. */
  follow(dt: number, heading: number, active: boolean): void {
    this.idle += dt;
    if (!active || this.idle < 1) return;
    const want = heading + Math.PI;
    const delta = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
    this.yaw += delta * damp(2.5, dt);
    this.pitch += (0.22 - this.pitch) * damp(1.5, dt);
  }

  /** Ease up to a high angle so the player is seen from above (cold dip). */
  lookDown(dt: number): void {
    this.pitch += (Math.max(this.pitch, 0.95) - this.pitch) * damp(3, dt);
  }

  update(dt: number, focus: THREE.Vector3, world: World, include: (c: Collider) => boolean): void {
    const goal = focus.clone().setY(focus.y + LOOK_HEIGHT);
    if (!this.initialised) {
      this.target.copy(goal);
      this.initialised = true;
    }
    this.target.lerp(goal, damp(10, dt));
    this.distance += (this.zoom - this.distance) * damp(8, dt);

    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const hit = world.castRay(new RAPIER.Ray(this.target, dir), this.distance, true, undefined, undefined, undefined, undefined, include);
    const allowed = hit ? Math.max(0.3, hit.timeOfImpact - 0.25) : this.distance;
    this.clear = allowed < this.clear ? allowed : this.clear + (allowed - this.clear) * damp(4, dt);
    const pos = dir.multiplyScalar(Math.min(this.distance, this.clear)).add(this.target);
    if (this.shake > 0) pos.add(new THREE.Vector3().randomDirection().multiplyScalar(this.shake));
    pos.y = Math.max(pos.y, groundHeight(pos.x, pos.z) + 0.4);

    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }
}
