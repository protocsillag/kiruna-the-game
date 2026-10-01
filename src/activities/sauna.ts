import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { damp } from '../world/noise';
import { ICE_Y, shoreZ } from '../world/terrain';
import { addGableRoof } from '../world/buildings';
import { MATS, mesh, timber } from '../world/materials';
import { Smoke } from '../world/smoke';
import type { Player } from '../player/player';
import type { Interaction } from './interaction';

const W = 3.6; // outer size along X
const D = 3.2; // outer size along Z; the door is on the +Z (shore) side
const H = 2.3;
const T = 0.14;
const DOOR = { x0: 0.55, x1: 1.45, h: 1.9 };
const OUTSIDE_TEMP = -12;
const MAX_LOGS = 5;
const BURN_SECONDS = 45; // per log

export interface Sauna {
  /** Where the ice hole goes: out on the lake behind the sauna. */
  holeSpot: THREE.Vector3;
  interior: THREE.Box3;
  isInside(p: THREE.Vector3): boolean;
  /** 0..1 how hot it feels to the player (for the warm screen tint). */
  warmth(p: THREE.Vector3): number;
  status(p: THREE.Vector3): string | null;
  interaction(p: THREE.Vector3): Interaction | null;
  update(dt: number, tint: THREE.Color): void;
}

/** Small wooden sauna on the ice at the lake edge, with a wood stove you stoke with E. */
export function createSauna(scene: THREE.Scene, world: World, player: Player): Sauna {
  const cx = -24;
  const cz = shoreZ(cx) - 5;
  const floorY = ICE_Y + 0.2;
  const group = new THREE.Group();
  group.position.set(cx, floorY, cz);
  scene.add(group);

  const wall = timber('dark', H);
  const solid = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = wall) => {
    group.add(mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(cx + x, floorY + y, cz + z));
  };

  // Deck on the ice (with extra room in front of the door) and the walls around a hollow room.
  solid(W + 0.6, 0.2, D + 0.6, 0, -0.1, 0, MATS.wood);
  solid(W + 0.6, 0.2, 1.4, 0, -0.1, D / 2 + 1.0, MATS.wood);
  solid(W, H, T, 0, H / 2, -D / 2 + T / 2);
  solid(T, H, D, -W / 2 + T / 2, H / 2, 0);
  solid(T, H, D, W / 2 - T / 2, H / 2, 0);
  const left = DOOR.x0 + W / 2;
  const right = W / 2 - DOOR.x1;
  solid(left, H, T, -W / 2 + left / 2, H / 2, D / 2 - T / 2);
  solid(right, H, T, W / 2 - right / 2, H / 2, D / 2 - T / 2);
  solid(DOOR.x1 - DOOR.x0, H - DOOR.h, T, (DOOR.x0 + DOOR.x1) / 2, (H + DOOR.h) / 2, D / 2 - T / 2);
  solid(W, 0.1, D, 0, H + 0.05, 0); // ceiling (also stops the camera)
  addGableRoof(group, W, D, H + 0.1, 1.3, 'dark');

  // Open door, swung out against the front wall.
  const door = mesh(new THREE.BoxGeometry(DOOR.x1 - DOOR.x0, DOOR.h, 0.05), MATS.door);
  door.geometry.translate(-(DOOR.x1 - DOOR.x0) / 2, DOOR.h / 2, 0);
  door.position.set(DOOR.x1, 0, D / 2 + 0.03);
  door.rotation.y = 1.9;
  group.add(door);

  // Two-tier benches along the back (lake) wall.
  const inner = W - T * 2;
  const benchZ = { upper: -D / 2 + T + 0.275, lower: -D / 2 + T + 0.55 + 0.25 };
  solid(inner, 0.95, 0.55, 0, 0.475, benchZ.upper, MATS.wood);
  solid(inner, 0.48, 0.5, 0, 0.24, benchZ.lower, MATS.wood);

  // Window in the back wall, glowing from the fire.
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, emissive: 0xff8a3c, emissiveIntensity: 0, roughness: 0.2 });
  group.add(mesh(new THREE.BoxGeometry(0.7, 0.42, T + 0.04), windowMat, -0.6, 1.6, -D / 2 + T / 2));

  // Stove in the front-left corner, door facing the room, stones on top, pipe through the roof.
  const stove = new THREE.Vector3(-1.1, 0, 0.85);
  solid(0.55, 0.8, 0.5, stove.x, 0.4, stove.z, MATS.metal);
  const fireMat = new THREE.MeshStandardMaterial({ color: 0x220d05, emissive: 0xff6a1a, emissiveIntensity: 0 });
  const fireDoor = mesh(new THREE.PlaneGeometry(0.24, 0.18), fireMat, stove.x + 0.28, 0.3, stove.z);
  fireDoor.rotation.y = Math.PI / 2;
  group.add(fireDoor);
  for (let i = 0; i < 9; i++) {
    group.add(mesh(new THREE.DodecahedronGeometry(0.085), MATS.stone, stove.x - 0.16 + (i % 3) * 0.16, 0.86, stove.z - 0.14 + Math.floor(i / 3) * 0.14));
  }
  const pipeTop = H + 2.4;
  group.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, pipeTop - 0.8), MATS.metal, stove.x, 0.8 + (pipeTop - 0.8) / 2, stove.z - 0.1));

  const fireLight = new THREE.PointLight(0xff8a3c, 0, 7, 2);
  fireLight.position.set(-0.4, 1.7, 0.3);
  group.add(fireLight);
  const lamp = mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), MATS.window, (DOOR.x0 + DOOR.x1) / 2, DOOR.h + 0.2, D / 2 + 0.1);
  lamp.castShadow = false;
  group.add(lamp);
  const doorLight = new THREE.PointLight(0xffc27a, 4, 10, 2);
  doorLight.position.set(1.0, 2.0, D / 2 + 0.6);
  group.add(doorLight);

  const toWorld = (v: THREE.Vector3) => v.clone().add(group.position);
  const steam = new Smoke(scene, toWorld(new THREE.Vector3(stove.x, 1.0, stove.z)), {
    count: 30, life: 4, rise: 0.35, spread: 0.5, size: [0.3, 1.6], opacity: 0.28,
  });
  const chimney = new Smoke(scene, toWorld(new THREE.Vector3(stove.x, pipeTop, stove.z - 0.1)), {
    count: 30, life: 7, rise: 0.8, spread: 0.15, size: [0.3, 2.6], opacity: 0.4,
  });

  const interior = new THREE.Box3(
    new THREE.Vector3(cx - W / 2 + T, floorY - 0.5, cz - D / 2 + T),
    new THREE.Vector3(cx + W / 2 - T, floorY + H, cz + D / 2 - T),
  );
  const stoveFront = toWorld(new THREE.Vector3(stove.x + 0.7, 0, stove.z));
  const seat = toWorld(new THREE.Vector3(0.4, 0.48, benchZ.lower));
  const standSpot = toWorld(new THREE.Vector3(0.4, 0, 0.35));

  let logs = 0;
  let temp = OUTSIDE_TEMP;
  let sitting = false;
  let time = 0;
  const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
  const isInside = (p: THREE.Vector3) => interior.containsPoint(p);

  const sit: Interaction = {
    label: 'sit on the bench',
    run() {
      sitting = true;
      player.lock(new THREE.Vector3(seat.x, seat.y + 0.12 - 0.9, seat.z), 0, 'sit');
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
      logs = Math.min(MAX_LOGS, logs + 1);
      steam.burst(3);
    },
  };
  const full: Interaction = { label: 'the stove is full', run() {} };

  return {
    holeSpot: toWorld(new THREE.Vector3(1.2, 0, -D / 2 - 3.4)).setY(ICE_Y),
    interior,
    isInside,
    warmth: (p) => (isInside(p) ? THREE.MathUtils.clamp((temp - 35) / 55, 0, 1) : 0),
    status(p) {
      if (!isInside(p) && !sitting) return null;
      const fire = '●'.repeat(Math.ceil(logs)) + '○'.repeat(MAX_LOGS - Math.ceil(logs));
      return `Sauna  ${Math.round(temp)} °C   ${fire}`;
    },
    interaction(p) {
      if (sitting) return stand;
      if (!isInside(p)) return null;
      const dStove = flat(p, stoveFront);
      const dSeat = flat(p, seat);
      if (dStove < 1.1 && dStove <= dSeat) return logs > MAX_LOGS - 1 ? full : stoke;
      if (dSeat < 1.2) return sit;
      return null;
    },
    update(dt, tint) {
      time += dt;
      logs = Math.max(0, logs - dt / BURN_SECONDS);
      temp += (OUTSIDE_TEMP + logs * 21 - temp) * damp(0.05, dt);
      const flicker = 0.85 + 0.15 * Math.sin(time * 13) * Math.sin(time * 7.3);
      const fire = Math.min(logs, 1) * (0.6 + logs * 0.25) * flicker;
      fireLight.intensity = fire * 6 + Math.max(0, temp) * 0.02;
      fireMat.emissiveIntensity = fire * 3;
      windowMat.emissiveIntensity = fire * 1.2;
      steam.rate = THREE.MathUtils.clamp((temp - 45) / 50, 0, 1) * 6;
      chimney.rate = logs > 0.05 ? 3 : 0;
      steam.update(dt);
      chimney.tint.copy(tint);
      chimney.update(dt, 0.8, 0.3);
    },
  };
}
