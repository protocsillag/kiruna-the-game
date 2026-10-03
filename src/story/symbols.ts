import * as THREE from 'three';
import type { Interaction } from '../activities/interaction';
import type { Story } from './state';

/**
 * Chapter 6: one carving hidden in each of the four art rooms, in corridor order. The numeral
 * under each is the headboard bar to press; the King walked the rooms cat first, lotus last.
 */
export const SYMBOLS = [
  { item: 'sym-cat', icon: '🐱', name: "the cat's eyes", numeral: 'II', bar: 2 },
  { item: 'sym-bird', icon: '🐦', name: 'a bird', numeral: 'IV', bar: 4 },
  { item: 'sym-train', icon: '🚋', name: 'the train number', numeral: 'VII', bar: 7 },
  { item: 'sym-lotus', icon: '🪷', name: 'a lotus', numeral: 'VI', bar: 6 },
];
/** Room-local spot: on an ice pedestal just inside the door, to the right, facing you as you enter. */
const SPOT = { x: 2.0, z: -2.4 };
const REACH = 2.2;

function carvingTexture(icon: string, numeral: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  // A dark ice tile with a glowing gold edge: the symbol and numeral read in any room's light.
  g.fillStyle = '#0e1a3a';
  g.beginPath();
  g.roundRect(8, 8, 240, 240, 28);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = '#ffd59a';
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '110px serif';
  g.fillText(icon, 128, 98);
  g.fillStyle = '#ffd59a';
  g.font = 'bold 66px Georgia, serif';
  g.fillText(numeral, 128, 200);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSymbols(story: Story, rooms: THREE.Group[]) {
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xd8f2ff, emissive: 0x4f9fe0, emissiveIntensity: 0.5, roughness: 0.2, transparent: true, opacity: 0.85 });
  const carvings = SYMBOLS.map((s, i) => {
    const mesh = new THREE.Group();
    mesh.position.set(SPOT.x, 0, SPOT.z);
    mesh.rotation.y = Math.PI; // face the door
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), pedestalMat);
    pedestal.position.y = 0.5;
    // The tile turns slowly on top of the pedestal, readable from both sides.
    const plaque = new THREE.Group();
    plaque.position.y = 1.6;
    const face = new THREE.MeshBasicMaterial({ map: carvingTexture(s.icon, s.numeral), transparent: true, toneMapped: false });
    for (const turn of [0, Math.PI]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), face);
      side.rotation.y = turn;
      side.position.z = turn ? -0.01 : 0.01;
      plaque.add(side);
    }
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshBasicMaterial({
      color: 0xffd59a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    plaque.add(halo);
    mesh.add(pedestal, plaque);
    mesh.visible = false;
    rooms[i].add(mesh);
    const floor = rooms[i].localToWorld(new THREE.Vector3(SPOT.x, 0, SPOT.z));
    return { mesh, floor, halo, plaque };
  });
  let time = 0;
  let note = '';
  let noteLeft = 0;

  const look = (i: number): Interaction => ({
    label: 'look at the carving',
    run() {
      const s = SYMBOLS[i];
      story.give(s.item);
      const n = SYMBOLS.filter((x) => story.items.has(x.item)).length;
      note = `Carved in the ice: ${s.name}, and under it ${s.numeral}   (${n} / ${SYMBOLS.length})`;
      noteLeft = 5;
      if (SYMBOLS.every((x) => story.items.has(x.item))) story.advance('rooms');
    },
  });

  return {
    begin(): void {
      carvings.forEach((c) => (c.mesh.visible = story.reached('rooms')));
    },
    interaction(p: THREE.Vector3): Interaction | null {
      if (!story.at('rooms')) return null;
      const i = carvings.findIndex((c, k) => !story.items.has(SYMBOLS[k].item) && Math.hypot(p.x - c.floor.x, p.z - c.floor.z) < REACH);
      return i >= 0 ? look(i) : null;
    },
    status(): string | null {
      return noteLeft > 0 ? note : null;
    },
    /** How many carvings are found (for the objective line). */
    get found(): number {
      return SYMBOLS.filter((x) => story.items.has(x.item)).length;
    },
    /** The nearest carving still to find, for the beacon. */
    target(p: THREE.Vector3): THREE.Vector3 | null {
      if (!story.at('rooms')) return null;
      let best: THREE.Vector3 | null = null;
      carvings.forEach((c, k) => {
        if (story.items.has(SYMBOLS[k].item)) return;
        if (!best || Math.hypot(p.x - c.floor.x, p.z - c.floor.z) < Math.hypot(p.x - best.x, p.z - best.z)) best = c.floor;
      });
      return best;
    },
    update(dt: number): void {
      time += dt;
      noteLeft -= dt;
      carvings.forEach((c, i) => {
        c.mesh.visible = story.reached('rooms');
        const found = story.items.has(SYMBOLS[i].item);
        c.plaque.rotation.y += dt * (found ? 0.3 : 0.8);
        c.plaque.position.y = 1.6 + Math.sin(time * 1.5 + i) * 0.06;
        (c.halo.material as THREE.MeshBasicMaterial).opacity = found ? 0.08 : 0.3 + Math.sin(time * 2.5 + i) * 0.12;
      });
    },
  };
}
