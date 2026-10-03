import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createTerrain } from './world/terrain';
import { createLake } from './world/lake';
import { createCamp } from './world/camp';
import { createTrees } from './world/trees';
import { createTrail } from './world/trail';
import { createSauna } from './activities/sauna';
import { createYurt } from './activities/yurt';
import { createIgloo } from './activities/igloo';
import { Prompt } from './ui/prompt';
import { ScreenFX } from './ui/screenfx';
import { Quality } from './ui/quality';
import { Snowmobile } from './vehicles/snowmobile';
import { DogSled } from './vehicles/dogsled';
import { createDogFarm } from './world/dogfarm';
import { groundHeight, ICEHOTEL } from './world/terrain';
import { Npcs } from './npc/npcs';
import { createWhiskeyPair } from './npc/whiskey';
import { createIceFishing } from './activities/icefishing';
import { createIceHotel, iceHotelClearings } from './icehotel/icehotel';
import { createIceHotelSign } from './world/signpost';
import { createSky } from './sky/sky';
import { createPostFX } from './sky/postfx';
import { Wind } from './audio/wind';
import { Hud } from './ui/hud';
import { Input } from './player/input';
import { OrbitCamera } from './player/camera';
import { Player } from './player/player';
import { Footprints } from './player/footprints';
import { Breath } from './player/breath';
import { setupOverlay, showError } from './ui/overlay';
import { isTouchDevice, TouchControls } from './ui/touch';
import { Story } from './story/state';
import { createStoryWorld } from './story/world';

/** Walking held still while picking a reply in a conversation. */
const STILL = { move: () => ({ fwd: 0, side: 0 }), down: () => false };

async function start(): Promise<void> {
  // Phones/tablets get touch controls and lighter defaults; everything touch-only is gated on this.
  const touch = isTouchDevice();
  document.body.classList.toggle('touch', touch);
  const maxRatio = touch ? 1.5 : 2;

  await RAPIER.init();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  document.getElementById('app')!.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1500);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  createTerrain(scene, world);
  createLake(scene, world);
  const camp = createCamp(scene, world);
  camp.clearings.push(...iceHotelClearings());
  createTrees(scene, world, camp.clearings, [{ x: 72, z: -96 }], touch ? 0.5 : 1); // + the lone spruce on the ice
  createTrail(scene);
  const sky = createSky(scene, renderer);
  const post = createPostFX(renderer, scene, camera);
  const wind = new Wind();
  const hud = new Hud();
  world.step(); // build broad-phase so the first character query sees the ground

  const input = new Input(renderer.domElement);
  const orbit = new OrbitCamera(camera);
  const player = new Player(world, scene, camp.spawn.x, camp.spawn.z);
  const fx = new ScreenFX();
  const prompt = new Prompt(touch, () => input.tap('KeyE'));
  const sauna = createSauna(scene, world, player, () => fx.triggerShiver());
  const yurt = createYurt(scene, world, player, camp.yurt.x, camp.yurt.z, camp.yurt.rot);
  const igloo = createIgloo(scene, world, camp.igloo.x, camp.igloo.z, camp.igloo.rot);
  sky.hideSnowIn(sauna.interior, 0);
  sky.hideSnowIn(yurt.interior, 1);

  // Parked at camp, between the spawn point and the shore, nose to the lake.
  const sled = new Snowmobile(scene, world, player, camp.spawn.x + 4, camp.spawn.z - 3, Math.PI);
  const farm = createDogFarm(scene, world, camp.dogFarm);
  const dogs = new DogSled(scene, world, player, farm.team.x, farm.team.z, farm.team.heading);

  // --- People around camp ---
  const npcs = new Npcs(scene, world);
  const onGround = (x: number, z: number) => new THREE.Vector3(x, groundHeight(x, z), z);
  const sledPark = { x: camp.spawn.x + 4, z: camp.spawn.z - 3 };
  const gyuri = onGround(sledPark.x + 1.8, sledPark.z + 0.9);
  const gyuriNpc = npcs.add({
    name: 'Gyuri', line: 'Watch out for the trees, these snowmobiles can go out of control',
    at: gyuri, heading: Math.atan2(camp.spawn.x - gyuri.x, camp.spawn.z - gyuri.z), solid: true,
    look: { jacket: 0xd0702a, pants: 0x1f2328, hat: 0x1a1a1a, scarf: 0x6b6f78 },
  });
  const fr = camp.dogFarm.rot; // Thomasz stands beside the farm gate, by the team
  const tx = camp.dogFarm.x + 2.8 * Math.cos(fr) - 2.6 * Math.sin(fr);
  const tz = camp.dogFarm.z - 2.8 * Math.sin(fr) - 2.6 * Math.cos(fr);
  npcs.add({
    name: 'Thomasz', line: 'These dogs are very friendly and cute, hop on the dog sledge for a cool experience',
    at: onGround(tx, tz), heading: fr + Math.PI, solid: true,
    look: { jacket: 0x6b4a2b, hat: 0xb23a2a, scarf: 0x2e5fa8 },
  });
  const inSauna = (p: THREE.Vector3) => sauna.isInside(p);
  const saunaLine = 'Put some more wood in the sauna stove.';
  [
    { name: 'Barbara', lx: -2.0, line: saunaLine, look: { towel: 0xf2c4cc, hat: null, hair: 0xd9b26f, bun: true, skin: 0xedc9ad } },
    { name: 'Zsofia', lx: -1.1, line: 'Is the aurora visible outside?', look: { towel: 0xf4f1ea, hat: null, hair: 0x3e2a20, bun: true, skin: 0xe3bc9c } },
  ].forEach((g) => {
    const seat = sauna.upperSeat(g.lx);
    npcs.add({ name: g.name, line: g.line, look: g.look, at: seat.root, heading: 0, pose: 'sit',
      talkFrom: seat.front, talkRadius: 0.9, reachable: inSauna });
  });
  const whiskey = createWhiskeyPair(scene, npcs, camp.igloo);
  const fishing = createIceFishing(scene, world, npcs, player,
    new THREE.Vector3(sauna.centre.x + 9.5, 0, sauna.centre.z - 2.5));
  const talk = { interaction: (p: THREE.Vector3) => npcs.interaction(p, !!player.locked) };
  const hotel = createIceHotel(scene, world, npcs, player);
  sky.hideSnowIn(hotel.bounds, 2);
  // "Visit the Ice Hotel" sign just behind the glass-roof cabin (cabin-local +Z is its back),
  // facing the spawn point, arrow toward the hotel door.
  const gc = camp.glassCabin;
  const sx = gc.x + 1.0 * Math.cos(gc.rot) + 5.2 * Math.sin(gc.rot);
  const sz = gc.z - 1.0 * Math.sin(gc.rot) + 5.2 * Math.cos(gc.rot);
  createIceHotelSign(scene, world, onGround(sx, sz), camp.spawn, new THREE.Vector3(ICEHOTEL.x, 0, ICEHOTEL.front));

  // Story mode: a layer over the same world. In free roam the gates and extras are pass-throughs.
  const story = new Story();
  const storyWorld = createStoryWorld({
    scene, world, story, sky, hud, npcs, hotel, igloo, sauna, player, gyuri: gyuriNpc,
    iglooRot: camp.igloo.rot,
    woodpile: new THREE.Vector3(camp.woodpile.x, 0, camp.woodpile.z),
    targets: {
      igloo: new THREE.Vector3(camp.igloo.x, 0, camp.igloo.z),
      sauna: sauna.centre,
      gyuri,
      spruce: new THREE.Vector3(72, 0, -96),
      farm: new THREE.Vector3(camp.dogFarm.x, 0, camp.dogFarm.z),
      hotel: new THREE.Vector3(ICEHOTEL.x, 0, ICEHOTEL.front + 3),
      fishing: new THREE.Vector3(sauna.centre.x + 9.5, 0, sauna.centre.z - 2.5),
      suite: new THREE.Vector3(ICEHOTEL.x, 0, ICEHOTEL.front - 30),
    },
  });
  npcs.choiceHint = touch ? 'Tap an answer' : 'A / D to choose · E to answer';
  const gate = storyWorld.gate;
  const providers = [
    { interaction: (p: THREE.Vector3) => npcs.continuation(p) },
    storyWorld.activities,
    gate(sled, 'snowmobile-run', 'the snowmobile has no key'),
    gate(dogs, 'harness', 'the farm gate is shut'),
    fishing, hotel, storyWorld.door, talk,
    gate(sauna, 'heat-sauna', 'the sauna is cold'),
    yurt,
    gate(igloo, null, null), // no King's song in story mode
  ];
  const ignored = new Set([player.collider.handle, sled.collider.handle, ...dogs.cameraIgnore, ...sauna.cameraIgnore]);
  const cameraSees = (c: { handle: number }) => !ignored.has(c.handle);

  const quality = new Quality((high) => {
    renderer.setPixelRatio(high ? Math.min(devicePixelRatio, maxRatio) : 1);
    renderer.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
    post.bloom.enabled = high;
    sky.setQuality(high, renderer.getPixelRatio());
  }, !touch, !touch); // phones start on Low; no "(Q)" hint without a keyboard
  const tint = new THREE.Color(0xffffff);
  let darkness = 0;
  let wasRiding = false;
  let lastSteer = 0;
  const footprints = new Footprints(scene);
  const breath = new Breath(scene);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
  });
  const overlay = setupOverlay(
    () => {
      if (touch) {
        // Android can go fullscreen from a tap (iPhone Safari can't; it just stays in the page).
        const root = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
        if (!document.fullscreenElement) root.requestFullscreen?.().catch(() => {});
      } else {
        input.requestLock();
      }
      wind.start();
      igloo.resume();
    },
    () => {
      wind.suspend();
      igloo.pause();
    },
    touch,
    {
      savedStep: Story.savedStep(),
      pick: (mode, fresh) => {
        if (mode === 'story') storyWorld.begin(fresh);
      },
    },
  );
  if (touch) new TouchControls(input, () => overlay.pause());

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const mouse = input.consumeMouse();
    orbit.look(mouse.dx, mouse.dy, mouse.wheel);
    if (input.pressed('KeyP')) sky.clock.togglePause();
    if (input.pressed('KeyF')) sky.clock.advance(1); // cheat: skip ahead an hour
    if (input.pressed('KeyQ')) {
      quality.toggle();
      hud.flash(quality.label);
    }

    sled.drive(dt, input);
    dogs.drive(dt, input);
    if (npcs.choosing) {
      const side = input.move().side;
      const steer = side > 0.5 ? 1 : side < -0.5 ? -1 : 0;
      if (steer && steer !== lastSteer) npcs.steer(steer);
      lastSteer = steer;
    }
    player.update(dt, npcs.choosing ? STILL : input, orbit.yaw);
    world.timestep = dt;
    world.step();
    sled.sync(dt, darkness, tint, wind.gust);
    dogs.sync(dt, tint);
    player.sync(dt);
    const vehicle = sled.riding ? sled : dogs.riding ? dogs : null;
    if (!!vehicle !== wasRiding) {
      wasRiding = !!vehicle;
      orbit.setZoom(vehicle === dogs ? 10 : vehicle ? 8.5 : 6); // the dog team is long: pull back more
    }

    const indoors = sauna.isInside(player.position) || yurt.isInside(player.position);
    if (!player.locked && !indoors) {
      footprints.update(player.position, player.heading, player.jogging, player.onIce);
    }
    const heat = Math.max(sauna.warmth(player.position), yurt.warmth(player.position));
    const cold = heat < 0.2;
    breath.update(dt, player.character.head, player.heading, player.jogging || fx.shivering, cold);

    let action = null;
    for (const p of providers) if ((action = p.interaction(player.position))) break;
    prompt.show(action?.label ?? null);
    if (action && input.pressed('KeyE')) action.run();
    prompt.status(
      storyWorld.status(player.position) ?? sled.status() ?? dogs.status(player.position) ?? fishing.status() ?? hotel.status(player.position) ?? sauna.status(player.position) ?? yurt.status(player.position) ?? igloo.status(player.position),
    );
    igloo.update(player.position);
    fx.update(dt, heat);
    orbit.shake = fx.shake;
    orbit.follow(dt, vehicle?.heading ?? 0, !!vehicle && Math.abs(vehicle.speed) > 2);
    if (sauna.dipping) orbit.lookDown(dt);
    orbit.update(dt, player.cameraFocus, world, cameraSees);
    wind.update(dt);
    const palette = sky.update(dt, camera.position, player.position, wind.gust);
    post.bloom.strength = palette.bloom;
    darkness = palette.stars;
    tint.copy(palette.hemiSky).multiplyScalar(0.35 + palette.hemiIntensity * 0.35);
    camp.update(dt, palette, wind.gust);
    camera.updateMatrixWorld();
    npcs.update(dt, player.position, camera);
    whiskey.update(dt);
    fishing.update(dt, tint);
    hotel.update(dt);
    farm.update(dt);
    sauna.update(dt, tint);
    yurt.update(dt, tint);
    storyWorld.update(dt, player.position);
    hud.update(sky.clock);
    post.render();
    input.endFrame();
  });
}

start().catch((err) => {
  console.error(err);
  showError('Could not start: ' + (err instanceof Error ? err.message : String(err)));
});
