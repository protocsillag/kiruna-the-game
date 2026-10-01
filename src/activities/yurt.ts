import * as THREE from 'three';
import RAPIER, { type ColliderDesc, type World } from '@dimforge/rapier3d-compat';
import { groundHeight } from '../world/terrain';
import { MATS, mesh, timber } from '../world/materials';
import { Smoke } from '../world/smoke';
import type { Player } from '../player/player';
import type { Interaction } from './interaction';

const R = 3.8; // wall radius
const WALL_H = 1.95;
const ROOF_H = 2.5;
const SEGS = 26; // wall segments; segment 0 (facing front, −Z) is left open as the door
const SEAT_R = 2.3;
const SEAT_TOP = 0.45;
const SEAT_ANGLES = [42, 90, 138, 222, 270, 318].map((d) => (d * Math.PI) / 180);

/** Outward direction for an angle around the yurt; 0 = front (−Z, the door). */
const dirAt = (a: number) => new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));

function furTexture(base: string, light: string, dark: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  let seed = base.length * 97;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    g.strokeStyle = rand() < 0.5 ? light : dark;
    g.globalAlpha = 0.35 + rand() * 0.4;
    const x = rand() * 128;
    const y = rand() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 3, y + 3 + rand() * 5);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A soft, lumpy reindeer pelt: a flattened, jittered icosphere. */
function pelt(mat: THREE.Material, sx: number, sz: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.9 + Math.random() * 0.2), p.getY(i), p.getZ(i) * (0.9 + Math.random() * 0.2));
  geo.computeVertexNormals();
  const m = mesh(geo, mat);
  m.scale.set(sx, 0.07, sz);
  return m;
}

export interface Yurt {
  interior: THREE.Box3;
  isInside(p: THREE.Vector3): boolean;
  warmth(p: THREE.Vector3): number;
  interaction(p: THREE.Vector3): Interaction | null;
  status(p: THREE.Vector3): string | null;
  update(dt: number, tint: THREE.Color): void;
}

/** Round timber kåta/yurt with a campfire in the middle and reindeer-fur seats around it. */
export function createYurt(scene: THREE.Scene, world: World, player: Player, x: number, z: number, rotY: number): Yurt {
  let base = groundHeight(x, z);
  for (let i = 0; i < 8; i++) {
    const d = dirAt((i / 8) * Math.PI * 2).multiplyScalar(R + 0.3);
    base = Math.max(base, groundHeight(x + d.x, z + d.z));
  }
  base += 0.15;
  const group = new THREE.Group();
  group.position.set(x, base, z);
  group.rotation.y = rotY;
  scene.add(group);
  const q = new THREE.Quaternion();
  /** Collider in group-local coordinates. */
  const collide = (desc: ColliderDesc, lx: number, ly: number, lz: number, yaw = 0) => {
    const w = new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY).add(group.position);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY + yaw);
    world.createCollider(desc.setTranslation(w.x, w.y, w.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  };

  // Plinth and wooden floor.
  group.add(mesh(new THREE.CylinderGeometry(R + 0.2, R + 0.2, 1.2, 28), MATS.foundation, 0, -0.6, 0));
  group.add(mesh(new THREE.CylinderGeometry(R, R, 0.05, 28), MATS.wood, 0, 0.025, 0));
  collide(RAPIER.ColliderDesc.cylinder(0.65, R + 0.2), 0, 0.05 - 0.65, 0);
  // Steps down from the door to the ground (the door faces downhill toward the lake).
  const doorFront = dirAt(0).multiplyScalar(R + 0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  const drop = base + 0.05 - groundHeight(x + doorFront.x, z + doorFront.z);
  const steps = Math.max(1, Math.ceil(drop / 0.22));
  for (let i = 0; i < steps; i++) {
    const top = 0.05 - ((i + 1) * drop) / (steps + 1);
    const h = top + 1.2; // reach well into the ground
    const sz = -R - 0.25 - i * 0.32;
    group.add(mesh(new THREE.BoxGeometry(1.4, h, 0.34), MATS.wood, 0, top - h / 2, sz));
    collide(RAPIER.ColliderDesc.cuboid(0.7, h / 2, 0.17), 0, top - h / 2, sz);
  }

  // Round timber wall, door gap at the front.
  const segW = ((Math.PI * 2 * R) / SEGS) * 1.04;
  const wallMat = timber('dark', WALL_H);
  for (let i = 1; i < SEGS; i++) {
    const a = (i / SEGS) * Math.PI * 2;
    const d = dirAt(a).multiplyScalar(R);
    const seg = mesh(new THREE.BoxGeometry(segW, WALL_H, 0.14), wallMat, d.x, WALL_H / 2, d.z);
    seg.rotation.y = -a;
    group.add(seg);
    collide(RAPIER.ColliderDesc.cuboid(segW / 2, WALL_H / 2, 0.07), d.x, WALL_H / 2, d.z, -a);
  }
  for (const s of [-1, 1]) {
    const d = dirAt((s * Math.PI) / SEGS).multiplyScalar(R);
    group.add(mesh(new THREE.BoxGeometry(0.14, WALL_H + 0.1, 0.18), MATS.wood, d.x, (WALL_H + 0.1) / 2, d.z));
  }

  // Cone roof: felt inside, snow outside, open smoke hole at the top.
  const felt = new THREE.MeshStandardMaterial({ color: 0xb9ab92, roughness: 1, side: THREE.DoubleSide });
  const roof = mesh(new THREE.CylinderGeometry(0.5, R + 0.35, ROOF_H, SEGS, 1, true), felt, 0, WALL_H + ROOF_H / 2, 0);
  group.add(roof);
  group.add(mesh(new THREE.CylinderGeometry(0.58, R + 0.43, ROOF_H, SEGS, 1, true), MATS.snow, 0, WALL_H + ROOF_H / 2 + 0.05, 0));
  const ring = mesh(new THREE.TorusGeometry(0.52, 0.06, 6, 16), MATS.wood, 0, WALL_H + ROOF_H, 0);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  collide(RAPIER.ColliderDesc.cone(ROOF_H / 2, R + 0.35), 0, WALL_H + ROOF_H / 2, 0); // keeps the camera inside
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 13; i++) {
    const d = dirAt((i / 13) * Math.PI * 2);
    const from = d.clone().multiplyScalar(R - 0.15).setY(WALL_H);
    const to = d.clone().multiplyScalar(0.5).setY(WALL_H + ROOF_H - 0.05);
    const len = from.distanceTo(to);
    const pole = mesh(new THREE.CylinderGeometry(0.04, 0.05, len, 5), MATS.wood);
    pole.position.copy(from).add(to).multiplyScalar(0.5);
    pole.quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize());
    group.add(pole);
  }

  // Campfire: stone ring, ash, crossed logs, flickering flames.
  for (let i = 0; i < 12; i++) {
    const d = dirAt((i / 12) * Math.PI * 2).multiplyScalar(0.7);
    group.add(mesh(new THREE.DodecahedronGeometry(0.13), MATS.stone, d.x, 0.1, d.z));
  }
  const ash = mesh(new THREE.CircleGeometry(0.6, 16), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1 }), 0, 0.055, 0);
  ash.rotation.x = -Math.PI / 2;
  group.add(ash);
  for (let i = 0; i < 4; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6), MATS.log);
    log.position.y = 0.3;
    log.rotation.set(0.55, (i / 4) * Math.PI * 2, 0, 'YXZ');
    group.add(log);
  }
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffa040, emissive: 0xff7a1a, emissiveIntensity: 3.5, transparent: true, opacity: 0.85, depthWrite: false,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffe08a, emissive: 0xffd060, emissiveIntensity: 4.5, transparent: true, opacity: 0.9, depthWrite: false,
  });
  const flames = [
    { r: 0.26, h: 0.75, x: 0, z: 0, mat: flameMat },
    { r: 0.18, h: 0.55, x: 0.12, z: 0.08, mat: flameMat },
    { r: 0.17, h: 0.5, x: -0.1, z: -0.1, mat: flameMat },
    { r: 0.12, h: 0.45, x: 0, z: 0, mat: coreMat },
  ].map((f) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(f.r, f.h, 7).translate(0, f.h / 2, 0), f.mat);
    m.position.set(f.x, 0.12, f.z);
    group.add(m);
    return m;
  });
  collide(RAPIER.ColliderDesc.cylinder(0.3, 0.8), 0, 0.3, 0);
  const fireLight = new THREE.PointLight(0xff9a4a, 10, 13, 2);
  fireLight.position.set(0, 0.9, 0);
  group.add(fireLight);

  // Log seats draped in reindeer fur, plus pelts on the floor.
  const furs = [
    new THREE.MeshStandardMaterial({ map: furTexture('#8a7563', '#b8a58e', '#4e4035'), roughness: 1 }),
    new THREE.MeshStandardMaterial({ map: furTexture('#d6cbb8', '#f1ebe0', '#9c8f7c'), roughness: 1 }),
  ];
  const seats: { pos: THREE.Vector3; front: THREE.Vector3; heading: number }[] = [];
  SEAT_ANGLES.forEach((a, i) => {
    const d = dirAt(a).multiplyScalar(SEAT_R);
    const bench = mesh(new THREE.BoxGeometry(0.95, SEAT_TOP - 0.06, 0.4), MATS.log, d.x, (SEAT_TOP - 0.06) / 2, d.z);
    bench.rotation.y = -a;
    group.add(bench);
    const fur = pelt(furs[i % 2], 0.6, 0.34);
    fur.position.set(d.x, SEAT_TOP - 0.02, d.z);
    fur.rotation.y = -a;
    group.add(fur);
    collide(RAPIER.ColliderDesc.cuboid(0.475, SEAT_TOP / 2, 0.2), d.x, SEAT_TOP / 2, d.z, -a);
    // localToWorld updates the group's world matrix itself, so these are true world positions.
    const pos = group.localToWorld(d.clone().setY(0));
    const front = group.localToWorld(dirAt(a).multiplyScalar(SEAT_R - 0.75));
    const toFire = group.localToWorld(new THREE.Vector3()).sub(pos);
    seats.push({ pos, front, heading: Math.atan2(toFire.x, toFire.z) });
  });
  for (const a of [Math.PI * 0.35, Math.PI, Math.PI * 1.65]) {
    const d = dirAt(a).multiplyScalar(1.45);
    const rug = pelt(furs[1], 0.75, 0.5);
    rug.position.set(d.x, 0.06, d.z);
    rug.rotation.y = -a + Math.PI / 2;
    rug.scale.y = 0.04;
    group.add(rug);
  }
  const fireTop = group.localToWorld(new THREE.Vector3(0, 1.0, 0));
  const smoke = new Smoke(scene, fireTop, { count: 40, life: 6.5, rise: 0.7, spread: 0.4, size: [0.4, 2.2], opacity: 0.3 });
  smoke.rate = 3;
  const fireTint = new THREE.Color(0xffb27a);

  const interior = new THREE.Box3(
    new THREE.Vector3(x - R, base - 0.5, z - R),
    new THREE.Vector3(x + R, base + WALL_H + ROOF_H, z + R),
  );
  const isInside = (p: THREE.Vector3) => Math.hypot(p.x - x, p.z - z) < R - 0.15 && Math.abs(p.y - base) < 2;

  let seated = -1;
  let time = 0;
  const stand: Interaction = {
    label: 'stand up',
    run() {
      player.unlock(seats[seated].front);
      seated = -1;
    },
  };

  return {
    interior,
    isInside,
    warmth: (p) => (isInside(p) ? 0.25 + 0.3 * (1 - Math.hypot(p.x - x, p.z - z) / R) : 0),
    status: () => (seated >= 0 ? 'By the fire' : null),
    interaction(p) {
      if (seated >= 0) return stand;
      if (!isInside(p)) return null;
      let best = -1;
      let bestD = 1.3;
      seats.forEach((s, i) => {
        const d = Math.hypot(p.x - s.front.x, p.z - s.front.z);
        if (d < bestD) [best, bestD] = [i, d];
      });
      if (best < 0) return null;
      return {
        label: 'sit by the fire',
        run() {
          seated = best;
          const s = seats[best];
          player.lock(new THREE.Vector3(s.pos.x, base + SEAT_TOP + 0.12 - 0.9, s.pos.z), s.heading, 'sit');
        },
      };
    },
    update(dt, tint) {
      time += dt;
      flames.forEach((f, i) => {
        const k = time * (9 + i * 2.3) + i * 1.7;
        f.scale.set(1 + Math.sin(k * 0.7) * 0.08, 0.8 + Math.sin(k) * 0.15 + Math.sin(k * 2.3) * 0.08, 1 + Math.cos(k * 0.6) * 0.08);
        f.rotation.y = time * (0.6 + i * 0.2);
      });
      fireLight.intensity = 9 + Math.sin(time * 11) * 1.4 + Math.sin(time * 23.7) * 0.8;
      smoke.tint.copy(tint).lerp(fireTint, 0.25);
      smoke.update(dt, 0.3, 0.1);
    },
  };
}
