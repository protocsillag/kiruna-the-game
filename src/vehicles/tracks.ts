import * as THREE from 'three';

const MAX = 1600;
const SPACING = 0.55;
const SNOW = new THREE.Color(0x7c90b4);
const ICE = new THREE.Color(0xc8d6e4);

function treadTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(4, 0, 56, 64);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = 0; y < 64; y += 10) g.fillRect(4, y, 56, 4); // cleat marks
  return new THREE.CanvasTexture(c);
}

/** Ring buffer of track-imprint segments behind the snowmobile. */
export class Tracks {
  private mesh: THREE.InstancedMesh;
  private next = 0;
  private travelled = 0;
  private last = new THREE.Vector3();
  private hasLast = false;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(0.5, SPACING + 0.05);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      alphaMap: treadTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, SNOW);
    scene.add(this.mesh);
  }

  /** `rear` is the ground point under the back of the track. */
  update(rear: THREE.Vector3, heading: number, onIce: boolean): void {
    if (!this.hasLast) {
      this.last.copy(rear);
      this.hasLast = true;
      return;
    }
    this.travelled += Math.hypot(rear.x - this.last.x, rear.z - this.last.z);
    this.last.copy(rear);
    if (this.travelled < SPACING) return;
    this.travelled = 0;
    this.dummy.position.set(rear.x, rear.y + 0.025, rear.z);
    this.dummy.rotation.set(0, heading, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(this.next, this.dummy.matrix);
    this.mesh.setColorAt(this.next, onIce ? ICE : SNOW);
    this.next = (this.next + 1) % MAX;
    this.mesh.count = Math.min(this.mesh.count + 1, MAX);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }
}
