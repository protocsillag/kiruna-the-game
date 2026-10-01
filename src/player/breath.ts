import * as THREE from 'three';

const POOL = 14;
const LIFE = 1.8;

function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

interface Puff {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  age: number;
}

/** Little clouds of breath vapor in the cold air; quicker when jogging. */
export class Breath {
  private puffs: Puff[] = [];
  private timer = 1;
  private cursor = 0;
  private head = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const map = puffTexture();
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.puffs.push({ sprite, vel: new THREE.Vector3(), age: LIFE });
    }
  }

  update(dt: number, head: THREE.Object3D, heading: number, jogging: boolean): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = (jogging ? 1.2 : 2.8) + Math.random() * 0.6;
      head.getWorldPosition(this.head);
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      for (let k = 0; k < 2; k++) {
        const p = this.puffs[this.cursor];
        this.cursor = (this.cursor + 1) % POOL;
        p.age = -k * 0.12;
        p.sprite.position.set(this.head.x + fx * 0.2, this.head.y - 0.04, this.head.z + fz * 0.2);
        p.vel.set(fx * 0.4 + (Math.random() - 0.5) * 0.1, 0.12, fz * 0.4 + (Math.random() - 0.5) * 0.1);
      }
    }

    for (const p of this.puffs) {
      p.age += dt;
      const t = p.age / LIFE;
      p.sprite.visible = t > 0 && t < 1;
      if (!p.sprite.visible) continue;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 0.8);
      p.sprite.scale.setScalar(0.12 + t * 0.6);
      p.sprite.material.opacity = Math.sin(t * Math.PI) * 0.32;
    }
  }
}
