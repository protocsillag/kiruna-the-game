import * as THREE from 'three';
import type { Palette } from './palette';

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunDir;
uniform float uGlowStrength;
uniform float uClouds;
uniform float uTime;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += noise(p) * a; p *= 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));

  // Low sun: glow hugging the horizon in the sun's direction.
  float toward = dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz + 1e-5)) * 0.5 + 0.5;
  float hp = max(h, 0.0);
  float glow = pow(toward, 3.0) * exp(-hp * 9.0) + pow(toward, 1.5) * exp(-hp * 3.0) * 0.35;
  glow += pow(toward, 8.0) * exp(-abs(h) * 40.0) * 0.6;
  col += uGlow * glow * uGlowStrength;

  // Grey-lilac cloud layer, lit pink from underneath toward the sun.
  if (uClouds > 0.001 && h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(uTime * 0.004, uTime * 0.002);
    float c = smoothstep(0.42, 0.78, fbm(uv)) * smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.55, 0.95, h));
    vec3 cloud = mix(uHorizon * 0.8, uZenith * 1.05, 0.5) + uGlow * pow(toward, 2.0) * 0.35 * uGlowStrength;
    col = mix(col, cloud, c * uClouds);
  }

  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0; // dither against banding
  gl_FragColor = vec4(col, 1.0);
}`;

export interface SkyDome {
  mesh: THREE.Mesh;
  update(camera: THREE.Vector3, p: Palette, sunDir: THREE.Vector3, time: number): void;
}

export function createSkyDome(): SkyDome {
  const uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3() },
    uGlowStrength: { value: 0 },
    uClouds: { value: 0 },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1200, 48, 24), mat);
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;

  return {
    mesh,
    update(camera, p, sunDir, time) {
      mesh.position.copy(camera);
      uniforms.uZenith.value.copy(p.zenith);
      uniforms.uHorizon.value.copy(p.horizon);
      uniforms.uGlow.value.copy(p.glow);
      uniforms.uSunDir.value.copy(sunDir);
      uniforms.uGlowStrength.value = p.glowStrength;
      uniforms.uClouds.value = p.clouds;
      uniforms.uTime.value = time;
    },
  };
}
