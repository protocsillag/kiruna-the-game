import * as THREE from 'three';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import { groundHeight } from '../world/terrain';
import { createSpruce } from '../world/trees';
import type { Snowmobile } from '../vehicles/snowmobile';
import type { Sky } from '../sky/sky';
import { fadeThrough } from './fade';
import { playCrash } from '../audio/crash';
import type { Player } from '../player/player';
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
export function createSnowRun(scene: THREE.Scene, world: World, story: Story, sled: Snowmobile, player: Player, sky: Sky, onCrash: (at: THREE.Vector3) => void) {
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
  let flash = 0;
  /** A spruce that shoots up out of the snow right in front of you (off-course crash). */
  let popTree: { group: THREE.Group; collider: Collider; t: number } | null = null;

  const bang = () => {
    flash = 1;
    playCrash();
  };
  /** Following the rings: the fifth one ends in the spruce right behind it. */
  const crash = () => {
    crashing = true;
    sled.placeAt(wreck.x, wreck.z, heading);
    sled.crash();
    bang();
    onCrash(wreck);
    story.advance('snowmobile-run');
  };
  /** Off toward the ICEHOTEL: a tree appears out of the whiteout, crash, and you come to at the wreck. */
  const crashOffCourse = () => {
    crashing = true;
    passed = WHITEOUT_AFTER; // the whiteout rolls in
    const f = new THREE.Vector3(Math.sin(sled.heading), 0, Math.cos(sled.heading));
    const at = sled.position.clone().addScaledVector(f, 3.2);
    popTree = { ...createSpruce(scene, world, at.x, at.z, 1.4), t: 0 };
    popTree.group.scale.setScalar(0.05);
    window.setTimeout(() => {
      sled.crash();
      bang();
      onCrash(wreck); // Yoppi and Gyuri wait at the real wreck spot
      story.advance('snowmobile-run');
    }, 250);
    window.setTimeout(() => fadeThrough(() => {
      if (popTree) {
        scene.remove(popTree.group);
        world.removeCollider(popTree.collider, false);
        popTree = null;
      }
      sled.placeAt(wreck.x, wreck.z, heading);
      const side = onGroundAt(wreck.x + Math.cos(heading) * 1.8, wreck.z - Math.sin(heading) * 1.8);
      player.unlock(side);
    }, 600), 2600);
  };
  const onGroundAt = (x: number, z: number) => new THREE.Vector3(x, groundHeight(x, z), z);
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
          crashOffCourse();
        }
      }
      const want = running && passed >= WHITEOUT_AFTER ? 1 : 0;
      whiteout += (want - whiteout) * Math.min(1, dt * (want ? 0.6 : 0.25));
      if (whiteout < 0.002) whiteout = 0;
      if (popTree && popTree.t < 1) {
        popTree.t = Math.min(1, popTree.t + dt / 0.25);
        popTree.group.scale.setScalar(1.4 * (0.05 + 0.95 * popTree.t) * (1 + Math.sin(popTree.t * Math.PI) * 0.15));
      }
      flash = Math.max(0, flash - dt * 1.6);
      sky.whiteout = whiteout;
      white.style.opacity = Math.min(1, whiteout * 0.35 + flash * 0.85).toFixed(3);
    },
  };
}
