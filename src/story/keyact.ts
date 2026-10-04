import * as THREE from 'three';
import { groundHeight } from '../world/terrain';
import type { Npcs } from '../npc/npcs';
import type { IceHotel } from '../icehotel/icehotel';
import type { Story } from './state';

/**
 * Chapter 5 at the hotel: Linnéa is locked out of her own hotel and waits by the front door
 * until the key opens it; then she is back behind reception.
 */
export function createKeyAct(story: Story, npcs: Npcs, hotel: IceHotel) {
  const linnea = hotel.receptionist;
  const inside = { at: linnea.at.clone(), heading: linnea.heading, talkFrom: linnea.talkFrom, talkRadius: linnea.talkRadius };
  const { at } = hotel.door;
  const out = new THREE.Vector3(at.x - 4.2, 0, at.z + 2.6);
  out.y = groundHeight(out.x, out.z);
  let outside = false;

  const place = () => {
    const want = !story.reached('bar');
    if (want === outside) return;
    outside = want;
    if (outside) npcs.move(linnea, out, 0); // facing the lake, where visitors come from
    else npcs.move(linnea, inside.at, inside.heading, { talkFrom: inside.talkFrom, talkRadius: inside.talkRadius });
  };

  return { begin: place, update: place };
}
