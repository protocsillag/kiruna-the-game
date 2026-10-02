import * as THREE from 'three';
import { mesh } from './materials';

function furTexture(base: string, light: string, dark: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  let seed = base.length * 97;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    g.strokeStyle = rand() < 0.5 ? light : dark;
    g.globalAlpha = 0.35 + rand() * 0.4;
    const x = rand() * 128;
    const y = rand() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 3, y + 3 + rand() * 5);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let furs: THREE.MeshStandardMaterial[] | undefined;
/** Reindeer fur materials: [brown-grey, white-grey]. */
export function furMaterials(): THREE.MeshStandardMaterial[] {
  return (furs ??= [
    new THREE.MeshStandardMaterial({ map: furTexture('#8a7563', '#b8a58e', '#4e4035'), roughness: 1 }),
    new THREE.MeshStandardMaterial({ map: furTexture('#d6cbb8', '#f1ebe0', '#9c8f7c'), roughness: 1 }),
  ]);
}

/** A soft, lumpy reindeer pelt: a flattened, jittered icosphere. */
export function pelt(mat: THREE.Material, sx: number, sz: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.9 + Math.random() * 0.2), p.getY(i), p.getZ(i) * (0.9 + Math.random() * 0.2));
  geo.computeVertexNormals();
  const m = mesh(geo, mat);
  m.scale.set(sx, 0.07, sz);
  return m;
}
