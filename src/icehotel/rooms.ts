import * as THREE from 'three';
import { DARK, ICE, ICE_GLOW, SNOW_RELIEF, WHITE, glow, iceBed, part } from './ice';

/**
 * Themed art rooms. Each builder works in room-local space: floor at y = 0, the doorway at
 * z = −4 (corridor side), the far wall at z = +4, side walls at x = ±3.5.
 */
export type RoomBuilder = (g: THREE.Group) => void;

const sphere = (r: number, seg = 16) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7));

/** Giant snow cat with glowing eyes in a holey niche, and a little ice mouse holding cheese. */
const catAndMouse: RoomBuilder = (g) => {
  const niche = new THREE.Shape();
  niche.moveTo(-2.4, 0);
  niche.lineTo(-2.4, 1.8);
  niche.absarc(0, 1.8, 2.4, Math.PI, 0, true);
  niche.lineTo(2.4, 0);
  const inner = new THREE.Path();
  inner.moveTo(-1.6, 0);
  inner.lineTo(1.6, 0);
  inner.lineTo(1.6, 1.8);
  inner.absarc(0, 1.8, 1.6, 0, Math.PI, false);
  inner.lineTo(-1.6, 0);
  niche.holes.push(inner);
  const arch = part(g, new THREE.ExtrudeGeometry(niche, { depth: 0.5, bevelEnabled: false, curveSegments: 20 }), SNOW_RELIEF, 0, 0, 3.4);
  arch.rotation.y = Math.PI; // face the door
  const holeMat = new THREE.MeshStandardMaterial({ color: 0xc4d2e2, roughness: 1 });
  for (const [x, y, r] of [[-2, 2.6, 0.22], [-1.9, 1.4, 0.14], [1.95, 2.2, 0.26], [2.05, 0.9, 0.15], [-0.4, 3.9, 0.18], [0.9, 3.7, 0.12], [-1.2, 3.4, 0.1]]) {
    const hole = part(g, new THREE.CircleGeometry(r, 18), holeMat, x, y, 2.88); // on the niche's front face
    hole.rotation.y = Math.PI;
  }
  // The cat peeking out of the niche.
  const cat = new THREE.Group();
  cat.position.set(0, 0, 3.0);
  g.add(cat);
  part(cat, sphere(0.95, 20), SNOW_RELIEF, 0, 1.25, 0).scale.set(1.1, 0.95, 0.85);
  part(cat, sphere(0.45), SNOW_RELIEF, 0, 1.0, -0.65).scale.set(1.2, 0.8, 0.8); // muzzle
  for (const s of [-1, 1]) {
    part(cat, new THREE.ConeGeometry(0.32, 0.6, 6), SNOW_RELIEF, s * 0.6, 2.15, 0).rotation.z = -s * 0.3;
    part(cat, sphere(0.12), glow(0xffd23a, 3), s * 0.36, 1.45, -0.72); // eyes
    part(cat, sphere(0.36), SNOW_RELIEF, s * 0.55, 0.25, -0.9).scale.set(1, 0.7, 1.5); // paws
  }
  part(cat, sphere(0.06), glow(0xe8a0a0, 0.6), 0, 1.12, -1.08); // nose
  // The ice mouse, holding a wedge of cheese.
  const mouse = new THREE.Group();
  mouse.position.set(-2.0, 0, 0.6);
  mouse.rotation.y = 0.5;
  g.add(mouse);
  part(mouse, sphere(0.42), ICE, 0, 0.7, 0).scale.set(1, 1.35, 0.9);
  part(mouse, sphere(0.26), ICE, 0, 1.45, -0.08);
  for (const s of [-1, 1]) part(mouse, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), ICE, s * 0.24, 1.72, -0.02).rotation.x = Math.PI / 2;
  part(mouse, new THREE.TorusGeometry(0.35, 0.04, 6, 12, Math.PI), ICE, 0, 0.3, 0.35).rotation.y = Math.PI / 2;
  const wedge = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.4, 0), new THREE.Vector2(0, 0.28)]);
  part(mouse, new THREE.ExtrudeGeometry(wedge, { depth: 0.2, bevelEnabled: false }), glow(0xffcf5a, 0.9), -0.2, 0.85, -0.45);
};

/** Two giant snow birds guarding an ice bed, under a glowing round window. */
const birds: RoomBuilder = (g) => {
  iceBed(g, 0, 2.4);
  part(g, new THREE.CircleGeometry(0.75, 32), glow(0xf0b8f4, 1.6), 0, 2.4, 3.7).rotation.y = Math.PI;
  part(g, new THREE.TorusGeometry(0.8, 0.08, 8, 32), SNOW_RELIEF, 0, 2.4, 3.65);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spike = part(g, new THREE.BoxGeometry(0.06, 0.6, 0.04), SNOW_RELIEF, Math.sin(a) * 1.2, 2.4 + Math.cos(a) * 1.2, 3.66);
    spike.rotation.z = -a;
  }
  for (const s of [-1, 1]) {
    const bird = new THREE.Group();
    bird.position.set(s * 2.3, 0, 2.2);
    bird.rotation.y = s * 0.35;
    g.add(bird);
    part(bird, sphere(0.75, 18), SNOW_RELIEF, 0, 1.3, 0).scale.set(0.85, 1.1, 1.1);
    part(bird, sphere(0.48, 16), SNOW_RELIEF, 0, 2.3, -0.35);
    part(bird, new THREE.ConeGeometry(0.1, 0.3, 6), glow(0xd8a060, 0.3), 0, 2.25, -0.85).rotation.x = -Math.PI / 2;
    for (const e of [-1, 1]) part(bird, sphere(0.05), DARK, e * 0.22, 2.42, -0.72);
    part(bird, new THREE.BoxGeometry(0.5, 0.1, 1.5), SNOW_RELIEF, 0, 0.6, 0.95).rotation.x = -0.6; // tail
    part(bird, sphere(0.5), SNOW_RELIEF, -s * 0.55, 1.4, 0.1).scale.set(0.35, 0.9, 1.2); // wing
  }
};

/** An ice tram carriage, a glowing lamp post and a bench with a small snow cat. */
const iceExpress: RoomBuilder = (g) => {
  const tram = new THREE.Group();
  tram.position.set(-1.5, 0, 0.6);
  g.add(tram);
  part(tram, new THREE.BoxGeometry(1.7, 2.1, 4.4), ICE, 0, 1.55, 0);
  part(tram, new THREE.BoxGeometry(1.5, 1.6, 4.2), glow(0x6fd6e8, 0.5), 0, 1.55, 0); // inner glow
  part(tram, new THREE.BoxGeometry(1.9, 0.15, 4.6), ICE_GLOW, 0, 2.66, 0); // roof
  for (let i = -2; i <= 2; i++) part(tram, new THREE.BoxGeometry(1.75, 0.08, 0.08), ICE_GLOW, 0, 1.85, i * 0.85); // window bars
  for (const z of [-1.5, 1.5]) for (const x of [-0.75, 0.75]) {
    part(tram, new THREE.CylinderGeometry(0.28, 0.28, 0.12, 16), ICE, x, 0.32, z).rotation.z = Math.PI / 2;
  }
  part(g, new THREE.CylinderGeometry(0.07, 0.1, 2.8, 10), ICE, 2.4, 1.4, 2.6); // lamp post
  part(g, new THREE.BoxGeometry(0.34, 0.45, 0.34), glow(0xfff4dc, 3), 2.4, 3.0, 2.6);
  for (let i = 0; i < 5; i++) part(g, new THREE.BoxGeometry(0.1, 0.06, 1.4), ICE, 2.6 - i * 0.14, 0.48, 0.2); // bench slats
  for (const z of [-0.45, 0.85]) part(g, new THREE.BoxGeometry(0.6, 0.46, 0.08), ICE, 2.35, 0.23, z);
  part(g, sphere(0.18), SNOW_RELIEF, 2.4, 0.72, 0.4).scale.set(1, 1.2, 1); // cat body
  part(g, sphere(0.12), SNOW_RELIEF, 2.4, 0.98, 0.32);
};

/** A bed on a pile of ice rocks between two glowing pink lotus flowers. */
const lotus: RoomBuilder = (g) => {
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    part(g, new THREE.DodecahedronGeometry(0.42), ICE, Math.cos(a) * 0.75, 0.3, 2.3 + Math.sin(a) * 0.9).rotation.set(a, a * 2, 0);
  }
  iceBed(g, 0, 2.3, 1.8, 2.1, false);
  const petal = glow(0xff9ac8, 1.7);
  for (const s of [-1, 1]) {
    const flower = new THREE.Group();
    flower.position.set(s * 2.4, 0, 2.6);
    g.add(flower);
    part(flower, new THREE.CylinderGeometry(0.6, 0.65, 0.1, 18), SNOW_RELIEF, 0, 0.05, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = part(flower, sphere(0.3), petal, Math.cos(a) * 0.28, 0.45, Math.sin(a) * 0.28);
      p.scale.set(0.45, 1, 0.75);
      p.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    }
    part(flower, sphere(0.15), glow(0xfff0a0, 2.2), 0, 0.5, 0);
  }
  const swirl = part(g, new THREE.TorusGeometry(1.2, 0.12, 8, 40, Math.PI * 1.7), SNOW_RELIEF, 0, 3.0, 3.7);
  swirl.rotation.z = 0.4;
  part(g, new THREE.TorusGeometry(0.6, 0.1, 8, 30, Math.PI * 1.5), SNOW_RELIEF, 0.3, 3.1, 3.68);
};

/** Classic suite: fur-covered bed, ice sunburst headboard, ice radiator and glowing bedside lamps. */
const royal: RoomBuilder = (g) => {
  iceBed(g, 0, 2.6, 2.0, 2.1);
  const fan = new THREE.Shape();
  fan.moveTo(-1.3, 0);
  fan.absarc(0, 0, 1.3, Math.PI, 0, true);
  fan.lineTo(-1.3, 0);
  part(g, new THREE.ShapeGeometry(fan, 24), ICE_GLOW, 0, 1.1, 3.72).rotation.y = Math.PI;
  for (let i = 1; i < 8; i++) {
    const a = Math.PI * (i / 8);
    const bar = part(g, new THREE.BoxGeometry(0.05, 1.2, 0.04), SNOW_RELIEF, -Math.cos(a) * 0.62, 1.1 + Math.sin(a) * 0.62, 3.66);
    bar.rotation.z = Math.PI / 2 - a;
  }
  part(g, new THREE.TorusGeometry(1.32, 0.07, 6, 30, Math.PI), SNOW_RELIEF, 0, 1.1, 3.66);
  for (let i = 0; i < 7; i++) part(g, new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), ICE, -3.2, 0.6, 0.2 + i * 0.22); // radiator
  for (const s of [-1, 1]) {
    part(g, new THREE.BoxGeometry(0.5, 0.6, 0.5), ICE, s * 1.5, 0.3, 3.2); // bedside table
    part(g, new THREE.CylinderGeometry(0.05, 0.08, 0.35, 8), ICE, s * 1.5, 0.78, 3.2);
    part(g, new THREE.CylinderGeometry(0.12, 0.2, 0.22, 12), glow(0xfff2dc, 2.4), s * 1.5, 1.05, 3.2); // shade
  }
  part(g, new THREE.BoxGeometry(2.6, 0.04, 1.6), WHITE, 0, 0.02, 0.6); // rug
};

export const ROOMS: { name: string; build: RoomBuilder }[] = [
  { name: 'Cat & Mouse', build: catAndMouse },
  { name: 'Birds of the North', build: birds },
  { name: 'Ice Express', build: iceExpress },
  { name: 'Lotus Dreams', build: lotus },
  { name: 'Royal Suite', build: royal },
];
