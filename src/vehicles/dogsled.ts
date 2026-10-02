import * as THREE from 'three';
import RAPIER, {
  type Collider,
  type KinematicCharacterController,
  type RigidBody,
  type World,
} from '@dimforge/rapier3d-compat';
import { groundHeight, isOnIce, snowDepth } from '../world/terrain';
import { Smoke } from '../world/smoke';
import { Runners } from '../audio/runners';
import { createHusky, type Husky } from './husky';
import { createDogSledModel } from './sledmodel';
import type { Input } from '../player/input';
import type { Player } from '../player/player';
import type { Interaction } from '../activities/interaction';

/** Distances (m) back along the team's trail, measured from the lead pair. */
const PAIR_AT = [0, 1.7, 3.4];
const SLED_FRONT = 4.8;
const SLED_LEN = 2.3;
const RIDER_AT = SLED_FRONT + SLED_LEN - 0.2;
const TRAIL = RIDER_AT + 2;
const CRUISE = 6.5; // m/s ≈ 23 km/h
const PULL = 1.6; // how quickly the dogs pick up speed
const BRAKE = 7;
const HALT = 5; // nobody on the runners: the team stops
const LEAD_R = 0.5;
const SKIN = 0.02;
const GRAVITY = 18;
const NAMES = ['Loki', 'Sisu', 'Aurora', 'Nanook', 'Kira', 'Balto'];
const POOP_POOL = 30;

const poopMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.6 });

/**
 * Six huskies in three pairs pulling a basket sled. Only the lead pair has a physics body: it
 * steers and collides; the other pairs, the sled and the musher follow its trail, so the team
 * bends naturally through turns. The dogs run on their own while someone is on the runners.
 */
export class DogSled {
  riding = false;
  speed = 0;
  /** Heading of the sled itself (for the camera). */
  heading: number;
  readonly cameraIgnore: number[];

  private leadHeading: number;
  private lead: RigidBody;
  private leadCol: Collider;
  private controller: KinematicCharacterController;
  private sledBody: RigidBody;
  private trail: THREE.Vector3[] = []; // oldest first
  private dogs: { dog: Husky; squat: number }[] = [];
  private sled = createDogSledModel();
  private lines: THREE.LineSegments;
  private poops: THREE.Group[] = [];
  private nextPoop = 0;
  private poopIn = 35 + Math.random() * 20;
  private steam: Smoke;
  private runners = new Runners();
  private message = '';
  private messageUntil = 0;
  private time = 0;
  private velY = 0;
  private filter: (c: Collider) => boolean;

  constructor(scene: THREE.Scene, world: World, private player: Player, x: number, z: number, heading: number) {
    this.leadHeading = this.heading = heading;
    const f = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    for (let d = TRAIL + 1; d > 0; d -= 0.25) {
      const p = new THREE.Vector3(x - f.x * d, 0, z - f.z * d);
      this.trail.push(p.setY(groundHeight(p.x, p.z)));
    }

    this.lead = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, groundHeight(x, z) + LEAD_R + SKIN + 0.05, z),
    );
    const lying = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    this.leadCol = world.createCollider(RAPIER.ColliderDesc.capsule(0.45, LEAD_R).setRotation(lying), this.lead);
    this.controller = world.createCharacterController(SKIN);
    this.controller.enableAutostep(0.3, 0.3, false);
    this.controller.enableSnapToGround(0.6);
    this.controller.setMaxSlopeClimbAngle((40 * Math.PI) / 180);
    this.sledBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    const sledCol = world.createCollider(RAPIER.ColliderDesc.cuboid(0.4, 0.3, SLED_LEN / 2), this.sledBody);
    const skip = new Set([player.collider.handle, sledCol.handle]);
    this.filter = (c) => !skip.has(c.handle);
    this.cameraIgnore = [this.leadCol.handle, sledCol.handle];

    for (let i = 0; i < 6; i++) {
      const dog = createHusky(i);
      scene.add(dog.root);
      this.dogs.push({ dog, squat: 0 });
    }
    scene.add(this.sled);

    // Gangline (sled → wheel dogs → lead dogs) plus a tug line to each dog's harness.
    const segs = 4 + 6;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 2 * 3), 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1c1c22 }));
    this.lines.frustumCulled = false;
    scene.add(this.lines);

    const lump = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < POOP_POOL; i++) {
      const g = new THREE.Group();
      for (const [px, py, pz, s] of [[0, 0.03, 0, 0.055], [0.05, 0.025, 0.03, 0.04], [-0.03, 0.06, 0.01, 0.035]]) {
        const m = new THREE.Mesh(lump, poopMat);
        m.position.set(px, py, pz);
        m.scale.setScalar(s);
        g.add(m);
      }
      g.visible = false;
      scene.add(g);
      this.poops.push(g);
    }
    this.steam = new Smoke(scene, new THREE.Vector3(), { count: 10, life: 2.5, rise: 0.25, spread: 0.1, size: [0.08, 0.5], opacity: 0.35 });
    this.sync(0);
  }

  status(p: THREE.Vector3): string | null {
    const near = Math.hypot(p.x - this.sled.position.x, p.z - this.sled.position.z) < 40;
    if (this.time < this.messageUntil && near) return this.message;
    return this.riding ? `Dog sled  ${Math.round(this.speed * 3.6)} km/h` : null;
  }

  interaction(p: THREE.Vector3): Interaction | null {
    if (this.riding) return { label: 'get off the sled', run: () => this.dismount() };
    if (this.player.locked) return null;
    if (Math.hypot(p.x - this.sled.position.x, p.z - this.sled.position.z) > 2.4) return null;
    return { label: 'drive the dog sled', run: () => (this.riding = true) };
  }

  /** Before world.step(): the dogs pull (if someone is aboard), the musher brakes and steers. */
  drive(dt: number, input: Input): void {
    const t = this.lead.translation();
    let target = 0;
    let rate = HALT;
    let steer = 0;
    if (this.riding) {
      const m = input.move();
      const brake = Math.max(0, -m.fwd); // S / stick down. There is no throttle: the dogs decide.
      steer = -m.side;
      if (brake > 0.2) rate = BRAKE * brake;
      else {
        target = CRUISE * (1 - snowDepth(t.x, t.z) * 0.3) * (isOnIce(t.x, t.z) ? 1.05 : 1);
        rate = PULL;
      }
    }
    this.speed += THREE.MathUtils.clamp(target - this.speed, -rate * dt, rate * dt);
    this.leadHeading += steer * 0.95 * Math.min(this.speed / 2, 1) * dt;

    const f = new THREE.Vector3(Math.sin(this.leadHeading), 0, Math.cos(this.leadHeading));
    // No push-down while grounded: pressing into the ground every frame made Rapier's controller
    // intermittently return zero horizontal movement (stalls, sinking into the ice). Snap-to-ground
    // already keeps contact.
    this.velY = this.controller.computedGrounded() ? 0 : this.velY - GRAVITY * dt;
    const want = { x: f.x * this.speed * dt, y: this.velY * dt, z: f.z * this.speed * dt };
    this.controller.computeColliderMovement(this.leadCol, want, undefined, undefined, this.filter);
    const m = this.controller.computedMovement();
    const wantF = want.x * f.x + want.z * f.z;
    if (wantF > 0.01 && (m.x * f.x + m.z * f.z) / wantF < 0.3) this.speed *= 0.3; // dogs won't run into a wall
    this.lead.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.leadHeading);
    this.lead.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }

  /** After world.step(): lay the team, sled and musher along the trail; effects and sound. */
  sync(dt: number, tint?: THREE.Color): void {
    this.time += dt;
    const t = this.lead.translation();
    const head = new THREE.Vector3(t.x, groundHeight(t.x, t.z), t.z);
    if (head.distanceTo(this.trail[this.trail.length - 1]) > 0.15) this.trail.push(head.clone());
    while (this.trail.length > 2 && this.trailLength(head) > TRAIL + 1) this.trail.shift();

    const lineAt: THREE.Vector3[] = [];
    const pos = this.lines.geometry.attributes.position as THREE.BufferAttribute;
    let seg = 0;
    const line = (a: THREE.Vector3, b: THREE.Vector3) => {
      pos.setXYZ(seg * 2, a.x, a.y, a.z);
      pos.setXYZ(seg * 2 + 1, b.x, b.y, b.z);
      seg++;
    };

    PAIR_AT.forEach((d, k) => {
      const c = this.sample(head, d);
      const f = c.clone().sub(this.sample(head, d + 0.6)).setY(0).normalize();
      const right = new THREE.Vector3(-f.z, 0, f.x);
      const yaw = Math.atan2(f.x, f.z);
      lineAt.push(c.clone().addScaledVector(f, -0.45).setY(c.y + 0.48));
      for (const s of [-1, 1]) {
        const i = k * 2 + (s > 0 ? 1 : 0);
        const entry = this.dogs[i];
        const dp = c.clone().addScaledVector(right, s * 0.42);
        dp.y = groundHeight(dp.x, dp.z);
        entry.dog.root.position.copy(dp);
        entry.dog.root.rotation.y = yaw;
        entry.squat = Math.max(0, entry.squat - dt);
        entry.dog.animate(dt, this.speed, entry.squat > 0 ? 'poop' : this.speed > 0.3 ? 'run' : 'idle');
        line(dp.clone().addScaledVector(f, 0.05).setY(dp.y + 0.5), lineAt[k]);
      }
    });

    // Sled between its front and back points on the trail, pitched to the ground.
    const front = this.sample(head, SLED_FRONT);
    const back = this.sample(head, SLED_FRONT + SLED_LEN);
    const centre = front.clone().add(back).multiplyScalar(0.5);
    centre.y = groundHeight(centre.x, centre.z);
    this.heading = Math.atan2(front.x - back.x, front.z - back.z);
    const pitch = Math.atan2(front.y - back.y, SLED_LEN);
    this.sled.position.copy(centre);
    this.sled.rotation.set(-pitch, this.heading, 0, 'YXZ');
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    this.sledBody.setNextKinematicTranslation({ x: centre.x, y: centre.y + 0.32, z: centre.z });
    this.sledBody.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

    const bow = front.clone().setY(front.y + 0.35);
    line(bow, lineAt[2]);
    line(lineAt[2], lineAt[1]);
    line(lineAt[1], lineAt[0]);
    const leadF = new THREE.Vector3(Math.sin(this.leadHeading), 0, Math.cos(this.leadHeading));
    line(lineAt[0], lineAt[0].clone().addScaledVector(leadF, 0.9));
    pos.needsUpdate = true;

    if (this.riding) {
      const r = this.sample(head, RIDER_AT);
      this.player.lock(new THREE.Vector3(r.x, groundHeight(r.x, r.z) + 0.07, r.z), this.heading, 'grip');
    }

    this.poopIn -= dt;
    if (this.poopIn <= 0) this.poop();
    if (tint) this.steam.tint.copy(tint).multiplyScalar(1.3);
    this.steam.update(dt);
    this.runners.update(dt, this.riding, this.speed);
  }

  /** About once a minute one of the dogs has to go — on the run, if the team is moving. */
  private poop(): void {
    this.poopIn = 50 + Math.random() * 25;
    const i = Math.floor(Math.random() * this.dogs.length);
    const d = this.dogs[i];
    d.squat = 1.6;
    const yaw = d.dog.root.rotation.y;
    const at = d.dog.root.position.clone().add(new THREE.Vector3(-Math.sin(yaw) * 0.42, 0, -Math.cos(yaw) * 0.42));
    at.y = groundHeight(at.x, at.z);
    const pile = this.poops[this.nextPoop];
    this.nextPoop = (this.nextPoop + 1) % POOP_POOL;
    pile.position.copy(at);
    pile.rotation.y = Math.random() * Math.PI * 2;
    pile.visible = true;
    this.steam.origin.copy(at).setY(at.y + 0.08);
    this.steam.burst(3); // it's −12 °C: fresh poop steams
    this.message = `${NAMES[i]} had to go 💩`;
    this.messageUntil = this.time + 4;
  }

  private dismount(): void {
    this.riding = false;
    const right = new THREE.Vector3(-Math.cos(this.heading), 0, Math.sin(this.heading));
    const side = this.sled.position.clone().addScaledVector(right, 1.2);
    side.y = groundHeight(side.x, side.z);
    this.player.unlock(side);
  }

  /** Point `d` metres back along the trail from the lead point. */
  private sample(head: THREE.Vector3, d: number): THREE.Vector3 {
    let prev = head;
    let left = d;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      const seg = prev.distanceTo(p);
      if (seg >= left && seg > 1e-6) return prev.clone().lerp(p, left / seg);
      left -= seg;
      prev = p;
    }
    return prev.clone();
  }

  private trailLength(head: THREE.Vector3): number {
    let sum = 0;
    let prev = head;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      sum += prev.distanceTo(this.trail[i]);
      prev = this.trail[i];
    }
    return sum;
  }
}
