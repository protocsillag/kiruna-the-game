import * as THREE from 'three';
import RAPIER, {
  type Collider,
  type KinematicCharacterController,
  type RigidBody,
  type World,
} from '@dimforge/rapier3d-compat';
import { damp } from '../world/noise';
import { groundHeight, isOnIce, snowDepth } from '../world/terrain';
import { Smoke } from '../world/smoke';
import { Engine } from '../audio/engine';
import { createSledModel, type SledModel } from './model';
import { Tracks } from './tracks';
import type { Input } from '../player/input';
import type { Player } from '../player/player';
import type { Interaction } from '../activities/interaction';

const RADIUS = 0.45;
const HALF = 0.8; // capsule half-length along the sled
const SKIN = 0.02;
const RIDE = RADIUS + SKIN; // body centre → ground
const ACCEL = 8;
const BRAKE = 14;
const MAX_SPEED = 22; // m/s ≈ 80 km/h on ice and packed snow
const GRAVITY = 18;

/** Arcade snowmobile: E to get on/off, WASD to drive, slides on the ice. */
export class Snowmobile {
  readonly collider: Collider;
  riding = false;
  /** Story mode: on its side by the lone spruce, out of use. */
  wrecked = false;
  /** 0→1 over the crash tumble (1 = lying still on its side). */
  private crashT = 1;
  heading: number;
  speed = 0;

  private model: SledModel;
  private body: RigidBody;
  private controller: KinematicCharacterController;
  private velocity = new THREE.Vector3();
  private velY = 0;
  private throttle = 0;
  private yawRate = 0;
  private tilt = new THREE.Quaternion();
  private tracks: Tracks;
  private spray: Smoke;
  private engine = new Engine();
  private ignore: (c: Collider) => boolean;

  constructor(scene: THREE.Scene, world: World, private player: Player, x: number, z: number, heading: number) {
    this.heading = heading;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, groundHeight(x, z) + RIDE + 0.05, z),
    );
    const lying = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS).setRotation(lying), this.body);
    this.controller = world.createCharacterController(SKIN);
    this.controller.enableAutostep(0.35, 0.3, false);
    this.controller.enableSnapToGround(0.6);
    this.controller.setMaxSlopeClimbAngle((42 * Math.PI) / 180);
    const playerHandle = player.collider.handle;
    this.ignore = (c) => c.handle !== playerHandle;

    this.model = createSledModel();
    scene.add(this.model.root);
    this.tracks = new Tracks(scene);
    this.spray = new Smoke(scene, new THREE.Vector3(), {
      count: 60, life: 1.1, rise: 0.6, spread: 0.4, size: [0.25, 1.2], opacity: 0.55,
    });
    this.body.setNextKinematicRotation(this.yaw());
    this.sync(0, 0);
  }

  get position(): THREE.Vector3 {
    return this.model.root.position;
  }

  status(): string | null {
    return this.riding ? `Snowmobile  ${Math.round(Math.abs(this.speed) * 3.6)} km/h` : null;
  }

  interaction(p: THREE.Vector3): Interaction | null {
    if (this.riding) return { label: 'get off', run: () => this.dismount() };
    if (this.player.locked) return null;
    if (Math.hypot(p.x - this.position.x, p.z - this.position.z) > 2.4) return null;
    return { label: 'ride the snowmobile', run: () => (this.riding = true) };
  }

  /** Before world.step(): read input and move the physics body. */
  drive(dt: number, input: Input): void {
    const t = this.body.translation();
    const onIce = isOnIce(t.x, t.z);
    const deep = snowDepth(t.x, t.z);

    this.throttle = 0;
    let steer = 0;
    if (this.riding) {
      const m = input.move(); // analog on touch, ±1 on keys
      this.throttle = m.fwd;
      steer = -m.side;
    }

    const top = MAX_SPEED * (1 - deep * 0.3);
    if (this.throttle > 0.05) this.speed += ACCEL * this.throttle * dt;
    else if (this.throttle < -0.05) this.speed -= (this.speed > 0.5 ? BRAKE : ACCEL * 0.4) * -this.throttle * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 2.5 * dt);
    this.speed -= this.speed * (0.05 + deep * 0.25) * dt; // drag, more in powder
    this.speed = THREE.MathUtils.clamp(this.speed, -5, top);

    const grip = Math.min(Math.abs(this.speed) / 5, 1);
    const turn = steer * 1.6 * grip * (1 - 0.35 * Math.min(Math.abs(this.speed) / 20, 1));
    this.yawRate = turn * Math.sign(this.speed || 1);
    this.heading += this.yawRate * dt;

    // Forward speed is set directly by the throttle (same pace on ice and snow). Sideways slip, left
    // over from turning, bleeds off slower on ice → a slight slide in turns on the lake.
    const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const slip = this.velocity.dot(right) * Math.exp(-(onIce ? 2.2 : 10) * dt);
    this.velocity.copy(fwd).multiplyScalar(this.speed).addScaledVector(right, slip);

    const grounded = this.controller.computedGrounded();
    // No push-down while grounded: pressing into the ground every frame made Rapier's controller
    // intermittently return zero horizontal movement (stalls, sinking into the ice). Snap-to-ground
    // already keeps contact.
    this.velY = grounded ? 0 : this.velY - GRAVITY * dt;
    const want = { x: this.velocity.x * dt, y: this.velY * dt, z: this.velocity.z * dt };
    this.controller.computeColliderMovement(this.collider, want, undefined, undefined, this.ignore);
    const m = this.controller.computedMovement();

    // Blocked head-on (not just scraping sideways): lose most of the speed.
    const wantF = want.x * fwd.x + want.z * fwd.z;
    const gotF = m.x * fwd.x + m.z * fwd.z;
    if (Math.abs(wantF) > 0.02 && gotF / wantF < 0.3) {
      this.speed *= 0.5;
      this.velocity.multiplyScalar(0.5);
    }
    this.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    this.body.setNextKinematicRotation(this.yaw());
  }

  /** After world.step(): place the model, seat the rider, effects and sound. */
  sync(dt: number, darkness: number, tint?: THREE.Color, gust = 0): void {
    const t = this.body.translation();
    const root = this.model.root;
    root.position.set(t.x, t.y - RIDE, t.z);
    root.rotation.y = this.heading;

    // Pitch/roll to the ground under the skis and track, plus a lean into turns.
    const f = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const h = (dx: number, dz: number) => groundHeight(t.x + dx, t.z + dz);
    const pitch = Math.atan2(h(f.x * 1.1, f.z * 1.1) - h(-f.x * 1.1, -f.z * 1.1), 2.2);
    const roll = Math.atan2(h(r.x * 0.5, r.z * 0.5) - h(-r.x * 0.5, -r.z * 0.5), 1.0);
    // Local right is −X: raising it (or leaning into a right turn, yawRate < 0) is +Z rotation.
    const lean = -this.yawRate * Math.min(Math.abs(this.speed) / 15, 1) * 0.12;
    const goal = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, 0, -roll + lean, 'YXZ'));
    this.tilt.slerp(goal, damp(10, dt || 1));
    this.model.body.quaternion.copy(this.tilt);
    if (this.wrecked) {
      // Tumble: a hop, nose up, then over onto its side.
      this.crashT = Math.min(1, this.crashT + dt / 0.8);
      const k = this.crashT;
      const hop = Math.sin(k * Math.PI);
      this.model.body.quaternion.setFromEuler(new THREE.Euler(0.12 * k - hop * 0.7, hop * 0.5, 1.15 * Math.min(1, k * 1.4)));
      root.position.y += hop * 0.9;
    }
    root.updateMatrixWorld(true);

    if (this.riding) {
      const seat = this.model.seat.getWorldPosition(new THREE.Vector3());
      this.player.lock(new THREE.Vector3(seat.x, seat.y + 0.12 - 0.9, seat.z), this.heading, 'sit');
    }

    const rear = new THREE.Vector3(t.x - f.x * 1.0, groundHeight(t.x - f.x, t.z - f.z), t.z - f.z * 1.0);
    if (Math.abs(this.speed) > 0.3) this.tracks.update(rear, this.heading, isOnIce(rear.x, rear.z));

    const fast = Math.max(0, Math.abs(this.speed) - 3);
    this.spray.rate = fast * (isOnIce(t.x, t.z) ? 0.6 : 2.2);
    this.spray.origin.copy(rear).setY(rear.y + 0.15);
    this.spray.push.copy(f).multiplyScalar(-this.speed * 0.25).setY(0.6);
    if (tint) this.spray.tint.copy(tint).multiplyScalar(1.4);
    this.spray.update(dt, gust * 0.8, gust * 0.3);

    const lit = this.riding ? THREE.MathUtils.lerp(8, 70, darkness) : 0;
    this.model.headlight.intensity = lit;
    this.model.lens.emissiveIntensity = this.riding ? 1.5 + darkness * 2 : 0.3;
    this.engine.update(dt, this.riding, this.throttle, this.speed);
  }

  /** Story mode's forced crash: stop dead, throw the rider off, lie on its side. */
  crash(): void {
    this.speed = 0;
    this.throttle = 0;
    this.velocity.set(0, 0, 0);
    if (this.riding) this.dismount();
    this.wrecked = true;
    this.crashT = 0;
    this.spray.origin.copy(this.position).setY(this.position.y + 0.4);
    this.spray.burst(40);
  }

  /** Move the parked sled (story mode puts the wreck back by the spruce after a reload). */
  placeAt(x: number, z: number, heading: number): void {
    this.heading = heading;
    const t = { x, y: groundHeight(x, z) + RIDE + 0.05, z };
    this.body.setTranslation(t, true);
    this.body.setNextKinematicTranslation(t);
    this.body.setNextKinematicRotation(this.yaw());
    // Move the model now too, so a dismount right after lands beside the new spot.
    this.model.root.position.set(x, t.y - RIDE, z);
    this.model.root.rotation.y = heading;
  }

  private dismount(): void {
    this.riding = false;
    const f = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const side = new THREE.Vector3(-f.z, 0, f.x).multiplyScalar(1.3).add(this.position);
    side.y = groundHeight(side.x, side.z);
    this.player.unlock(side);
  }

  private yaw(): { x: number; y: number; z: number; w: number } {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    return { x: q.x, y: q.y, z: q.z, w: q.w };
  }
}
