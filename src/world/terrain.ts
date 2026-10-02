import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { clamp, fbm, smoothstep } from './noise';

export const WORLD_SIZE = 1000; // room for the Ice Hotel behind the far shore
const SEGMENTS = 320; // ≈3.1 m grid, as before

/** The frozen lake: an ellipse north of camp. */
export const LAKE = { x: 0, z: -190, rx: 260, rz: 170 };
/** Camp Alta sits on the shore here; terrain is kept gentle around it. */
export const CAMP = { x: 0, z: 18 };
/** Height of the ice surface. */
export const ICE_Y = 0.04;

/** Approximate signed distance in metres from the shoreline; negative = on the lake. */
export function shoreDistance(x: number, z: number): number {
  const dx = (x - LAKE.x) / LAKE.rx;
  const dz = (z - LAKE.z) / LAKE.rz;
  const wobble = fbm(x * 0.012, z * 0.012, 3, 7) * 0.12;
  return (Math.sqrt(dx * dx + dz * dz) - 1 + wobble) * Math.min(LAKE.rx, LAKE.rz);
}

/** Z of the far shoreline at a given x (searching away from camp, across the lake). */
export function farShoreZ(x: number): number {
  for (let z = LAKE.z; z > -WORLD_SIZE / 2; z -= 0.5) if (shoreDistance(x, z) > 0) return z;
  return -WORLD_SIZE / 2;
}

/** Natural terrain before the Ice Hotel pad is levelled. */
function naturalHeight(x: number, z: number, hotelX: number, hotelZ: number): number {
  const e = shoreDistance(x, z);
  if (e <= 0) return THREE.MathUtils.lerp(-0.3, 0.15, smoothstep(-3, 0, e));
  const flat = Math.min(
    smoothstep(35, 90, Math.hypot(x - CAMP.x, z - CAMP.z)),
    smoothstep(45, 100, Math.hypot(x - hotelX, z - hotelZ)),
  );
  const hillAmp = (3 + smoothstep(0, 280, e) * 26) * (0.25 + 0.75 * flat);
  const hills = (fbm(x * 0.006, z * 0.006, 4, 1) * 0.5 + 0.5) * hillAmp;
  const detail = fbm(x * 0.05, z * 0.05, 2, 3) * 0.25;
  return 0.15 + smoothstep(0, 35, e) * (0.8 + hills + detail);
}

/**
 * The Ice Hotel: straight across the lake from camp (where the red-cross trail ends), front door
 * facing the lake (+Z). `front` is the door's z; the building extends 74 m back (−Z). `y` is the
 * levelled floor height.
 */
const HOTEL_X = 45;
const HOTEL_FRONT = farShoreZ(HOTEL_X) - 22;
const HOTEL_DEPTH = 74;
const PAD = { x0: HOTEL_X - 15, x1: HOTEL_X + 15, z0: HOTEL_FRONT - HOTEL_DEPTH - 2, z1: HOTEL_FRONT + 3, blend: 10 };
export const ICEHOTEL = {
  x: HOTEL_X,
  front: HOTEL_FRONT,
  depth: HOTEL_DEPTH,
  y: naturalHeight(HOTEL_X, HOTEL_FRONT, HOTEL_X, HOTEL_FRONT - HOTEL_DEPTH / 2),
};

/** Raw terrain height (lake bed lies below the ice); levelled flat under the Ice Hotel. */
export function heightAt(x: number, z: number): number {
  const h = naturalHeight(x, z, HOTEL_X, HOTEL_FRONT - HOTEL_DEPTH / 2);
  const dx = Math.max(0, PAD.x0 - x, x - PAD.x1);
  const dz = Math.max(0, PAD.z0 - z, z - PAD.z1);
  const pad = (1 - smoothstep(0, PAD.blend, dx)) * (1 - smoothstep(0, PAD.blend, dz));
  return pad > 0 ? THREE.MathUtils.lerp(h, ICEHOTEL.y, pad) : h;
}

/** Walkable surface height: terrain or ice, whichever is higher. */
export function groundHeight(x: number, z: number): number {
  return Math.max(heightAt(x, z), ICE_Y);
}

/** Z of the shoreline at a given x, searching from camp toward the lake. */
export function shoreZ(x: number): number {
  for (let z = 60; z > -200; z -= 0.5) if (shoreDistance(x, z) <= 0) return z;
  return LAKE.z;
}

export const isOnIce = (x: number, z: number) => heightAt(x, z) < ICE_Y;

/** 0 = packed snow / ice, 1 = deep powder. */
export function snowDepth(x: number, z: number): number {
  if (isOnIce(x, z)) return 0;
  const packed = 1 - smoothstep(25, 45, Math.hypot(x - CAMP.x, z - CAMP.z));
  return clamp(0.45 + fbm(x * 0.03, z * 0.03, 2, 11) * 0.7, 0, 1) * (1 - packed);
}

export function createTerrain(scene: THREE.Scene, world: World): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(0xf1f5fb);
  const hollow = new THREE.Color(0xc9d6ec);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    c.copy(base).lerp(hollow, smoothstep(-0.2, 0.6, fbm(x * 0.02, z * 0.02, 3, 5)) * 0.6);
    c.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  const vertices = new Float32Array(pos.array as ArrayLike<number>);
  const indices = new Uint32Array(geo.index!.array as ArrayLike<number>);
  // FIX_INTERNAL_EDGES: stops shapes catching on the seams between triangles.
  world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES));
  return mesh;
}
