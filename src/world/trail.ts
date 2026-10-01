import * as THREE from 'three';
import { groundHeight, LAKE, shoreZ } from './terrain';
import { MATS, mesh } from './materials';

const SPACING = 28;
const RED = new THREE.MeshStandardMaterial({ color: 0xc4202a, roughness: 0.6 });

/** Winter-trail poles with red crosses, leading from camp across the lake. */
export function createTrail(scene: THREE.Scene): void {
  const startX = 6;
  const start = new THREE.Vector2(startX, shoreZ(startX) - 6);
  const end = new THREE.Vector2(55, LAKE.z - LAKE.rz + 30);
  const length = start.distanceTo(end);
  const n = Math.floor(length / SPACING);
  const dir = end.clone().sub(start).normalize();
  const side = new THREE.Vector2(-dir.y, dir.x);
  const heading = Math.atan2(dir.x, dir.y);

  const pole = new THREE.CylinderGeometry(0.035, 0.045, 1.9, 6).translate(0, 0.95, 0);
  const arm = new THREE.BoxGeometry(0.06, 0.55, 0.03);

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = start.clone().lerp(end, t).addScaledVector(side, Math.sin(t * Math.PI * 1.5) * 25);
    const y = groundHeight(p.x, p.y);
    const g = new THREE.Group();
    g.position.set(p.x, y, p.y);
    g.rotation.y = heading;
    g.add(mesh(pole, MATS.wood));
    for (const a of [-1, 1]) {
      const cross = mesh(arm, RED, 0, 1.72, 0.05);
      cross.rotation.z = a * Math.PI * 0.25;
      g.add(cross);
    }
    scene.add(g); // no collider: you ride past the poles, not into them
  }
}
