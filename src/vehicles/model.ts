import * as THREE from 'three';
import { mesh } from '../world/materials';

export interface SledModel {
  root: THREE.Group;
  /** Tilted with the ground; holds everything except the shadow-free lights' targets. */
  body: THREE.Group;
  seat: THREE.Object3D;
  headlight: THREE.SpotLight;
  lens: THREE.MeshStandardMaterial;
}

/** Low-poly Lynx-style snowmobile, yellow and black. Faces +Z, origin on the ground. */
export function createSledModel(): SledModel {
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8b100, roughness: 0.45, metalness: 0.1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.9 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xfff0d0, emissiveIntensity: 0.3 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: 1.6 });
  const shield = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, transparent: true, opacity: 0.55 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  body.add(mesh(new THREE.BoxGeometry(0.9, 0.32, 2.1), yellow, 0, 0.5, -0.05)); // chassis
  const hood = mesh(new THREE.BoxGeometry(0.86, 0.34, 0.95), yellow, 0, 0.68, 0.72);
  hood.rotation.x = 0.32;
  body.add(hood);
  const nose = mesh(new THREE.BoxGeometry(0.7, 0.2, 0.4), yellow, 0, 0.47, 1.18);
  nose.rotation.x = 0.6;
  body.add(nose);
  body.add(mesh(new THREE.BoxGeometry(0.5, 0.18, 1.05), black, 0, 0.75, -0.42)); // seat
  body.add(mesh(new THREE.BoxGeometry(0.6, 0.22, 0.25), black, 0, 0.72, -1.05)); // rear rack
  const screen = mesh(new THREE.BoxGeometry(0.62, 0.38, 0.02), shield, 0, 1.02, 0.42);
  screen.rotation.x = -0.55;
  body.add(screen);

  // Handlebar.
  body.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36), chrome, 0, 0.92, 0.18));
  const bar = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.78), chrome, 0, 1.08, 0.16);
  bar.rotation.z = Math.PI / 2;
  body.add(bar);
  for (const x of [-0.36, 0.36]) {
    const grip = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.12), black, x, 1.08, 0.16);
    grip.rotation.z = Math.PI / 2;
    body.add(grip);
  }

  // Track under the rear, with end rollers.
  body.add(mesh(new THREE.BoxGeometry(0.5, 0.26, 1.45), grey, 0, 0.2, -0.45));
  for (const z of [-1.17, 0.27]) {
    const roller = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 10), grey, 0, 0.17, z);
    roller.rotation.z = Math.PI / 2;
    body.add(roller);
  }

  // Skis with upturned tips, and struts.
  for (const x of [-0.45, 0.45]) {
    body.add(mesh(new THREE.BoxGeometry(0.13, 0.04, 1.2), black, x, 0.03, 0.85));
    const tip = mesh(new THREE.BoxGeometry(0.13, 0.04, 0.3), black, x, 0.1, 1.55);
    tip.rotation.x = -0.6;
    body.add(tip);
    const strut = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), grey, x * 0.85, 0.28, 0.9);
    strut.rotation.z = x > 0 ? -0.35 : 0.35;
    body.add(strut);
  }

  const lensMesh = mesh(new THREE.BoxGeometry(0.34, 0.12, 0.04), lens, 0, 0.8, 1.1);
  lensMesh.rotation.x = 0.32;
  lensMesh.castShadow = false;
  body.add(lensMesh);
  const tailMesh = mesh(new THREE.BoxGeometry(0.3, 0.06, 0.03), tail, 0, 0.78, -1.19);
  tailMesh.castShadow = false;
  body.add(tailMesh);

  const headlight = new THREE.SpotLight(0xfff1d6, 0, 70, 0.5, 0.55, 1.4);
  headlight.position.set(0, 0.85, 1.15);
  headlight.target.position.set(0, -0.6, 12);
  body.add(headlight, headlight.target);

  const seat = new THREE.Object3D();
  seat.position.set(0, 0.84, -0.3);
  body.add(seat);

  return { root, body, seat, headlight, lens };
}
