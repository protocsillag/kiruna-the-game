import * as THREE from 'three';
import RAPIER, {
  type Collider,
  type KinematicCharacterController,
  type RigidBody,
  type World,
} from '@dimforge/rapier3d-compat';
import { damp } from '../world/noise';
import { groundHeight, isOnIce, snowDepth, WORLD_SIZE } from '../world/terrain';
import { createCharacter, type Character } from './character';
import type { Input } from './input';

const HALF_HEIGHT = 0.55;
const RADIUS = 0.3;
const SKIN = 0.02;
const FEET = HALF_HEIGHT + RADIUS + SKIN; // body centre → feet
const WALK = 2.2;
const JOG = 4.6;
const GRAVITY = 18;
const BOUND = WORLD_SIZE / 2 - 30;

export class Player {
  readonly character: Character;
  /** Feet position, updated after each physics step. */
  readonly position = new THREE.Vector3();
  heading = Math.PI;
  speed = 0;
  jogging = false;
  onIce = false;

  private body: RigidBody;
  private collider: Collider;
  private controller: KinematicCharacterController;
  private velocity = new THREE.Vector3();
  private velY = 0;
  private spawn: THREE.Vector3;

  constructor(world: World, scene: THREE.Scene, x: number, z: number) {
    this.spawn = new THREE.Vector3(x, groundHeight(x, z) + FEET + 0.1, z);
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.spawn.x, this.spawn.y, this.spawn.z),
    );
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), this.body);

    this.controller = world.createCharacterController(SKIN);
    this.controller.enableAutostep(0.3, 0.2, false);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((60 * Math.PI) / 180);

    this.character = createCharacter();
    scene.add(this.character.root);
    this.sync(0);
  }

  /** Computes this frame's movement; call before world.step(). */
  update(dt: number, input: Input, cameraYaw: number): void {
    const fwd = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const side = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    this.jogging = input.down('ShiftLeft') || input.down('ShiftRight');

    const p = this.position;
    this.onIce = isOnIce(p.x, p.z);
    const deep = snowDepth(p.x, p.z);

    // Camera-relative direction: forward is away from the camera.
    const dir = new THREE.Vector3(
      -Math.sin(cameraYaw) * fwd + Math.cos(cameraYaw) * side,
      0,
      -Math.cos(cameraYaw) * fwd - Math.sin(cameraYaw) * side,
    );
    const moving = dir.lengthSq() > 0;
    if (moving) dir.normalize();

    const topSpeed = (this.jogging ? JOG : WALK) * (1 - deep * 0.4);
    const targetVel = dir.multiplyScalar(moving ? topSpeed : 0);
    // Ice is a little slippery: slower to start and stop.
    this.velocity.lerp(targetVel, damp(this.onIce ? 2.5 : 9, dt));
    this.speed = this.velocity.length();

    if (moving) {
      const want = Math.atan2(targetVel.x, targetVel.z);
      const delta = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
      this.heading += delta * damp(10, dt);
    }

    const grounded = this.controller.computedGrounded();
    this.velY = grounded ? -2 : this.velY - GRAVITY * dt;

    this.controller.computeColliderMovement(this.collider, {
      x: this.velocity.x * dt,
      y: this.velY * dt,
      z: this.velocity.z * dt,
    });
    const m = this.controller.computedMovement();
    const t = this.body.translation();
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
    next.x = THREE.MathUtils.clamp(next.x, -BOUND, BOUND);
    next.z = THREE.MathUtils.clamp(next.z, -BOUND, BOUND);
    if (next.y < -20) Object.assign(next, { x: this.spawn.x, y: this.spawn.y, z: this.spawn.z });
    this.body.setNextKinematicTranslation(next);
  }

  /** Copies the physics result to the visible character; call after world.step(). */
  sync(dt: number): void {
    const t = this.body.translation();
    this.position.set(t.x, t.y - FEET, t.z);
    const root = this.character.root;
    root.position.copy(this.position);
    root.rotation.y = this.heading;
    this.character.animate(dt, this.speed);
    root.updateMatrixWorld(true);
  }
}
