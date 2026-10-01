import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { ICE_Y, LAKE } from './terrain';

/** Pale blue ice with wind-blown snow drifts and faint cracks, tileable. */
function iceTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#b4cadb';
  g.fillRect(0, 0, size, size);

  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  for (let i = 0; i < 140; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 30 + rand() * 120;
    const squash = 0.08 + rand() * 0.18;
    const angle = 0.35 + (rand() - 0.5) * 0.3;
    const alpha = 0.25 + rand() * 0.45;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        g.save();
        g.translate(x + ox, y + oy);
        g.rotate(angle);
        g.scale(1, squash);
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, w);
        grad.addColorStop(0, `rgba(246,249,253,${alpha})`);
        grad.addColorStop(1, 'rgba(246,249,253,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(0, 0, w, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  }

  g.strokeStyle = 'rgba(80,110,140,0.22)';
  g.lineWidth = 1;
  for (let i = 0; i < 25; i++) {
    let x = rand() * size;
    let y = rand() * size;
    let dir = rand() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 12; s++) {
      dir += (rand() - 0.5) * 0.9;
      x += Math.cos(dir) * 9;
      y += Math.sin(dir) * 9;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createLake(scene: THREE.Scene, world: World): THREE.Mesh {
  // A flat sheet covering the lake's bounding box; the shore terrain rises above it and
  // hides the edges, so the visible shoreline follows the terrain.
  const w = LAKE.rx * 2 + 80;
  const d = LAKE.rz * 2 + 80;
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ map: iceTexture(), roughness: 0.32, metalness: 0 });
  const ice = new THREE.Mesh(geo, mat);
  ice.position.set(LAKE.x, ICE_Y, LAKE.z);
  ice.receiveShadow = true;
  scene.add(ice);

  // Thin slab whose top face is the ice surface.
  const desc = RAPIER.ColliderDesc.cuboid(w / 2, 0.5, d / 2).setTranslation(LAKE.x, ICE_Y - 0.5, LAKE.z);
  world.createCollider(desc);
  return ice;
}
