import * as THREE from 'three';
import type { Interaction } from '../activities/interaction';
import type { Sauna } from '../activities/sauna';
import type { Carry } from './carry';
import type { Story } from './state';

const TARGET = 80; // °C
const HOLD = 20; // seconds at or above the target
const PER_TRIP = 2;

/**
 * Chapter 2: carry logs from the woodpile by the lodge, two per trip, stoke the sauna to 80 °C
 * and keep it there for 20 seconds while Barbara and Zsofia insist it is still cold.
 */
export function createSaunaHeat(story: Story, sauna: Sauna, carry: Carry, woodpile: THREE.Vector3) {
  let held = 0;
  const fuel = { has: () => carry.kind === 'logs', use: () => carry.take() };
  const take: Interaction = { label: 'take two logs', run: () => carry.hold('logs', PER_TRIP) };

  return {
    begin(): void {
      sauna.allowDip = () => story.reached('find-gyuri'); // the cold dip comes with the restored sauna
    },
    interaction(p: THREE.Vector3): Interaction | null {
      if (!story.at('heat-sauna') || carry.kind) return null;
      return Math.hypot(p.x - woodpile.x, p.z - woodpile.z) < 2.5 ? take : null;
    },
    status(p: THREE.Vector3): string | null {
      if (!story.at('heat-sauna')) return null;
      if (sauna.isInside(p)) {
        const hot = sauna.temperature >= TARGET;
        const goal = held > 0 && hot ? `keep it hot: ${Math.ceil(HOLD - held)} s` : `heat it to ${TARGET} °C`;
        return `${sauna.status(p)}   ·   ${goal}`;
      }
      if (carry.kind === 'logs') return `Carrying ${carry.count} log${carry.count > 1 ? 's' : ''} for the sauna`;
      return null;
    },
    update(dt: number): void {
      const heating = story.at('heat-sauna');
      sauna.wood = heating ? fuel : null;
      if (!heating || sauna.temperature < TARGET) return;
      held += dt;
      if (held >= HOLD) story.advance('heat-sauna');
    },
  };
}
