import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { furMaterials, pelt } from '../world/fur';
import { DARK, ICE, glow, part } from './ice';
import type { Look } from '../player/character';
import type { Npc, Npcs } from '../npc/npcs';

const GUESTS: { name: string; line: string; look: Look }[] = [
  { name: 'Sven', line: 'Skål! To the coldest bar in Sweden.', look: { jacket: 0x2d5a3a, hat: 0x8a2a22 } },
  { name: 'Maja', line: 'Have you seen the cat room? Those eyes follow you.', look: { jacket: 0xb8322a, hat: 0xf2efe8 } },
  { name: 'Lars', line: 'My drink froze to my mitten. Worth it.', look: { jacket: 0x3a3a44, hat: 0x2e5fa8 } },
  { name: 'Ingrid', line: 'We came for the aurora and stayed for the blueberry vodka.', look: { jacket: 0x6b3a8a, hat: 0xd9b26f } },
  { name: 'Elin', line: 'The glasses are made of ice. Drink fast or it gets slippery!', look: { jacket: 0x2f6fa8, hat: 0xe0a83a } },
  { name: 'Johan', line: 'This place is so cool. Literally.', look: { jacket: 0x8a5a2b, hat: 0x1a1a1a } },
  { name: 'Kaisa', line: 'First time in Kiruna? You picked the right week.', look: { jacket: 0xd0702a, hat: 0x2d5a3a } },
  { name: 'Nils', line: 'One more round and then the sauna across the lake.', look: { jacket: 0x1f3b5a, hat: 0xb8322a } },
];

/** Gold crown with gems, sized for a character's head. */
function crown(): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8b830, emissive: 0x6a4a08, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.9 });
  part(g, new THREE.CylinderGeometry(0.15, 0.14, 0.09, 16, 1, true), gold, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(g, new THREE.ConeGeometry(0.035, 0.1, 5), gold, Math.sin(a) * 0.14, 0.09, Math.cos(a) * 0.14);
    part(g, new THREE.SphereGeometry(0.018, 6, 4), glow(i % 2 ? 0xd8243a : 0x2a6ae0, 1.4), Math.sin(a) * 0.15, 0.0, Math.cos(a) * 0.15);
  }
  return g;
}

interface Sipper {
  npc: Npc;
  cup: THREE.Group;
  next: number;
  sip: number;
}

/**
 * Life in the Ice Bar: two tables of three guests on fur-covered ice cubes, two at the counter,
 * everyone sipping from ice glasses now and then, and Jimmy, the King, on his ice throne.
 */
export function createBarGuests(
  scene: THREE.Scene,
  world: World,
  npcs: Npcs,
  bar: { x: number; front: number; y: number; counterZ: number },
): { update(dt: number): void } {
  const { x: X, front: F, y: Y } = bar;
  const furs = furMaterials();
  const sippers: Sipper[] = [];
  let g = 0;
  const seat = (sx: number, sz: number, top: number, heading: number, withCube: boolean) => {
    if (withCube) {
      part(scene, new THREE.BoxGeometry(0.5, top, 0.5), ICE, sx, Y + top / 2, sz);
      const fur = pelt(furs[g % 2], 0.3, 0.3);
      fur.position.set(sx, Y + top + 0.02, sz);
      scene.add(fur);
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.25, top / 2, 0.25).setTranslation(sx, Y + top / 2, sz));
    }
    const guest = GUESTS[g++ % GUESTS.length];
    const npc = npcs.add({
      ...guest, at: new THREE.Vector3(sx, Y + top + 0.12 - 0.9, sz), heading, pose: 'sit',
      talkFrom: new THREE.Vector3(sx, Y, sz), talkRadius: 1.4,
    });
    const cup = new THREE.Group();
    part(cup, new THREE.BoxGeometry(0.08, 0.11, 0.08), ICE, 0, 0, 0);
    part(cup, new THREE.BoxGeometry(0.055, 0.06, 0.055), glow([0x6a3fd0, 0xd03f6a, 0x3fb0d0][g % 3], 0.6), 0, -0.01, 0);
    scene.add(cup);
    sippers.push({ npc, cup, next: 2 + Math.random() * 10, sip: 0 });
  };

  // Two round tables (already in the bar), three guests around each.
  for (const tx of [X - 5, X + 5]) {
    const tz = F - 63.5;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + (tx < X ? 0.5 : -0.5);
      const sx = tx + Math.sin(a) * 1.4; // far enough that sitting legs stay clear of the table
      const sz = tz + Math.cos(a) * 1.4;
      seat(sx, sz, 0.45, Math.atan2(tx - sx, tz - sz), true);
    }
  }
  // Two guests on the counter stools, facing the bar.
  for (const i of [0, 4]) seat(X - 4.4 + i * 1.35, bar.counterZ + 1.5, 0.6, Math.PI, false);

  // Jimmy, the King, on an ice throne in the back corner, overlooking the room.
  const tx = X + 6.3;
  const tz = F - 71.6;
  const heading = Math.atan2(X - tx, F - 65 - tz);
  const throne = new THREE.Group();
  throne.position.set(tx, Y, tz);
  throne.rotation.y = heading;
  scene.add(throne);
  part(throne, new THREE.BoxGeometry(0.9, 0.5, 0.75), ICE, 0, 0.25, 0);
  part(throne, new THREE.BoxGeometry(0.95, 1.9, 0.18), ICE, 0, 0.95, -0.42);
  for (const s of [-1, 1]) part(throne, new THREE.BoxGeometry(0.14, 0.75, 0.7), ICE, s * 0.52, 0.38, 0);
  part(throne, new THREE.SphereGeometry(0.12, 10, 8), glow(0xe8b830, 1.5), 0, 1.98, -0.42);
  const fur = pelt(furs[1], 0.48, 0.42);
  fur.position.set(tx, Y + 0.52, tz);
  scene.add(fur);
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 1.0, 0.55).setTranslation(tx, Y + 1.0, tz));
  const jimmy = npcs.add({
    name: 'Jimmy', line: "I can't lose yet. Not yet. I still want to live.",
    at: new THREE.Vector3(tx, Y + 0.5 + 0.12 - 0.9, tz).add(new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(0.05)),
    heading, pose: 'sit', talkFrom: new THREE.Vector3(tx, Y, tz).add(new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(1.2)),
    talkRadius: 1.3, look: { jacket: 0xf0ede6, pants: 0x1a1a22, hat: null, hair: 0xe6c266, scarf: 0xe8b830 },
  });
  const c = crown();
  c.position.y = 0.13;
  jimmy.character.head.add(c);
  // Long blonde curls falling from under the crown, down past the shoulders.
  const curlMat = new THREE.MeshStandardMaterial({ color: 0xe6c266, roughness: 0.75 });
  for (let row = 0; row < 5; row++) {
    const n = 9 - row;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 0.3 + (i / (n - 1)) * Math.PI * 1.4; // round the back and sides, open at the face
      const r = 0.13 + row * 0.012;
      part(jimmy.character.head, new THREE.SphereGeometry(0.055 + (row % 2) * 0.01, 8, 6), curlMat,
        Math.sin(a) * r, 0.02 - row * 0.085, Math.cos(a) * r); // a = π is the back of the head; the face (+Z) stays clear
    }
  }
  const cape = part(jimmy.character.root, new THREE.BoxGeometry(0.62, 1.15, 0.04), new THREE.MeshStandardMaterial({ color: 0x9a1a24, roughness: 0.7 }), 0, 1.0, -0.2);
  cape.rotation.x = 0.12;

  // A rooster standing at the King's feet.
  const rooster = new THREE.Group();
  const rf = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const rr = new THREE.Vector3(-rf.z, 0, rf.x);
  rooster.position.set(tx, Y, tz).addScaledVector(rf, 0.95).addScaledVector(rr, 0.55);
  rooster.rotation.y = heading + 0.9;
  scene.add(rooster);
  const plumage = new THREE.MeshStandardMaterial({ color: 0xa8461e, roughness: 0.8 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x14302a, roughness: 0.4, metalness: 0.3 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd2202a, roughness: 0.6 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8b830, roughness: 0.6 });
  part(rooster, new THREE.SphereGeometry(0.16, 14, 10), plumage, 0, 0.32, 0).scale.set(0.85, 0.9, 1.2);
  const neck = new THREE.Group();
  neck.position.set(0, 0.42, 0.12);
  rooster.add(neck);
  part(neck, new THREE.SphereGeometry(0.075, 12, 8), plumage, 0, 0.1, 0.03);
  part(neck, new THREE.ConeGeometry(0.025, 0.07, 6), yellow, 0, 0.09, 0.12).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) part(neck, new THREE.SphereGeometry(0.024, 6, 4), red, 0, 0.17 + Math.sin(i) * 0.01, 0.06 - i * 0.03);
  part(neck, new THREE.SphereGeometry(0.022, 6, 4), red, 0, 0.04, 0.1).scale.y = 1.6; // wattle
  for (const s of [-1, 1]) part(neck, new THREE.SphereGeometry(0.011, 5, 4), DARK, s * 0.05, 0.12, 0.08);
  for (let i = 0; i < 5; i++) {
    const f = part(rooster, new THREE.TorusGeometry(0.16 - i * 0.015, 0.018, 5, 10, Math.PI * 0.9), tailMat, (i - 2) * 0.03, 0.42, -0.14);
    f.rotation.set(0, Math.PI / 2, -0.3 - i * 0.08);
  }
  for (const s of [-1, 1]) {
    part(rooster, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5), yellow, s * 0.05, 0.1, 0);
    part(rooster, new THREE.BoxGeometry(0.06, 0.012, 0.08), yellow, s * 0.05, 0.006, 0.02);
  }
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.25, 0.2).setTranslation(rooster.position.x, Y + 0.25, rooster.position.z));
  let peck = 3;
  let time = 0;

  const hand = new THREE.Vector3();
  return {
    update(dt) {
      time += dt;
      // The rooster looks around, and pecks at the snow now and then.
      peck -= dt;
      if (peck < -0.5) peck = 2 + Math.random() * 4;
      neck.rotation.x = peck < 0 ? 0.9 : 0;
      neck.rotation.y = Math.sin(time * 0.9) * 0.6;
      for (const s of sippers) {
        s.next -= dt;
        if (s.next <= 0) {
          s.sip = 1.4; // raise the glass
          s.next = 8 + Math.random() * 10;
        }
        s.sip = Math.max(0, s.sip - dt);
        s.npc.character.armOverride[0] = s.sip > 0 ? -2.0 : -0.75;
        s.npc.character.hands[0].getWorldPosition(hand);
        s.cup.position.copy(hand);
      }
    },
  };
}
