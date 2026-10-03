import * as THREE from 'three';
import RAPIER, { type Collider, type World } from '@dimforge/rapier3d-compat';
import { fbm } from '../world/noise';
import { groundHeight } from '../world/terrain';
import { MATS, mesh } from '../world/materials';
import type { Interaction } from './interaction';

// Served from public/audio/ (BASE_URL keeps it working under /kiruna-the-game/ on Pages).
const SONG_URL = `${import.meta.env.BASE_URL}audio/the-king.mp3`;

const RX = 4.2; // mound radii
const RY = 3.0;
const RZ = 4.0;
const ARCH = { half: 0.45, side: 0.9, frame: 0.3, depth: 1.4, front: -RZ - 0.25 };
const HEARING = 38; // metres until the music fades out

/** Arch outline: straight sides up to `side`, then a semicircle. */
function archPath(path: THREE.Path, half: number, side: number): void {
  path.moveTo(-half, 0);
  path.lineTo(-half, side);
  path.absarc(0, side, half, Math.PI, 0, true);
  path.lineTo(half, 0);
}

function signTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3b2a1b';
  g.textBaseline = 'middle';
  // Letters pressed into the snow by hand: each a little crooked. Shrink the font until the whole
  // word (with letter gaps) fits the canvas, then centre it, so no letter gets clipped.
  const text = 'ICE HOSTEL';
  const GAP = 6;
  const widthAt = (px: number) => {
    g.font = `bold ${px}px Georgia, serif`;
    return [...text].reduce((sum, ch) => sum + (ch === ' ' ? px / 3 : g.measureText(ch).width) + GAP, -GAP);
  };
  let px = 150;
  while (px > 40 && widthAt(px) > c.width - 80) px -= 4;
  let x = (c.width - widthAt(px)) / 2;
  let seed = 9;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const ch of text) {
    const w = ch === ' ' ? px / 3 : g.measureText(ch).width;
    g.save();
    g.translate(x + w / 2, 128 + (rand() - 0.5) * 16);
    g.rotate((rand() - 0.5) * 0.16);
    g.fillText(ch, -w / 2, 0);
    g.restore();
    x += w + GAP;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface Igloo {
  /** Mound radius (at full size) and the igloo-local → world transform, for story mode. */
  radius: number;
  toWorld(lx: number, lz: number): THREE.Vector3;
  /** Story mode grows the mound from small to full size (1). */
  setSize(s: number): void;
  interaction(p: THREE.Vector3): Interaction | null;
  status(p: THREE.Vector3): string | null;
  /** Story mode's igloo building: the song plays quietly in the background (scale × free-roam volume). */
  background(on: boolean, scale: number): void;
  /** Esc pause: hold the music, and pick it back up on resume. */
  pause(): void;
  resume(): void;
  update(p: THREE.Vector3): void;
}

/** "Ice Hostel": a dug-out snow mound next to the lodge. E at the entrance plays the King. */
export function createIgloo(scene: THREE.Scene, world: World, x: number, z: number, rotY: number): Igloo {
  const base = groundHeight(x, z) - 0.05;
  const group = new THREE.Group();
  group.position.set(x, base, z);
  group.rotation.y = rotY;
  scene.add(group);

  // Lumpy snow mound (half ellipsoid), smoother around the entrance so the sign sits cleanly.
  const geo = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const front = THREE.MathUtils.smoothstep(-v.z, 0.55, 0.9);
    const lump = fbm(v.x * 2.2 + v.y * 3.1, v.z * 2.2 - v.y * 1.7, 3, 21) * (0.09 - 0.06 * front);
    v.multiplyScalar(1 + lump);
    pos.setXYZ(i, v.x * RX, Math.max(0, v.y) * RY, v.z * RZ);
  }
  geo.computeVertexNormals();
  group.add(mesh(geo, MATS.snow));
  group.add(mesh(new THREE.CylinderGeometry(RX * 0.99, RX * 1.02, 1.2, 40), MATS.snow, 0, -0.6, 0)); // skirt for slopes

  // Entrance: an arched snow tunnel cut into the front, dark inside.
  const ring = new THREE.Shape();
  archPath(ring, ARCH.half + ARCH.frame, ARCH.side);
  const hole = new THREE.Path();
  archPath(hole, ARCH.half, ARCH.side);
  ring.holes.push(hole);
  const tunnel = new THREE.ExtrudeGeometry(ring, { depth: ARCH.depth, bevelEnabled: false, curveSegments: 16 });
  group.add(mesh(tunnel, MATS.snow, 0, 0, ARCH.front));
  const darkShape = new THREE.Shape();
  archPath(darkShape, ARCH.half, ARCH.side);
  const dark = new THREE.Mesh(new THREE.ShapeGeometry(darkShape, 16), new THREE.MeshBasicMaterial({ color: 0x0c1220 }));
  dark.position.set(0, 0, ARCH.front + ARCH.depth - 0.05);
  dark.rotation.y = Math.PI; // face out of the tunnel
  group.add(dark);
  const inner = mesh(new THREE.PlaneGeometry(ARCH.half * 2, ARCH.depth), new THREE.MeshStandardMaterial({ color: 0xaab8cf, roughness: 1 }), 0, 0.02, ARCH.front + ARCH.depth / 2);
  inner.rotation.x = -Math.PI / 2;
  group.add(inner);

  // Snow banks either side of the dug-out approach.
  for (const s of [-1, 1]) {
    const bank = mesh(new THREE.SphereGeometry(1, 14, 8), MATS.snow, s * 1.15, 0, ARCH.front - 1.0);
    bank.scale.set(0.6, 0.55, 1.5);
    group.add(bank);
  }

  // "ICE HOSTEL" above the arch, lying on the mound's slope.
  const signY = ARCH.side + ARCH.half + ARCH.frame + 0.32;
  const surfZ = -RZ * Math.sqrt(1 - (signY / RY) ** 2);
  const normal = new THREE.Vector3(0, signY / (RY * RY), surfZ / (RZ * RZ)).normalize();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 0.58),
    new THREE.MeshStandardMaterial({ map: signTexture(), transparent: true, alphaTest: 0.3, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  sign.position.set(0, signY, surfZ).addScaledVector(normal, 0.22);
  // Turn the plane to face the front (−Z) with text upright, then tilt it back onto the slope.
  const tilt = Math.atan2(normal.y, -normal.z);
  sign.quaternion
    .setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
  group.add(sign);

  // Colliders: the mound and the tunnel frame (rebuilt when story mode resizes the mound).
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  const rot = { x: q.x, y: q.y, z: q.z, w: q.w };
  const at = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyQuaternion(q).add(group.position);
  let colliders: Collider[] = [];
  let entrance = new THREE.Vector3();
  const build = (s: number) => {
    colliders.forEach((c) => world.removeCollider(c, false));
    group.scale.setScalar(s);
    const c1 = at(0, 1.4 * s, 0);
    const c2 = at(0, 0.8 * s, (ARCH.front + 0.35) * s);
    colliders = [
      world.createCollider(RAPIER.ColliderDesc.cylinder(1.4 * s, (Math.min(RX, RZ) - 0.1) * s).setTranslation(c1.x, c1.y, c1.z)),
      world.createCollider(RAPIER.ColliderDesc.cuboid((ARCH.half + ARCH.frame) * s, 0.8 * s, 0.35 * s).setTranslation(c2.x, c2.y, c2.z).setRotation(rot)),
    ];
    entrance = at(0, 0, ARCH.front * s - 0.8);
  };
  build(1);

  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';
  let playing = false;
  let volumeScale = 1;
  let state: 'idle' | 'loading' | 'playing' | 'error' = 'idle';
  audio.addEventListener('playing', () => (state = 'playing'));
  audio.addEventListener('waiting', () => (state = 'loading'));
  audio.addEventListener('error', () => {
    state = 'error';
    playing = false;
  });

  const start = () => {
    if (!audio.src) audio.src = SONG_URL;
    playing = true;
    state = 'loading';
    audio.play().catch(() => {
      state = 'error';
      playing = false;
    });
  };
  const stop = () => {
    playing = false;
    state = 'idle';
    audio.pause();
  };
  const listen: Interaction = { label: 'listen to the king', run: start };
  const quiet: Interaction = { label: 'stop the music', run: stop };
  const near = (p: THREE.Vector3) => Math.hypot(p.x - entrance.x, p.z - entrance.z) < 2.4;

  return {
    radius: RX,
    toWorld(lx, lz) {
      const w = at(lx, 0, lz);
      return w.setY(groundHeight(w.x, w.z));
    },
    setSize: build,
    interaction: (p) => (near(p) ? (playing ? quiet : listen) : null),
    status(p) {
      const d = Math.hypot(p.x - entrance.x, p.z - entrance.z);
      if (state === 'error' && d < 6) return 'The King is not answering (could not load the song)';
      if (!playing || d > HEARING) return null;
      return state === 'loading' ? 'Calling the King…' : null; // no title while it plays
    },
    background(on, scale) {
      if (on === playing) return;
      volumeScale = scale;
      if (on) start();
      else stop();
    },
    pause() {
      if (playing) audio.pause();
    },
    resume() {
      if (playing) audio.play().catch(() => {});
    },
    update(p) {
      if (!playing) return;
      const d = Math.hypot(p.x - entrance.x, p.z - entrance.z);
      audio.volume = THREE.MathUtils.clamp(1.1 - d / (HEARING * 0.9), 0, 1) * 0.9 * volumeScale;
    },
  };
}
