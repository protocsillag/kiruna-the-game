import * as THREE from 'three';
import { smoothstep } from '../world/noise';
import { DayClock } from './clock';
import { samplePalette, type Palette } from './palette';
import { createSkyDome } from './skydome';
import { createStars } from './stars';
import { createAurora } from './aurora';
import { createSnowfall } from './snowfall';

const START_HOUR = 12.5; // midday glow first, then blue hour and the first aurora a few minutes in
const SUN_COLOR = new THREE.Color(0xffb68c);
const MOON_COLOR = new THREE.Color(0x9db4ff);
const AURORA_TINT = new THREE.Color(0x3cff8a);
const MIN_LIGHT_ELEV = Math.sin((6 * Math.PI) / 180); // keep shadows from going infinitely long

export interface Sky {
  clock: DayClock;
  hideSnowIn(box: THREE.Box3, slot: number): void;
  setQuality(high: boolean, pixelRatio: number): void;
  update(dt: number, camera: THREE.Vector3, focus: THREE.Vector3, gust: number): Palette;
}

export function createSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Sky {
  const clock = new DayClock(START_HOUR);
  const pixelRatio = renderer.getPixelRatio();
  const dome = createSkyDome();
  const stars = createStars(pixelRatio);
  const aurora = createAurora();
  const snow = createSnowfall(pixelRatio);
  scene.add(dome.mesh, stars.points, aurora.group, snow.points);

  const fog = new THREE.Fog(0x000000, 80, 600);
  scene.fog = fog;

  const hemi = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const cam = key.shadow.camera;
  cam.left = cam.bottom = -35;
  cam.right = cam.top = 35;
  cam.near = 1;
  cam.far = 400;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.05;
  scene.add(hemi, key, key.target);

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const lightDir = new THREE.Vector3();
  const snowColor = new THREE.Color();
  let time = 0;

  return {
    clock,
    hideSnowIn: (box, slot) => snow.hideIn(box, slot),
    setQuality(high, pixelRatio) {
      key.castShadow = high;
      stars.setPixelRatio(pixelRatio);
      snow.setQuality(pixelRatio, high ? 1 : 0.35);
    },
    update(dt, camera, focus, gust) {
      time += dt;
      clock.update(dt);
      const elev = clock.sunElevation();
      const p = samplePalette(elev);
      clock.sunDirection(sunDir);
      clock.moonDirection(moonDir);

      const auroraStrength = p.aurora * (0.7 + 0.3 * Math.sin(time * 0.021));
      dome.update(camera, p, sunDir, time);
      stars.update(camera, p.stars, time);
      aurora.update(camera, auroraStrength, time);

      hemi.color.copy(p.hemiSky).lerp(AURORA_TINT, auroraStrength * 0.12);
      hemi.groundColor.copy(p.hemiGround);
      hemi.intensity = p.hemiIntensity;

      // One shadow-casting key light: low warm sun by day, cool moonlight by night.
      const sunness = smoothstep(-6, -1, elev);
      lightDir.copy(sunDir).setY(Math.max(sunDir.y, MIN_LIGHT_ELEV)).normalize();
      lightDir.lerp(moonDir, 1 - sunness).normalize();
      key.color.lerpColors(MOON_COLOR, SUN_COLOR, sunness);
      key.intensity = p.key;
      key.target.position.copy(focus);
      key.position.copy(focus).addScaledVector(lightDir, 150);

      fog.color.copy(p.fog);
      fog.near = p.fogNear;
      fog.far = p.fogFar;
      renderer.toneMappingExposure = p.exposure;

      snowColor.copy(hemi.color).multiplyScalar(0.35 + p.hemiIntensity * 0.35);
      snow.update(dt, camera, gust, snowColor, time);
      return p;
    },
  };
}
