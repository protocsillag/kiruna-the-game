import * as THREE from 'three';
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
  private target = new THREE.Vector3();
  private initialised = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  look(dx: number, dy: number, wheel: number): void {
    this.yaw -= dx * SENSITIVITY;
    this.pitch = clamp(this.pitch + dy * SENSITIVITY, -0.3, 1.2);
    this.zoom = clamp(this.zoom + wheel * 0.8, 2.5, 14);
  }

  update(dt: number, focus: THREE.Vector3): void {
    const goal = focus.clone().setY(focus.y + LOOK_HEIGHT);
    if (!this.initialised) {
      this.target.copy(goal);
      this.initialised = true;
    }
    this.target.lerp(goal, damp(10, dt));
    this.distance += (this.zoom - this.distance) * damp(8, dt);

    const cp = Math.cos(this.pitch);
    const pos = new THREE.Vector3(
      Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cp,
    ).multiplyScalar(this.distance).add(this.target);
    pos.y = Math.max(pos.y, groundHeight(pos.x, pos.z) + 0.4);

    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }
}
