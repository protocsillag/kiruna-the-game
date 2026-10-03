import * as THREE from 'three';
import type { Interaction } from '../activities/interaction';
import type { Npc, Npcs } from '../npc/npcs';

const SONG_URL = `${import.meta.env.BASE_URL}audio/meg-nem-veszithetek.mp3`;
const HEARING = 34; // metres until the song fades out

/**
 * Free roam: talk to Jimmy on his throne and he sings "Még nem veszíthetek"; E again stops it.
 * Story mode turns this off (the song belongs to the finale there).
 */
export function createKingSong(npcs: Npcs, king: Npc) {
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';
  let playing = false;
  const start: Interaction = {
    label: 'talk to Jimmy',
    run() {
      npcs.say(king);
      if (!audio.src) audio.src = SONG_URL;
      playing = true;
      audio.play().catch(() => (playing = false));
    },
  };
  const stop: Interaction = {
    label: 'stop the music',
    run() {
      playing = false;
      audio.pause();
    },
  };

  return {
    enabled: true,
    interaction(p: THREE.Vector3): Interaction | null {
      if (!this.enabled || king.hidden) return null;
      const from = king.talkFrom ?? king.at;
      if (Math.hypot(p.x - from.x, p.z - from.z) > (king.talkRadius ?? 2.2)) return null;
      return playing ? stop : start;
    },
    update(p: THREE.Vector3): void {
      if (!playing) return;
      const d = Math.hypot(p.x - king.at.x, p.z - king.at.z);
      audio.volume = THREE.MathUtils.clamp(1.1 - d / (HEARING * 0.9), 0, 1) * 0.9;
    },
    pause(): void {
      if (playing) audio.pause();
    },
    resume(): void {
      if (playing) audio.play().catch(() => {});
    },
  };
}
