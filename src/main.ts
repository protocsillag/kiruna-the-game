import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createTerrain, CAMP } from './world/terrain';
import { createLake } from './world/lake';
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
  const sky = createSky(scene, renderer);
  const post = createPostFX(renderer, scene, camera);
  const wind = new Wind();
  const hud = new Hud();
  world.step(); // build broad-phase so the first character query sees the ground

  const input = new Input(renderer.domElement);
  const orbit = new OrbitCamera(camera);
  const player = new Player(world, scene, CAMP.x, CAMP.z - 8);
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

    player.update(dt, input, orbit.yaw);
    world.timestep = dt;
    world.step();
    player.sync(dt);

    footprints.update(player.position, player.heading, player.jogging, player.onIce);
    breath.update(dt, player.character.head, player.heading, player.jogging);
    orbit.update(dt, player.position);
    wind.update(dt);
    const palette = sky.update(dt, camera.position, player.position, wind.gust);
    post.bloom.strength = palette.bloom;
    hud.update(sky.clock);
    post.render();
  });
}

start().catch((err) => {
  console.error(err);
  showError('Could not start: ' + (err instanceof Error ? err.message : String(err)));
});
