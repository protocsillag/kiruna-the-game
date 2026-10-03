import type { Interaction } from '../activities/interaction';
import type { Npc, Npcs } from '../npc/npcs';
import type { Story } from './state';

const WINDOW = 1.4; // seconds the line twitches: press E within it
const wait = () => 3 + Math.random() * 3;

/** Three junk catches, then the key. Each gets a remark from Alex or Boti. */
const CATCHES = [
  { name: 'an old boot', by: 1, remark: 'How much is the boot?' },
  { name: 'a glass made of ice', by: 0, remark: 'From the Ice Bar! Somebody had a good night.' },
  { name: 'a frozen mitten', by: 1, remark: 'My mitten! I lost that in 2018.' },
  { name: 'a key on a royal blue ribbon', by: 1, remark: 'How much is the fish? That is no fish. That is a KEY!' },
];

interface Fishing {
  readonly fishing: boolean;
  twitch: number;
  people: Npc[];
}

/**
 * Chapter 5: sit on the free fur at the ice fishing spot. When the line twitches, press E
 * (a short bar shows the window). Three junk catches, then the ICEHOTEL key. No fail: a missed
 * bite just comes back.
 */
export function createFishKey(story: Story, fishing: Fishing, npcs: Npcs, touch: boolean) {
  const bar = document.createElement('div');
  bar.id = 'bite';
  const fill = document.createElement('i');
  bar.append(fill);
  document.body.append(bar);
  let caught = 0;
  let next = wait();
  let window = 0;
  let message = '';
  let messageLeft = 0;

  const say = (text: string, seconds = 3.5) => {
    message = text;
    messageLeft = seconds;
  };
  const reel: Interaction = {
    label: 'reel in!',
    run() {
      window = 0;
      next = wait() + 1.5;
      const c = CATCHES[Math.min(caught++, CATCHES.length - 1)];
      say(`You caught ${c.name}!`, 4.5);
      if (caught >= CATCHES.length) {
        story.give('key');
        story.advance('fish-key');
        npcs.tell(fishing.people[1], [
          { text: c.remark },
          { who: 'Alex', text: 'Look at the ribbon. Royal blue, like the light in one of the hotel rooms.' },
        ]);
      } else {
        npcs.tell(fishing.people[c.by], [{ text: c.remark }]);
      }
    },
  };
  const active = () => story.at('fish-key') && fishing.fishing;

  return {
    interaction(): Interaction | null {
      return active() && window > 0 ? reel : null;
    },
    status(): string | null {
      if (!active()) return null;
      if (messageLeft > 0) return message;
      if (window > 0) return `The line twitches! ${touch ? 'Tap' : 'Press E'}!`;
      return 'Ice fishing  ·  watch the line…';
    },
    update(dt: number): void {
      messageLeft -= dt;
      if (!active()) {
        window = 0;
        fishing.twitch = 0;
        bar.classList.remove('visible');
        return;
      }
      if (window > 0) {
        window -= dt;
        if (window <= 0) {
          say('Too slow. It got away... it will be back.');
          next = wait();
        }
      } else if ((next -= dt) <= 0) {
        window = WINDOW;
      }
      fishing.twitch = window > 0 ? 1 : 0;
      bar.classList.toggle('visible', window > 0);
      fill.style.width = `${Math.max(0, window / WINDOW) * 100}%`;
    },
  };
}
