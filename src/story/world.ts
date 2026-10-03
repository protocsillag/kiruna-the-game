import * as THREE from 'three';
import RAPIER, { type Collider, type World } from '@dimforge/rapier3d-compat';
import type { Interaction } from '../activities/interaction';
import type { Npc, Npcs } from '../npc/npcs';
import type { Igloo } from '../activities/igloo';
import type { Sauna } from '../activities/sauna';
import type { Yurt } from '../activities/yurt';
import type { createCamp } from '../world/camp';
import { ICEHOTEL } from '../world/terrain';
import type { Player } from '../player/player';
import { Pockets } from '../ui/pockets';
import { Carry } from './carry';
import { createIglooBuild } from './igloobuild';
import { createSaunaHeat } from './saunaheat';
import { createSnowRun } from './snowrun';
import { createLakeAct, type Spot } from './lakeact';
import type { Snowmobile } from '../vehicles/snowmobile';
import { createFishKey } from './fishkey';
import { createKeyAct } from './keyact';
import { createSymbols } from './symbols';
import { createHeadboard } from './headboard';
import { createCrypt } from './crypt';
import { createFinale } from './finale';
import type { OrbitCamera } from '../player/camera';
import type { Input } from '../player/input';
import type { IceHotel } from '../icehotel/icehotel';
import type { Sky } from '../sky/sky';
import type { Hud } from '../ui/hud';
import { Beacon } from './beacon';
import { storyScript } from './dialogue';
import type { Story } from './state';
import type { TargetId } from './steps';

const STORY_START_HOUR = 15.3; // blue hour

type Camp = ReturnType<typeof createCamp>;

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
  sauna: Sauna;
  yurt: Yurt;
  camp: Camp;
  player: Player;
  sled: Snowmobile;
  fishing: Parameters<typeof createFishKey>[1] & { away: boolean };
  touch: boolean;
  orbit: OrbitCamera;
  kingSong: { enabled: boolean };
  /** The finale is on screen: hide the HUD; and when it ends, free the mouse for the end screen. */
  onCinematic: () => void;
  onEnd: () => void;
  /** Gyuri stays out of sight until his chapter, then chills in the yurt. */
  gyuri: Npc;
  /** Screen shake etc. when the snowmobile hits the spruce. */
  onCrash: () => void;
}

/**
 * Story mode on top of the finished world: it starts dimmed (no aurora, no King, locked doors) and
 * each chapter gives a piece back. Everything here is a pass-through in free roam.
 */
export function createStoryWorld(parts: Parts) {
  const { scene, world, story, sky, hud, npcs, hotel, camp, sauna } = parts;
  const at = (x: number, z: number) => new THREE.Vector3(x, 0, z);
  const targets: Record<TargetId, THREE.Vector3> = {
    spruce: new THREE.Vector3(), // set from the snowmobile run below
    igloo: at(camp.igloo.x, camp.igloo.z),
    sauna: sauna.centre,
    gyuri: at(camp.yurt.x, camp.yurt.z),
    farm: at(camp.dogFarm.x, camp.dogFarm.z),
    hotel: at(ICEHOTEL.x, ICEHOTEL.front + 3),
    fishing: at(sauna.centre.x + 9.5, sauna.centre.z - 2.5),
    suite: hotel.rooms[4].position.clone(), // the Royal Suite
  };
  // Gyuri leaves the snowmobile for a seat by the fire in the yurt (reserved only in story mode).
  const gyuriSpot = (): Spot => {
    const s = parts.yurt.reserveBackSeat();
    return { at: s.root, heading: s.heading, opts: { pose: 'sit', talkFrom: s.front, talkRadius: 1.1, reachable: (p) => parts.yurt.isInside(p) } };
  };
  const beacon = new Beacon(scene);
  const pockets = new Pockets();
  const carry = new Carry(scene, parts.player);
  const iglooBuild = createIglooBuild(scene, world, story, parts.igloo, camp.igloo.rot, carry, parts.player);
  const saunaHeat = createSaunaHeat(story, sauna, carry, at(camp.woodpile.x, camp.woodpile.z));
  const fishKey = createFishKey(story, parts.fishing, npcs, parts.touch);
  const keyAct = createKeyAct(story, npcs, hotel);
  const suite = hotel.rooms[4];
  const symbols = createSymbols(story, hotel.rooms);
  const headboard = createHeadboard(story, suite, parts.player, parts.touch);
  const finale = createFinale({
    scene, npcs, player: parts.player, orbit: parts.orbit, sky, king: hotel.king, touch: parts.touch, hotelDoor: hotel.door.at,
    onCinematic: () => {
      parts.fishing.away = true; // Alex and Boti come along: no fishing lines across the lake
      parts.onCinematic();
    },
    onEnd: parts.onEnd,
  });
  const crypt = createCrypt(scene, world, story, npcs, parts.player, parts.orbit, hotel.king, suite.position.clone(),
    () => headboard.stairsAt.clone(), () => {
      story.advance('crypt');
      finale.start();
    });
  const activities = [fishKey, iglooBuild, saunaHeat, symbols, headboard, crypt];
  const snowRun = createSnowRun(scene, world, story, parts.sled, sky, (at) => {
    lakeAct.crashed(at);
    parts.onCrash();
  });
  targets.spruce.copy(snowRun.spruce);
  const lakeAct = createLakeAct(story, npcs, parts.sled, parts.gyuri, gyuriSpot, snowRun);

  /**
   * Wrap an interaction provider: while `open()` is false in story mode, the prompt it would show
   * becomes `closed()` (or nothing) and E does nothing. Always open in free roam.
   */
  const gate = (p: Provider, open: () => boolean, closed: () => string | null = () => null): Provider => ({
    interaction(pos) {
      if (!story.active || open()) return p.interaction(pos);
      const label = closed();
      return label && p.interaction(pos) ? { label, run: () => {} } : null;
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
  const unlockPrompt: Interaction = { label: 'unlock the door with the key', run: () => story.advance('open-door') };

  const objectiveText = () => {
    const step = story.current;
    if (!step) return null;
    return step.objective + (step.id === 'rooms' ? `  (${symbols.found} / 4)` : '');
  };
  const refresh = () => {
    hud.objective(objectiveText());
    const step = story.current;
    beacon.point(step?.target ? targets[step.target] : null);
    pockets.show(story.items);
    npcs.setHidden(parts.gyuri, !story.reached('find-gyuri'));
    lakeAct.refresh();
  };
  story.onChange((chapterChanged) => {
    carry.drop();
    refresh();
    if (chapterChanged && story.current) {
      hud.chapter(story.chapter, story.chapterTitle);
      hud.flash('Progress saved');
    }
  });

  return {
    gate,
    finale,
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
      const run = snowRun.status();
      if (run) return run;
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
        if (Math.hypot(p.x - at.x, p.z - (at.z + 1.2)) > 2.2) return null;
        return story.at('open-door') && story.items.has('key') ? unlockPrompt : doorPrompt;
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
      snowRun.begin();
      lakeAct.begin();
      keyAct.begin();
      symbols.begin();
      headboard.begin();
      crypt.begin();
      sky.hideSnowIn(hotel.bounds.clone().union(crypt.box), 2);
      npcs.setHidden(hotel.king, true); // the throne starts empty
      parts.kingSong.enabled = false; // his song belongs to the finale
      if (!story.reached('rooms')) lockDoor();
      refresh();
      hud.chapter(story.chapter, story.chapterTitle);
    },
    update(dt: number, player: THREE.Vector3, input: Input): void {
      if (!story.active) return;
      finale.update(dt);
      symbols.update(dt);
      headboard.update(dt, input);
      crypt.update(dt);
      if (door && story.reached('rooms')) unlockDoor();
      beacon.update(dt, player);
      iglooBuild.update(dt);
      parts.igloo.background(story.at('build-igloo'), 0.2); // the King, quietly, while you build
      saunaHeat.update(dt);
      snowRun.update(dt);
      fishKey.update(dt);
      keyAct.update();
      lakeAct.update(player);
      const run = snowRun.target() ?? symbols.target(player);
      if (run) beacon.point(run);
      hud.objective(objectiveText()); // keeps the carving count fresh
      carry.update();
      pockets.show(story.items);
    },
  };
}
