import * as THREE from 'three';
import type { Interaction } from '../activities/interaction';
import type { Player } from '../player/player';
import type { Story } from './state';
import { SYMBOLS } from './symbols';

const BARS = 7;
const ORDER = SYMBOLS.map((s) => s.bar); // the order the King walked the rooms
/** Royal Suite, room-local: where you stand at the foot of the bed, and the hidden staircase. */
const STAND = { x: 0, z: 0.9 };
export const STAIRS = { x: 1.95, z: 0.4 };

interface Steer {
  move(): { fwd: number; side: number };
  pressed(code: string): boolean;
}

/**
 * Chapter 6's lock: stand at the foot of the Royal Suite bed (E), pick a sunburst bar with
 * steer (A/D), press it with E, step back with brake (S). The four symbols in order open a
 * staircase beside the bed. A wrong bar just dims them all; start again.
 */
export function createHeadboard(story: Story, suite: THREE.Group, player: Player, touch: boolean) {
  const glowMat = (on: boolean) => new THREE.MeshBasicMaterial({ color: on ? 0xffe2a0 : 0x9fc6ff, transparent: true, opacity: on ? 0.95 : 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const bars = Array.from({ length: BARS }, (_, k) => {
    const a = Math.PI * ((BARS - k) / 8); // bar 1 is the leftmost seen from the bed's foot
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.24, 0.03), glowMat(false));
    m.position.set(-Math.cos(a) * 0.62, 1.1 + Math.sin(a) * 0.62, 3.62);
    m.rotation.z = Math.PI / 2 - a;
    m.visible = false;
    suite.add(m);
    return m;
  });
  const stairs = new THREE.Group();
  stairs.position.set(STAIRS.x, 0.03, STAIRS.z);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 1.3), new THREE.MeshBasicMaterial({ color: 0x050a18 }));
  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.015, 1.4), new THREE.MeshBasicMaterial({ color: 0x4f86ff }));
  rim.position.y = -0.005;
  stairs.add(rim, hole);
  stairs.visible = false;
  suite.add(stairs);

  const standAt = suite.localToWorld(new THREE.Vector3(STAND.x, 0, STAND.z));
  const stairsAt = suite.localToWorld(new THREE.Vector3(STAIRS.x, 0, STAIRS.z));
  const facing = suite.rotation.y; // room-local +Z, toward the headboard
  let active = false;
  let pick = 3;
  let entered = 0;
  let lastSteer = 0;
  let note = '';
  let noteLeft = 0;

  const paint = () => bars.forEach((b, i) => {
    const lit = i === pick || ORDER.slice(0, entered).includes(i + 1);
    b.material = glowMat(lit);
    b.scale.set(i === pick ? 1.6 : 1, 1, 1);
  });
  const leave = () => {
    active = false;
    player.unlock(standAt.clone().add(new THREE.Vector3(-Math.sin(facing), 0, -Math.cos(facing)).multiplyScalar(0.6)));
  };
  const press = () => {
    if (ORDER[entered] === pick + 1) {
      entered++;
      note = `Bar ${pick + 1} glows and stays lit.`;
      if (entered >= ORDER.length) {
        note = 'Something rumbles under the bed... a staircase opens!';
        story.advance('headboard');
        leave();
      }
    } else {
      entered = 0;
      note = 'Click. All the bars go dim. Start again.';
    }
    noteLeft = 3;
    paint();
  };
  const sitDown: Interaction = {
    label: 'look at the sunburst headboard',
    run() {
      active = true;
      player.lock(standAt, facing, 'stand');
      paint();
    },
  };
  const pressIt: Interaction = { label: 'press the bar', run: press };

  return {
    /** Where the stairs come back up. */
    stairsAt,
    get stairsOpen() {
      return story.reached('crypt');
    },
    begin(): void {
      bars.forEach((b) => (b.visible = story.reached('headboard')));
      stairs.visible = story.reached('crypt');
    },
    interaction(p: THREE.Vector3): Interaction | null {
      if (!story.at('headboard')) return null;
      if (active) return pressIt;
      return Math.hypot(p.x - standAt.x, p.z - standAt.z) < 1.2 ? sitDown : null;
    },
    status(): string | null {
      if (noteLeft > 0) return note;
      if (!active) return null;
      return `Bar ${pick + 1} of ${BARS}  ·  ${touch ? 'stick left/right to choose, down to step back' : 'A / D choose  ·  E press  ·  S step back'}`;
    },
    update(dt: number, input: Steer): void {
      noteLeft -= dt;
      bars.forEach((b) => (b.visible = story.reached('headboard')));
      stairs.visible = story.reached('crypt');
      if (!active) return;
      if (!story.at('headboard')) return leave();
      const m = input.move();
      const steer = m.side > 0.5 ? 1 : m.side < -0.5 ? -1 : 0;
      if (steer && steer !== lastSteer) {
        pick = THREE.MathUtils.clamp(pick + steer, 0, BARS - 1);
        paint();
      }
      lastSteer = steer;
      if (m.fwd < -0.5) leave();
    },
  };
}
