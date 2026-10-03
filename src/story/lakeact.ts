import * as THREE from 'three';
import { groundHeight } from '../world/terrain';
import { trailPoint } from '../world/trail';
import type { Npc, NpcDef, Npcs } from '../npc/npcs';
import type { Snowmobile } from '../vehicles/snowmobile';
import type { Story } from './state';

export type Spot = { at: THREE.Vector3; heading: number; opts?: Pick<NpcDef, 'pose' | 'talkFrom' | 'talkRadius' | 'reachable'> };

const ARRIVE_RADIUS = 30; // metres from the trail's end below the ICEHOTEL

/**
 * Chapters 3–4 people and places: Gyuri chills in the yurt (not at the snowmobile),
 * Yoppi turns up at the wreck with Gyuri, and riding the dogs to the far shore ends chapter 4.
 */
export function createLakeAct(story: Story, npcs: Npcs, sled: Snowmobile, gyuri: Npc, gyuriSpot: () => Spot, run: { spruce: THREE.Vector3; wreck: THREE.Vector3; wreckHeading: number }) {
  const spruce = run.spruce;
  let yoppi: Npc | null = null;
  const arrival = trailPoint(1);
  const onGround = (x: number, z: number) => new THREE.Vector3(x, groundHeight(x, z), z);

  /** Yoppi and Gyuri stand either side of the wreck, facing it. */
  const crewAt = (wreck: THREE.Vector3) => {
    const away = Math.atan2(wreck.x - spruce.x, wreck.z - spruce.z); // from the spruce out past the wreck
    const side = (s: number, d: number) => onGround(wreck.x + Math.sin(away + s) * d, wreck.z + Math.cos(away + s) * d);
    const y = side(0.9, 3.2);
    const g = side(-0.9, 3.4);
    npcs.move(yoppi!, y, Math.atan2(wreck.x - y.x, wreck.z - y.z));
    npcs.move(gyuri, g, Math.atan2(wreck.x - g.x, wreck.z - g.z));
  };

  return {
    begin(): void {
      yoppi = npcs.add({
        name: 'Yoppi', line: 'Welcome to Camp Alta!', at: onGround(spruce.x, spruce.z + 4), heading: 0, solid: true,
        // Placeholder look until the group decides (docs/STORY_BRIEF.md, open decisions).
        look: { jacket: 0x1f4fa0, pants: 0x22252b, hat: 0xe0a83a, scarf: 0xd8d2c4 },
      });
      const g = gyuriSpot();
      npcs.move(gyuri, g.at, g.heading, g.opts);
      if (story.reached('crash')) {
        sled.placeAt(run.wreck.x, run.wreck.z, run.wreckHeading);
        sled.wrecked = true;
        crewAt(run.wreck);
      }
      this.refresh();
    },
    /** The snowmobile just hit the spruce (or near enough). */
    crashed(at: THREE.Vector3): void {
      crewAt(at);
    },
    refresh(): void {
      if (yoppi) npcs.setHidden(yoppi, !story.reached('crash'));
    },
    update(player: THREE.Vector3): void {
      if (story.at('ride') && Math.hypot(player.x - arrival.x, player.z - arrival.y) < ARRIVE_RADIUS) story.advance('ride');
    },
  };
}
