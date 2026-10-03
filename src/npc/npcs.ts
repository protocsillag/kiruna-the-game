import * as THREE from 'three';
import RAPIER, { type Collider, type World } from '@dimforge/rapier3d-compat';
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
  /** Out of the world for now (e.g. the King's empty throne in story mode). */
  hidden?: boolean;
  collider?: Collider;
}

/** A reply the player can pick; `reply` is what the person says back. */
export interface Choice {
  text: string;
  reply?: string;
  then?: () => void;
}

export interface Line {
  text: string;
  choices?: Choice[];
  /** Runs when this line is said (e.g. hand over an item, move the story on). */
  then?: () => void;
}

/** Story mode's lines for a person, or null to use their fixed `line`. */
export type Script = (name: string) => Line[] | null;

interface Conversation {
  npc: Npc;
  lines: Line[];
  i: number;
  pick: number;
}

const NAME_RANGE = 9;
const SPEAK_SECONDS = 7;
const TALK_SECONDS = 45; // a multi-line conversation waits this long for E

/** Named people around camp: name tags, a speech bubble, and heads that turn toward you. */
export class Npcs {
  private list: Npc[] = [];
  private bubble = document.createElement('div');
  private convo: Conversation | null = null;
  private speakUntil = 0;
  /** Set in story mode: changing, multi-line dialogue chosen by story step. */
  script: Script | null = null;
  /** Shown under reply choices. */
  choiceHint = '';
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
    const collider = def.solid
      ? this.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3).setTranslation(def.at.x, def.at.y + 0.87, def.at.z))
      : undefined;
    const tag = document.createElement('div');
    tag.className = 'npc-name';
    tag.textContent = def.name;
    document.body.append(tag);
    const npc: Npc = { ...def, character, tag, collider };
    this.list.push(npc);
    return npc;
  }

  interaction(p: THREE.Vector3, playerBusy: boolean): Interaction | null {
    if (playerBusy) return null;
    let best: Npc | null = null;
    let bestD = Infinity;
    for (const n of this.list) {
      if (n.hidden) continue;
      if (n.reachable && !n.reachable(p)) continue;
      const from = n.talkFrom ?? n.at;
      const d = Math.hypot(p.x - from.x, p.z - from.z);
      if (d < (n.talkRadius ?? 2.2) && d < bestD) [best, bestD] = [n, d];
    }
    if (!best) return null;
    const npc = best;
    return { label: `talk to ${npc.name}`, run: () => this.say(npc) };
  }

  /** "E · continue" / "E · answer" while a conversation is waiting for the player. */
  continuation(p: THREE.Vector3): Interaction | null {
    const c = this.convo;
    if (!c || this.time >= this.speakUntil) return null;
    const line = c.lines[c.i];
    if (!line.choices && c.i + 1 >= c.lines.length) return null;
    const from = c.npc.talkFrom ?? c.npc.at;
    if (Math.hypot(p.x - from.x, p.z - from.z) > (c.npc.talkRadius ?? 2.2) + 1.5) return null;
    return { label: line.choices ? 'answer' : 'continue', run: () => this.advance() };
  }

  /** Waiting for the player to pick a reply (main.ts holds walking still meanwhile). */
  get choosing(): boolean {
    const c = this.convo;
    return !!c && !!c.lines[c.i].choices && this.time < this.speakUntil;
  }

  /** Move the highlighted reply (steer left/right). */
  steer(dir: number): void {
    const choices = this.convo?.lines[this.convo.i].choices;
    if (!this.convo || !choices) return;
    this.convo.pick = (this.convo.pick + dir + choices.length) % choices.length;
    this.render();
  }

  say(npc: Npc): void {
    const lines = this.script?.(npc.name) ?? [{ text: npc.line }];
    this.convo = { npc, lines, i: 0, pick: 0 };
    this.show();
  }

  setHidden(npc: Npc, hidden: boolean): void {
    npc.hidden = hidden;
    npc.character.root.visible = !hidden;
    npc.collider?.setEnabled(!hidden);
    if (hidden && this.convo?.npc === npc) this.convo = null;
  }

  private advance(): void {
    const c = this.convo!;
    const choice = c.lines[c.i].choices?.[c.pick];
    if (choice) {
      choice.then?.();
      if (choice.reply) c.lines.splice(c.i + 1, 0, { text: choice.reply });
    }
    if (c.i + 1 >= c.lines.length) {
      this.convo = null;
      return;
    }
    c.i++;
    c.pick = 0;
    this.show();
  }

  private show(): void {
    const c = this.convo!;
    const waits = !!c.lines[c.i].choices || c.i + 1 < c.lines.length;
    this.speakUntil = this.time + (waits ? TALK_SECONDS : SPEAK_SECONDS);
    this.render();
    c.lines[c.i].then?.();
  }

  private render(): void {
    const c = this.convo!;
    const line = c.lines[c.i];
    this.bubble.innerHTML = '';
    const who = document.createElement('b');
    who.textContent = c.npc.name;
    this.bubble.append(who, document.createTextNode(line.text));
    if (line.choices) {
      const list = document.createElement('ol');
      line.choices.forEach((ch, i) => {
        const li = document.createElement('li');
        li.textContent = ch.text;
        li.classList.toggle('on', i === c.pick);
        li.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          c.pick = i;
          this.advance();
        });
        list.append(li);
      });
      const hint = document.createElement('small');
      hint.textContent = this.choiceHint;
      this.bubble.append(list, hint);
    } else if (c.i + 1 < c.lines.length) {
      const more = document.createElement('small');
      more.textContent = '▸';
      this.bubble.append(more);
    }
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

      const show = !n.hidden && dist < NAME_RANGE && (!n.reachable || n.reachable(player));
      this.place(n.tag, c, camera, 0.55, show);
    }
    const s = this.convo?.npc;
    const speaking = !!s && this.time < this.speakUntil &&
      Math.hypot(player.x - s.character.root.position.x, player.z - s.character.root.position.z) < 10;
    if (s) this.place(this.bubble, s.character, camera, 0.95, speaking);
    else this.bubble.classList.remove('visible');
    if (!speaking) this.convo = null;
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
