import * as THREE from 'three';

const MAX = 700;
const DEEP = new THREE.Color(0x7487ab);
const ICE = new THREE.Color(0xc4d3e2);

function printTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 32, 2, 16, 32, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.save();
  g.translate(16, 32);
  g.scale(1, 1.9);
  g.translate(-16, -32);
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 64);
  g.restore();
  return new THREE.CanvasTexture(c);
}

/** Ring buffer of instanced footprint decals left behind the player. */
export class Footprints {
  private mesh: THREE.InstancedMesh;
  private next = 0;
  private travelled = 0;
  private left = false;
  private last = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private hasLast = false;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(0.15, 0.3);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      alphaMap: printTexture(),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, DEEP);
    scene.add(this.mesh);
  }

  update(feet: THREE.Vector3, heading: number, jogging: boolean, onIce: boolean): void {
    if (!this.hasLast) {
      this.last.copy(feet);
      this.hasLast = true;
      return;
    }
    this.travelled += Math.hypot(feet.x - this.last.x, feet.z - this.last.z);
    this.last.copy(feet);
    const stride = jogging ? 1.0 : 0.7;
    if (this.travelled < stride) return;
    this.travelled = 0;
    this.left = !this.left;

    const side = this.left ? 0.12 : -0.12;
    this.dummy.position.set(
      feet.x + Math.cos(heading) * side,
      feet.y + 0.02,
      feet.z - Math.sin(heading) * side,
    );
    this.dummy.rotation.set(0, heading, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(this.next, this.dummy.matrix);
    this.mesh.setColorAt(this.next, onIce ? ICE : DEEP);
    this.next = (this.next + 1) % MAX;
    this.mesh.count = Math.min(this.mesh.count + 1, MAX);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }
}
