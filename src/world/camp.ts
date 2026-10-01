import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundHeight, LAKE, shoreZ } from './terrain';
import { createBuilding, type BuildingOpts } from './buildings';
import { MATS, mesh } from './materials';
import { Smoke } from './smoke';
import type { Palette } from '../sky/palette';

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export interface Camp {
  spawn: THREE.Vector3;
  /** Where the yurt stands (built by activities/yurt.ts). */
  yurt: { x: number; z: number; rot: number };
  /** The "Ice Hostel" snow igloo beside the lodge (built by activities/igloo.ts). */
  igloo: { x: number; z: number; rot: number };
  /** Areas kept free of trees. */
  clearings: Circle[];
  update(dt: number, p: Palette, gust: number): void;
}

/** Rotation that turns a building's front (−Z) toward the middle of the lake. */
const faceLake = (x: number, z: number) => Math.atan2(-(LAKE.x - x), -(LAKE.z - z));

const CABIN: BuildingOpts = {
  w: 4.2, d: 3.8, h: 2.5, roofH: 1.7, wall: 'falu',
  windows: [
    { face: 'front', at: -1.0, y: 1.35, w: 1.0, h: 0.9 },
    { face: 'left', at: 0, y: 1.35, w: 0.8, h: 0.7 },
  ],
  door: { face: 'front', at: 1.15, w: 0.8, h: 1.9 },
};

function woodpile(scene: THREE.Scene, world: World, x: number, z: number, rotY: number): void {
  const logs: THREE.BufferGeometry[] = [];
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i < 9 - (row % 2); i++) {
      const g = new THREE.CylinderGeometry(0.12, 0.12, 0.55, 7);
      g.rotateX(Math.PI / 2);
      g.translate(-1.0 + i * 0.25 + (row % 2) * 0.125, 0.12 + row * 0.22, (Math.random() - 0.5) * 0.06);
      logs.push(g);
    }
  }
  const y = groundHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;
  group.add(mesh(mergeGeometries(logs), MATS.log));
  group.add(mesh(new THREE.BoxGeometry(2.4, 0.14, 0.75), MATS.snow, 0, 1.2, 0));
  scene.add(group);
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, 0.65, 0.35).setTranslation(x, y + 0.6, z).setRotation(
    new THREE.Quaternion().setFromEuler(group.rotation),
  ));
}

function porchLight(scene: THREE.Scene, at: THREE.Vector3, rotY: number): void {
  const lamp = mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), MATS.window, at.x, at.y, at.z);
  lamp.rotation.y = rotY;
  lamp.castShadow = false;
  scene.add(lamp);
  const light = new THREE.PointLight(0xffc27a, 6, 14, 2);
  light.position.copy(at).add(new THREE.Vector3(0, -0.2, 0));
  scene.add(light);
}

/** Camp Alta: lodge, five cabins and a glass-roof cabin along the shore, plus a woodpile. */
export function createCamp(scene: THREE.Scene, world: World): Camp {
  const clearings: Circle[] = [];
  const add = (x: number, z: number, opts: BuildingOpts) => {
    const b = createBuilding(scene, world, x, z, faceLake(x, z), opts);
    clearings.push({ x, z, r: b.radius + 4 });
    return b;
  };

  const lodgeX = -4;
  const lodgeZ = shoreZ(lodgeX) + 32;
  const lodge = add(lodgeX, lodgeZ, {
    w: 13, d: 9, h: 3.6, roofH: 3.2, wall: 'falu',
    windows: [
      ...[-4.6, -2.4, 2.4, 4.6].map((at) => ({ face: 'front' as const, at, y: 1.7, w: 1.4, h: 1.3 })),
      { face: 'front', at: 0, y: 4.6, w: 1.0, h: 0.8 },
      ...[-2, 2].flatMap((at) => [
        { face: 'left' as const, at, y: 1.7, w: 1.2, h: 1.1 },
        { face: 'right' as const, at, y: 1.7, w: 1.2, h: 1.1 },
      ]),
    ],
    door: { face: 'front', at: 0, w: 1.2, h: 2.1 },
    chimney: { x: 2.6, z: 1.5 },
  });
  const lodgeSmoke = new Smoke(scene, lodge.chimneyTop!, {
    count: 40, life: 9, rise: 0.9, spread: 0.3, size: [0.7, 4.5], opacity: 0.45,
  });
  lodgeSmoke.rate = 4;
  const lodgeRot = faceLake(lodgeX, lodgeZ);
  porchLight(scene, lodge.group.localToWorld(new THREE.Vector3(-1.0, 2.5, -4.62)), lodgeRot);
  woodpile(scene, world, lodgeX + 9.2 * Math.cos(lodgeRot), lodgeZ - 9.2 * Math.sin(lodgeRot), lodgeRot);

  [-46, -35, 24, 35, 46].forEach((x, i) => {
    const z = shoreZ(x) + 13 + (i % 2) * 3;
    add(x, z, { ...CABIN, wall: i % 2 ? 'dark' : 'falu' });
  });

  // The glass-roof cabin, for watching the aurora from bed.
  const gx = 12;
  add(gx, shoreZ(gx) + 10, {
    w: 4.6, d: 4.2, h: 2.4, roofH: 1.6, wall: 'dark', glassRoof: true,
    windows: [{ face: 'front', at: 0, y: 1.3, w: 2.4, h: 1.2 }],
    door: { face: 'right', at: 0.8, w: 0.8, h: 1.9 },
  });

  const spawnX = 2;
  const spawn = new THREE.Vector3(spawnX, 0, shoreZ(spawnX) + 14);
  // Ice Hostel: on the lodge's left side (lodge-local x = −13, slightly back), facing the lake.
  const igloo = {
    x: lodgeX - 13 * Math.cos(lodgeRot) + 1 * Math.sin(lodgeRot),
    z: lodgeZ + 13 * Math.sin(lodgeRot) + 1 * Math.cos(lodgeRot),
    rot: lodgeRot,
  };
  clearings.push({ x: igloo.x, z: igloo.z, r: 8 });

  const yurtX = -18;
  const yurtZ = shoreZ(yurtX) + 22;
  const yurt = { x: yurtX, z: yurtZ, rot: faceLake(yurtX, yurtZ) };
  clearings.push({ x: spawn.x, z: spawn.z, r: 10 }, { x: lodgeX, z: lodgeZ - 12, r: 14 }, { x: yurtX, z: yurtZ, r: 9 });

  return {
    spawn,
    yurt,
    igloo,
    clearings,
    update(dt, p, gust) {
      MATS.window.emissiveIntensity = 1.6 + p.stars * 1.8;
      MATS.glow.emissiveIntensity = 0.5 + p.stars * 0.9;
      lodgeSmoke.tint.copy(p.hemiSky).multiplyScalar(0.35 + p.hemiIntensity * 0.35);
      lodgeSmoke.update(dt, 0.4 + gust * 1.6, 0.2 + gust * 0.6);
    },
  };
}
