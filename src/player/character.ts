import * as THREE from 'three';
import { damp } from '../world/noise';

const mat = (color: number, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });

export type Pose = 'stand' | 'sit' | 'grip';

/** Appearance. Defaults are the player: red jacket, blue beanie, yellow scarf, backpack. */
export interface Look {
  jacket?: number;
  pants?: number;
  hat?: number | null; // null = no hat (shows hair, if any)
  scarf?: number;
  skin?: number;
  hair?: number; // hair colour; drawn when there's no hat, plus a bun for `bun: true`
  bun?: boolean;
  /** Sauna outfit: bare arms and legs, a towel wrapped around the body. */
  towel?: number;
  backpack?: boolean;
}

export interface Character {
  root: THREE.Group;
  head: THREE.Object3D;
  /** Hand objects: [right, left]. World positions via getWorldPosition. */
  hands: [THREE.Object3D, THREE.Object3D];
  /** Per-arm forward raise in radians, overriding the animation; null = animated. [right, left]. */
  armOverride: [number | null, number | null];
  /** Head turn (radians, + = toward the character's left). */
  lookYaw: number;
  animate(dt: number, speed: number, pose: Pose): void;
}

/** Low-poly person; faces +Z, origin at the feet. (+X is the character's left.) */
export function createCharacter(look: Look = {}): Character {
  const towel = look.towel !== undefined;
  const skin = mat(look.skin ?? 0xe6c1a2, 0.7);
  const jacket = towel ? skin : mat(look.jacket ?? 0xa3342b);
  const pants = towel ? skin : mat(look.pants ?? 0x2a2e38);
  const boots = towel ? skin : mat(0x3b2a20);
  const scarfMat = mat(look.scarf ?? 0xe0a83a, 0.95);
  const eyeMat = mat(0x1d1d22, 0.4);
  const hatColor = look.hat === undefined ? 0x2e4a7a : look.hat;

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.9;
  root.add(hips);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.32, 4, 12), jacket);
  torso.position.y = 0.24;
  torso.scale.set(1, 1, 0.8);
  hips.add(torso);
  if (towel) {
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.27, 0.6, 14), mat(look.towel!, 1));
    wrap.position.y = 0.13;
    wrap.scale.z = 0.85;
    hips.add(wrap);
  }
  if (look.backpack ?? !towel) {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.14), mat(0x4b5a3a));
    pack.position.set(0, 0.3, -0.21);
    hips.add(pack);
  }
  if (!towel) {
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 6, 14), scarfMat);
    scarf.position.y = 0.58;
    scarf.rotation.x = Math.PI / 2;
    hips.add(scarf);
  }

  const head = new THREE.Group();
  head.position.y = 0.72;
  hips.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skin));
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 4), eyeMat);
    eye.position.set(side * 0.045, 0.02, 0.12);
    head.add(eye);
  }
  if (hatColor !== null) {
    const hatMat = mat(hatColor, 0.95);
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.142, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
    hat.position.y = 0.025;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.06, 14), hatMat);
    cuff.position.y = 0.03;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xf2efe8, 1));
    pom.position.y = 0.18;
    head.add(hat, cuff, pom);
  } else if (look.hair !== undefined) {
    const hairMat = mat(look.hair, 0.9);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.138, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
    cap.rotation.x = -0.35; // further down at the back
    head.add(cap);
    if (look.bun) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), hairMat);
      bun.position.set(0, 0.12, -0.09);
      head.add(bun);
    }
  }

  const legGeo = new THREE.CapsuleGeometry(0.09, 0.62, 4, 8);
  const footGeo = towel ? new THREE.BoxGeometry(0.1, 0.07, 0.2) : new THREE.BoxGeometry(0.15, 0.12, 0.26);
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.x = side * 0.11;
    hips.add(pivot);
    const leg = new THREE.Mesh(legGeo, pants);
    leg.position.y = -0.4;
    const foot = new THREE.Mesh(footGeo, boots);
    foot.position.set(0, towel ? -0.86 : -0.84, 0.04);
    pivot.add(leg, foot);
    return pivot;
  });

  const armGeo = new THREE.CapsuleGeometry(towel ? 0.06 : 0.075, 0.42, 4, 8);
  const handGeo = new THREE.SphereGeometry(towel ? 0.055 : 0.075, 8, 6);
  const handMat = towel ? skin : scarfMat;
  const hands: THREE.Object3D[] = [];
  // side −1 is the character's right (it faces +Z), so arms/hands are [right, left].
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.29, 0.5, 0);
    pivot.rotation.z = side * 0.12;
    hips.add(pivot);
    const arm = new THREE.Mesh(armGeo, jacket);
    arm.position.y = -0.26;
    const hand = new THREE.Mesh(handGeo, handMat);
    hand.position.y = -0.53;
    pivot.add(arm, hand);
    hands.push(hand);
    return pivot;
  });

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });

  let phase = 0;
  let amp = 0;
  let time = Math.random() * 10;

  const character: Character = {
    root,
    head,
    hands: hands as [THREE.Object3D, THREE.Object3D],
    armOverride: [null, null],
    lookYaw: 0,
    animate(dt, speed, pose) {
      time += dt;
      head.rotation.y = character.lookYaw;
      if (pose === 'grip') {
        // Standing on sled runners, both hands forward on the handlebar.
        for (const leg of legs) leg.rotation.x = 0;
        for (const arm of arms) arm.rotation.x = -1.15;
        hips.position.y = 0.9;
        hips.rotation.x = 0.18;
        amp = 0;
      } else if (pose === 'sit') {
        // Thighs forward and slightly down, hands resting on the knees.
        for (const leg of legs) leg.rotation.x = -1.15;
        for (const arm of arms) arm.rotation.x = -0.6;
        hips.position.y = 0.9;
        hips.rotation.x = -0.05;
        torso.scale.y = 1 + Math.sin(time * 1.2) * 0.015;
        amp = 0;
      } else {
        amp += (Math.min(speed / 4.5, 1) * 0.75 - amp) * damp(8, dt);
        phase += dt * (4 + speed * 1.2);
        const s = Math.sin(phase) * amp;
        legs[0].rotation.x = s;
        legs[1].rotation.x = -s;
        arms[0].rotation.x = -s * 0.8;
        arms[1].rotation.x = s * 0.8;
        hips.position.y = 0.9 + Math.abs(Math.cos(phase)) * 0.05 * amp;
        hips.rotation.x = amp * 0.12; // lean into the walk
        torso.scale.y = 1 + Math.sin(time * 1.6) * 0.012; // idle breathing
      }
      character.armOverride.forEach((v, i) => {
        if (v !== null) arms[i].rotation.x = v;
      });
    },
  };
  return character;
}
