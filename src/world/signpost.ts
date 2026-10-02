import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { MATS, mesh } from './materials';

/** Hand-drawn (in code) poster: the Ice Hotel under the aurora, the invitation, an arrow, times. */
function posterTexture(arrowAngle: number, lines: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 768;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4a3324';
  g.fillRect(0, 0, 1024, 768);

  // Picture: night sky, aurora, snow, the arched entrance glowing blue.
  const pic = { x: 40, y: 36, w: 944, h: 380 };
  g.save();
  g.beginPath();
  g.roundRect(pic.x, pic.y, pic.w, pic.h, 18);
  g.clip();
  const sky = g.createLinearGradient(0, pic.y, 0, pic.y + pic.h);
  sky.addColorStop(0, '#06102a');
  sky.addColorStop(1, '#1d3a66');
  g.fillStyle = sky;
  g.fillRect(pic.x, pic.y, pic.w, pic.h);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + ((i * 37) % 10) / 15})`;
    g.fillRect(pic.x + ((i * 173) % pic.w), pic.y + ((i * 97) % 200), 2, 2);
  }
  for (const [y0, w, a] of [[150, 46, 0.55], [190, 30, 0.35]]) {
    g.strokeStyle = `rgba(80,255,150,${a})`;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(pic.x - 20, y0 + 40);
    g.bezierCurveTo(300, y0 - 90, 620, y0 + 120, 1000, y0 - 40);
    g.stroke();
  }
  g.fillStyle = '#dfe9f5';
  g.beginPath();
  g.ellipse(512, pic.y + pic.h + 40, 620, 150, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#eef4fb';
  g.beginPath();
  g.ellipse(512, 360, 300, 120, 0, Math.PI, 0);
  g.fill();
  const arch = g.createLinearGradient(0, 230, 0, 360);
  arch.addColorStop(0, '#bfe8ff');
  arch.addColorStop(1, '#5fb4e6');
  g.fillStyle = arch;
  g.beginPath();
  g.moveTo(440, 360);
  g.lineTo(440, 300);
  g.arc(512, 300, 72, Math.PI, 0);
  g.lineTo(584, 360);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2;
  for (let y = 250; y < 360; y += 18) {
    g.beginPath();
    g.moveTo(440, y);
    g.lineTo(584, y);
    g.stroke();
  }
  g.fillStyle = '#3b2a1e';
  g.fillRect(492, 310, 40, 50);
  for (const fx of [410, 614]) {
    g.fillStyle = '#ff9a3a';
    g.beginPath();
    g.ellipse(fx, 330, 9, 18, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // Text and arrow.
  g.fillStyle = '#fff6e6';
  g.textAlign = 'center';
  g.font = 'bold 76px Georgia, serif';
  g.fillText('Visit the Ice Hotel', 512, 505);
  g.save();
  g.translate(140, 640);
  g.rotate(arrowAngle);
  g.fillStyle = '#ffd59a';
  g.beginPath();
  g.moveTo(0, -62);
  g.lineTo(42, -12);
  g.lineTo(15, -12);
  g.lineTo(15, 56);
  g.lineTo(-15, 56);
  g.lineTo(-15, -12);
  g.lineTo(-42, -12);
  g.closePath();
  g.fill();
  g.restore();
  g.textAlign = 'left';
  g.fillStyle = '#fff6e6';
  g.font = '600 38px "Helvetica Neue", Arial, sans-serif';
  g.fillText(lines[0], 230, 615);
  g.font = '32px "Helvetica Neue", Arial, sans-serif';
  g.fillStyle = '#e9dcc8';
  g.fillText(lines[1], 230, 670);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Signpost facing `reader` that points toward `target`. The arrow is computed from the actual
 * direction, as seen by someone standing in front of the sign.
 */
export function createIceHotelSign(scene: THREE.Scene, world: World, at: THREE.Vector3, reader: THREE.Vector3, target: THREE.Vector3): void {
  const yaw = Math.atan2(reader.x - at.x, reader.z - at.z); // board's front faces the reader
  const facing = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const fwd = facing.clone().negate(); // the reader looks along −facing
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const dir = target.clone().sub(at).setY(0).normalize();
  const arrowAngle = Math.atan2(dir.dot(right), dir.dot(fwd)); // 0 = straight ahead, + = to the right

  const g = new THREE.Group();
  g.position.copy(at);
  g.rotation.y = yaw;
  scene.add(g);
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), MATS.wood, s * 1.05, 1.3, -0.05));
  g.add(mesh(new THREE.BoxGeometry(2.5, 1.9, 0.08), MATS.wood, 0, 1.75, 0));
  g.add(mesh(new THREE.BoxGeometry(2.6, 0.1, 0.25), MATS.snow, 0, 2.75, 0));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.8),
    new THREE.MeshStandardMaterial({
      map: posterTexture(arrowAngle, ['Across the lake: follow the red-cross poles', '≈ 20 s by snowmobile · 1 min by dog sled · 3 min on foot']),
      roughness: 0.85,
    }),
  );
  face.position.set(0, 1.75, 0.045);
  g.add(face);
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.25, 1.3, 0.12).setTranslation(at.x, at.y + 1.3, at.z).setRotation(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
  ));
}
