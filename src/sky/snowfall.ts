import * as THREE from 'three';

const COUNT = 3500;
const BOX = new THREE.Vector3(50, 30, 50);

const vertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uPixelRatio;
uniform vec3 uCam;
uniform vec3 uBox;
uniform vec2 uDrift;
uniform vec3 uHideMin[2];
uniform vec3 uHideMax[2];
varying float vAlpha;
void main() {
  vec3 p = position;
  p.y -= uTime * (0.55 + aSeed * 0.5);
  p.xz += uDrift + vec2(sin(uTime * 0.8 + aSeed * 30.0), cos(uTime * 0.6 + aSeed * 20.0)) * 0.4;
  vec3 origin = uCam - uBox * 0.5;
  p = mod(p - origin, uBox) + origin; // wrap the flakes around the camera
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vAlpha = (1.0 - smoothstep(uBox.x * 0.25, uBox.x * 0.5, dist)) * smoothstep(0.3, 1.5, dist);
  for (int i = 0; i < 2; i++) {
    if (all(greaterThan(p, uHideMin[i])) && all(lessThan(p, uHideMax[i]))) vAlpha = 0.0; // indoors
  }
  gl_PointSize = 26.0 * (0.6 + aSeed * 0.8) / max(dist, 0.5) * uPixelRatio;
  gl_Position = projectionMatrix * mv;
}`;

const fragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float a = (1.0 - smoothstep(0.15, 0.5, length(gl_PointCoord - 0.5))) * vAlpha;
  gl_FragColor = vec4(uColor, a * 0.85);
}`;

export interface Snowfall {
  points: THREE.Points;
  update(dt: number, camera: THREE.Vector3, gust: number, color: THREE.Color, time: number): void;
  /** Keep flakes out of up to two indoor boxes (slot 0 or 1). */
  hideIn(box: THREE.Box3, slot: number): void;
  /** Pixel ratio for flake size, and the fraction of flakes drawn (Low quality draws fewer). */
  setQuality(pixelRatio: number, fraction: number): void;
}

/** Light snowfall drawn entirely on the GPU; flakes drift with the wind gusts. */
export function createSnowfall(pixelRatio: number): Snowfall {
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos.set([Math.random() * BOX.x, Math.random() * BOX.y, Math.random() * BOX.z], i * 3);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uCam: { value: new THREE.Vector3() },
    uBox: { value: BOX },
    uDrift: { value: new THREE.Vector2() },
    uColor: { value: new THREE.Color() },
    uHideMin: { value: [new THREE.Vector3(1e9, 1e9, 1e9), new THREE.Vector3(1e9, 1e9, 1e9)] },
    uHideMax: { value: [new THREE.Vector3(1e9, 1e9, 1e9), new THREE.Vector3(1e9, 1e9, 1e9)] },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  return {
    points,
    setQuality(pixelRatio, fraction) {
      uniforms.uPixelRatio.value = pixelRatio;
      geo.setDrawRange(0, Math.floor(COUNT * fraction));
    },
    hideIn(box, slot) {
      uniforms.uHideMin.value[slot].copy(box.min);
      uniforms.uHideMax.value[slot].copy(box.max).setY(box.max.y + 3); // include the roof space
    },
    update(dt, camera, gust, color, time) {
      // Prevailing wind from the west-north-west, stronger in gusts.
      uniforms.uDrift.value.x += (0.4 + gust * 2.2) * dt;
      uniforms.uDrift.value.y += (0.15 + gust * 0.8) * dt;
      uniforms.uCam.value.copy(camera);
      uniforms.uColor.value.copy(color);
      uniforms.uTime.value = time;
    },
  };
}
