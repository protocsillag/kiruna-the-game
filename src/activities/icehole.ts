import * as THREE from 'three';
import { ICE_Y } from '../world/terrain';
import { MATS, mesh } from '../world/materials';
import { Smoke } from '../world/smoke';
import type { Player } from '../player/player';
import type { Interaction } from './interaction';

const RADIUS = 0.75;
const DOWN = 0.9;
const HOLD = 1.8;
const UP = 0.9;
const DEPTH = 1.25;

export interface IceHole {
  interaction(p: THREE.Vector3): Interaction | null;
  update(dt: number): void;
}

/** An ice hole (vak) next to the sauna for a cold dip. `onPlunge` fires as you hit the water. */
export function createIceHole(scene: THREE.Scene, at: THREE.Vector3, player: Player, onPlunge: () => void): IceHole {
  const group = new THREE.Group();
  group.position.set(at.x, ICE_Y, at.z);
  scene.add(group);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(RADIUS, 28),
    new THREE.MeshStandardMaterial({ color: 0x0a1824, roughness: 0.08, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.006;
  water.receiveShadow = true;
  group.add(water);

  const rim = mesh(new THREE.TorusGeometry(RADIUS + 0.28, 0.2, 6, 24), MATS.snow);
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 0.35;
  group.add(rim);
  const chunk = new THREE.MeshStandardMaterial({ color: 0xcfe0ee, roughness: 0.3 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const c = mesh(new THREE.BoxGeometry(0.32, 0.12, 0.22), chunk, Math.cos(a) * (RADIUS + 0.6), 0.06, Math.sin(a) * (RADIUS + 0.6));
    c.rotation.set(0.1, a, 0.15);
    group.add(c);
  }

  // Ladder on the sauna side.
  const ladder = new THREE.Group();
  ladder.position.set(0, 0, RADIUS - 0.08);
  ladder.rotation.x = -0.25;
  for (const x of [-0.2, 0.2]) ladder.add(mesh(new THREE.BoxGeometry(0.04, 1.6, 0.04), MATS.wood, x, -0.35, 0));
  for (let i = 0; i < 3; i++) ladder.add(mesh(new THREE.BoxGeometry(0.4, 0.035, 0.035), MATS.wood, 0, 0.25 - i * 0.35, 0));
  group.add(ladder);

  const mist = new Smoke(scene, new THREE.Vector3(at.x, ICE_Y + 0.1, at.z), {
    count: 24, life: 3.5, rise: 0.25, spread: 1.0, size: [0.4, 1.6], opacity: 0.3,
  });
  mist.rate = 0.6; // sea smoke: open water steams in −12 °C air

  const exit = new THREE.Vector3(at.x, ICE_Y, at.z + RADIUS + 0.9);
  const root = new THREE.Vector3();
  let t = -1; // < 0 = not dipping
  let plunged = false;

  const dip: Interaction = {
    label: 'cold dip',
    run() {
      t = 0;
      plunged = false;
      root.set(at.x, ICE_Y, at.z);
      player.lock(root, Math.PI, 'stand');
    },
  };

  return {
    interaction(p) {
      if (t >= 0) return null;
      return Math.hypot(p.x - at.x, p.z - at.z) < RADIUS + 0.9 ? dip : null;
    },
    update(dt) {
      mist.update(dt, 0.3, 0.1);
      if (t < 0) return;
      t += dt;
      let depth: number;
      if (t < DOWN) depth = THREE.MathUtils.smoothstep(t, 0, DOWN);
      else if (t < DOWN + HOLD) depth = 1;
      else depth = 1 - THREE.MathUtils.smoothstep(t, DOWN + HOLD, DOWN + HOLD + UP);
      if (!plunged && t > DOWN * 0.5) {
        plunged = true;
        mist.burst(10);
        onPlunge();
      }
      root.y = ICE_Y - depth * DEPTH;
      player.lock(root, Math.PI, 'stand');
      if (t >= DOWN + HOLD + UP) {
        t = -1;
        player.unlock(exit);
      }
    },
  };
}
