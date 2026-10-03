import type { Line, Script } from '../npc/npcs';
import type { Story } from './state';

/** Things a line can make happen beyond the story state. */
export interface Cues {
  instagram(): void;
}

type Lines = (s: Story, cue: Cues) => Line[];
const say = (...texts: string[]): Lines => () => texts.map((text) => ({ text }));

/** Barbara and Zsofia tell what they saw; either of them finishes chapter 2. */
const sawHimLeave = (first: string): Lines => (s) => [
  { text: first },
  { text: 'You want to know about the King? He lived here at camp. We saw him go out one night, for his usual rehearsal.' },
  { text: 'He never came back. And the aurora has not shown since that same night.' },
  { text: 'Ask the camp leader where he rehearsed. Yoppi knows everybody.', then: () => s.advance('sauna-done') },
];

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
    ['build-igloo', say('Cut snow blocks at the drift over there and put them where it glows.', 'We would help, but the bottle needs holding.')],
    ['igloo-done', (s, cue) => [
      { text: 'Now THAT is an Ice Hostel. Fit for a king.' },
      { text: 'Which reminds me. Look at this. Instagram, two weeks ago, from right here in Kiruna.', then: () => cue.instagram() },
      { text: "That's him. The King is alive, and he was living right here at Camp Alta, playing songs for the locals." },
      { text: 'Here, take the flask. Balazs will never notice. You might need it more than us.', then: () => {
        s.give('flask');
        s.advance('igloo-done');
      } },
    ]],
    ['sauna-ask', say('The girls in the sauna might know more. They have been here longer than us.')],
  ],
  Balazs: [
    ['arrive', say('Shh. Listen... nothing. The King used to sing in there.', 'Richard has a plan. Richard always has a plan. Talk to him.')],
    ['build-igloo', say('Blocks go on the mound. Bottle goes to me. Simple system.')],
    ['igloo-done', say('Richard found something on his phone. Go on, ask him.')],
    ['sauna-ask', say('Have you seen my flask? Hm. Never mind, the bottle is bigger anyway.')],
  ],
  Gyuri: [
    ['find-gyuri', say('Yoppi? He went out across the lake. Watch out for the trees if you follow him.')],
  ],
  Thomasz: [
    ['arrive', say('The dogs are resting today.', 'The gate stays shut until the camp leader says otherwise. Nobody has seen Yoppi since this morning.')],
  ],
  Barbara: [
    ['arrive', say('Brr. Nobody has put wood in the stove all day.', 'Some sauna this is.')],
    ['sauna-ask', (s) => [
      { text: 'Finally, someone! It is freezing in here.' },
      { text: 'The stove went out and nobody brings wood. The woodpile is by the lodge. Two logs at a time, please.', then: () => s.advance('sauna-ask') },
    ]],
    ['heat-sauna', say('More wood! It has to be eighty degrees, not a degree less.')],
    ['sauna-done', sawHimLeave('Ahh. Now that is a sauna.')],
    ['find-gyuri', say('Go and find Yoppi. Gyuri knows which way he went.')],
  ],
  Zsofia: [
    ['arrive', say('Is the aurora visible outside?', 'No? It has not shown for days. Strange, in January.')],
    ['sauna-ask', (s) => [
      { text: 'Is that you? Please tell me you brought wood.' },
      { text: 'The woodpile is next to the lodge. Two logs a trip, the stove is hungry.', then: () => s.advance('sauna-ask') },
    ]],
    ['heat-sauna', say('Is it eighty yet? It still feels cold to me.')],
    ['sauna-done', sawHimLeave('Finally warm. Thank you!')],
    ['find-gyuri', say('Is the aurora visible outside? Not yet... Bring him back, will you?')],
  ],
};

/** The story's dialogue as a script for `Npcs`. */
export function storyScript(story: Story, cue: Cues): Script {
  return (name) => {
    if (!story.active) return null;
    let found: Lines | null = null;
    for (const [from, lines] of SCRIPT[name] ?? []) if (story.reached(from)) found = lines;
    return found ? found(story, cue) : null;
  };
}
