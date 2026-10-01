import * as THREE from 'three';
import { damp } from '../world/noise';

const mat = (color: number, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });

export interface Character {
  root: THREE.Group;
  head: THREE.Object3D;
  animate(dt: number, speed: number): void;
}

/** Low-poly placeholder in a winter jacket and beanie; faces +Z, origin at the feet. */
export function createCharacter(): Character {
  const jacket = mat(0xa3342b);
  const pants = mat(0x2a2e38);
  const boots = mat(0x3b2a20);
  const skin = mat(0xe6c1a2, 0.7);
  const hatMat = mat(0x2e4a7a, 0.95);
  const wool = mat(0xf2efe8, 1);
  const scarfMat = mat(0xe0a83a, 0.95);
  const packMat = mat(0x4b5a3a);
  const eyeMat = mat(0x1d1d22, 0.4);

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.9;
  root.add(hips);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.32, 4, 12), jacket);
  torso.position.y = 0.24;
  torso.scale.set(1, 1, 0.8);
  hips.add(torso);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.14), packMat);
  pack.position.set(0, 0.3, -0.21);
  hips.add(pack);

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 6, 14), scarfMat);
  scarf.position.y = 0.58;
  scarf.rotation.x = Math.PI / 2;
  hips.add(scarf);

  const head = new THREE.Group();
  head.position.y = 0.72;
  hips.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skin));
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 4), eyeMat);
    eye.position.set(side * 0.045, 0.02, 0.12);
    head.add(eye);
  }
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.142, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
  hat.position.y = 0.025;
  head.add(hat);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.06, 14), hatMat);
  cuff.position.y = 0.03;
  head.add(cuff);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), wool);
  pom.position.y = 0.18;
  head.add(pom);

  const legGeo = new THREE.CapsuleGeometry(0.09, 0.62, 4, 8);
  const bootGeo = new THREE.BoxGeometry(0.15, 0.12, 0.26);
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.x = side * 0.11;
    hips.add(pivot);
    const leg = new THREE.Mesh(legGeo, pants);
    leg.position.y = -0.4;
    const boot = new THREE.Mesh(bootGeo, boots);
    boot.position.set(0, -0.84, 0.04);
    pivot.add(leg, boot);
    return pivot;
  });

  const armGeo = new THREE.CapsuleGeometry(0.075, 0.42, 4, 8);
  const mittenGeo = new THREE.SphereGeometry(0.075, 8, 6);
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.29, 0.5, 0);
    pivot.rotation.z = side * 0.12;
    hips.add(pivot);
    const arm = new THREE.Mesh(armGeo, jacket);
    arm.position.y = -0.26;
    const mitten = new THREE.Mesh(mittenGeo, scarfMat);
    mitten.position.y = -0.53;
    pivot.add(arm, mitten);
    return pivot;
  });

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });

  let phase = 0;
  let amp = 0;
  let time = 0;

  return {
    root,
    head,
    animate(dt, speed) {
      time += dt;
      amp += (Math.min(speed / 4.5, 1) * 0.75 - amp) * damp(8, dt);
      phase += dt * (4 + speed * 1.2);
      const s = Math.sin(phase) * amp;
      legs[0].rotation.x = s;
      legs[1].rotation.x = -s;
      arms[0].rotation.x = -s * 0.8;
      arms[1].rotation.x = s * 0.8;
      hips.position.y = 0.9 + Math.abs(Math.cos(phase)) * 0.05 * amp;
      hips.rotation.x = amp * 0.12; // lean into the walk
      torso.scale.y = 1 + Math.sin(time * 1.6) * 0.012; // idle breathing
    },
  };
}
