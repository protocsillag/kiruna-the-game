import * as THREE from 'three';
import RAPIER, { type Collider, type World } from '@dimforge/rapier3d-compat';
import type { Interaction } from '../activities/interaction';
import type { Npc, Npcs } from '../npc/npcs';
import type { Igloo } from '../activities/igloo';
import type { Sauna } from '../activities/sauna';
import type { Player } from '../player/player';
import { Pockets } from '../ui/pockets';
import { Carry } from './carry';
import { createIglooBuild } from './igloobuild';
import { createSaunaHeat } from './saunaheat';
import type { IceHotel } from '../icehotel/icehotel';
import type { Sky } from '../sky/sky';
import type { Hud } from '../ui/hud';
import { Beacon } from './beacon';
import { storyScript } from './dialogue';
import type { Story } from './state';
import type { TargetId } from './steps';

const STORY_START_HOUR = 15.3; // blue hour

interface Provider {
  interaction(p: THREE.Vector3): Interaction | null;
}

interface Parts {
  scene: THREE.Scene;
  world: World;
  story: Story;
  sky: Sky;
  hud: Hud;
  npcs: Npcs;
  hotel: IceHotel;
  igloo: Igloo;
  iglooRot: number;
  sauna: Sauna;
  player: Player;
  woodpile: THREE.Vector3;
  /** Gyuri stays out of sight until his chapter. */
  gyuri: Npc;
  targets: Record<TargetId, THREE.Vector3>;
}

/**
 * Story mode on top of the finished world: it starts dimmed (no aurora, no King, locked doors) and
 * each chapter gives a piece back. Everything here is a pass-through in free roam.
 */
export function createStoryWorld(parts: Parts) {
  const { scene, world, story, sky, hud, npcs, hotel, targets } = parts;
  const beacon = new Beacon(scene);
  const pockets = new Pockets();
  const carry = new Carry(scene, parts.player);
  const iglooBuild = createIglooBuild(scene, world, story, parts.igloo, parts.iglooRot, carry, parts.player);
  const saunaHeat = createSaunaHeat(story, parts.sauna, carry, parts.woodpile);
  const activities = [iglooBuild, saunaHeat];

  /**
   * Wrap an interaction provider: until the story reaches `step`, the prompt it would show
   * becomes `closed` (or nothing) and E does nothing. Always open in free roam.
   */
  const gate = (p: Provider, step: string | null, closed: string | null): Provider => ({
    interaction(pos) {
      if (step && story.reached(step)) return p.interaction(pos);
      if (!story.active) return p.interaction(pos);
      return closed && p.interaction(pos) ? { label: closed, run: () => {} } : null;
    },
  });

  // The ICEHOTEL front door: a plain wooden door with a padlock, until chapter 5 opens it.
  let door: { mesh: THREE.Group; collider: Collider } | null = null;
  const lockDoor = () => {
    const { at, w, h } = hotel.door;
    const mesh = new THREE.Group();
    mesh.position.set(at.x, at.y, at.z + 0.05);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.85 });
    const planks = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), wood);
    planks.position.y = h / 2;
    planks.castShadow = planks.receiveShadow = true;
    const brass = new THREE.MeshStandardMaterial({ color: 0xc89b3c, roughness: 0.35, metalness: 0.8 });
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.08), brass);
    lock.position.set(w * 0.3, 1.15, 0.1);
    mesh.add(planks, lock);
    scene.add(mesh);
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, h / 2, 0.25).setTranslation(at.x, at.y + h / 2, at.z + 0.05),
    );
    door = { mesh, collider };
  };
  const unlockDoor = () => {
    if (!door) return;
    scene.remove(door.mesh);
    world.removeCollider(door.collider, false);
    door = null;
  };
  const doorPrompt: Interaction = { label: 'the door is locked', run: () => {} };

  const refresh = () => {
    const step = story.current;
    hud.objective(step?.objective ?? null);
    beacon.point(step?.target ? targets[step.target] : null);
    pockets.show(story.items);
    npcs.setHidden(parts.gyuri, !story.reached('find-gyuri'));
  };
  story.onChange((chapterChanged) => {
    carry.drop();
    refresh();
    if (chapterChanged) {
      hud.chapter(story.chapter, story.chapterTitle);
      hud.flash('Progress saved');
    }
  });

  return {
    gate,
    /** Chapter mini-games (cut a block, take logs...). */
    activities: {
      interaction(p: THREE.Vector3): Interaction | null {
        if (!story.active) return null;
        for (const a of activities) {
          const action = a.interaction(p);
          if (action) return action;
        }
        return null;
      },
    },
    status(p: THREE.Vector3): string | null {
      if (!story.active) return null;
      for (const a of activities) {
        const text = a.status(p);
        if (text) return text;
      }
      return null;
    },
    /** Shown at the locked hotel door. */
    door: {
      interaction(p: THREE.Vector3): Interaction | null {
        if (!door) return null;
        const { at } = hotel.door;
        return Math.hypot(p.x - at.x, p.z - (at.z + 1.2)) < 2.2 ? doorPrompt : null;
      },
    },
    /** Called once when the player picks Story on the title card. */
    begin(fresh: boolean): void {
      story.begin(fresh);
      sky.aurora = false;
      sky.clock.nightOnly = true;
      sky.clock.hours = STORY_START_HOUR;
      npcs.script = storyScript(story, {
        instagram: () => hud.post('@kiruna.nights', '👑🎸', 'Thank you Camp Alta! Another night of songs by the fire. Same time tomorrow? ❄️'),
      });
      iglooBuild.begin();
      saunaHeat.begin();
      npcs.setHidden(hotel.king, true); // the throne starts empty
      if (!story.reached('rooms')) lockDoor();
      refresh();
      hud.chapter(story.chapter, story.chapterTitle);
    },
    update(dt: number, player: THREE.Vector3): void {
      if (!story.active) return;
      if (door && story.reached('rooms')) unlockDoor();
      beacon.update(dt, player);
      iglooBuild.update(dt);
      saunaHeat.update(dt);
      carry.update();
      pockets.show(story.items);
    },
  };
}
