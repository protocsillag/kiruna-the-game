import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { groundHeight } from './terrain';
import { addGableRoof, createBuilding } from './buildings';
import { MATS, mesh, timber } from './materials';
import { createHusky, type DogMode, type Husky } from '../vehicles/husky';

const YARD = { w: 16, d: 11, z: 7 }; // fenced yard behind the gate (local +Z), gate faces the lake
const GATE = 3.2;
const POST_EVERY = 2;

export interface DogFarm {
  /** Where the harnessed team starts: lead dogs, facing out of the gate toward the lake. */
  team: { x: number; z: number; heading: number };
  update(dt: number): void;
}

function signTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a3d27';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#f3e9d8';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let px = 64;
  do g.font = `bold ${(px -= 4)}px Georgia, serif`;
  while (g.measureText(text).width > 470 && px > 20);
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Husky farm next to camp: fenced yard, dog houses with straw, a kennel shed and resting dogs. */
export function createDogFarm(scene: THREE.Scene, world: World, gate: { x: number; z: number; rot: number }): DogFarm {
  const { x: gx, z: gz, rot } = gate;
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromAxisAngle(up, rot);
  /** Local (x, z) → world point on the ground. */
  const at = (lx: number, lz: number, lift = 0) => {
    const w = new THREE.Vector3(lx, 0, lz).applyQuaternion(q).add(new THREE.Vector3(gx, 0, gz));
    return w.setY(groundHeight(w.x, w.z) + lift);
  };
  const place = (o: THREE.Object3D, lx: number, lz: number, yaw = 0, lift = 0) => {
    o.position.copy(at(lx, lz, lift));
    o.rotation.y = rot + yaw;
    scene.add(o);
    return o;
  };
  const block = (lx: number, lz: number, hx: number, hy: number, hz: number, yaw = 0) => {
    const p = at(lx, lz, hy);
    const r = new THREE.Quaternion().setFromAxisAngle(up, rot + yaw);
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(p.x, p.y, p.z).setRotation({ x: r.x, y: r.y, z: r.z, w: r.w }));
  };

  // Fence: posts every 2 m, two rails per bay, a gate gap in the front side.
  const x0 = -YARD.w / 2, x1 = YARD.w / 2, z0 = YARD.z - YARD.d / 2, z1 = YARD.z + YARD.d / 2;
  const sides: [number, number, number, number][] = [
    [x0, z0, -GATE / 2, z0], [GATE / 2, z0, x1, z0], // front, split by the gate
    [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0],
  ];
  const post = new THREE.CylinderGeometry(0.06, 0.07, 1.2, 6).translate(0, 0.6, 0);
  for (const [ax, az, bx, bz] of sides) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / POST_EVERY));
    const yaw = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) {
      const lx = ax + ((bx - ax) * i) / n;
      const lz = az + ((bz - az) * i) / n;
      place(mesh(post, MATS.wood), lx, lz);
      if (i === n) continue;
      const mx = ax + ((bx - ax) * (i + 0.5)) / n;
      const mz = az + ((bz - az) * (i + 0.5)) / n;
      for (const h of [0.45, 0.95]) {
        place(mesh(new THREE.BoxGeometry(0.05, 0.1, len / n), MATS.wood), mx, mz, yaw, h);
      }
    }
    block((ax + bx) / 2, (az + bz) / 2, 0.08, 0.6, len / 2, yaw);
  }

  // Dog houses along the back fence, doors facing the gate.
  for (let i = 0; i < 5; i++) {
    const lx = -6 + i * 3;
    const lz = z1 - 1.1;
    const house = new THREE.Group();
    house.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 1.0), timber(i % 2 ? 'dark' : 'falu', 0.7), 0, 0.35, 0));
    addGableRoof(house, 0.9, 1.0, 0.7, 0.45, i % 2 ? 'dark' : 'falu');
    const door = mesh(new THREE.PlaneGeometry(0.36, 0.42), new THREE.MeshBasicMaterial({ color: 0x0d0f14 }), 0, 0.24, -0.505);
    door.rotation.y = Math.PI;
    house.add(door);
    place(house, lx, lz);
    block(lx, lz, 0.5, 0.55, 0.55);
    const straw = mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.04, 12), new THREE.MeshStandardMaterial({ color: 0xc9a75a, roughness: 1 }));
    place(straw, lx, lz - 1.0, 0, 0.01);
    place(mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.08, 10), MATS.metal), lx + 0.6, lz - 0.9, 0, 0.04);
  }

  // Kennel shed beside the yard, and a sign at the gate.
  const shed = at(-YARD.w / 2 - 3.5, YARD.z);
  createBuilding(scene, world, shed.x, shed.z, rot, {
    w: 3.6, d: 3.2, h: 2.3, roofH: 1.3, wall: 'falu',
    windows: [{ face: 'front', at: -0.8, y: 1.3, w: 0.8, h: 0.7 }],
    door: { face: 'front', at: 0.9, w: 0.8, h: 1.9 },
  });
  for (const s of [-1, 1]) place(mesh(new THREE.BoxGeometry(0.1, 2.1, 0.1), MATS.wood), s * (GATE / 2 + 0.3), z0 - 0.3, 0, 1.05);
  const sign = mesh(new THREE.BoxGeometry(GATE + 0.8, 0.5, 0.06), new THREE.MeshStandardMaterial({ map: signTexture('CAMP ALTA HUSKIES'), roughness: 0.9 }));
  place(sign, 0, z0 - 0.3, Math.PI, 2.05);

  // A few dogs resting in the yard.
  const resting: { dog: Husky; mode: DogMode }[] = [];
  const spots: [number, number, number, DogMode][] = [[-5, 7.5, 0.6, 'lie'], [-1.2, 9.2, -2.2, 'lie'], [3.4, 6.2, 2.6, 'idle'], [6.5, 8.8, -0.9, 'lie']];
  spots.forEach(([lx, lz, yaw, mode], i) => {
    const dog = createHusky(10 + i, false);
    place(dog.root, lx, lz, yaw);
    resting.push({ dog, mode });
  });

  const lead = at(0, z0 - 1 - 7.9);
  return {
    team: { x: lead.x, z: lead.z, heading: rot + Math.PI },
    update(dt) {
      for (const r of resting) r.dog.animate(dt, 0, r.mode);
    },
  };
}
