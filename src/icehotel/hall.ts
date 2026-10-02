import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { SNICE } from './ice';

export type Side = 'n' | 's' | 'e' | 'w'; // n = +Z, s = −Z, e = +X, w = −X

export interface Opening {
  side: Side;
  /** Centre of the opening along that wall, in world X (n/s) or world Z (e/w). */
  at: number;
  w: number;
  h: number;
}

export interface HallOpts {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  wallH: number;
  /** Direction the barrel vault runs; the arched end walls (gables) are at its two ends. */
  axis: 'x' | 'z';
  openings?: Opening[];
  /** Skip the gables (a corridor whose ends are covered by the halls it joins). */
  gables?: boolean;
  /** Material for a particular gable (e.g. the glowing ice-block facade). */
  gableMat?: Partial<Record<Side, THREE.Material>>;
}

const T = 0.5; // wall thickness

type Rect = { u0: number; u1: number; v0: number; v1: number };

/** Wall `len` long and `height` tall, minus door openings (u = along the wall from its start). */
function pieces(len: number, height: number, holes: { u: number; w: number; h: number }[]): Rect[] {
  const out: Rect[] = [];
  let cursor = 0;
  for (const o of [...holes].sort((a, b) => a.u - b.u)) {
    const a = o.u - o.w / 2;
    const b = o.u + o.w / 2;
    if (a > cursor) out.push({ u0: cursor, u1: a, v0: 0, v1: height });
    out.push({ u0: a, u1: b, v0: o.h, v1: height });
    cursor = b;
  }
  if (cursor < len) out.push({ u0: cursor, u1: len, v0: 0, v1: height });
  return out;
}

/**
 * One vaulted snow hall of the Ice Hotel: straight walls, a barrel vault on top, arched end walls,
 * door openings, colliders, and a ceiling collider at wall height so the camera stays inside.
 */
export function createHall(scene: THREE.Scene, world: World, floorY: number, o: HallOpts): void {
  const group = new THREE.Group();
  group.position.y = floorY;
  scene.add(group);
  const span = o.axis === 'z' ? o.x1 - o.x0 : o.z1 - o.z0;
  const length = o.axis === 'z' ? o.z1 - o.z0 : o.x1 - o.x0;
  const cx = (o.x0 + o.x1) / 2;
  const cz = (o.z0 + o.z1) / 2;
  const r = span / 2;
  const openings = o.openings ?? [];

  const block = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material = SNICE, collide = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    if (collide) world.createCollider(RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setTranslation(x, floorY + y, z));
  };

  // Straight side walls (parallel to the vault axis).
  const sideWalls: Side[] = o.axis === 'z' ? ['w', 'e'] : ['s', 'n'];
  for (const side of sideWalls) {
    const alongX = side === 'n' || side === 's';
    const start = alongX ? o.x0 : o.z0;
    const fixed = side === 'n' ? o.z1 : side === 's' ? o.z0 : side === 'e' ? o.x1 : o.x0;
    const holes = openings.filter((h) => h.side === side).map((h) => ({ u: h.at - start, w: h.w, h: h.h }));
    for (const p of pieces(length, o.wallH, holes)) {
      const mid = start + (p.u0 + p.u1) / 2;
      const len = p.u1 - p.u0;
      const hgt = p.v1 - p.v0;
      if (alongX) block(mid, p.v0 + hgt / 2, fixed, len, hgt, T);
      else block(fixed, p.v0 + hgt / 2, mid, T, hgt, len);
    }
  }

  // Barrel vault.
  const vault = new THREE.CylinderGeometry(r, r, length, 28, 1, true, Math.PI / 2, Math.PI);
  vault.rotateX(Math.PI / 2); // axis along Z, open side down
  if (o.axis === 'x') vault.rotateY(Math.PI / 2);
  const roof = new THREE.Mesh(vault, SNICE);
  roof.position.set(cx, o.wallH, cz);
  roof.castShadow = roof.receiveShadow = true;
  group.add(roof);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid((o.x1 - o.x0) / 2, 0.2, (o.z1 - o.z0) / 2).setTranslation(cx, floorY + o.wallH + 0.2, cz),
  );

  // Arched end walls (gables) with door holes.
  if (o.gables === false) return;
  const gableSides: Side[] = o.axis === 'z' ? ['s', 'n'] : ['w', 'e'];
  for (const side of gableSides) {
    const shape = new THREE.Shape();
    shape.moveTo(-r, 0);
    shape.lineTo(-r, o.wallH);
    shape.absarc(0, o.wallH, r, Math.PI, 0, true);
    shape.lineTo(r, 0);
    shape.lineTo(-r, 0);
    const centre = o.axis === 'z' ? cx : cz;
    const holes = openings.filter((h) => h.side === side);
    for (const h of holes) {
      const hole = new THREE.Path();
      const u = h.at - centre;
      hole.moveTo(u - h.w / 2, 0);
      hole.lineTo(u + h.w / 2, 0);
      hole.lineTo(u + h.w / 2, h.h);
      hole.lineTo(u - h.w / 2, h.h);
      hole.lineTo(u - h.w / 2, 0);
      shape.holes.push(hole);
    }
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), o.gableMat?.[side] ?? SNICE);
    const at = side === 'n' ? o.z1 : side === 's' ? o.z0 : side === 'e' ? o.x1 : o.x0;
    if (o.axis === 'z') gable.position.set(cx, 0, at);
    else {
      gable.position.set(at, 0, cz);
      gable.rotation.y = -Math.PI / 2; // shape +u → world +Z, matching the hole and collider maths
    }
    gable.receiveShadow = true;
    group.add(gable);
    // Colliders for the gable up to wall height (above that the ceiling collider takes over).
    const local = holes.map((h) => ({ u: h.at - (centre - r), w: h.w, h: h.h }));
    for (const p of pieces(span, o.wallH, local)) {
      const mid = centre - r + (p.u0 + p.u1) / 2;
      const len = p.u1 - p.u0;
      const hgt = p.v1 - p.v0;
      const y = floorY + p.v0 + hgt / 2;
      const d = o.axis === 'z'
        ? RAPIER.ColliderDesc.cuboid(len / 2, hgt / 2, T / 2).setTranslation(mid, y, at)
        : RAPIER.ColliderDesc.cuboid(T / 2, hgt / 2, len / 2).setTranslation(at, y, mid);
      world.createCollider(d);
    }
  }
}
