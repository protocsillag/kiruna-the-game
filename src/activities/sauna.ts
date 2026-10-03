import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { damp } from '../world/noise';
import { ICE_Y, shoreZ } from '../world/terrain';
import { addGableRoof } from '../world/buildings';
import { MATS, mesh, timber } from '../world/materials';
import { Smoke } from '../world/smoke';
import { createIceHole } from './icehole';
import type { Player } from '../player/player';
import type { Interaction } from './interaction';

const W = 7.2; // outer size along X: long two-tier benches seat ~16
const D = 4.0; // outer size along Z; the door is on the +Z (shore) side
const H = 2.5;
const T = 0.14;
const DOOR = { x0: -0.5, x1: 0.5, h: 1.95 };
const HOLE = { x: 2.6, z: 0.9, size: 1.4 }; // ice hole through the floor, front-right
const STOVE = { x: -2.85, z: 1.25 };
const OUTSIDE_TEMP = -12;
const MAX_LOGS = 5;
const BURN_SECONDS = 50; // per log
const PEAK = 115; // a full stove settles near OUTSIDE_TEMP + PEAK·(1 − e^(−2.75)) ≈ 96 °C

/** Where more wood settles the room: 1 log ≈ 36 °C, 2 ≈ 65 °C, 3 ≈ 81 °C, 5 ≈ 96 °C. */
const targetTemp = (logs: number) => OUTSIDE_TEMP + PEAK * (1 - Math.exp(-0.55 * logs));

export interface Sauna {
  interior: THREE.Box3;
  /** Sitting spot on the upper bench at local x (for NPCs), and where to stand to talk to them. */
  upperSeat(lx: number): { root: THREE.Vector3; front: THREE.Vector3 };
  centre: THREE.Vector3;
  readonly dipping: boolean;
  cameraIgnore: number[];
  isInside(p: THREE.Vector3): boolean;
  /** 0..1 how hot it feels to the player (for the warm screen tint). */
  warmth(p: THREE.Vector3): number;
  status(p: THREE.Vector3): string | null;
  interaction(p: THREE.Vector3): Interaction | null;
  update(dt: number, tint: THREE.Color): void;
  readonly temperature: number;
  /** Story mode: logs must be carried in from the woodpile (null = the stove never runs out). */
  wood: { has(): boolean; use(): void } | null;
  /** Story mode keeps the cold dip closed until the sauna is restored. */
  allowDip: () => boolean;
}

/** Camp Alta's sauna on the ice: room for 16, a wood stove you stoke with E, and an ice hole inside. */
export function createSauna(scene: THREE.Scene, world: World, player: Player, onPlunge: () => void): Sauna {
  const cx = -24;
  const cz = shoreZ(cx) - 5.5;
  const floorY = ICE_Y + 0.2;
  const group = new THREE.Group();
  group.position.set(cx, floorY, cz);
  scene.add(group);

  const wall = timber('dark', H);
  const solid = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = wall) => {
    group.add(mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(cx + x, floorY + y, cz + z));
  };
  /** Floor slab spanning [x0,x1]×[z0,z1] (local), top at the floor. */
  const deck = (x0: number, x1: number, z0: number, z1: number) =>
    solid(x1 - x0, 0.2, z1 - z0, (x0 + x1) / 2, -0.1, (z0 + z1) / 2, MATS.wood);

  // Deck around the building (with a hole cut for the ice hole) and an entry deck toward shore.
  const e = { x0: -W / 2 - 0.3, x1: W / 2 + 0.3, z0: -D / 2 - 0.3, z1: D / 2 + 0.3 };
  const h = { x0: HOLE.x - HOLE.size / 2, x1: HOLE.x + HOLE.size / 2, z0: HOLE.z - HOLE.size / 2, z1: HOLE.z + HOLE.size / 2 };
  deck(e.x0, h.x0, e.z0, e.z1);
  deck(h.x1, e.x1, e.z0, e.z1);
  deck(h.x0, h.x1, e.z0, h.z0);
  deck(h.x0, h.x1, h.z1, e.z1);
  deck(-2.2, 2.2, e.z1, e.z1 + 1.4);

  // Walls around one long room; the door gap is in the front (+Z) wall.
  solid(W, H, T, 0, H / 2, -D / 2 + T / 2);
  solid(T, H, D, -W / 2 + T / 2, H / 2, 0);
  solid(T, H, D, W / 2 - T / 2, H / 2, 0);
  const leftW = DOOR.x0 + W / 2;
  const rightW = W / 2 - DOOR.x1;
  solid(leftW, H, T, -W / 2 + leftW / 2, H / 2, D / 2 - T / 2);
  solid(rightW, H, T, W / 2 - rightW / 2, H / 2, D / 2 - T / 2);
  solid(DOOR.x1 - DOOR.x0, H - DOOR.h, T, (DOOR.x0 + DOOR.x1) / 2, (H + DOOR.h) / 2, D / 2 - T / 2);
  solid(W, 0.1, D, 0, H + 0.05, 0); // ceiling (also stops the camera)
  addGableRoof(group, W, D, H + 0.1, 1.8, 'dark');

  // Open door, swung out against the front wall.
  const doorW = DOOR.x1 - DOOR.x0;
  const door = mesh(new THREE.BoxGeometry(doorW, DOOR.h, 0.05), MATS.door);
  door.geometry.translate(-doorW / 2, DOOR.h / 2, 0);
  door.position.set(DOOR.x1, 0, D / 2 + 0.03);
  door.rotation.y = 1.9;
  group.add(door);

  // Two long benches along the back (lake) wall.
  const inner = W - T * 2;
  const upperZ = -D / 2 + T + 0.3;
  const lowerZ = -D / 2 + T + 0.6 + 0.275;
  solid(inner, 1.0, 0.6, 0, 0.5, upperZ, MATS.wood);
  solid(inner, 0.5, 0.55, 0, 0.25, lowerZ, MATS.wood);

  // Windows in the back wall, glowing from the fire.
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, emissive: 0xff8a3c, emissiveIntensity: 0, roughness: 0.2 });
  for (const x of [-1.8, 1.4]) group.add(mesh(new THREE.BoxGeometry(0.8, 0.42, T + 0.04), windowMat, x, 1.8, -D / 2 + T / 2));

  // Stove in the front-left corner, fire door facing the room, stones on top, pipe through the roof.
  solid(0.6, 0.85, 0.55, STOVE.x, 0.425, STOVE.z, MATS.metal);
  const fireMat = new THREE.MeshStandardMaterial({ color: 0x220d05, emissive: 0xff6a1a, emissiveIntensity: 0 });
  const fireDoor = mesh(new THREE.PlaneGeometry(0.26, 0.2), fireMat, STOVE.x + 0.305, 0.32, STOVE.z);
  fireDoor.rotation.y = Math.PI / 2;
  group.add(fireDoor);
  for (let i = 0; i < 12; i++) {
    group.add(mesh(new THREE.DodecahedronGeometry(0.09), MATS.stone, STOVE.x - 0.2 + (i % 4) * 0.13, 0.91, STOVE.z - 0.15 + Math.floor(i / 4) * 0.15));
  }
  const roofAtStove = H + 0.1 + 1.8 * (1 - Math.abs(STOVE.x) / (W / 2));
  const pipeTop = roofAtStove + 1.4;
  group.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, pipeTop - 0.85), MATS.metal, STOVE.x, 0.85 + (pipeTop - 0.85) / 2, STOVE.z - 0.1));

  const fireLight = new THREE.PointLight(0xff8a3c, 0, 11, 2);
  fireLight.position.set(-1.2, 1.9, 0.3);
  group.add(fireLight);
  const lamp = mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), MATS.window, 0, DOOR.h + 0.22, D / 2 + 0.1);
  lamp.castShadow = false;
  group.add(lamp);
  const doorLight = new THREE.PointLight(0xffc27a, 4, 10, 2);
  doorLight.position.set(0.9, 2.1, D / 2 + 0.6);
  group.add(doorLight);

  const toWorld = (x: number, y: number, z: number) => new THREE.Vector3(cx + x, floorY + y, cz + z);
  const steam = new Smoke(scene, toWorld(STOVE.x, 1.05, STOVE.z), {
    count: 40, life: 4.5, rise: 0.35, spread: 0.6, size: [0.3, 1.9], opacity: 0.28,
  });
  const chimney = new Smoke(scene, toWorld(STOVE.x, pipeTop, STOVE.z - 0.1), {
    count: 30, life: 7, rise: 0.8, spread: 0.15, size: [0.3, 2.6], opacity: 0.4,
  });

  const hole = createIceHole(scene, world, toWorld(HOLE.x, 0, HOLE.z).setY(ICE_Y), HOLE.size, floorY,
    toWorld(HOLE.x - 1.3, 0, HOLE.z), player, onPlunge);

  const interior = new THREE.Box3(
    new THREE.Vector3(cx - W / 2 + T, floorY - 0.5, cz - D / 2 + T),
    new THREE.Vector3(cx + W / 2 - T, floorY + H, cz + D / 2 - T),
  );
  const stoveFront = toWorld(STOVE.x + 0.8, 0, STOVE.z);
  const benchEdge = cz + lowerZ;

  let logs = 0;
  let temp = OUTSIDE_TEMP;
  let sitting = false;
  let standSpot = new THREE.Vector3();
  let time = 0;
  const isInside = (p: THREE.Vector3) => interior.containsPoint(p);

  const sit: Interaction = {
    label: 'sit on the bench',
    run() {
      // Sit on the lower bench right where you are standing.
      const x = THREE.MathUtils.clamp(player.position.x, cx - W / 2 + 0.5, cx + W / 2 - 0.5);
      sitting = true;
      standSpot = new THREE.Vector3(x, floorY, cz + lowerZ + 0.75);
      player.lock(new THREE.Vector3(x, floorY + 0.5 + 0.12 - 0.9, benchEdge), 0, 'sit');
    },
  };
  const stand: Interaction = {
    label: 'stand up',
    run() {
      sitting = false;
      player.unlock(standSpot);
    },
  };
  const stoke: Interaction = {
    label: 'add wood',
    run() {
      api.wood?.use();
      logs = Math.min(MAX_LOGS, logs + 1);
      steam.burst(3);
    },
  };
  const full: Interaction = { label: 'the stove is full', run() {} };
  const noWood: Interaction = { label: 'bring wood from the woodpile', run() {} };

  const api: Sauna = {
    interior,
    centre: new THREE.Vector3(cx, floorY, cz),
    upperSeat: (lx) => ({
      root: new THREE.Vector3(cx + lx, floorY + 1.0 + 0.12 - 0.9, cz + upperZ),
      front: new THREE.Vector3(cx + lx, floorY, cz + lowerZ + 0.75),
    }),
    get dipping() {
      return hole.dipping;
    },
    get temperature() {
      return temp;
    },
    wood: null,
    allowDip: () => true,
    cameraIgnore: hole.cameraIgnore,
    isInside,
    warmth: (p) => (isInside(p) ? THREE.MathUtils.clamp((temp - 35) / 55, 0, 1) : 0),
    status(p) {
      if (!isInside(p) && !sitting) return null;
      const n = Math.ceil(logs - 0.001);
      return `Sauna  ${Math.round(temp)} °C   ${'●'.repeat(n)}${'○'.repeat(MAX_LOGS - n)}`;
    },
    interaction(p) {
      if (sitting) return stand;
      if (hole.dipping || !isInside(p)) return null;
      const viaHole = api.allowDip() ? hole.interaction(p) : null;
      const dStove = Math.hypot(p.x - stoveFront.x, p.z - stoveFront.z);
      if (dStove < 1.2) return logs > MAX_LOGS - 0.5 ? full : api.wood && !api.wood.has() ? noWood : stoke;
      if (viaHole) return viaHole;
      if (p.z - benchEdge < 1.1) return sit;
      return null;
    },
    update(dt, tint) {
      time += dt;
      hole.update(dt);
      logs = Math.max(0, logs - dt / BURN_SECONDS);
      // Heats faster the more wood is burning; cools off slowly once the fire dies down.
      const target = targetTemp(logs);
      const rate = target > temp ? 0.02 + logs * 0.03 : 0.025;
      temp += (target - temp) * damp(rate, dt);

      const flicker = 0.85 + 0.15 * Math.sin(time * 13) * Math.sin(time * 7.3);
      const fire = Math.min(logs, 1) * (0.6 + logs * 0.25) * flicker;
      fireLight.intensity = fire * 9 + Math.max(0, temp) * 0.03;
      fireMat.emissiveIntensity = fire * 3;
      windowMat.emissiveIntensity = fire * 1.2;
      steam.rate = THREE.MathUtils.clamp((temp - 45) / 50, 0, 1) * 8;
      chimney.rate = logs > 0.05 ? 3 : 0;
      steam.update(dt);
      chimney.tint.copy(tint);
      chimney.update(dt, 0.8, 0.3);
    },
  };
  return api;
}
