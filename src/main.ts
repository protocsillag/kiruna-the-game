import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createTerrain, CAMP } from './world/terrain';
import { createLake } from './world/lake';
import { createLighting } from './world/lighting';
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
  const lighting = createLighting(scene);
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
  });
  setupOverlay(() => input.requestLock());

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const mouse = input.consumeMouse();
    orbit.look(mouse.dx, mouse.dy, mouse.wheel);

    player.update(dt, input, orbit.yaw);
    world.timestep = dt;
    world.step();
    player.sync(dt);

    footprints.update(player.position, player.heading, player.jogging, player.onIce);
    breath.update(dt, player.character.head, player.heading, player.jogging);
    orbit.update(dt, player.position);
    lighting.follow(player.position);
    renderer.render(scene, camera);
  });
}

start().catch((err) => {
  console.error(err);
  showError('Could not start: ' + (err instanceof Error ? err.message : String(err)));
});
