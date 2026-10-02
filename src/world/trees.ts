import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundHeight, shoreDistance, WORLD_SIZE } from './terrain';
import { MATS } from './materials';
import type { Circle } from './camp';

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spruceParts(): { trunk: THREE.BufferGeometry; needles: THREE.BufferGeometry; snow: THREE.BufferGeometry } {
  const trunk = new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6).translate(0, 0.7, 0);
  const needles: THREE.BufferGeometry[] = [];
  const snow: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const r = 1.5 - i * 0.32;
    const base = 1.0 + i * 0.9;
    needles.push(new THREE.ConeGeometry(r, 1.6, 8).translate(0, base + 0.8, 0));
    // Snow caps: same slope, upper half of each tier, a touch proud of the needles.
    const capH = 0.85;
    snow.push(new THREE.ConeGeometry(r * (capH / 1.6) * 1.1, capH, 8).translate(0, base + 1.6 - capH / 2 + 0.03, 0));
  }
  return { trunk, needles: mergeGeometries(needles), snow: mergeGeometries(snow) };
}

function birchBark(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ece8e0';
  g.fillRect(0, 0, 64, 256);
  const rand = mulberry32(5);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(30,28,26,${0.5 + rand() * 0.4})`;
    g.fillRect(rand() * 64, rand() * 256, 4 + rand() * 18, 1 + rand() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function birchParts(): { wood: THREE.BufferGeometry; frost: THREE.BufferGeometry } {
  const rand = mulberry32(11);
  const wood: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.07, 0.13, 7, 7).translate(0, 3.5, 0)];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.CylinderGeometry(0.02, 0.04, 2, 4).translate(0, 1, 0);
    b.rotateZ(0.5 + rand() * 0.4);
    b.rotateY(rand() * Math.PI * 2);
    wood.push(b.translate(0, 3.2 + i * 0.55, 0));
  }
  const frost: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = 0.7 + rand() * 0.3;
    frost.push(new THREE.IcosahedronGeometry(r, 0).translate(Math.cos(a) * 0.55, 4.6 + rand() * 2.2, Math.sin(a) * 0.55));
  }
  return { wood: mergeGeometries(wood), frost: mergeGeometries(frost) };
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[]): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Spruce and frosted birch forest around camp, plus one lone spruce out on the ice. */
export function createTrees(
  scene: THREE.Scene,
  world: World,
  clearings: Circle[],
  extra: { x: number; z: number }[],
  density = 1,
): void {
  const rand = mulberry32(42);
  const spruces: THREE.Matrix4[] = [];
  const birches: THREE.Matrix4[] = [];
  const place = (list: THREE.Matrix4[], x: number, z: number, scale: number) => {
    const y = groundHeight(x, z) - 0.1;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2),
      new THREE.Vector3(scale, scale * (0.9 + rand() * 0.25), scale),
    );
    list.push(m);
    world.createCollider(RAPIER.ColliderDesc.cylinder(1.5, 0.22 * scale).setTranslation(x, y + 1.5, z));
  };

  const half = WORLD_SIZE / 2 - 10;
  const candidates = 6000 * (WORLD_SIZE / 800) ** 2 * density; // same forest density at any world size
  for (let i = 0; i < candidates; i++) {
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    const e = shoreDistance(x, z);
    if (e < 6) continue;
    if (clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
    // Sparse near the shore and camp, a thicker low treeline further back.
    const density = THREE.MathUtils.smoothstep(e, 6, 70) * 0.55 + 0.05;
    if (rand() > density) continue;
    const birchChance = THREE.MathUtils.lerp(0.55, 0.2, THREE.MathUtils.smoothstep(e, 20, 140));
    if (rand() < birchChance) place(birches, x, z, 0.75 + rand() * 0.6);
    else place(spruces, x, z, 0.8 + rand() * 1.0);
  }
  for (const t of extra) place(spruces, t.x, t.z, 1.5);

  const s = spruceParts();
  const b = birchParts();
  const needleMat = new THREE.MeshStandardMaterial({ color: 0x1f3b2e, roughness: 0.95 });
  const barkMat = new THREE.MeshStandardMaterial({ map: birchBark(), roughness: 0.85 });
  const frostMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 1, flatShading: true });
  scene.add(
    instanced(s.trunk, MATS.wood, spruces),
    instanced(s.needles, needleMat, spruces),
    instanced(s.snow, MATS.snow, spruces),
    instanced(b.wood, barkMat, birches),
    instanced(b.frost, frostMat, birches),
  );
}
