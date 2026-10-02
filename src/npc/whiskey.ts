import * as THREE from 'three';
import { groundHeight } from '../world/terrain';
import type { Npc, Npcs } from './npcs';

const LINE = "Listen to the king...we love him. By the way this whiskey is so smoky, it's like licking an ashtray. Want some?";
const TURN = 6.5; // seconds each holder keeps the bottle
const DRINK_END = 1.8;
const PASS_START = 4.8;
const SWAP_AT = 5.6;

function bottle(): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0x4a2408, roughness: 0.15, metalness: 0.1 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = y;
    mesh.castShadow = true;
    g.add(mesh);
  };
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.17, 10), glass, 0);
  add(new THREE.SphereGeometry(0.04, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0.085);
  add(new THREE.CylinderGeometry(0.014, 0.016, 0.07, 8), glass, 0.15);
  add(new THREE.CylinderGeometry(0.017, 0.017, 0.025, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }), 0.195);
  add(new THREE.CylinderGeometry(0.0415, 0.0415, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 }), 0);
  return g;
}

/** Balazs and Richard beside the Ice Hostel, passing a bottle of smoky whiskey back and forth. */
export function createWhiskeyPair(scene: THREE.Scene, npcs: Npcs, igloo: { x: number; z: number; rot: number }): { update(dt: number): void } {
  const { x, z, rot } = igloo;
  /** Igloo-local (lx, lz) → world, on the ground. */
  const at = (lx: number, lz: number) => {
    const wx = x + lx * Math.cos(rot) + lz * Math.sin(rot);
    const wz = z - lx * Math.sin(rot) + lz * Math.cos(rot);
    return new THREE.Vector3(wx, groundHeight(wx, wz), wz);
  };
  // Right of the entrance, side-on to each other; offset so their right hands meet in the middle.
  const pair: Npc[] = [
    npcs.add({ name: 'Balazs', line: LINE, at: at(2.6, -5.8), heading: rot + Math.PI / 2, solid: true,
      look: { jacket: 0x3d6b3f, hat: 0xc9b07a, scarf: 0x7a2a22 } }),
    npcs.add({ name: 'Richard', line: 'Jimmy is the king. Do you want to build a bigger ice hostel with us?', at: at(3.75, -5.22), heading: rot - Math.PI / 2, solid: true,
      look: { jacket: 0x2b3d63, hat: 0xb8322a, scarf: 0xd8d2c4 } }),
  ];

  const b = bottle();
  scene.add(b);
  const hand = new THREE.Vector3();
  const tilt = new THREE.Quaternion();
  let holder = 0;
  let t = 0;

  return {
    update(dt) {
      t += dt;
      if (t >= TURN) t -= TURN;
      const giver = pair[holder].character;
      const taker = pair[1 - holder].character;
      let giverArm = -0.35; // holding it low
      let takerArm: number | null = null;
      let drinking = false;
      if (t < DRINK_END) {
        giverArm = -2.1; // swig
        drinking = true;
      } else if (t >= PASS_START) {
        giverArm = takerArm = -1.3; // both reach out
      }
      giver.armOverride[0] = giverArm;
      taker.armOverride[0] = takerArm;
      if (t >= SWAP_AT && t - dt < SWAP_AT) holder = 1 - holder; // hand-over

      // Bottle follows the holder's right hand; tipped back toward the mouth while drinking.
      const c = pair[holder].character;
      c.hands[0].getWorldPosition(hand);
      b.position.copy(hand);
      tilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), drinking ? -1.9 : 0);
      b.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.root.rotation.y).multiply(tilt);
    },
  };
}
