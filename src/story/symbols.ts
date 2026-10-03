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
/** Room-local spot on the right-hand wall, a little in from the door. */
const SPOT = { x: 3.42, y: 1.55, z: -2.2 };

function carvingTexture(icon: string, numeral: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '130px serif';
  g.fillText(icon, 128, 100);
  // Turn the emoji into a frosty silhouette, as if carved into the ice.
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(205, 238, 255, 0.92)';
  g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#e8f7ff';
  g.font = 'bold 54px Georgia, serif';
  g.fillText(numeral, 128, 210);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSymbols(story: Story, rooms: THREE.Group[]) {
  const carvings = SYMBOLS.map((s, i) => {
    const mat = new THREE.MeshStandardMaterial({
      map: carvingTexture(s.icon, s.numeral), transparent: true, alphaTest: 0.05,
      emissive: 0x7fc8ff, emissiveIntensity: 0.6, emissiveMap: null, roughness: 0.4,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), mat);
    mesh.position.set(SPOT.x - 0.02, SPOT.y, SPOT.z);
    mesh.rotation.y = -Math.PI / 2; // face into the room
    mesh.visible = false;
    rooms[i].add(mesh);
    const floor = rooms[i].localToWorld(new THREE.Vector3(SPOT.x - 0.9, 0, SPOT.z));
    return { mesh, floor };
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
      const i = carvings.findIndex((c, k) => !story.items.has(SYMBOLS[k].item) && Math.hypot(p.x - c.floor.x, p.z - c.floor.z) < 1.3);
      return i >= 0 ? look(i) : null;
    },
    status(): string | null {
      return noteLeft > 0 ? note : null;
    },
    update(dt: number): void {
      time += dt;
      noteLeft -= dt;
      carvings.forEach((c, i) => {
        c.mesh.visible = story.reached('rooms');
        const found = story.items.has(SYMBOLS[i].item);
        (c.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = found ? 0.35 : 0.5 + Math.sin(time * 2.5 + i) * 0.25;
      });
    },
  };
}
