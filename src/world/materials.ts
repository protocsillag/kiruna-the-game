import * as THREE from 'three';

let seed = 3;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Horizontal log/plank cladding: 8 planks per texture tile. */
function plankTexture(base: string, line: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = `rgba(255,255,255,${rand() * 0.07})`;
    g.fillRect(0, y, 64, 32);
    g.fillStyle = line;
    g.fillRect(0, y, 64, 3);
  }
  for (let i = 0; i < 140; i++) {
    g.fillStyle = 'rgba(0,0,0,0.07)';
    g.fillRect(rand() * 64, rand() * 256, 6 + rand() * 22, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const plank = { falu: plankTexture('#8a2b1f', '#4a140e'), dark: plankTexture('#3a2a22', '#1d140f') };
export type Timber = keyof typeof plank;

const PLANK_TILE = 1.76; // metres of wall per texture tile (8 × 0.22 m planks)
const timberCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Timber cladding. `metres` is how many metres one UV unit spans vertically: the wall height for
 * box faces (UV 0..1), or 1 for extruded gables (UV in metres).
 */
export function timber(kind: Timber, metres: number): THREE.MeshStandardMaterial {
  const key = `${kind}:${metres.toFixed(2)}`;
  let m = timberCache.get(key);
  if (!m) {
    const map = plank[kind].clone();
    map.repeat.set(1, metres / PLANK_TILE);
    map.needsUpdate = true;
    m = new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
    timberCache.set(key, m);
  }
  return m;
}

const std = (color: number, roughness = 0.9, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra });

export const MATS = {
  trim: std(0xe9e4da, 0.8),
  snow: std(0xf3f6fb, 0.95),
  roof: std(0x2c2a2e, 0.85),
  door: std(0x2a1d16, 0.8),
  stone: std(0x6b6e74, 0.95),
  foundation: std(0x2e2a28, 1),
  metal: std(0x1d1d20, 0.55, { metalness: 0.6 }),
  wood: std(0x6b4a32, 0.9),
  log: std(0x7a5a3e, 0.95),
  // Warm windows: emissive above 1.0 so they bloom; intensity is raised at night by the camp.
  window: std(0xffc46b, 0.4, { emissive: 0xffa94a, emissiveIntensity: 2 }),
  glass: std(0x9fb8d0, 0.05, { metalness: 0.3, transparent: true, opacity: 0.28, depthWrite: false }),
  glow: std(0xffb066, 1, { emissive: 0xff9d4a, emissiveIntensity: 0.9 }),
};

/** Mesh helper: shadows on, positioned. */
export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
