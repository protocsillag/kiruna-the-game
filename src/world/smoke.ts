import * as THREE from 'three';

let sharedTexture: THREE.CanvasTexture | undefined;
function puffTexture(): THREE.CanvasTexture {
  if (sharedTexture) return sharedTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return (sharedTexture = new THREE.CanvasTexture(c));
}

export interface SmokeOpts {
  count: number;
  life: number;
  rise: number;
  spread: number;
  size: [number, number];
  opacity: number;
}

interface Puff {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  age: number;
}

/** Pooled sprite emitter for chimney smoke, sauna steam and sea smoke over the ice hole. */
export class Smoke {
  /** Puffs per second. */
  rate = 0;
  readonly tint = new THREE.Color(0xffffff);
  private puffs: Puff[] = [];
  private cursor = 0;
  private acc = 0;

  constructor(scene: THREE.Scene, readonly origin: THREE.Vector3, private o: SmokeOpts) {
    for (let i = 0; i < o.count; i++) {
      const mat = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0 });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.puffs.push({ sprite, vel: new THREE.Vector3(), age: o.life });
    }
  }

  burst(n: number): void {
    for (let i = 0; i < n; i++) this.emit();
  }

  update(dt: number, windX = 0, windZ = 0): void {
    this.acc += this.rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.emit();
    }
    const { life, size, opacity } = this.o;
    for (const p of this.puffs) {
      if (p.age >= life) continue;
      p.age += dt;
      const t = p.age / life;
      p.sprite.visible = t < 1;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.position.x += windX * t * dt;
      p.sprite.position.z += windZ * t * dt;
      p.sprite.scale.setScalar(THREE.MathUtils.lerp(size[0], size[1], t));
      p.sprite.material.opacity = Math.sin(Math.min(t * 1.5, 1) * Math.PI * 0.5) * (1 - t) * opacity;
      p.sprite.material.color.copy(this.tint);
    }
  }

  private emit(): void {
    const p = this.puffs[this.cursor];
    this.cursor = (this.cursor + 1) % this.puffs.length;
    const s = this.o.spread;
    p.age = 0;
    p.sprite.position.copy(this.origin).add(new THREE.Vector3((Math.random() - 0.5) * s, 0, (Math.random() - 0.5) * s));
    p.vel.set((Math.random() - 0.5) * 0.2, this.o.rise * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * 0.2);
  }
}
