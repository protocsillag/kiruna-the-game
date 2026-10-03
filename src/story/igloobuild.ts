import * as THREE from 'three';
import RAPIER, { type Collider, type World } from '@dimforge/rapier3d-compat';
import { MATS, mesh } from '../world/materials';
import { groundHeight } from '../world/terrain';
import type { Igloo } from '../activities/igloo';
import type { Interaction } from '../activities/interaction';
import type { Player } from '../player/player';
import type { Carry } from './carry';
import type { Story } from './state';

/** Mound size per stage: 0 is the small silent mound story mode starts with, 4 is today's igloo. */
const SIZES = [0.5, 0.62, 0.75, 0.88, 1];
const PER_STAGE = 2;
const TOTAL = PER_STAGE * (SIZES.length - 1);
/** Where each block goes round the mound (degrees from igloo-local +X; the entrance is at −90). */
const ANGLES = [-20, 200, 30, 150, 70, 110, -45, 225];
const DRIFT = { lx: 6.8, lz: 1.0 };

/**
 * Chapter 1: cut snow blocks at the drift (E), carry one at a time to the glowing outline on
 * the mound, and the Ice Hostel grows in four stages. Balazs and Richard supervise.
 */
export function createIglooBuild(scene: THREE.Scene, world: World, story: Story, igloo: Igloo, rotY: number, carry: Carry, player: Player) {
  const drift = igloo.toWorld(DRIFT.lx, DRIFT.lz);
  let driftObj: { group: THREE.Group; collider: Collider } | null = null;
  const showDrift = () => {
    const group = new THREE.Group();
    group.position.copy(drift);
    const heap = mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), MATS.snow);
    heap.scale.set(1.5, 0.75, 1.1);
    const cut = mesh(new THREE.BoxGeometry(0.66, 0.42, 0.5), MATS.snow, -0.9, 0.12, 0.35); // a block half cut out
    cut.rotation.y = 0.4;
    const blade = mesh(new THREE.BoxGeometry(0.03, 0.55, 0.16), MATS.metal, 0.35, 0.95, -0.1);
    blade.rotation.z = 0.25;
    const handle = mesh(new THREE.BoxGeometry(0.06, 0.12, 0.3), MATS.wood, 0.42, 1.28, -0.1);
    group.add(heap, cut, blade, handle);
    scene.add(group);
    const collider = world.createCollider(RAPIER.ColliderDesc.cylinder(0.4, 1.1).setTranslation(drift.x, drift.y + 0.4, drift.z));
    driftObj = { group, collider };
  };

  const slot = (i: number) => {
    const s = SIZES[Math.floor(i / PER_STAGE)];
    const r = igloo.radius * s * 0.9 + 0.2;
    const a = THREE.MathUtils.degToRad(ANGLES[i]);
    const at = igloo.toWorld(Math.cos(a) * r, Math.sin(a) * r);
    // Long side along the mound's curve.
    return { at, rot: rotY + Math.atan2(-Math.cos(a), -Math.sin(a)) };
  };
  const blockGeo = new THREE.BoxGeometry(0.62, 0.36, 0.4);
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xffd59a, transparent: true, opacity: 0.4, depthWrite: false });
  const outline = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.46), outlineMat);
  outline.visible = false;
  scene.add(outline);
  let laid: THREE.Mesh[] = [];
  let placed = 0;
  let time = 0;
  const putOutline = () => {
    const s = slot(placed);
    outline.position.copy(s.at).setY(s.at.y + 0.21);
    outline.rotation.y = s.rot;
  };

  /** Keep the player out of the bigger mound when it grows around them. */
  const nudgePlayer = (size: number) => {
    const c = igloo.toWorld(0, 0);
    const p = player.position;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    const clear = igloo.radius * size + 0.6;
    if (d >= clear) return;
    const k = clear / Math.max(d, 0.01);
    const x = c.x + (p.x - c.x) * k;
    const z = c.z + (p.z - c.z) * k;
    player.unlock(new THREE.Vector3(x, groundHeight(x, z), z));
  };

  const cut: Interaction = { label: 'cut a snow block', run: () => carry.hold('block') };
  const place: Interaction = {
    label: 'place the snow block',
    run() {
      carry.take();
      const s = slot(placed);
      const block = mesh(blockGeo, MATS.snow, s.at.x, s.at.y + 0.18, s.at.z);
      block.rotation.y = s.rot;
      scene.add(block);
      laid.push(block);
      placed++;
      if (placed % PER_STAGE === 0) {
        // The blocks melt into a bigger mound.
        laid.forEach((b) => scene.remove(b));
        laid = [];
        const size = SIZES[placed / PER_STAGE];
        igloo.setSize(size);
        nudgePlayer(size);
      }
      if (placed >= TOTAL) story.advance('build-igloo');
      else putOutline();
    },
  };
  const near = (p: THREE.Vector3, q: THREE.Vector3, r: number) => Math.hypot(p.x - q.x, p.z - q.z) < r;

  return {
    /** Story begins: start small unless chapter 1 is already done. */
    begin(): void {
      const done = story.reached('igloo-done');
      igloo.setSize(done ? 1 : SIZES[0]);
      if (!done) showDrift();
      placed = 0;
      putOutline();
    },
    interaction(p: THREE.Vector3): Interaction | null {
      if (!story.at('build-igloo')) return null;
      if (!carry.kind && near(p, drift, 2.6)) return cut;
      if (carry.kind === 'block' && near(p, outline.position, 2.3)) return place;
      return null;
    },
    status(p: THREE.Vector3): string | null {
      if (!story.at('build-igloo') || (!carry.kind && !near(p, drift, 14))) return null;
      return `Ice Hostel  ${placed} / ${TOTAL} blocks` + (carry.kind === 'block' ? '  ·  carrying a snow block' : '');
    },
    update(dt: number): void {
      time += dt;
      const building = story.at('build-igloo');
      outline.visible = building;
      outlineMat.opacity = (carry.kind === 'block' ? 0.45 : 0.18) + Math.sin(time * 3) * 0.1;
      if (driftObj && story.reached('igloo-done')) {
        scene.remove(driftObj.group);
        world.removeCollider(driftObj.collider, false);
        driftObj = null;
      }
    },
  };
}
