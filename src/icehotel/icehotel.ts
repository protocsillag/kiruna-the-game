import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { ICEHOTEL } from '../world/terrain';
import { MATS } from '../world/materials';
import { furMaterials, pelt } from '../world/fur';
import { createHall, type Opening } from './hall';
import { ICE, ICE_GLOW, SNOW_RELIEF, glow, iceBlockMaterial, icePillar, part, textMaterial, tintedIce, tintedSnice } from './ice';
import { ROOMS } from './rooms';
import { createBarGuests } from './guests';
import type { Npc, Npcs } from '../npc/npcs';
import type { Player } from '../player/player';
import type { Interaction } from '../activities/interaction';

const X = ICEHOTEL.x;
const F = ICEHOTEL.front; // front door z; the building runs back toward −Z
const Y = ICEHOTEL.y;

// Layout (world coordinates).
const RECEPTION = { x0: X - 7, x1: X + 7, z0: F - 12, z1: F, wallH: 3.8 };
const CORRIDOR = { x0: X - 3, x1: X + 3, z0: F - 60, z1: F - 12, wallH: 3.6 };
const BAR = { x0: X - 8, x1: X + 8, z0: F - 74, z1: F - 60, wallH: 3.8 };
const ROOM_DEPTH = 8;
const ROOM_HALF = 3.5;
const DOOR = { w: 2.2, h: 3.0 };
/** Five rooms off the corridor, alternating sides (−1 = west, +1 = east). */
const ROOM_SLOTS = [
  { side: -1, z: F - 17 },
  { side: 1, z: F - 23 },
  { side: -1, z: F - 29 },
  { side: 1, z: F - 35 },
  { side: -1, z: F - 41 },
];
const COUNTER_Z = F - 69.5;
const DRINK_SECONDS = 120;

type Rect = { x0: number; x1: number; z0: number; z1: number };

/**
 * Give every piece of furniture in `group` a box collider from its measured bounds. Rooms are
 * rotated by exactly ±90°, so world-aligned boxes fit snugly. Flat things (rugs, floor holes) and
 * decorations mounted high on the walls are skipped.
 */
function solidify(world: World, group: THREE.Object3D, floorY: number): void {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  for (const child of group.children) {
    if (child instanceof THREE.Light) continue;
    box.setFromObject(child);
    box.getSize(size);
    box.getCenter(centre);
    if (size.y < 0.15 || box.min.y - floorY > 1.6) continue;
    const h = (v: number) => Math.max(v / 2, 0.05); // flat pieces still get a real thickness
    world.createCollider(RAPIER.ColliderDesc.cuboid(h(size.x), h(size.y), h(size.z)).setTranslation(centre.x, centre.y, centre.z));
  }
}
const inside = (r: Rect, p: THREE.Vector3) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;

/** Areas to keep trees out of (the hotel, its forecourt, and the walk up from the lake). */
export function iceHotelClearings(): { x: number; z: number; r: number }[] {
  const out = [];
  for (let z = F + 22; z > F - 80; z -= 8) out.push({ x: X, z, r: 17 });
  return out;
}

export interface IceHotel {
  bounds: THREE.Box3;
  /** Jimmy on his throne in the Ice Bar. */
  king: Npc;
  /** Linnéa at reception (story mode has her locked out, waiting by the door). */
  receptionist: Npc;
  /** Each art room's group (room-local: door at z = −4, far wall at +4), in ROOMS order. */
  rooms: THREE.Group[];
  /** The front doorway (centre on the floor, opening size), for story mode's lock. */
  door: { at: THREE.Vector3; w: number; h: number };
  interaction(p: THREE.Vector3): Interaction | null;
  status(p: THREE.Vector3): string | null;
  update(dt: number): void;
}

/** ICEHOTEL across the lake: reception, a long corridor of themed art rooms, and the Ice Bar. */
export function createIceHotel(scene: THREE.Scene, world: World, npcs: Npcs, player: Player): IceHotel {
  const blocks = iceBlockMaterial();
  const roomRects: (Rect & { name: string })[] = [];
  const roomGroups: THREE.Group[] = [];

  // --- Halls ---
  createHall(scene, world, Y, {
    ...RECEPTION, axis: 'z', gableMat: { n: blocks },
    openings: [{ side: 'n', at: X, w: 2.6, h: 3.2 }, { side: 's', at: X, w: 3.6, h: 3.4 }],
  });
  const corridorDoors: Opening[] = ROOM_SLOTS.map((r) => ({ side: r.side < 0 ? 'w' : 'e', at: r.z, ...DOOR }));
  createHall(scene, world, Y, { ...CORRIDOR, axis: 'z', gables: false, openings: corridorDoors });
  createHall(scene, world, Y, { ...BAR, axis: 'z', mats: tintedSnice(0x8c7cff, 0.32), openings: [{ side: 'n', at: X, w: 3.6, h: 3.4 }] });

  ROOM_SLOTS.forEach((slot, i) => {
    const near = slot.side < 0 ? CORRIDOR.x0 : CORRIDOR.x1;
    const far = near + slot.side * ROOM_DEPTH;
    const rect = { x0: Math.min(near, far), x1: Math.max(near, far), z0: slot.z - ROOM_HALF, z1: slot.z + ROOM_HALF };
    const room = ROOMS[i];
    createHall(scene, world, Y, {
      ...rect, wallH: 3.4, axis: 'x', mats: tintedSnice(room.color),
      openings: [{ side: slot.side < 0 ? 'e' : 'w', at: slot.z, ...DOOR }],
    });
    // Coloured light strips along the room's floor edges (cheap: emissive + bloom, no lights).
    const strip = glow(room.color, 2.4);
    const cx = (near + far) / 2;
    for (const e of [-1, 1]) part(scene, new THREE.BoxGeometry(ROOM_DEPTH - 0.6, 0.05, 0.1), strip, cx, Y + 0.03, slot.z + e * (ROOM_HALF - 0.32));
    part(scene, new THREE.BoxGeometry(0.1, 0.05, ROOM_HALF * 2 - 0.6), strip, far - slot.side * 0.32, Y + 0.03, slot.z);
    // A glowing ice frame round the doorway on the corridor side, in the room's colour.
    const frameMat = tintedIce(room.color);
    const fx = near - slot.side * 0.3;
    for (const e of [-1, 1]) part(scene, new THREE.BoxGeometry(0.22, DOOR.h + 0.2, 0.32), frameMat, fx, Y + (DOOR.h + 0.2) / 2, slot.z + e * (DOOR.w / 2 + 0.16));
    part(scene, new THREE.BoxGeometry(0.22, 0.24, DOOR.w + 0.64), frameMat, fx, Y + DOOR.h + 0.12, slot.z);
    part(scene, new THREE.BoxGeometry(0.6, 0.04, DOOR.w), glow(room.color, 2.8), near, Y + 0.02, slot.z); // threshold
    roomRects.push({ ...rect, name: room.name });
    const g = new THREE.Group();
    g.position.set((near + far) / 2, Y, slot.z);
    g.rotation.y = slot.side < 0 ? -Math.PI / 2 : Math.PI / 2; // local +Z points from the door into the room
    scene.add(g);
    room.build(g);
    roomGroups.push(g);
    solidify(world, g, Y);
    // Room name on an ice plaque above the corridor doorway.
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), textMaterial(room.name.toUpperCase(), '#d9f1ff', { glowing: true }));
    plaque.position.set(near - slot.side * 0.42, Y + DOOR.h + 0.5, slot.z);
    plaque.rotation.y = slot.side < 0 ? Math.PI / 2 : -Math.PI / 2; // face into the corridor
    scene.add(plaque);
  });

  const deco = new THREE.Group();
  deco.position.y = Y;
  scene.add(deco);
  const pillar = (x: number, z: number, h: number, size = 0.7) => {
    icePillar(deco, x, z, h, size);
    world.createCollider(RAPIER.ColliderDesc.cuboid(size / 2, h / 2, size / 2).setTranslation(x, Y + h / 2, z));
  };

  // --- Reception: ice pillars, chandelier, desk, fur bench ---
  for (const px of [-3.2, 3.2]) for (const pz of [-4, -8.5]) pillar(X + px, F + pz, RECEPTION.wallH);
  const chandelier = new THREE.Group();
  chandelier.position.set(X, 6.3, F - 6.2);
  deco.add(chandelier);
  for (let ring = 0; ring < 3; ring++) {
    const rr = 0.9 - ring * 0.25;
    for (let i = 0; i < 14 - ring * 3; i++) {
      const a = (i / (14 - ring * 3)) * Math.PI * 2;
      part(chandelier, new THREE.OctahedronGeometry(0.09), ICE_GLOW, Math.cos(a) * rr, -ring * 0.35, Math.sin(a) * rr).scale.y = 2.2;
    }
  }
  part(chandelier, new THREE.CylinderGeometry(0.01, 0.01, 2.6), MATS.metal, 0, 1.3, 0);
  const lobbyLight = new THREE.PointLight(0xcfe9ff, 22, 20, 2);
  lobbyLight.position.set(X, Y + 3.2, F - 6.2);
  scene.add(lobbyLight);
  part(deco, new THREE.BoxGeometry(0.9, 1.1, 3.2), ICE_GLOW, X + 4.6, 0.55, F - 6.2); // desk front
  part(deco, new THREE.BoxGeometry(1.1, 0.1, 3.4), ICE, X + 4.6, 1.15, F - 6.2); // desk top
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.55, 0.6, 1.7).setTranslation(X + 4.6, Y + 0.6, F - 6.2));
  part(deco, new THREE.BoxGeometry(0.9, 0.45, 3.2), ICE, X - 6.0, 0.22, F - 6.2); // bench
  // Centrepiece: a life-size reindeer carved from clear ice, on a glowing plinth.
  const deer = new THREE.Group();
  deer.position.set(X - 3.2, 0, F - 6.2);
  deer.rotation.y = 0.6;
  deco.add(deer);
  part(deer, new THREE.CylinderGeometry(0.9, 1.0, 0.35, 24), ICE_GLOW, 0, 0.17, 0);
  part(deer, new THREE.SphereGeometry(0.5, 18, 12), ICE, 0, 1.45, 0).scale.set(0.75, 0.75, 1.5);
  part(deer, new THREE.CylinderGeometry(0.16, 0.22, 0.75, 10), ICE, 0, 1.9, 0.62).rotation.x = -0.6; // neck
  const head = part(deer, new THREE.SphereGeometry(0.22, 14, 10), ICE, 0, 2.3, 0.88);
  head.scale.set(0.8, 0.8, 1.35);
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.5, 0.5]) part(deer, new THREE.CylinderGeometry(0.06, 0.05, 1.0, 8), ICE, sx, 0.85, sz);
  for (const s of [-1, 1]) {
    const antler = new THREE.Group();
    antler.position.set(s * 0.1, 2.45, 0.8);
    antler.rotation.set(-0.3, 0, s * 0.5);
    deer.add(antler);
    part(antler, new THREE.CylinderGeometry(0.025, 0.035, 0.7, 6), ICE_GLOW, 0, 0.35, 0);
    for (const [h, a] of [[0.25, 0.8], [0.45, -0.7], [0.6, 0.6]]) {
      const tine = part(antler, new THREE.CylinderGeometry(0.018, 0.025, 0.32, 6), ICE_GLOW, 0, h, 0.08);
      tine.rotation.x = a;
      tine.position.z += Math.sin(a) * 0.12;
    }
  }
  world.createCollider(RAPIER.ColliderDesc.cylinder(1.2, 1.0).setTranslation(X - 3.2, Y + 1.2, F - 6.2));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.45, 0.3, 1.6).setTranslation(X - 6.0, Y + 0.3, F - 6.2));
  const benchFur = pelt(furMaterials()[1], 0.45, 1.5);
  benchFur.position.set(X - 6.0, Y + 0.5, F - 6.2);
  scene.add(benchFur);
  const receptionist = npcs.add({
    name: 'Linnéa', at: new THREE.Vector3(X + 5.6, Y, F - 6.2), heading: -Math.PI / 2, solid: true,
    line: 'Welcome to the ICEHOTEL! Our art rooms are along the corridor, and the Ice Bar is at the very end. Everything here is made of ice from the river.',
    look: { jacket: 0x1d2a44, hat: 0xe9e4da, scarf: 0x9fc6e6 }, talkFrom: new THREE.Vector3(X + 3.4, Y, F - 6.2), talkRadius: 1.8,
  });

  // --- Corridor: ice pillars along both walls and glowing floor strips ---
  const doorZs = ROOM_SLOTS.map((r) => ({ side: r.side, z: r.z }));
  for (let z = F - 14; z > F - 59; z -= 3.5) {
    for (const side of [-1, 1]) {
      if (doorZs.some((d) => d.side === side && Math.abs(d.z - z) < 2)) continue;
      pillar(X + side * 2.3, z, CORRIDOR.wallH, 0.55);
    }
  }
  for (const side of [-1, 1]) part(deco, new THREE.BoxGeometry(0.12, 0.06, 47), glow(0x7fd2ff, 2.2), X + side * 2.6, 0.03, (CORRIDOR.z0 + CORRIDOR.z1) / 2);
  // Snow-relief swirls carved into the corridor walls between the doors.
  for (let z = F - 20; z > F - 58; z -= 6) {
    for (const side of [-1, 1]) {
      if (doorZs.some((d) => d.side === side && Math.abs(d.z - z) < 2.6)) continue;
      const swirl = part(deco, new THREE.TorusGeometry(0.55, 0.07, 8, 32, Math.PI * 1.6), SNOW_RELIEF, X + side * 2.72, 2.2, z);
      swirl.rotation.set(0, Math.PI / 2, z * 0.7);
      part(deco, new THREE.SphereGeometry(0.12, 12, 8), glow(0x9fe6ff, 1.4), X + side * 2.7, 2.2, z);
    }
  }

  // --- Ice Bar: counter, shelves of bottles, ice stools, chandelier, bartender ---
  part(deco, new THREE.BoxGeometry(8, 1.1, 0.8), glow(0x8fa8ff, 1.4), X - 1, 0.55, COUNTER_Z);
  part(deco, new THREE.BoxGeometry(8.4, 0.12, 1.0), ICE, X - 1, 1.16, COUNTER_Z);
  world.createCollider(RAPIER.ColliderDesc.cuboid(4.2, 0.6, 0.5).setTranslation(X - 1, Y + 0.6, COUNTER_Z));
  for (const h of [0.9, 1.6, 2.3]) part(deco, new THREE.BoxGeometry(8, 0.08, 0.45), ICE, X - 1, h, F - 73.3);
  world.createCollider(RAPIER.ColliderDesc.cuboid(4, 1.25, 0.25).setTranslation(X - 1, Y + 1.25, F - 73.3));
  const bottleColors = [0x2d6b3a, 0x8a2a22, 0xd8c060, 0x3a4d8a, 0xeaeaea, 0x6b3a8a];
  for (let i = 0; i < 30; i++) {
    const h = [0.9, 1.6, 2.3][i % 3];
    part(deco, new THREE.CylinderGeometry(0.05, 0.05, 0.32, 8), glow(bottleColors[i % 6], 0.35), X - 4.6 + (i % 10) * 0.8, h + 0.2, F - 73.3);
  }
  for (let i = 0; i < 6; i++) {
    const sx = X - 4.4 + i * 1.35;
    part(deco, new THREE.BoxGeometry(0.5, 0.6, 0.5), ICE, sx, 0.3, COUNTER_Z + 1.5);
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.25, 0.3, 0.25).setTranslation(sx, Y + 0.3, COUNTER_Z + 1.5));
  }
  for (const tx of [X - 5, X + 5]) {
    part(deco, new THREE.CylinderGeometry(0.6, 0.5, 0.95, 16), ICE, tx, 0.48, F - 63.5);
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.48, 0.6).setTranslation(tx, Y + 0.48, F - 63.5));
  }
  const barLight = new THREE.PointLight(0xa8b8ff, 22, 20, 2);
  barLight.position.set(X, Y + 3.3, F - 67);
  scene.add(barLight);
  const barSign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.8), textMaterial('ICEBAR', '#e6f4ff', { glowing: true }));
  barSign.position.set(X - 1, Y + 3.0, F - 73.5);
  scene.add(barSign);
  const bartender = npcs.add({
    name: 'Oskar', at: new THREE.Vector3(X - 1, Y, F - 71.6), heading: 0, solid: true, talkRadius: 0,
    line: 'Skål! One blueberry vodka, served in a glass made of ice.',
    look: { jacket: 0x1c1c22, hat: null, hair: 0x6b4a2b, scarf: 0xe9e4da },
  });

  // --- Outside: arched snow frame, fur door, fire baskets, candles, illuminated sign ---
  const frame = new THREE.Shape();
  frame.moveTo(-8.2, 0);
  frame.lineTo(-8.2, RECEPTION.wallH);
  frame.absarc(0, RECEPTION.wallH, 8.2, Math.PI, 0, true);
  frame.lineTo(8.2, 0);
  const frameHole = new THREE.Path();
  frameHole.moveTo(-6.9, 0);
  frameHole.lineTo(6.9, 0);
  frameHole.lineTo(6.9, RECEPTION.wallH);
  frameHole.absarc(0, RECEPTION.wallH, 6.9, 0, Math.PI, false);
  frameHole.lineTo(-6.9, 0);
  frame.holes.push(frameHole);
  part(deco, new THREE.ExtrudeGeometry(frame, { depth: 1.2, bevelEnabled: false, curveSegments: 28 }), SNOW_RELIEF, X, -0.1, F - 0.2);
  const furDoor = part(deco, new THREE.BoxGeometry(1.3, 3.1, 0.08), furMaterials()[0], X + 1.3 + 0.65 * Math.cos(1.2), 1.55, F + 0.65 * Math.sin(1.2));
  furDoor.rotation.y = -1.2;
  const flames: THREE.Mesh[] = [];
  const flameMat = glow(0xff8a2a, 3.5);
  for (const s of [-1, 1]) {
    const bx = X + s * 2.4;
    const bz = F + 1.6;
    part(deco, new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), MATS.metal, bx, 0.55, bz);
    part(deco, new THREE.CylinderGeometry(0.28, 0.18, 0.35, 10, 1, true), MATS.metal, bx, 1.25, bz);
    const f = part(deco, new THREE.ConeGeometry(0.22, 0.6, 7), flameMat, bx, 1.6, bz);
    f.castShadow = false;
    flames.push(f);
  }
  for (let i = 0; i < 12; i++) {
    const a = -1.2 + (i / 11) * 2.4;
    const cx = X + Math.sin(a) * 6.5;
    const cz = F + 4 + Math.cos(a) * 2.2 + (i % 2) * 0.8;
    part(deco, new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), MATS.trim, cx, 0.06, cz);
    part(deco, new THREE.SphereGeometry(0.035, 6, 4), glow(0xffb050, 4), cx, 0.16, cz).castShadow = false;
  }
  part(deco, new THREE.BoxGeometry(4.4, 1.3, 0.9), SNOW_RELIEF, X + 8.5, 0.65, F + 3.5);
  world.createCollider(RAPIER.ColliderDesc.cuboid(2.2, 0.65, 0.45).setTranslation(X + 8.5, Y + 0.65, F + 3.5));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.75), textMaterial('ICEHOTEL', '#ffffff', { glowing: true }));
  sign.position.set(X + 8.5, Y + 0.7, F + 3.96);
  scene.add(sign);

  // --- Drinks at the bar ---
  const cup = new THREE.Group();
  part(cup, new THREE.BoxGeometry(0.09, 0.12, 0.09), ICE, 0, 0, 0);
  part(cup, new THREE.BoxGeometry(0.06, 0.07, 0.06), glow(0x6a3fd0, 0.6), 0, -0.01, 0);
  cup.visible = false;
  scene.add(cup);
  let drinkLeft = 0;
  let finishedUntil = 0;
  let time = 0;
  const order: Interaction = {
    label: 'order a drink',
    run() {
      drinkLeft = DRINK_SECONDS;
      npcs.say(bartender);
    },
  };

  const guests = createBarGuests(scene, world, npcs, { x: X, front: F, y: Y, counterZ: COUNTER_Z });

  const bounds = new THREE.Box3(new THREE.Vector3(X - 11.5, Y - 1, F - 74.5), new THREE.Vector3(X + 11.5, Y + 12, F + 0.5));
  return {
    bounds,
    king: guests.king,
    receptionist,
    rooms: roomGroups,
    door: { at: new THREE.Vector3(X, Y, F), w: 2.6, h: 3.2 },
    interaction(p) {
      if (player.locked || !inside(BAR, p)) return null;
      return Math.abs(p.z - (COUNTER_Z + 0.9)) < 1.0 && Math.abs(p.x - (X - 1)) < 4.2 ? order : null;
    },
    status(p) {
      if (time < finishedUntil) return 'You finished your drink.';
      const room = roomRects.find((r) => inside(r, p));
      if (room) return `ICEHOTEL  ·  ${room.name}`;
      if (inside(BAR, p)) return drinkLeft > 0 ? 'ICEHOTEL  ·  Ice Bar  ·  sipping from a glass of ice' : 'ICEHOTEL  ·  Ice Bar';
      if (inside(RECEPTION, p)) return 'ICEHOTEL  ·  Reception';
      if (inside(CORRIDOR, p)) return 'ICEHOTEL';
      return null;
    },
    update(dt) {
      time += dt;
      guests.update(dt);
      flames.forEach((f, i) => (f.scale.y = 0.85 + Math.sin(time * (11 + i * 3)) * 0.15));
      if (drinkLeft > 0) {
        drinkLeft -= dt;
        if (drinkLeft <= 0) finishedUntil = time + 3;
      }
      cup.visible = drinkLeft > 0;
      if (cup.visible) player.character.hands[1].getWorldPosition(cup.position).y += 0.06;
    },
  };
}
