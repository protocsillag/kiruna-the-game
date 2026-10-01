import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { groundHeight } from './terrain';
import { MATS, mesh, timber, type Timber } from './materials';

export type Face = 'front' | 'back' | 'left' | 'right';

export interface BuildingOpts {
  w: number; // along local X
  d: number; // along local Z; the gable faces front (−Z)
  h: number; // wall height
  roofH: number;
  wall: Timber;
  windows?: { face: Face; at: number; y: number; w: number; h: number }[];
  door?: { face: Face; at: number; w?: number; h?: number };
  chimney?: { x: number; z: number };
  glassRoof?: boolean;
}

export interface Building {
  group: THREE.Group;
  /** World position of the chimney top, if any. */
  chimneyTop?: THREE.Vector3;
  /** World position just outside the door. */
  doorstep?: THREE.Vector3;
  radius: number;
}

const OVERHANG = 0.35;

/** Gable roof (ridge along local Z) with snow on top, sitting on walls of height h. */
export function addGableRoof(group: THREE.Group, w: number, d: number, h: number, roofH: number, wall: Timber, glass = false): void {
  const gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, roofH)]);
  const attic = new THREE.ExtrudeGeometry(gable, { depth: d, bevelEnabled: false });
  attic.translate(0, h, -d / 2);
  group.add(mesh(attic, timber(wall, 1)));

  const angle = Math.atan2(roofH, w / 2);
  const half = w / 2 + OVERHANG;
  const slant = half / Math.cos(angle);
  const len = d + OVERHANG * 2;
  const slab = new THREE.BoxGeometry(slant, 0.12, len);
  const snow = new THREE.BoxGeometry(slant * 0.97, 0.16, len - 0.06);
  for (const side of [-1, 1]) {
    const cx = (side * half) / 2;
    const cy = h + roofH - (half / 2) * Math.tan(angle) + 0.06;
    const roof = mesh(slab, glass ? MATS.glass : MATS.roof, cx, cy, 0);
    roof.rotation.z = -side * angle;
    group.add(roof);
    if (glass) {
      // Window bars running down the slope.
      for (let i = -2; i <= 2; i++) {
        const bar = mesh(new THREE.BoxGeometry(slant, 0.06, 0.06), MATS.metal, cx, cy + 0.06, (i * len) / 5);
        bar.rotation.z = -side * angle;
        group.add(bar);
      }
    } else {
      const cap = mesh(snow, MATS.snow, cx + side * Math.sin(angle) * 0.14, cy + Math.cos(angle) * 0.14, 0);
      cap.rotation.z = -side * angle;
      group.add(cap);
    }
  }
}

function placeOnFace(o: THREE.Object3D, face: Face, at: number, y: number, w: number, d: number, out: number): void {
  if (face === 'front') o.position.set(at, y, -d / 2 - out);
  if (face === 'back') o.position.set(-at, y, d / 2 + out);
  if (face === 'left') o.position.set(-w / 2 - out, y, at);
  if (face === 'right') o.position.set(w / 2 + out, y, -at);
  if (face === 'left') o.rotation.y = Math.PI / 2;
  if (face === 'right') o.rotation.y = -Math.PI / 2;
  if (face === 'back') o.rotation.y = Math.PI;
}

/** Framed, glowing window on a wall. */
function addWindow(group: THREE.Group, face: Face, at: number, y: number, ww: number, wh: number, o: BuildingOpts): void {
  const win = new THREE.Group();
  win.add(mesh(new THREE.BoxGeometry(ww, wh, 0.04), MATS.window));
  const f = 0.08;
  win.add(mesh(new THREE.BoxGeometry(ww + f * 2, f, 0.08), MATS.trim, 0, wh / 2 + f / 2, 0));
  win.add(mesh(new THREE.BoxGeometry(ww + f * 2, f, 0.1), MATS.trim, 0, -wh / 2 - f / 2, 0.02));
  win.add(mesh(new THREE.BoxGeometry(f, wh, 0.08), MATS.trim, -ww / 2 - f / 2, 0, 0));
  win.add(mesh(new THREE.BoxGeometry(f, wh, 0.08), MATS.trim, ww / 2 + f / 2, 0, 0));
  win.add(mesh(new THREE.BoxGeometry(0.04, wh, 0.06), MATS.trim)); // mullion
  placeOnFace(win, face, at, y, o.w, o.d, 0.03);
  group.add(win);
}

/** Simple timber building with foundation, trim, gable roof, windows, door and an optional chimney. */
export function createBuilding(scene: THREE.Scene, world: World, x: number, z: number, rotY: number, o: BuildingOpts): Building {
  const group = new THREE.Group();
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]];
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  let base = -Infinity;
  for (const [cx, cz] of corners) {
    const lx = (cx * o.w) / 2;
    const lz = (cz * o.d) / 2;
    base = Math.max(base, groundHeight(x + lx * cos + lz * sin, z - lx * sin + lz * cos));
  }
  base += 0.1;
  group.position.set(x, base, z);
  group.rotation.y = rotY;

  group.add(mesh(new THREE.BoxGeometry(o.w + 0.1, 1.6, o.d + 0.1), MATS.foundation, 0, -0.65, 0));
  group.add(mesh(new THREE.BoxGeometry(o.w, o.h, o.d), timber(o.wall, o.h), 0, o.h / 2, 0));
  for (const [cx, cz] of corners.slice(0, 4)) {
    group.add(mesh(new THREE.BoxGeometry(0.14, o.h, 0.14), MATS.trim, (cx * o.w) / 2, o.h / 2, (cz * o.d) / 2));
  }
  addGableRoof(group, o.w, o.d, o.h, o.roofH, o.wall, o.glassRoof);
  if (o.glassRoof) {
    // Warm lit interior seen through the glass.
    const ceiling = mesh(new THREE.PlaneGeometry(o.w - 0.2, o.d - 0.2), MATS.glow, 0, o.h + 0.02, 0);
    ceiling.rotation.x = -Math.PI / 2;
    group.add(ceiling);
  }

  for (const w of o.windows ?? []) addWindow(group, w.face, w.at, w.y, w.w, w.h, o);

  const result: Building = { group, radius: Math.hypot(o.w, o.d) / 2 };
  let doorMarker: THREE.Object3D | undefined;
  if (o.door) {
    const dw = o.door.w ?? 0.9;
    const dh = o.door.h ?? 1.95;
    const door = new THREE.Group();
    door.add(mesh(new THREE.BoxGeometry(dw, dh, 0.06), MATS.door, 0, dh / 2, 0));
    door.add(mesh(new THREE.BoxGeometry(dw + 0.16, 0.08, 0.1), MATS.trim, 0, dh + 0.04, 0));
    door.add(mesh(new THREE.BoxGeometry(dw + 0.4, 0.14, 0.6), MATS.wood, 0, 0.07, -0.3)); // step
    placeOnFace(door, o.door.face, o.door.at, 0, o.w, o.d, 0.03);
    group.add(door);
    doorMarker = new THREE.Object3D();
    doorMarker.position.set(0, 0, -1.2);
    door.add(doorMarker);
  }

  if (o.chimney) {
    const roofY = o.h + o.roofH * (1 - Math.abs(o.chimney.x) / (o.w / 2));
    const top = roofY + 1.1;
    const height = top - (roofY - 0.4);
    group.add(mesh(new THREE.BoxGeometry(0.55, height, 0.55), MATS.stone, o.chimney.x, top - height / 2, o.chimney.z));
    group.add(mesh(new THREE.BoxGeometry(0.65, 0.12, 0.65), MATS.snow, o.chimney.x, top + 0.06, o.chimney.z));
    result.chimneyTop = new THREE.Vector3(o.chimney.x, top + 0.15, o.chimney.z);
  }

  scene.add(group);
  group.updateMatrixWorld(true);
  if (result.chimneyTop) group.localToWorld(result.chimneyTop);
  if (doorMarker) result.doorstep = doorMarker.getWorldPosition(new THREE.Vector3());

  const q = new THREE.Quaternion().setFromEuler(group.rotation);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(o.w / 2, (o.h + 1.6) / 2, o.d / 2)
      .setTranslation(x, base + (o.h - 1.6) / 2, z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
  );
  return result;
}
