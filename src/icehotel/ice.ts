import * as THREE from 'three';
import { furMaterials, pelt } from '../world/fur';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

/** Frosted ice: faint cracks and air bubbles on a near-white base (multiplies the ice colour). */
function frostTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  let seed = 17;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const grad = g.createRadialGradient(rand() * 256, rand() * 256, 0, rand() * 256, rand() * 256, 40 + rand() * 60);
    grad.addColorStop(0, 'rgba(200,230,250,0.35)');
    grad.addColorStop(1, 'rgba(200,230,250,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  g.strokeStyle = 'rgba(150,200,235,0.55)';
  for (let i = 0; i < 18; i++) {
    let x = rand() * 256;
    let y = rand() * 256;
    let dir = rand() * Math.PI * 2;
    g.lineWidth = 0.5 + rand();
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 10; k++) {
      dir += (rand() - 0.5) * 1.1;
      x += Math.cos(dir) * 10;
      y += Math.sin(dir) * 10;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${0.4 + rand() * 0.5})`;
    g.beginPath();
    g.arc(rand() * 256, rand() * 256, 0.6 + rand() * 1.8, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft, blotchy snow ("snice") so walls and vaults aren't a flat grey. */
function sniceTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  g.fillStyle = '#f2f6fa';
  g.fillRect(0, 0, 256, 256);
  let seed = 5;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 120; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 6 + rand() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = rand() < 0.5 ? '210,224,238' : '255,255,255';
    grad.addColorStop(0, `rgba(${tone},${0.25 + rand() * 0.35})`);
    grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Carved ice: translucent, frosted, with edges that glow where you see the surface edge-on
 * (a fresnel rim, the way real ice sculptures catch light). depthWrite is off so one piece of
 * ice never hides another (that was what made pieces vanish); the rim term is clamped so it can
 * never go NaN (pow of a negative base blew up bloom before).
 */
function carvedIce(opts: { color: number; glow: number; glowIntensity: number; rim: number; rimIntensity: number; opacity: number }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: opts.color, map: frost, emissive: opts.glow, emissiveIntensity: opts.glowIntensity,
    roughness: 0.06, metalness: 0.05, transparent: true, opacity: opts.opacity, depthWrite: false,
  });
  const rim = new THREE.Color(opts.rim).multiplyScalar(opts.rimIntensity);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: rim };
    shader.fragmentShader = 'uniform vec3 uRim;\n' + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float facing = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
      totalEmissiveRadiance += uRim * pow(1.0 - facing, 2.5);`,
    );
  };
  return m;
}

const frost = frostTexture();
const snice = sniceTexture();

/** Clear carved ice for sculptures, pillars, furniture. */
export const ICE = carvedIce({ color: 0xd8f2ff, glow: 0x2f8fd0, glowIntensity: 0.35, rim: 0x9fe6ff, rimIntensity: 1.6, opacity: 0.6 });
/** Ice lit from within (counter fronts, lamp shades): bright enough to bloom. */
export const ICE_GLOW = carvedIce({ color: 0xe6f7ff, glow: 0x7cc8ff, glowIntensity: 1.5, rim: 0xd8f6ff, rimIntensity: 2.0, opacity: 0.85 });
/** Carved ice in a room's colour (door frames, accents). */
export const tintedIce = (color: number) =>
  carvedIce({ color: 0xffffff, glow: color, glowIntensity: 1.2, rim: color, rimIntensity: 2.2, opacity: 0.75 });

/** Snow-and-ice ("snice") for vaults and arched end walls: two-sided, softly lit. */
export const SNICE = new THREE.MeshStandardMaterial({
  map: snice, emissiveMap: snice, color: 0xeef3f8, emissive: 0x9fc6e6, emissiveIntensity: 0.16, roughness: 1, side: THREE.DoubleSide,
});
/** Same snice for solid wall blocks: one-sided, so their undersides don't z-fight with the floor. */
export const SNICE_SOLID = SNICE.clone();
SNICE_SOLID.side = THREE.FrontSide;

/** Outer snow shell for tinted halls: plain and snowy from outside, whatever the colour inside. */
export const SNOW_SHELL = SNICE_SOLID.clone();
SNOW_SHELL.emissiveIntensity = 0.08;
SNOW_SHELL.color = new THREE.Color(0xf4f7fb);
export const SNOW_SHELL_BACK = SNOW_SHELL.clone();
SNOW_SHELL_BACK.side = THREE.BackSide;

/** Snice washed in a room's coloured light, as a [two-sided, one-sided] pair for vaults and walls. */
export function tintedSnice(color: number, intensity = 0.42): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] {
  const surface = SNICE.clone();
  surface.emissive = new THREE.Color(color);
  surface.emissiveIntensity = intensity;
  surface.color = new THREE.Color(0xeef3f8).lerp(new THREE.Color(color), 0.25);
  const solid = surface.clone();
  solid.side = THREE.FrontSide;
  return [surface, solid];
}
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
  // Gable UVs are in metres: one tile per 4 m gives ~1 × 0.5 m blocks (1 m tiles shimmered as a fine checker).
  tex.repeat.set(0.25, 0.25);
  tex.anisotropy = 8;
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
    map: tex, alphaTest: 0.2, roughness: 0.8, // cut-out letters: no transparency sorting needed
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
