import * as THREE from 'three';
import RAPIER, {
  type Collider,
  type KinematicCharacterController,
  type RigidBody,
  type World,
} from '@dimforge/rapier3d-compat';
import { damp } from '../world/noise';
import { groundHeight, isOnIce, snowDepth, WORLD_SIZE } from '../world/terrain';
import { createCharacter, type Character, type Pose } from './character';
import type { Input } from './input';

const HALF_HEIGHT = 0.55;
const RADIUS = 0.3;
const SKIN = 0.02;
const FEET = HALF_HEIGHT + RADIUS + SKIN; // body centre → feet
const WALK = 4.6; // m/s (was the old jog speed)
const JOG = 6.5;
const GRAVITY = 18;
const BOUND = WORLD_SIZE / 2 - 30;

export class Player {
  readonly character: Character;
  /** Feet position, updated after each physics step. */
  readonly position = new THREE.Vector3();
  heading = Math.PI;
  /** Set while an activity controls the player (sitting, cold dip). */
  locked: { root: THREE.Vector3; pose: Pose; focusY?: number } | null = null;
  speed = 0;
  jogging = false;
  onIce = false;

  private body: RigidBody;
  readonly collider: Collider;
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

  /** Hands control to an activity: holds the character at `root` (feet) facing `heading`. */
  lock(root: THREE.Vector3, heading: number, pose: Pose, focusY?: number): void {
    this.locked = { root: root.clone(), pose, focusY };
    this.heading = heading;
    this.velocity.set(0, 0, 0);
    this.speed = 0;
  }

  /** What the camera should follow: the feet, unless an activity pins the height (cold dip). */
  get cameraFocus(): THREE.Vector3 {
    const f = this.locked?.focusY;
    return f === undefined ? this.position : this.position.clone().setY(f);
  }

  /** Returns control, standing the player at `feet`. */
  unlock(feet: THREE.Vector3): void {
    this.locked = null;
    const t = { x: feet.x, y: feet.y + FEET + 0.05, z: feet.z };
    this.body.setTranslation(t, true);
    this.body.setNextKinematicTranslation(t);
    this.velY = 0;
  }

  /** Computes this frame's movement; call before world.step(). */
  update(dt: number, input: Pick<Input, 'move' | 'down'>, cameraYaw: number): void {
    if (this.locked) {
      const r = this.locked.root;
      this.body.setNextKinematicTranslation({ x: r.x, y: r.y + FEET, z: r.z });
      return;
    }
    const { fwd, side } = input.move(); // analog on touch, ±1 on keys
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
    const moving = dir.lengthSq() > 0.0004; // length ≤ 1: a half-pushed stick walks slower

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
    // No push-down while grounded: pressing into the ground every frame made Rapier's controller
    // intermittently return zero horizontal movement (stalls, sinking into the ice). Snap-to-ground
    // already keeps contact.
    this.velY = grounded ? 0 : this.velY - GRAVITY * dt;

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
    if (this.locked) this.position.copy(this.locked.root);
    else {
      const t = this.body.translation();
      this.position.set(t.x, t.y - FEET, t.z);
    }
    const root = this.character.root;
    root.position.copy(this.position);
    root.rotation.y = this.heading;
    this.character.animate(dt, this.speed, this.locked?.pose ?? 'stand');
    root.updateMatrixWorld(true);
  }
}
