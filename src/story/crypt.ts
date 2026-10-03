import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { createHall } from '../icehotel/hall';
import { ICE, glow, part, tintedSnice } from '../icehotel/ice';
import type { Interaction } from '../activities/interaction';
import type { Npc, Npcs } from '../npc/npcs';
import type { Player } from '../player/player';
import type { OrbitCamera } from '../player/camera';
import { fadeThrough } from './fade';
import type { Story } from './state';

const DEPTH = 9; // metres below the hotel floor
const SIZE = { w: 6, d: 8, wallH: 3 };

/**
 * Chapter 7: a small blue crypt under the Royal Suite (built only in story mode, out of sight
 * below the ground). The King stands frozen mid-song in a block of ice; the whiskey wakes him.
 */
export function createCrypt(
  scene: THREE.Scene, world: World, story: Story, npcs: Npcs, player: Player, orbit: OrbitCamera,
  king: Npc, centre: THREE.Vector3, upstairs: () => THREE.Vector3, onWake: () => void,
) {
  const floorY = centre.y - DEPTH;
  const r = { x0: centre.x - SIZE.w / 2, x1: centre.x + SIZE.w / 2, z0: centre.z - SIZE.d / 2, z1: centre.z + SIZE.d / 2 };
  const bottom = new THREE.Vector3(centre.x, floorY, r.z1 - 2.9); // foot of the stairs
  const kingAt = new THREE.Vector3(centre.x, floorY + 0.3, r.z0 + 1.4);
  const box = new THREE.Box3(new THREE.Vector3(r.x0, floorY - 1, r.z0), new THREE.Vector3(r.x1, floorY + 6, r.z1));
  let built = false;
  let block: THREE.Mesh | null = null;
  let below = false;

  const build = () => {
    built = true;
    createHall(scene, world, floorY, { ...r, wallH: SIZE.wallH, axis: 'z', mats: tintedSnice(0x3f6fff, 0.5) });
    const floor = part(scene, new THREE.BoxGeometry(SIZE.w, 0.4, SIZE.d), tintedSnice(0x2a4fd0, 0.35)[0], centre.x, floorY - 0.2, centre.z);
    floor.receiveShadow = true;
    world.createCollider(RAPIER.ColliderDesc.cuboid(SIZE.w / 2, 0.2, SIZE.d / 2).setTranslation(centre.x, floorY - 0.2, centre.z));
    // Stairs climbing into the far wall, and a pedestal for the King.
    for (let i = 0; i < 6; i++) part(scene, new THREE.BoxGeometry(1.4, 0.25 * (i + 1), 0.4), ICE, centre.x, floorY + 0.125 * (i + 1), r.z1 - 2.2 + i * 0.4); // tallest step at the wall
    part(scene, new THREE.CylinderGeometry(0.8, 0.9, 0.3, 24), ICE, kingAt.x, floorY + 0.15, kingAt.z);
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.15, 0.9).setTranslation(kingAt.x, floorY + 0.15, kingAt.z));
    for (const s of [-1, 1]) {
      part(scene, new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), ICE, kingAt.x + s * 1.6, floorY + 0.6, kingAt.z + 0.4);
      part(scene, new THREE.SphereGeometry(0.16, 12, 8), glow(0x7fb0ff, 3), kingAt.x + s * 1.6, floorY + 1.3, kingAt.z + 0.4).castShadow = false;
    }
    const light = new THREE.PointLight(0x6f9cff, 14, 12, 1.6);
    light.position.set(centre.x, floorY + 2.6, centre.z);
    scene.add(light);
    block = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.8), ICE);
    block.position.set(kingAt.x, kingAt.y + 1.05, kingAt.z);
    scene.add(block);
  };

  const go = (down: boolean) => fadeThrough(() => {
    below = down;
    orbit.floor = down ? floorY : null;
    player.unlock(down ? bottom : upstairs());
  });
  const descend: Interaction = { label: 'go down the stairs', run: () => go(true) };
  const climb: Interaction = { label: 'climb the stairs', run: () => go(false) };
  const give: Interaction = {
    label: 'give the King the whiskey',
    run() {
      story.items.delete('flask');
      if (block) block.visible = false;
      king.character.armOverride[0] = null;
      npcs.tell(king, [{ text: "...Ahh. Smoky. I can't lose yet. Not yet. I still want to live." }]);
      onWake();
    },
  };
  const near = (p: THREE.Vector3, q: THREE.Vector3, d: number) => Math.hypot(p.x - q.x, p.z - q.z) < d && Math.abs(p.y - q.y) < 3;

  return {
    /** Snow is kept out of the crypt by widening the hotel's snow-free box down to here. */
    box,
    get below() {
      return below;
    },
    begin(): void {
      if (story.reached('end')) return;
      build();
      // The King waits below, frozen mid-song with his right arm raised.
      npcs.move(king, kingAt, 0, { pose: 'stand' }); // facing the stairs
      king.character.armOverride[0] = -2.2;
      npcs.setHidden(king, !story.reached('crypt'));
    },
    interaction(p: THREE.Vector3): Interaction | null {
      if (!built || !story.reached('crypt') || story.reached('end')) return null;
      if (!below) return near(p, upstairs(), 1.3) ? descend : null;
      if (near(p, bottom, 1.4)) return climb;
      if (story.items.has('flask') && near(p, kingAt, 2.0)) return give;
      return null;
    },
    status: (): string | null => null,
    update(): void {
      if (built && story.reached('crypt') && king.hidden) npcs.setHidden(king, false);
    },
  };
}
