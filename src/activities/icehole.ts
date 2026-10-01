import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { ICE_Y } from '../world/terrain';
import { MATS, mesh } from '../world/materials';
import { Smoke } from '../world/smoke';
import type { Player } from '../player/player';
import type { Interaction } from './interaction';

const DOWN = 0.9;
const HOLD = 1.8;
const UP = 0.9;
const DEPTH = 1.25;
/** Camera aims ~0.5 m above the floor during the dip (focus + 1.5 m look height). */
const FOCUS_DROP = 1.0;

export interface IceHole {
  dipping: boolean;
  /** Collider handles the camera ray should ignore (the invisible block over the hole). */
  cameraIgnore: number[];
  interaction(p: THREE.Vector3): Interaction | null;
  update(dt: number): void;
}

/**
 * A square opening cut through the sauna floor into the lake, with a wooden frame and a ladder.
 * `centre` is on the ice; `floorY` is the sauna floor; `exit` is where you climb out (on the floor).
 */
export function createIceHole(
  scene: THREE.Scene,
  world: World,
  centre: THREE.Vector3,
  size: number,
  floorY: number,
  exit: THREE.Vector3,
  player: Player,
  onPlunge: () => void,
): IceHole {
  const group = new THREE.Group();
  group.position.set(centre.x, ICE_Y, centre.z);
  scene.add(group);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color: 0x0a1824, roughness: 0.06, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.006;
  water.receiveShadow = true;
  group.add(water);

  // Frame boards around the opening, flush with the floor, plus a low curb.
  const rise = floorY - ICE_Y;
  for (const [x, z, w, d] of [[0, -size / 2, size + 0.2, 0.1], [0, size / 2, size + 0.2, 0.1], [-size / 2, 0, 0.1, size], [size / 2, 0, 0.1, size]]) {
    group.add(mesh(new THREE.BoxGeometry(w, rise + 0.12, d), MATS.wood, x, (rise + 0.12) / 2, z));
  }

  // Ladder down into the water on the −Z (bench) side.
  const ladder = new THREE.Group();
  ladder.position.set(0, rise, -size / 2 + 0.12);
  ladder.rotation.x = 0.2;
  for (const x of [-0.22, 0.22]) ladder.add(mesh(new THREE.BoxGeometry(0.045, 1.9, 0.045), MATS.wood, x, -0.55, 0));
  for (let i = 0; i < 4; i++) ladder.add(mesh(new THREE.BoxGeometry(0.44, 0.035, 0.035), MATS.wood, 0, 0.25 - i * 0.38, 0));
  group.add(ladder);

  // Invisible block so you don't simply walk into the hole; the dip itself is E.
  const blocker = world.createCollider(
    RAPIER.ColliderDesc.cuboid(size / 2, 0.6, size / 2).setTranslation(centre.x, floorY + 0.6, centre.z),
  );

  const mist = new Smoke(scene, new THREE.Vector3(centre.x, ICE_Y + 0.1, centre.z), {
    count: 16, life: 3, rise: 0.25, spread: size * 0.6, size: [0.3, 1.1], opacity: 0.22,
  });
  mist.rate = 0.5;

  const root = new THREE.Vector3();
  let t = -1; // < 0 = not dipping
  let plunged = false;

  const dip: Interaction = {
    label: 'cold dip',
    run() {
      t = 0;
      plunged = false;
      root.set(centre.x, floorY, centre.z);
      player.lock(root, Math.PI, 'stand', floorY - FOCUS_DROP);
    },
  };

  const hole: IceHole = {
    dipping: false,
    cameraIgnore: [blocker.handle],
    interaction(p) {
      if (t >= 0) return null;
      const near = Math.max(Math.abs(p.x - centre.x), Math.abs(p.z - centre.z)) < size / 2 + 0.9;
      return near && p.y > floorY - 0.3 ? dip : null;
    },
    update(dt) {
      mist.update(dt);
      hole.dipping = t >= 0;
      if (t < 0) return;
      t += dt;
      let depth: number;
      if (t < DOWN) depth = THREE.MathUtils.smoothstep(t, 0, DOWN);
      else if (t < DOWN + HOLD) depth = 1;
      else depth = 1 - THREE.MathUtils.smoothstep(t, DOWN + HOLD, DOWN + HOLD + UP);
      if (!plunged && t > DOWN * 0.6) {
        plunged = true;
        mist.burst(8);
        onPlunge();
      }
      // From the floor, down the ladder to shoulder-deep in the lake.
      root.y = THREE.MathUtils.lerp(floorY, ICE_Y - DEPTH, depth);
      player.lock(root, Math.PI, 'stand', floorY - FOCUS_DROP); // camera stays at floor level, looking down
      if (t >= DOWN + HOLD + UP) {
        t = -1;
        player.unlock(exit);
      }
    },
  };
  return hole;
}
