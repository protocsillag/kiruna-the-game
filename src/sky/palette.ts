import * as THREE from 'three';

/** Everything that changes with the light, sampled from the sun's elevation. */
export interface Palette {
  zenith: THREE.Color;
  horizon: THREE.Color;
  glow: THREE.Color;
  glowStrength: number;
  clouds: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  key: number;
  stars: number;
  aurora: number;
  fog: THREE.Color;
  fogNear: number;
  fogFar: number;
  exposure: number;
  bloom: number;
}

type ColorKey = 'zenith' | 'horizon' | 'glow' | 'hemiSky' | 'hemiGround';
type NumKey = Exclude<keyof Palette, ColorKey | 'fog'>;
type Key = { elev: number } & Record<ColorKey, number> & Record<NumKey, number>;

// January polar light: a short pink-orange midday band, long blue hours, then night.
const KEYS: Key[] = [
  { elev: 1, zenith: 0x7b86ad, horizon: 0xd8b9bf, glow: 0xff9466, glowStrength: 1.1, clouds: 0.55,
    hemiSky: 0xd2d4ea, hemiGround: 0x6d7290, hemiIntensity: 1.5, key: 1.3, stars: 0, aurora: 0,
    fogNear: 60, fogFar: 520, exposure: 0.85, bloom: 0.25 },
  { elev: -4, zenith: 0x405a92, horizon: 0xa597bd, glow: 0xff7f6a, glowStrength: 0.6, clouds: 0.4,
    hemiSky: 0x94a8da, hemiGround: 0x3e4870, hemiIntensity: 1.25, key: 0.45, stars: 0, aurora: 0,
    fogNear: 70, fogFar: 540, exposure: 0.95, bloom: 0.35 },
  { elev: -9, zenith: 0x1d2c5a, horizon: 0x4b5f97, glow: 0x7a6fb0, glowStrength: 0.2, clouds: 0.15,
    hemiSky: 0x6e86c8, hemiGround: 0x293356, hemiIntensity: 1.0, key: 0.3, stars: 0.45, aurora: 0.35,
    fogNear: 80, fogFar: 600, exposure: 1.05, bloom: 0.6 },
  { elev: -14, zenith: 0x050816, horizon: 0x15214a, glow: 0x000000, glowStrength: 0, clouds: 0,
    hemiSky: 0x4a5d96, hemiGround: 0x1b2244, hemiIntensity: 0.8, key: 0.35, stars: 1, aurora: 1,
    fogNear: 90, fogFar: 650, exposure: 1.15, bloom: 0.85 },
];

const COLOR_KEYS: ColorKey[] = ['zenith', 'horizon', 'glow', 'hemiSky', 'hemiGround'];
const NUM_KEYS: NumKey[] = [
  'glowStrength', 'clouds', 'hemiIntensity', 'key', 'stars', 'aurora',
  'fogNear', 'fogFar', 'exposure', 'bloom',
];

// Pre-convert key colours once (hex is sRGB; THREE.Color stores linear).
const colors = KEYS.map((k) => Object.fromEntries(COLOR_KEYS.map((c) => [c, new THREE.Color(k[c])])));

const out = {
  zenith: new THREE.Color(), horizon: new THREE.Color(), glow: new THREE.Color(),
  hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), fog: new THREE.Color(),
} as Palette;

/** Interpolates the palette for a sun elevation in degrees. Returns a shared object. */
export function samplePalette(elev: number): Palette {
  let i = 0;
  while (i < KEYS.length - 2 && elev < KEYS[i + 1].elev) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((a.elev - elev) / (a.elev - b.elev), 0, 1);
  for (const c of COLOR_KEYS) out[c].lerpColors(colors[i][c], colors[i + 1][c], t);
  for (const n of NUM_KEYS) out[n] = THREE.MathUtils.lerp(a[n], b[n], t);
  out.fog.copy(out.horizon).multiplyScalar(0.92);
  return out;
}
