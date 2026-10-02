import * as THREE from 'three';
import RAPIER, { type World } from '@dimforge/rapier3d-compat';
import { damp } from '../world/noise';
import { createCharacter, type Character, type Look, type Pose } from '../player/character';
import type { Interaction } from '../activities/interaction';

export interface NpcDef {
  name: string;
  line: string;
  look: Look;
  /** Feet (root) position and facing. */
  at: THREE.Vector3;
  heading: number;
  pose?: Pose;
  /** Where the player stands to talk (default: the NPC) and how close they must be. */
  talkFrom?: THREE.Vector3;
  talkRadius?: number;
  /** Only talkable / labelled while this holds (e.g. only from inside the sauna). */
  reachable?: (p: THREE.Vector3) => boolean;
  /** Standing NPCs get a body collider so you can't walk through them. */
  solid?: boolean;
}

export interface Npc extends NpcDef {
  character: Character;
  tag: HTMLElement;
}

const NAME_RANGE = 9;
const SPEAK_SECONDS = 7;

/** Named people around camp: name tags, a speech bubble, and heads that turn toward you. */
export class Npcs {
  private list: Npc[] = [];
  private bubble = document.createElement('div');
  private speaker: Npc | null = null;
  private speakUntil = 0;
  private time = 0;
  private v = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private world: World) {
    this.bubble.className = 'speech';
    document.body.append(this.bubble);
  }

  add(def: NpcDef): Npc {
    const character = createCharacter(def.look);
    character.root.position.copy(def.at);
    character.root.rotation.y = def.heading;
    this.scene.add(character.root);
    if (def.solid) {
      this.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3).setTranslation(def.at.x, def.at.y + 0.87, def.at.z));
    }
    const tag = document.createElement('div');
    tag.className = 'npc-name';
    tag.textContent = def.name;
    document.body.append(tag);
    const npc: Npc = { ...def, character, tag };
    this.list.push(npc);
    return npc;
  }

  interaction(p: THREE.Vector3, playerBusy: boolean): Interaction | null {
    if (playerBusy) return null;
    let best: Npc | null = null;
    let bestD = Infinity;
    for (const n of this.list) {
      if (n.reachable && !n.reachable(p)) continue;
      const from = n.talkFrom ?? n.at;
      const d = Math.hypot(p.x - from.x, p.z - from.z);
      if (d < (n.talkRadius ?? 2.2) && d < bestD) [best, bestD] = [n, d];
    }
    if (!best) return null;
    const npc = best;
    return { label: `talk to ${npc.name}`, run: () => this.say(npc) };
  }

  say(npc: Npc): void {
    this.speaker = npc;
    this.speakUntil = this.time + SPEAK_SECONDS;
    this.bubble.innerHTML = '';
    const who = document.createElement('b');
    who.textContent = npc.name;
    this.bubble.append(who, document.createTextNode(npc.line));
  }

  /** Animate, turn heads toward the player, and place name tags + bubble on screen. */
  update(dt: number, player: THREE.Vector3, camera: THREE.Camera): void {
    this.time += dt;
    for (const n of this.list) {
      const c = n.character;
      const dx = player.x - c.root.position.x;
      const dz = player.z - c.root.position.z;
      const dist = Math.hypot(dx, dz);
      // Glance at the player when they're close (head only; bodies keep their pose).
      let want = 0;
      if (dist < 5) {
        const rel = Math.atan2(dx, dz) - c.root.rotation.y;
        want = THREE.MathUtils.clamp(Math.atan2(Math.sin(rel), Math.cos(rel)), -1.1, 1.1);
      }
      c.lookYaw += (want - c.lookYaw) * damp(4, dt);
      c.animate(dt, 0, n.pose ?? 'stand');

      const show = dist < NAME_RANGE && (!n.reachable || n.reachable(player));
      this.place(n.tag, c, camera, 0.55, show);
    }
    const s = this.speaker;
    const speaking = !!s && this.time < this.speakUntil &&
      Math.hypot(player.x - s.character.root.position.x, player.z - s.character.root.position.z) < 10;
    if (s) this.place(this.bubble, s.character, camera, 0.95, speaking);
    else this.bubble.classList.remove('visible');
    if (!speaking) this.speaker = null;
  }

  /** Pin a DOM element above a character's head, hidden when off-screen or behind the camera. */
  private place(el: HTMLElement, c: Character, camera: THREE.Camera, above: number, show: boolean): void {
    if (show) {
      c.head.getWorldPosition(this.v);
      this.v.y += above;
      this.v.project(camera);
      show = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1;
      if (show) {
        el.style.left = `${((this.v.x + 1) / 2) * innerWidth}px`;
        el.style.top = `${((1 - this.v.y) / 2) * innerHeight}px`;
      }
    }
    el.classList.toggle('visible', show);
  }
}
