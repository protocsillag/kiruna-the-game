import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { ICE_Y } from '../world/terrain';
import { MATS, mesh } from '../world/materials';
import { createCampfire } from '../world/campfire';
import { furMaterials, pelt } from '../world/fur';
import type { Npcs } from '../npc/npcs';
import type { Character } from '../player/character';
import type { Player } from '../player/player';
import type { Interaction } from './interaction';

const LINE = 'No catches today, maybe we should not have put fire on the lake';
const SEAT = ICE_Y + 0.07; // top of a fur on the ice
const UPDATES = [
  'Waiting for a bite…',
  'The line twitches… just the wind.',
  'Nothing yet. Boti blames the fire.',
  'Still nothing. Alex offers you a sausage instead.',
  'A fish looked at the bait. And left.',
];

/**
 * Ice fishing a few metres from the sauna: a hole, a campfire on the ice, Alex and Boti on
 * reindeer furs with rods, and a free fur where the player can join them (nobody ever catches).
 */
export function createIceFishing(scene: THREE.Scene, world: World, npcs: Npcs, player: Player, centre: THREE.Vector3) {
  const local = (lx: number, lz: number, y = ICE_Y) => new THREE.Vector3(centre.x + lx, y, centre.z + lz);
  const hole = local(0, 0);

  // The hole: dark water, a snowy rim, a few ice chips, and a red bucket.
  const water = mesh(new THREE.CircleGeometry(0.25, 20), new THREE.MeshStandardMaterial({ color: 0x0a1824, roughness: 0.06, polygonOffset: true, polygonOffsetFactor: -2 }), hole.x, ICE_Y + 0.006, hole.z);
  water.rotation.x = -Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(0.36, 0.09, 6, 20), MATS.snow, hole.x, ICE_Y + 0.02, hole.z);
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 0.4;
  scene.add(water, rim);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    const chip = mesh(new THREE.BoxGeometry(0.12, 0.05, 0.09), new THREE.MeshStandardMaterial({ color: 0xcfe0ee, roughness: 0.3 }), hole.x + Math.cos(a) * 0.6, ICE_Y + 0.03, hole.z + Math.sin(a) * 0.6);
    chip.rotation.y = a;
    scene.add(chip);
  }
  scene.add(mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.26, 12), new THREE.MeshStandardMaterial({ color: 0xc8322a, roughness: 0.6 }), centre.x + 1.75, ICE_Y + 0.13, centre.z + 0.4));

  const fire = createCampfire(scene, world, local(-2.5, -1.0));

  // Three furs around the hole: Alex, Boti, and a free one for the player.
  const furs = furMaterials();
  const spots = [local(-1.0, 0.9), local(1.0, 0.9), local(0.15, -1.25)];
  spots.forEach((s, i) => {
    const f = pelt(furs[i % 2], 0.55, 0.42);
    f.position.set(s.x, ICE_Y + 0.03, s.z);
    f.rotation.y = i * 0.7;
    scene.add(f);
  });
  const facing = (s: THREE.Vector3) => Math.atan2(hole.x - s.x, hole.z - s.z);
  const seatRoot = (s: THREE.Vector3) => new THREE.Vector3(s.x, SEAT + 0.12 - 0.9, s.z);
  const fishers = [
    { name: 'Alex', look: { jacket: 0x2f6fa8, hat: 0xe0a83a, scarf: 0x3a3a3a } },
    { name: 'Boti', look: { jacket: 0x5a5f66, hat: 0x2d5a3a, scarf: 0xb8322a } },
  ].map((f, i) => {
    const s = spots[i];
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.35, 0.4).setTranslation(s.x, ICE_Y + 0.35, s.z));
    return npcs.add({ ...f, line: LINE, at: seatRoot(s), heading: facing(s), pose: 'sit', talkFrom: s, talkRadius: 1.9 }).character;
  });

  // Rods: placed each frame from the hand toward the hole, with a line down into the water.
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.5 });
  const rodGeo = new THREE.CylinderGeometry(0.008, 0.014, 0.55, 5).translate(0, 0.275, 0);
  const rods = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(rodGeo, rodMat);
    r.castShadow = true;
    scene.add(r);
    return r;
  });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 2 * 3), 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xdadde4, transparent: true, opacity: 0.7 }));
  lines.frustumCulled = false;
  scene.add(lines);
  const up = new THREE.Vector3(0, 1, 0);
  const base = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const aim = hole.clone().setY(ICE_Y + 0.35);
  const placeRod = (i: number, c: Character | null) => {
    const r = rods[i];
    r.visible = !!c;
    const pos = lineGeo.attributes.position as THREE.BufferAttribute;
    if (!c) {
      pos.setXYZ(i * 2, 0, -100, 0);
      pos.setXYZ(i * 2 + 1, 0, -100, 0);
      return;
    }
    c.hands[0].getWorldPosition(base);
    const dir = aim.clone().sub(base).normalize();
    r.position.copy(base);
    r.quaternion.setFromUnitVectors(up, dir);
    tip.copy(base).addScaledVector(dir, 0.55);
    pos.setXYZ(i * 2, tip.x, tip.y, tip.z);
    pos.setXYZ(i * 2 + 1, hole.x, ICE_Y, hole.z);
  };

  let fishing = false;
  let time = 0;
  const spot = spots[2];
  const leave: Interaction = {
    label: 'stop fishing',
    run() {
      fishing = false;
      player.character.armOverride[0] = null;
      player.unlock(local(0.15, -2.2));
    },
  };
  const join: Interaction = {
    label: 'try ice fishing',
    run() {
      fishing = true;
      time = 0;
      player.lock(seatRoot(spot), facing(spot), 'sit');
    },
  };

  return {
    interaction(p: THREE.Vector3): Interaction | null {
      if (fishing) return leave;
      if (player.locked) return null;
      return Math.hypot(p.x - spot.x, p.z - spot.z) < 0.9 ? join : null;
    },
    status: () => (fishing ? `Ice fishing  ·  ${UPDATES[Math.floor(time / 6) % UPDATES.length]}` : null),
    update(dt: number, tint: THREE.Color) {
      time += dt;
      fire.update(dt, tint);
      // A little jig now and then.
      fishers.forEach((c, i) => (c.armOverride[0] = -0.85 + Math.max(0, Math.sin(time * 2.4 + i * 2)) * 0.12));
      if (fishing) player.character.armOverride[0] = -0.85 + Math.max(0, Math.sin(time * 2.1)) * 0.12;
      placeRod(0, fishers[0]);
      placeRod(1, fishers[1]);
      placeRod(2, fishing ? player.character : null);
      lineGeo.attributes.position.needsUpdate = true;
    },
  };
}
