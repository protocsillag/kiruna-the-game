import * as THREE from 'three';
import { groundHeight } from '../world/terrain';
import type { Npc, Npcs } from '../npc/npcs';
import type { Player } from '../player/player';
import type { OrbitCamera } from '../player/camera';
import type { Sky } from '../sky/sky';
import { fadeThrough } from './fade';

const SONG_URL = `${import.meta.env.BASE_URL}audio/meg-nem-veszithetek.mp3`;
/** Everyone who comes out to see the King sing (bar guests stay inside). */
const CAST = ['Balazs', 'Richard', 'Barbara', 'Zsofia', 'Gyuri', 'Yoppi', 'Thomasz', 'Alex', 'Boti', 'Linnéa', 'Oskar'];
const CREDITS_AFTER = 10; // seconds outside before the credits start rolling
const WAKE_SECONDS = 12; // in the crypt: the ice melts (3.5 s), he speaks, the song swells
const SONG_AFTER = 3.5;
const BOOST = 1.7;
const STAGE_H = 0.6;

const CREDITS_HTML = `
  <h1>Kiruna</h1><p class="tag">the game</p>
  <p class="big">The King is back.<br>And so are the northern lights.</p>
  <h3>Starring</h3>
  <p>Jimmy, the King</p>
  <h3>and, as themselves</h3>
  <p>Balazs · Richard · Barbara · Zsofia<br>Gyuri · Thomasz · Alex · Boti</p>
  <h3>With</h3>
  <p>Yoppi, the camp leader<br>Linnéa, Oskar and the guests of the ICEHOTEL<br>Luna, Sixten, Pippi, Molly, Bamse and Tor<br>One lone spruce (unharmed)</p>
  <h3>Music</h3>
  <p>“Még nem veszíthetek” · Zámbó Jimmy<br>“Egy jó asszony mindent megbocsájt” · Zámbó Jimmy<br><small>All rights belong to their rights holders</small></p>
  <h3>Made with</h3>
  <p>three.js · Rapier · Vite<br>Built with Claude Code</p>
  <h3>In memory of</h3>
  <p>Camp Alta, Kiruna, January 2018<br>and everyone who was there</p>
  <p class="big">Thanks for playing.</p>`;

/**
 * The end of the story: the King drinks, the song starts, everyone gathers outside the ICEHOTEL,
 * night falls and the aurora blazes. Then the credits roll for the rest of the song (Enter or
 * Skip jumps ahead), a congratulations screen, and Continue loads free roam.
 */
export function createFinale(opts: {
  scene: THREE.Scene; npcs: Npcs; player: Player; orbit: OrbitCamera; sky: Sky; king: Npc; touch: boolean;
  hotelDoor: THREE.Vector3; onCinematic: () => void; onEnd: () => void;
}) {
  const { npcs, player, orbit, sky, king, touch, hotelDoor } = opts;
  const hotelScene = opts.scene;
  const song = new Audio();
  song.preload = 'none';
  let phase: 'off' | 'waking' | 'outside' | 'credits' | 'end' = 'off';
  let t = 0;
  let creditsStart = 0;
  let creditsLength = 180;

  const roll = document.createElement('div');
  roll.id = 'credits';
  const inner = document.createElement('div');
  inner.className = 'roll';
  inner.innerHTML = CREDITS_HTML;
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = touch ? 'Skip ▸' : 'Enter · skip';
  roll.append(inner, skip);
  const end = document.createElement('div');
  end.id = 'end';
  end.innerHTML = `<div class="card"><h1>Congratulations!</h1><p class="sub">You completed the game</p>
    <p>You brought the King back to his throne, and the northern lights back to Kiruna.</p>
    <p>This is the end of the story. From now on Kiruna is yours to roam freely: the sauna, the snowmobile,
    the dogs, the ICEHOTEL, and the King on his throne in the Ice Bar.</p>
    <button type="button">Continue to free roam</button></div>`;
  document.body.append(roll, end);

  const onGround = (x: number, z: number) => new THREE.Vector3(x, groundHeight(x, z), z);
  /** A small wooden stage with footlights, a mic stand and two lamp posts: a concert on the ice. */
  const stage = (at: THREE.Vector3) => {
    const g = new THREE.Group();
    g.position.copy(at);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.8 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.5, metalness: 0.6 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(4.2, STAGE_H, 3), wood, 0, STAGE_H / 2, 0);
    add(new THREE.BoxGeometry(4.3, 0.06, 3.1), new THREE.MeshStandardMaterial({ color: 0x9a1a24, roughness: 0.9 }), 0, STAGE_H + 0.03, 0.1); // red carpet top
    add(new THREE.BoxGeometry(1.4, STAGE_H * 0.5, 0.5), wood, 0, STAGE_H * 0.25, -1.75); // a step up
    // Footlights along the front edge (the side facing the crowd, −Z).
    const colors = [0xffd59a, 0xff8cc6, 0x9fe6c0, 0x6f9cff];
    for (let i = 0; i < 9; i++) add(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: colors[i % 4], toneMapped: false }), -1.9 + i * 0.475, STAGE_H + 0.08, -1.45);
    // Mic stand in front of the King.
    add(new THREE.CylinderGeometry(0.02, 0.02, 1.45, 6), metal, 0.15, STAGE_H + 0.73, -0.55);
    add(new THREE.SphereGeometry(0.05, 10, 8), metal, 0.15, STAGE_H + 1.48, -0.55);
    // Two lamp posts at the back corners, and warm light on the singer.
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.05, 0.06, 3, 8), metal, s * 1.9, STAGE_H + 1.5, 1.3);
      add(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd59a, toneMapped: false }), s * 1.9, STAGE_H + 3.1, 1.3);
    }
    const spot = new THREE.PointLight(0xffc27a, 18, 12, 1.5);
    spot.position.set(0, STAGE_H + 3.2, -2);
    g.add(spot);
    g.rotation.y = 0; // the crowd and the camera are toward −Z (the hotel side)
    hotelScene.add(g);
  };
  const gather = () => {
    const x = hotelDoor.x;
    const z = hotelDoor.z;
    player.lock(onGround(x, z + 14), 0, 'stand');
    orbit.floor = null;
    // Start framed on the stage and the sky; after that the camera is yours to look around.
    orbit.yaw = Math.PI;
    orbit.pitch = -0.2;
    orbit.setZoom(8.5);
    const stageAt = onGround(x, z + 21.5);
    stage(stageAt);
    npcs.move(king, stageAt.clone().setY(stageAt.y + STAGE_H), Math.PI, { pose: 'stand' });
    CAST.forEach((name, i) => {
      const npc = npcs.byName(name);
      if (!npc) return;
      const side = i % 2 ? 1 : -1;
      const k = Math.floor(i / 2);
      // Two wings either side of the King, a little staggered, all looking up at the sky.
      npcs.move(npc, onGround(x + side * (1.9 + k * 1.15), z + 19.5 + (k % 2) * 0.7 - k * 0.25), side * 0.25, { pose: 'stand' });
      npcs.setHidden(npc, false);
    });
    sky.clock.nightOnly = false;
    sky.clock.paused = true;
    sky.aurora = true;
    opts.onCinematic();
  };
  const finish = () => {
    if (phase === 'end') return;
    phase = 'end';
    roll.classList.remove('visible');
    end.classList.add('visible');
    const fadeOut = window.setInterval(() => {
      song.volume = Math.max(0, song.volume - 0.08);
      if (song.volume <= 0) {
        song.pause();
        window.clearInterval(fadeOut);
      }
    }, 80);
    opts.onEnd();
  };
  const leave = () => {
    location.href = `${location.pathname}?free`;
  };
  skip.addEventListener('click', (e) => {
    e.stopPropagation();
    finish();
  });
  end.querySelector('button')!.addEventListener('click', leave);
  addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
    if (phase === 'credits' || phase === 'outside') finish();
    else if (phase === 'end') leave();
  });
  song.addEventListener('loadedmetadata', () => {
    if (isFinite(song.duration)) creditsLength = Math.max(60, song.duration - CREDITS_AFTER - 4);
  });
  song.addEventListener('ended', finish);

  return {
    get active() {
      return phase !== 'off';
    },
    /** The King has his whiskey: start the song and the whole sequence. */
    start(): void {
      phase = 'waking';
      t = 0;
      song.src = SONG_URL;
      song.load();
    },
    pause(): void {
      if (phase !== 'off' && phase !== 'end') song.pause();
    },
    resume(): void {
      if (phase !== 'off' && phase !== 'end') song.play().catch(() => {});
    },
    update(dt: number): void {
      if (phase === 'off') return;
      t += dt;
      if (phase === 'waking' && t >= SONG_AFTER && t - dt < SONG_AFTER) {
        song.volume = 0.25;
        song.play().catch(() => {});
      }
      if (phase === 'waking' && song.volume < 0.9 && !song.paused) song.volume = Math.min(0.9, song.volume + dt * 0.15);
      if (phase === 'waking' && t > WAKE_SECONDS) {
        phase = 'outside';
        t = 0;
        fadeThrough(gather, 900);
        return;
      }
      if (phase === 'waking') return;
      // Night falls fast, then the aurora swells and stays strong.
      const h = sky.clock.hours;
      if (h > 9 && h < 23.5) sky.clock.hours = Math.min(23.5, h + dt * 0.7);
      sky.auroraBoost = Math.min(BOOST, sky.auroraBoost + dt * 0.12);
      king.character.armOverride[0] = -1.8 + Math.sin(t * 1.3) * 0.35; // singing, arm up
      if (song.volume < 0.9 && phase !== 'end') song.volume = Math.min(0.9, song.volume + dt * 0.15);
      if (phase === 'outside' && t > CREDITS_AFTER) {
        phase = 'credits';
        creditsStart = t;
        roll.classList.add('visible');
      }
      if (phase === 'credits') {
        const k = (t - creditsStart) / creditsLength;
        const travel = inner.offsetHeight + innerHeight;
        inner.style.transform = `translateY(${innerHeight - k * travel}px)`;
        if (k >= 1 && song.paused) finish();
      }
    },
  };
}
