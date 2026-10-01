import * as THREE from 'three';

const COUNT = 2600;
const RADIUS = 1100;

const vertex = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vColor = aColor;
  float fade = smoothstep(0.0, 0.25, normalize(position).y); // haze near the horizon
  vTwinkle = (0.75 + 0.25 * sin(uTime * (1.5 + aPhase * 2.0) + aPhase * 40.0)) * fade;
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uAlpha;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  float a = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(vColor * vTwinkle * a * uAlpha, 1.0);
}`;

export interface Stars {
  points: THREE.Points;
  update(camera: THREE.Vector3, alpha: number, time: number): void;
  setPixelRatio(r: number): void;
}

export function createStars(pixelRatio: number): Stars {
  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  const color = new Float32Array(COUNT * 3);
  const tints = [new THREE.Color(0xffffff), new THREE.Color(0xcfdcff), new THREE.Color(0xffe6c4)];
  for (let i = 0; i < COUNT; i++) {
    const y = Math.random() * 1.05 - 0.05;
    const r = Math.sqrt(1 - y * y);
    const phi = Math.random() * Math.PI * 2;
    pos.set([Math.cos(phi) * r * RADIUS, y * RADIUS, Math.sin(phi) * r * RADIUS], i * 3);
    const bright = Math.pow(Math.random(), 3);
    size[i] = 1 + bright * 2.6;
    phase[i] = Math.random();
    tints[i % 3].clone().multiplyScalar(0.5 + bright * 1.3).toArray(color, i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));

  const uniforms = { uTime: { value: 0 }, uAlpha: { value: 0 }, uPixelRatio: { value: pixelRatio } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = -1;
  points.frustumCulled = false;

  return {
    points,
    setPixelRatio: (r) => (uniforms.uPixelRatio.value = r),
    update(camera, alpha, time) {
      points.position.copy(camera);
      points.visible = alpha > 0.01;
      uniforms.uAlpha.value = alpha;
      uniforms.uTime.value = time;
    },
  };
}
