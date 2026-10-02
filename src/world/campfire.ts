import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { MATS, mesh } from './materials';
import { Smoke } from './smoke';

export interface Campfire {
  update(dt: number, tint: THREE.Color): void;
}

const flameMat = new THREE.MeshStandardMaterial({
  color: 0xffa040, emissive: 0xff7a1a, emissiveIntensity: 3.5, transparent: true, opacity: 0.85, depthWrite: false,
});
const coreMat = new THREE.MeshStandardMaterial({
  color: 0xffe08a, emissive: 0xffd060, emissiveIntensity: 4.5, transparent: true, opacity: 0.9, depthWrite: false,
});
const ashMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1 });
const FIRE_TINT = new THREE.Color(0xffb27a);

/** Stone ring, crossed logs, flickering flames, warm light and rising smoke, centred on `at` (ground). */
export function createCampfire(scene: THREE.Scene, world: World, at: THREE.Vector3): Campfire {
  const group = new THREE.Group();
  group.position.copy(at);
  scene.add(group);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    group.add(mesh(new THREE.DodecahedronGeometry(0.13), MATS.stone, Math.sin(a) * 0.7, 0.1, Math.cos(a) * 0.7));
  }
  const ash = mesh(new THREE.CircleGeometry(0.6, 16), ashMat, 0, 0.055, 0);
  ash.rotation.x = -Math.PI / 2;
  group.add(ash);
  for (let i = 0; i < 4; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6), MATS.log);
    log.position.y = 0.3;
    log.rotation.set(0.55, (i / 4) * Math.PI * 2, 0, 'YXZ');
    group.add(log);
  }
  const flames = [
    { r: 0.26, h: 0.75, x: 0, z: 0, mat: flameMat },
    { r: 0.18, h: 0.55, x: 0.12, z: 0.08, mat: flameMat },
    { r: 0.17, h: 0.5, x: -0.1, z: -0.1, mat: flameMat },
    { r: 0.12, h: 0.45, x: 0, z: 0, mat: coreMat },
  ].map((f) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(f.r, f.h, 7).translate(0, f.h / 2, 0), f.mat);
    m.position.set(f.x, 0.12, f.z);
    group.add(m);
    return m;
  });
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.3, 0.8).setTranslation(at.x, at.y + 0.3, at.z));
  const light = new THREE.PointLight(0xff9a4a, 10, 13, 2);
  light.position.set(0, 0.9, 0);
  group.add(light);
  const smoke = new Smoke(scene, at.clone().setY(at.y + 1.0), { count: 40, life: 6.5, rise: 0.7, spread: 0.4, size: [0.4, 2.2], opacity: 0.3 });
  smoke.rate = 3;

  let time = Math.random() * 10;
  return {
    update(dt, tint) {
      time += dt;
      flames.forEach((f, i) => {
        const k = time * (9 + i * 2.3) + i * 1.7;
        f.scale.set(1 + Math.sin(k * 0.7) * 0.08, 0.8 + Math.sin(k) * 0.15 + Math.sin(k * 2.3) * 0.08, 1 + Math.cos(k * 0.6) * 0.08);
        f.rotation.y = time * (0.6 + i * 0.2);
      });
      light.intensity = 9 + Math.sin(time * 11) * 1.4 + Math.sin(time * 23.7) * 0.8;
      smoke.tint.copy(tint).lerp(FIRE_TINT, 0.25);
      smoke.update(dt, 0.3, 0.1);
    },
  };
}
