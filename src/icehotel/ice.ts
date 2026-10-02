import * as THREE from 'three';
import { furMaterials, pelt } from '../world/fur';

/** Clear, faintly glowing ice. */
export const ICE = new THREE.MeshStandardMaterial({
  color: 0xa9dcf2, emissive: 0x4fa8d8, emissiveIntensity: 0.45, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.8,
});
/** Ice lit from within (counter fronts, lamp shades): bright enough to bloom. */
export const ICE_GLOW = new THREE.MeshStandardMaterial({
  color: 0xbfe8ff, emissive: 0x7cc8ff, emissiveIntensity: 1.6, roughness: 0.1, transparent: true, opacity: 0.85,
});
/** Snow-and-ice ("snice") walls and vaults, softly lit so interiors never go flat black. */
export const SNICE = new THREE.MeshStandardMaterial({
  color: 0xeef3f8, emissive: 0x9fc6e6, emissiveIntensity: 0.14, roughness: 1, side: THREE.DoubleSide,
});
/** Same snice for solid wall blocks: one-sided, so their undersides don't z-fight with the floor. */
export const SNICE_SOLID = SNICE.clone();
SNICE_SOLID.side = THREE.FrontSide;
export const SNOW_RELIEF = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, emissive: 0xb8d4ec, emissiveIntensity: 0.18, roughness: 1 });
export const DARK = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9 });
export const WHITE = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.9 });

export const glow = (color: number, intensity = 2) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 });

/** Glowing wall of stacked ice blocks (the facade of the entrance arch). */
export function iceBlockMaterial(): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#cfe9f7';
  g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 32 : 0;
    for (let col = -1; col < 5; col++) {
      const x = col * 64 + off;
      const y = row * 32;
      const grad = g.createLinearGradient(x, y, x + 64, y + 32);
      grad.addColorStop(0, '#e9f7ff');
      grad.addColorStop(1, '#a8d6ee');
      g.fillStyle = grad;
      g.fillRect(x + 2, y + 2, 60, 28);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0x6fb8e8, emissiveIntensity: 1.1, roughness: 0.2, side: THREE.DoubleSide,
  });
}

/** Text drawn on a transparent canvas; `glowing` makes it emissive (bloom). */
export function textMaterial(text: string, color: string, opts: { w?: number; glowing?: boolean } = {}): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas');
  c.width = opts.w ?? 1024;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let px = 130;
  do g.font = `600 ${(px -= 4)}px "Helvetica Neue", Arial, sans-serif`;
  while (g.measureText(text).width > c.width - 60 && px > 24);
  g.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: tex, transparent: true, alphaTest: 0.2, roughness: 0.8,
    ...(opts.glowing ? { emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.8 } : {}),
  });
}

/** Mesh with shadows, positioned. */
export function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A column of stacked ice blocks, slightly uneven like the real ones. */
export function icePillar(parent: THREE.Object3D, x: number, z: number, h: number, size = 0.7): void {
  const n = Math.round(h / 0.6);
  for (let i = 0; i < n; i++) {
    const s = size * (0.94 + ((i * 37) % 7) / 60);
    part(parent, new THREE.BoxGeometry(s, h / n - 0.02, s), ICE, x, (i + 0.5) * (h / n), z);
  }
}

/** Ice bed: an ice block base, black mattress, reindeer fur, white pillows at the head (+Z). */
export function iceBed(parent: THREE.Object3D, x: number, z: number, w = 1.8, d = 2.1, base = true): void {
  if (base) part(parent, new THREE.BoxGeometry(w, 0.5, d), ICE, x, 0.25, z);
  part(parent, new THREE.BoxGeometry(w - 0.05, 0.18, d - 0.05), DARK, x, 0.59, z);
  const fur = pelt(furMaterials()[0], w * 0.42, d * 0.42);
  fur.position.set(x, 0.7, z - 0.1);
  parent.add(fur);
  for (const s of [-1, 1]) part(parent, new THREE.BoxGeometry(w * 0.38, 0.14, 0.42), WHITE, x + (s * w) / 4, 0.75, z + d / 2 - 0.3);
}
