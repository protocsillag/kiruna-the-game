import * as THREE from 'three';

/** Fixed blue-hour lighting for M1. The day/night cycle replaces this in M2. */
const SKY = 0x4b5f89;
const SUN_OFFSET = new THREE.Vector3(-80, 32, -120);

export interface Lighting {
  follow(target: THREE.Vector3): void;
}

export function createLighting(scene: THREE.Scene): Lighting {
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 140, 560);

  scene.add(new THREE.HemisphereLight(0xa3b8e4, 0x39446a, 1.4));

  // Low polar sun skimming the horizon across the lake: long warm shadows.
  const sun = new THREE.DirectionalLight(0xffbe96, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -35;
  cam.right = cam.top = 35;
  cam.near = 1;
  cam.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  return {
    follow(target) {
      sun.target.position.copy(target);
      sun.position.copy(target).add(SUN_OFFSET);
    },
  };
}
