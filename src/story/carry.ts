import * as THREE from 'three';
import { MATS, mesh } from '../world/materials';
import type { Player } from '../player/player';

export type Load = 'block' | 'logs';

/** Something held in both arms in front of the chest: one snow block, or a couple of logs. */
export class Carry {
  kind: Load | null = null;
  count = 0;
  private block = mesh(new THREE.BoxGeometry(0.62, 0.36, 0.4), MATS.snow);
  private logs = new THREE.Group();
  private holder = new THREE.Group();

  constructor(scene: THREE.Scene, private player: Player) {
    for (let i = 0; i < 2; i++) {
      const log = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 7), MATS.log, (i - 0.5) * 0.08, i * 0.17, 0);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i - 0.5) * 0.3;
      this.logs.add(log);
    }
    this.holder.add(this.block, this.logs);
    this.holder.visible = false;
    scene.add(this.holder);
  }

  hold(kind: Load, count = 1): void {
    this.kind = kind;
    this.count = count;
  }

  /** Use one of what is carried; empty arms once nothing is left. */
  take(): void {
    if (--this.count <= 0) this.drop();
  }

  drop(): void {
    this.kind = null;
    this.count = 0;
  }

  update(): void {
    const c = this.player.character;
    const holding = !!this.kind && !this.player.locked;
    this.holder.visible = holding;
    c.armOverride[0] = c.armOverride[1] = holding ? -1.15 : null;
    if (!holding) return;
    this.block.visible = this.kind === 'block';
    this.logs.visible = this.kind === 'logs';
    this.logs.children[1].visible = this.count > 1;
    const h = this.player.heading;
    this.holder.position.copy(this.player.position).add(new THREE.Vector3(Math.sin(h) * 0.48, 1.0, Math.cos(h) * 0.48));
    this.holder.rotation.y = h;
  }
}
