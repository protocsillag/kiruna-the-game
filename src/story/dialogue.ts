import type { Line, Script } from '../npc/npcs';
import type { Story } from './state';

type Lines = (s: Story) => Line[];
const say = (...texts: string[]): Lines => () => texts.map((text) => ({ text }));

/**
 * Story-mode lines per person: [first step, lines] entries, and the last entry the story has
 * reached wins. People without an entry keep their free-roam line.
 * Placeholder dialogue until the group sends real anecdotes (see docs/STORY_BRIEF.md).
 */
const SCRIPT: Record<string, [string, Lines][]> = {
  Richard: [
    ['arrive', (s) => [
      { text: 'You made it! Jimmy is the king, you know. The real one.' },
      { text: 'But this Ice Hostel is a disgrace. A king deserves better.' },
      {
        text: 'Do you want to build a bigger ice hostel with us?',
        choices: [
          { text: "Yes, let's build it!", reply: "That's the spirit. We'll supervise.", then: () => s.advance('arrive') },
          { text: 'Is that even an ice hostel?', reply: 'Exactly why we need you. Grab some snow!', then: () => s.advance('arrive') },
          { text: 'Only if you share the whiskey.', reply: 'Deal. Well... we will think about it.', then: () => s.advance('arrive') },
        ],
      },
    ]],
    ['build-igloo', say('Cut snow blocks from the drift and stack them on the mound.', 'We would help, but the bottle needs holding.')],
  ],
  Balazs: [
    ['arrive', say('Shh. Listen... nothing. The King used to sing in there.', 'Richard has a plan. Richard always has a plan. Talk to him.')],
    ['build-igloo', say('Blocks go on the mound. Bottle goes to me. Simple system.')],
  ],
  Gyuri: [
    ['arrive', say('Watch out for the trees, these snowmobiles can go out of control.', "That's why I'm keeping the key for now.")],
  ],
  Thomasz: [
    ['arrive', say('The dogs are resting today.', "The gate stays shut until the camp leader says otherwise. Nobody has seen Yoppi since this morning.")],
  ],
  Barbara: [
    ['arrive', say('Brr. Nobody has put wood in the stove all day.', 'Some sauna this is.')],
  ],
  Zsofia: [
    ['arrive', say('Is the aurora visible outside?', 'No? It has not shown for days. Strange, in January.')],
  ],
  Alex: [
    ['arrive', say("Pull up a fur. You won't catch anything, but the company is great.")],
  ],
};

/** The story's dialogue as a script for `Npcs`. */
export function storyScript(story: Story): Script {
  return (name) => {
    if (!story.active) return null;
    let found: Lines | null = null;
    for (const [from, lines] of SCRIPT[name] ?? []) if (story.reached(from)) found = lines;
    return found ? found(story) : null;
  };
}
