import * as THREE from 'three';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import { groundHeight } from '../world/terrain';
import { createSpruce } from '../world/trees';
import type { Snowmobile } from '../vehicles/snowmobile';
import type { Sky } from '../sky/sky';
import { fadeThrough } from './fade';
import type { Story } from './state';

/** From the snowmobile's parking spot (camp) out across the ice and back toward the husky farm. */
const START = { x: 6, z: -4.5 };
const RINGS = [
  { x: 8, z: -45 },
  { x: -15, z: -95 }, // swing right
  { x: 30, z: -140 }, // and back left, far out
  { x: 95, z: -120 }, // east, into the whiteout
  { x: 75, z: -50 }, // home toward the farm: the crash ring
];
const WHITEOUT_AFTER = 3; // rings passed before the whiteout rolls in
const PASS_RADIUS = 7;
const TREE_AFTER = 7; // metres past the last ring
/** Heading across the lake toward the ICEHOTEL instead: the run ends (with a crash) here. */
const TOO_FAR_Z = -190;

/**
 * Chapter 3: ride the snowmobile through five light rings with turns. Past the third a whiteout
 * rolls in; the fifth ring is where it ends: a spruce right behind it, and the crash always
 * happens. Heading off toward the ICEHOTEL ends it the same way, back at the fifth ring.
 */
export function createSnowRun(scene: THREE.Scene, world: World, story: Story, sled: Snowmobile, sky: Sky, onCrash: (at: THREE.Vector3) => void) {
  const ringGeo = new THREE.TorusGeometry(2.8, 0.14, 8, 40);
  const rings = RINGS.map((p, i) => {
    const from = i ? RINGS[i - 1] : START;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd59a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.set(p.x, groundHeight(p.x, p.z) + 3.0, p.z);
    ring.rotation.y = Math.atan2(p.x - from.x, p.z - from.z); // face the way you arrive: ride through it
    ring.visible = false;
    scene.add(ring);
    return ring;
  });
  const last = RINGS[RINGS.length - 1];
  const prev = RINGS[RINGS.length - 2];
  const dir = new THREE.Vector2(last.x - prev.x, last.z - prev.z).normalize();
  const heading = Math.atan2(dir.x, dir.y);
  const treeAt = new THREE.Vector3(last.x + dir.x * TREE_AFTER, 0, last.z + dir.y * TREE_AFTER);
  treeAt.y = groundHeight(treeAt.x, treeAt.z);
  /** Where the sled ends up: nose against the spruce. */
  const wreck = new THREE.Vector3(treeAt.x - dir.x * 2.4, 0, treeAt.z - dir.y * 2.4);
  wreck.y = groundHeight(wreck.x, wreck.z);

  const white = document.createElement('div');
  white.className = 'fx fx-white';
  document.body.append(white);
  let tree: { group: THREE.Group; collider: Collider } | null = null;
  let passed = 0;
  let whiteout = 0;
  let time = 0;
  let crashing = false;

  const crash = () => {
    crashing = true;
    sled.placeAt(wreck.x, wreck.z, heading);
    sled.crash();
    onCrash(wreck);
    story.advance('snowmobile-run');
  };
  const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

  return {
    /** The spruce behind the fifth ring (story mode only), and the wreck spot in front of it. */
    spruce: treeAt,
    wreck,
    wreckHeading: heading,
    begin(): void {
      if (!tree) tree = createSpruce(scene, world, treeAt.x, treeAt.z, 1.4);
    },
    /** Where the beacon should point while the run is on (the next ring). */
    target(): THREE.Vector3 | null {
      if (!story.at('snowmobile-run')) return null;
      return rings[Math.min(passed, rings.length - 1)].position;
    },
    status(): string | null {
      if (!story.at('snowmobile-run') || !sled.riding) return null;
      if (passed >= WHITEOUT_AFTER) return `Whiteout!  Follow the lights   ·   ${passed} / ${rings.length}`;
      return `Rings  ${passed} / ${rings.length}`;
    },
    update(dt: number): void {
      time += dt;
      const running = story.at('snowmobile-run');
      rings.forEach((r, i) => {
        r.visible = running && i >= passed;
        (r.material as THREE.MeshBasicMaterial).opacity = i === passed ? 0.75 + Math.sin(time * 4) * 0.2 : 0.25;
      });
      if (running && sled.riding && !crashing) {
        if (flat(sled.position, rings[passed].position) < PASS_RADIUS) {
          if (passed === rings.length - 1) crash();
          else passed++;
        } else if (sled.position.z < TOO_FAR_Z) {
          // Off toward the ICEHOTEL: the whiteout swallows you and you come to at the spruce.
          crashing = true;
          passed = WHITEOUT_AFTER;
          fadeThrough(crash, 600);
        }
      }
      const want = running && passed >= WHITEOUT_AFTER ? 1 : 0;
      whiteout += (want - whiteout) * Math.min(1, dt * (want ? 0.6 : 0.25));
      if (whiteout < 0.002) whiteout = 0;
      sky.whiteout = whiteout;
      white.style.opacity = (whiteout * 0.35).toFixed(3);
    },
  };
}
