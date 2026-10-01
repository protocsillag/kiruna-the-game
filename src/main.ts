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
import { Prompt } from './ui/prompt';
import { ScreenFX } from './ui/screenfx';
import { Quality } from './ui/quality';
import { Snowmobile } from './vehicles/snowmobile';
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

async function start(): Promise<void> {
  await RAPIER.init();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
  createTrees(scene, world, camp.clearings, [{ x: 72, z: -96 }]); // + the lone spruce on the ice
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
  const prompt = new Prompt();
  const sauna = createSauna(scene, world, player, () => fx.triggerShiver());
  const yurt = createYurt(scene, world, player, camp.yurt.x, camp.yurt.z, camp.yurt.rot);
  sky.hideSnowIn(sauna.interior, 0);
  sky.hideSnowIn(yurt.interior, 1);

  // Parked at camp, between the spawn point and the shore, nose to the lake.
  const sled = new Snowmobile(scene, world, player, camp.spawn.x + 4, camp.spawn.z - 3, Math.PI);
  const providers = [sled, sauna, yurt];
  const ignored = new Set([player.collider.handle, sled.collider.handle, ...sauna.cameraIgnore]);
  const cameraSees = (c: { handle: number }) => !ignored.has(c.handle);

  const quality = new Quality((high) => {
    renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 2) : 1);
    renderer.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
    post.bloom.enabled = high;
    sky.setQuality(high, renderer.getPixelRatio());
  });
  const tint = new THREE.Color(0xffffff);
  let darkness = 0;
  let wasRiding = false;
  const footprints = new Footprints(scene);
  const breath = new Breath(scene);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
  });
  setupOverlay(
    () => {
      input.requestLock();
      wind.start();
    },
    () => wind.suspend(),
  );

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
    player.update(dt, input, orbit.yaw);
    world.timestep = dt;
    world.step();
    sled.sync(dt, darkness, tint, wind.gust);
    player.sync(dt);
    if (sled.riding !== wasRiding) {
      wasRiding = sled.riding;
      orbit.setZoom(sled.riding ? 8.5 : 6);
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
    prompt.status(sled.status() ?? sauna.status(player.position) ?? yurt.status(player.position));
    fx.update(dt, heat);
    orbit.shake = fx.shake;
    orbit.follow(dt, sled.heading, sled.riding && Math.abs(sled.speed) > 3);
    if (sauna.dipping) orbit.lookDown(dt);
    orbit.update(dt, player.cameraFocus, world, cameraSees);
    wind.update(dt);
    const palette = sky.update(dt, camera.position, player.position, wind.gust);
    post.bloom.strength = palette.bloom;
    darkness = palette.stars;
    tint.copy(palette.hemiSky).multiplyScalar(0.35 + palette.hemiIntensity * 0.35);
    camp.update(dt, palette, wind.gust);
    sauna.update(dt, tint);
    yurt.update(dt, tint);
    hud.update(sky.clock);
    post.render();
    input.endFrame();
  });
}

start().catch((err) => {
  console.error(err);
  showError('Could not start: ' + (err instanceof Error ? err.message : String(err)));
});
