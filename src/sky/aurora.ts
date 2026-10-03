import * as THREE from 'three';

/** Curtain placement relative to the camera. Positive offset = north (+Z), negative = over the lake. */
const RIBBONS = [
  { angle: 0.15, offset: 120, half: 650, curve: 120, base: 230, height: 170, seed: 1.3 },
  { angle: -0.25, offset: 480, half: 750, curve: 200, base: 260, height: 220, seed: 4.1 },
  { angle: 0.4, offset: -420, half: 600, curve: 160, base: 200, height: 150, seed: 7.7 },
  // Story finale only (scaled by `boost`, so invisible in free roam): a low, wide curtain.
  { angle: 0.05, offset: 260, half: 800, curve: 90, base: 60, height: 230, seed: 2.6 },
];
const FINALE_RIBBON = 3;

const vertex = /* glsl */ `
uniform vec4 uLine;   // angle, offset, half length, curve
uniform vec2 uSpan;   // base height, curtain height
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
void main() {
  vUv = uv;
  float s = uv.x * 2.0 - 1.0;
  float across = uLine.y + sin(s * 2.2 + uSeed) * uLine.w
    + sin(s * 7.0 + uTime * 0.05 + uSeed) * 18.0
    + sin(s * 19.0 - uTime * 0.09 + uSeed * 3.0) * 6.0;
  vec2 along = vec2(cos(uLine.x), sin(uLine.x));
  vec2 side = vec2(-along.y, along.x);
  vec2 xz = along * s * uLine.z + side * across;
  float y = uSpan.x + uv.y * uSpan.y + sin(s * 3.0 + uSeed) * 25.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(xz.x, y, xz.y, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uAlpha;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  float rays = 0.5 + 0.5 * noise(vec2(vUv.x * 60.0 + uTime * 0.05 + uSeed, uTime * 0.03));
  float patches = noise(vec2(vUv.x * 3.5 - uTime * 0.012 + uSeed, uSeed));
  float lower = smoothstep(0.0, 0.05, vUv.y);           // crisp lower edge
  float upper = pow(max(1.0 - vUv.y, 0.0), 1.7);        // long fade upward
  float ends = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
  float i = lower * upper * ends * rays * (0.35 + 0.9 * patches) * uAlpha;
  vec3 green = vec3(0.12, 1.0, 0.42);
  vec3 violet = vec3(0.55, 0.22, 0.85);
  vec3 col = mix(green, violet, smoothstep(0.35, 1.0, vUv.y) * 0.7) * 1.8; // HDR → bloom
  gl_FragColor = vec4(col, i);
}`;

export interface Aurora {
  group: THREE.Group;
  update(camera: THREE.Vector3, strength: number, time: number, boost?: number): void;
}

export function createAurora(): Aurora {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1, 200, 1);
  const materials = RIBBONS.map((r) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uLine: { value: new THREE.Vector4(r.angle, r.offset, r.half, r.curve) },
        uSpan: { value: new THREE.Vector2(r.base, r.height) },
        uSeed: { value: r.seed },
        uTime: { value: 0 },
        uAlpha: { value: 0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    return mat;
  });

  return {
    group,
    update(camera, strength, time, boost = 0) {
      group.position.set(camera.x, 0, camera.z);
      group.visible = strength > 0.01;
      materials.forEach((m, i) => {
        m.uniforms.uTime.value = time;
        // Each curtain breathes on its own slow rhythm.
        const k = i === FINALE_RIBBON ? boost : 1 + boost;
        m.uniforms.uAlpha.value = strength * k * (0.65 + 0.35 * Math.sin(time * 0.05 + i * 2.1));
      });
    },
  };
}
