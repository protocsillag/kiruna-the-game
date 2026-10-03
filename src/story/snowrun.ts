import * as THREE from 'three';
import { groundHeight } from '../world/terrain';
import { TRAIL_HEADING, trailPoint } from '../world/trail';
import type { Snowmobile } from '../vehicles/snowmobile';
import type { Sky } from '../sky/sky';
import type { Story } from './state';

/** Checkpoint lights along the trail poles (trail t); the lone spruce waits just past the last. */
const CHECK_T = [0.04, 0.09, 0.14, 0.19, 0.24];
const WHITEOUT_AFTER = 3; // checkpoints passed before the whiteout rolls in
const PASS_RADIUS = 7;
const CRASH_RADIUS = 8;

/**
 * Chapter 3: ride the snowmobile through light checkpoints along the trail. Past the midpoint a
 * whiteout rolls in, the last light sits by the lone spruce, and the crash always happens.
 */
export function createSnowRun(scene: THREE.Scene, story: Story, sled: Snowmobile, sky: Sky, spruce: THREE.Vector3, onCrash: (at: THREE.Vector3) => void) {
  const ringGeo = new THREE.TorusGeometry(2.6, 0.12, 8, 40);
  const rings = CHECK_T.map((t) => {
    const p = trailPoint(t);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd59a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.set(p.x, groundHeight(p.x, p.y) + 2.8, p.y);
    ring.rotation.y = TRAIL_HEADING; // face along the trail: ride through it
    ring.visible = false;
    scene.add(ring);
    return ring;
  });
  const white = document.createElement('div');
  white.className = 'fx fx-white';
  document.body.append(white);
  let passed = 0;
  let whiteout = 0;
  let time = 0;

  const crash = () => {
    const at = sled.position.clone();
    sled.crash();
    onCrash(at);
    story.advance('snowmobile-run');
  };
  const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

  return {
    /** Where the beacon should point while the run is on (the next light, then the spruce). */
    target(): THREE.Vector3 | null {
      if (!story.at('snowmobile-run')) return null;
      return passed < rings.length ? rings[passed].position : spruce;
    },
    status(): string | null {
      if (!story.at('snowmobile-run') || !sled.riding) return null;
      if (passed >= WHITEOUT_AFTER) return 'Whiteout!  Follow the lights';
      return `Checkpoints  ${passed} / ${rings.length}`;
    },
    update(dt: number): void {
      time += dt;
      const running = story.at('snowmobile-run');
      rings.forEach((r, i) => {
        r.visible = running && i >= passed;
        (r.material as THREE.MeshBasicMaterial).opacity = i === passed ? 0.75 + Math.sin(time * 4) * 0.2 : 0.25;
      });
      if (running && sled.riding) {
        if (passed < rings.length && flat(sled.position, rings[passed].position) < PASS_RADIUS) passed++;
        if (passed >= WHITEOUT_AFTER && flat(sled.position, spruce) < CRASH_RADIUS) crash();
      }
      const want = running && passed >= WHITEOUT_AFTER ? 1 : 0;
      whiteout += (want - whiteout) * Math.min(1, dt * (want ? 0.6 : 0.25));
      if (whiteout < 0.002) whiteout = 0;
      sky.whiteout = whiteout;
      white.style.opacity = (whiteout * 0.35).toFixed(3);
    },
  };
}
