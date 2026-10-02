import * as THREE from 'three';
import { damp } from '../world/noise';

export type DogMode = 'run' | 'idle' | 'poop' | 'lie';

export interface Husky {
  root: THREE.Group;
  animate(dt: number, speed: number, mode: DogMode): void;
}

const mat = (color: number, roughness = 0.95) => new THREE.MeshStandardMaterial({ color, roughness });
const DARK = mat(0x4f535b);
const LIGHT = mat(0xe9e6e0);
const NOSE = mat(0x161616, 0.5);
const EYE = mat(0x6fa8dc, 0.3);
const HARNESS = [mat(0x2f6fd0, 0.7), mat(0xd9342b, 0.7)];

function part(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Low-poly Siberian husky: grey saddle, white face/belly/legs, blue eyes, curled tail. Faces +Z. */
export function createHusky(seed: number, harnessed = true): Husky {
  const root = new THREE.Group();
  const body = new THREE.Group(); // pitches/bobs with the gait
  body.position.y = 0.42;
  root.add(body);

  const torso = part(new THREE.CapsuleGeometry(0.17, 0.5, 4, 10), DARK, body, 0, 0.07, 0);
  torso.rotation.x = Math.PI / 2;
  const belly = part(new THREE.CapsuleGeometry(0.15, 0.45, 4, 10), LIGHT, body, 0, 0.0, 0.02);
  belly.rotation.x = Math.PI / 2;
  part(new THREE.SphereGeometry(0.16, 10, 8), LIGHT, body, 0, 0.1, 0.33); // chest ruff
  if (harnessed) {
    const strap = part(new THREE.TorusGeometry(0.175, 0.025, 4, 12), HARNESS[seed % 2], body, 0, 0.06, 0.18);
    strap.scale.set(1, 1.05, 1);
    part(new THREE.BoxGeometry(0.06, 0.03, 0.5), HARNESS[seed % 2], body, 0, 0.245, -0.05);
  }

  const head = new THREE.Group();
  head.position.set(0, 0.25, 0.45);
  body.add(head);
  part(new THREE.SphereGeometry(0.125, 10, 8), DARK, head, 0, 0.02, 0);
  part(new THREE.SphereGeometry(0.105, 10, 8), LIGHT, head, 0, -0.02, 0.04); // face mask
  part(new THREE.BoxGeometry(0.09, 0.08, 0.16), LIGHT, head, 0, -0.04, 0.13); // snout
  part(new THREE.SphereGeometry(0.026, 6, 5), NOSE, head, 0, -0.02, 0.215);
  for (const s of [-1, 1]) {
    const ear = part(new THREE.ConeGeometry(0.045, 0.12, 5), DARK, head, s * 0.07, 0.13, -0.02);
    ear.rotation.z = -s * 0.25;
    part(new THREE.SphereGeometry(0.017, 6, 4), EYE, head, s * 0.05, 0.035, 0.105);
  }

  const legGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.42, 6).translate(0, -0.21, 0);
  const pawGeo = new THREE.SphereGeometry(0.04, 6, 4);
  const legs = [
    [-0.09, 0.25], [0.09, 0.25], // front
    [-0.09, -0.25], [0.09, -0.25], // back
  ].map(([x, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z);
    body.add(pivot);
    part(legGeo, LIGHT, pivot);
    part(pawGeo, LIGHT, pivot, 0, -0.42, 0.02);
    return pivot;
  });

  const tail = new THREE.Group();
  tail.position.set(0, 0.17, -0.36);
  body.add(tail);
  const curl = part(new THREE.TorusGeometry(0.1, 0.04, 6, 10, Math.PI * 1.25), DARK, tail, 0, 0.09, 0);
  curl.rotation.y = Math.PI / 2;
  curl.rotation.z = -0.4;

  let phase = seed * 1.7;
  let time = seed * 3.1;
  let amp = 0;
  let squat = 0;
  let lying = 0;

  return {
    root,
    animate(dt, speed, mode) {
      time += dt;
      amp += (Math.min(speed / 5, 1) * (mode === 'lie' ? 0 : 1) - amp) * damp(6, dt);
      squat += ((mode === 'poop' ? 1 : 0) - squat) * damp(8, dt);
      lying += ((mode === 'lie' ? 1 : 0) - lying) * damp(4, dt);
      phase += dt * (6 + speed * 1.6);

      // Gallop: front pair and back pair each swing together, half a stride apart.
      // (+x rotation swings a paw backward; −x forward. Body: −x lowers the rear.)
      const front = Math.sin(phase) * 0.75 * amp;
      const back = Math.sin(phase + Math.PI) * 0.75 * amp;
      legs[0].rotation.x = front;
      legs[1].rotation.x = front * 0.85;
      legs[2].rotation.x = back * 0.85 - squat * 0.6 - lying * 1.5; // hind legs tuck forward
      legs[3].rotation.x = back - squat * 0.6 - lying * 1.5;
      legs[0].rotation.x -= lying * 1.4; // sphinx: front legs stretched forward
      legs[1].rotation.x -= lying * 1.4;

      body.position.y = 0.42 + Math.abs(Math.cos(phase)) * 0.05 * amp - squat * 0.12 - lying * 0.28;
      body.rotation.x = Math.sin(phase * 2) * 0.05 * amp - squat * 0.3; // rear down when squatting
      head.rotation.x = Math.sin(phase * 2) * 0.08 * amp + lying * 0.25;
      head.rotation.y = (1 - amp) * Math.sin(time * 0.5 + seed) * 0.45;
      // Tail: wags when idle, streams back when running, shoots up when squatting.
      tail.rotation.z = (1 - amp) * Math.sin(time * (8 + seed)) * 0.45;
      tail.rotation.x = -amp * 0.5 - squat * 0.3; // −x tips the curl out behind
    },
  };
}
