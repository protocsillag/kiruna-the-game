import * as THREE from 'three';
import { MATS, mesh } from '../world/materials';

/** Wooden basket sled with a red sled bag. Faces +Z, origin on the ground at the sled's centre. */
export function createDogSledModel(): THREE.Group {
  const root = new THREE.Group();
  const bag = new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.9 });
  const LEN = 2.3;

  for (const x of [-0.3, 0.3]) {
    root.add(mesh(new THREE.BoxGeometry(0.05, 0.04, LEN), MATS.wood, x, 0.02, 0)); // runner
    const tip = mesh(new THREE.BoxGeometry(0.05, 0.04, 0.35), MATS.wood, x, 0.12, LEN / 2 + 0.12);
    tip.rotation.x = -0.75; // upturned brush bow
    root.add(tip);
    for (const z of [-0.85, -0.3, 0.3, 0.85]) {
      root.add(mesh(new THREE.BoxGeometry(0.035, 0.34, 0.035), MATS.wood, x, 0.19, z)); // stanchion
    }
    root.add(mesh(new THREE.BoxGeometry(0.035, 0.035, 1.9), MATS.wood, x, 0.56, 0.05)); // side rail
  }
  for (let i = 0; i < 6; i++) {
    root.add(mesh(new THREE.BoxGeometry(0.62, 0.02, 0.12), MATS.wood, 0, 0.36, -0.75 + i * 0.3)); // bed slats
  }
  root.add(mesh(new THREE.BoxGeometry(0.54, 0.24, 1.35), bag, 0, 0.49, 0.15)); // sled bag

  // Handlebar the musher holds, and the brake claw between the runners.
  for (const x of [-0.28, 0.28]) {
    const upright = mesh(new THREE.BoxGeometry(0.04, 0.72, 0.04), MATS.wood, x, 0.72, -LEN / 2 + 0.12);
    upright.rotation.x = -0.18;
    root.add(upright);
  }
  const bar = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 8), MATS.wood, 0, 1.08, -LEN / 2 + 0.05);
  bar.rotation.z = Math.PI / 2;
  root.add(bar);
  root.add(mesh(new THREE.BoxGeometry(0.3, 0.04, 0.25), MATS.metal, 0, 0.06, -LEN / 2 + 0.25));
  return root;
}
