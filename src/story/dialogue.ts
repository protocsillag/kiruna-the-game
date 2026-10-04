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

/** Chapter 4: the insurance talk at the wreck. Every answer ends the same way. */
const insuranceTalk: Lines = (s) => [
  { text: 'Well, well. One Camp Alta snowmobile. One lone spruce. I am Yoppi, the camp leader.' },
  { text: 'Let me read the small print. Section 4b: "Trees are not considered unexpected." How do you explain this?', choices: [
    { text: 'The tree came out of nowhere.', reply: 'It has been standing there for eighty years.' },
    { text: 'It was a whiteout!', reply: 'Section 4c: "Weather is also not unexpected. This is Lapland."' },
    { text: 'Is the tree insured?', reply: 'The tree is fine. The tree is always fine.' },
  ] },
  { text: 'Damage: one ski, one windscreen, one very offended spruce. That makes fourteen thousand kronor. How will you pay?', choices: [
    { text: 'I will pay in whiskey.', reply: 'That is a lot of whiskey. Smoky? No. Next option.' },
    { text: 'Can I pay in songs?', reply: 'Only one man here ever paid in songs.' },
    { text: 'Put it on Richard\'s tab.', reply: 'Richard\'s tab is already longer than the trail.' },
  ] },
  { who: 'Gyuri', text: 'Relax, Yoppi. It is on my insurance. I told them to watch out for the trees.' },
  { text: 'Hmm. Fine. Gyuri\'s insurance covers the damage.' },
  { text: 'You want to know about the King? I welcomed him to camp myself. He rehearses in the ICEHOTEL, across the lake.' },
  { text: 'You cannot walk that far. Take the dog sled. Tell Thomasz I said so.', then: () => s.advance('crash') },
];

/** Chapter 4: put each pair of huskies in the right place. A wrong answer ends it; just ask again. */
const harnessQuiz: Lines = (s) => [
  { text: 'Yoppi sent you? Then we harness the team. Six dogs, three pairs.' },
  { text: 'Luna and Sixten are the clever ones. Pippi and Molly are young and keen. Bamse and Tor are big and strong.' },
  { text: 'Who runs up front and leads?', choices: [
    { text: 'Luna and Sixten', reply: 'Yes! Leaders need brains, not muscles.' },
    { text: 'Bamse and Tor', reply: 'They would pull us straight into the forest. Leaders need brains. Talk to me again.', stop: true },
    { text: 'Pippi and Molly', reply: 'Too young, they would chase every hare. Talk to me again.', stop: true },
  ] },
  { text: 'And who goes at the back, right in front of the sled?', choices: [
    { text: 'Bamse and Tor', reply: 'Exactly. The strong ones take the weight of the sled.', then: () => s.advance('harness') },
    { text: 'Pippi and Molly', reply: 'They would get squashed. The back needs strength. Talk to me again.', stop: true },
    { text: 'Luna and Sixten', reply: 'They are already leading. Talk to me again.', stop: true },
  ] },
  { text: 'Pippi and Molly in the middle, then. The team is ready. Hop on the sled!' },
];

/** A bar guest's hint. The first one heard (step 'bar') sends you off to find the carvings. */
const guest = (text: string): [string, Lines][] => [
  ['bar', (s) => [{ text, then: () => s.advance('bar') }]],
  ['rooms', say(text)],
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
      { text: 'And while you work, we will sing you one of his songs.' },
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
    ['find-gyuri', (s) => [
      { text: 'Ahh, nothing beats a fire in the kåta. Sit, warm up.' },
      { text: 'Looking for Yoppi? He took the trail across the lake this morning and has not come back.' },
      { text: 'You want my snowmobile? Hmm. Follow the poles with the red crosses, I put lights out along the trail.' },
      { text: 'Here are the keys. And be careful! Watch out for the trees, these snowmobiles can go out of control.', then: () => s.advance('find-gyuri') },
    ]],
    ['snowmobile-run', say('The snowmobile is parked by the shore. I stay here by the fire.', 'Follow the lights. And the trees... you know.')],
    ['crash', say('My snowmobile! What did I say about the trees?', 'Talk to Yoppi. He is the one with the paperwork.')],
    ['harness', say('Do not worry about the snowmobile. That is what insurance is for.')],
  ],
  Yoppi: [
    ['crash', insuranceTalk],
    ['harness', say('Thomasz will sort out the dogs. Tell him I sent you.', 'And find the King. The ICEHOTEL, across the lake.')],
    ['ride', say('The dogs know the way. Mush!')],
  ],
  Thomasz: [
    ['arrive', say('The dogs are resting today.', 'The gate stays shut until the camp leader says otherwise. Nobody has seen Yoppi since this morning.')],
    ['harness', harnessQuiz],
    ['ride', say('Lead dogs know the way. Brake when you want them to stop, steer to turn.', 'The ICEHOTEL is straight across the lake. Follow the poles.')],
  ],
  Barbara: [
    ['arrive', say('Brr. Nobody has put wood in the stove all day.', 'Some sauna this is.')],
    ['sauna-ask', (s) => [
      { text: 'Finally, someone! It is freezing in here.' },
      { text: 'The stove went out and nobody brings wood. I saw a pile of wood next to the main lodge. Two logs at a time, please.', then: () => s.advance('sauna-ask') },
    ]],
    ['heat-sauna', say('More wood! I saw plenty stacked by the main lodge.', 'It has to be eighty degrees, not a degree less.')],
    ['sauna-done', sawHimLeave('Ahh. Now that is a sauna.')],
    ['find-gyuri', say('Go and find Yoppi. Gyuri knows which way he went.')],
  ],
  Linnéa: [
    ['arrive', say('I am sorry, the ICEHOTEL is closed today. I cannot even get in myself.')],
    ['linnea', (s) => [
      { text: 'Oh, hello! I am Linnéa, I run the ICEHOTEL. And I am locked out of it.' },
      { text: 'The King? Yes, he rehearses here every night. He had the spare key, and my own key is inside. Of course.' },
      { text: 'He crossed the ice the night he went missing. If he dropped the key, it is at the bottom of the lake.' },
      { text: 'If only someone here knew how to fish...', then: () => s.advance('linnea') },
    ]],
    ['fish-key', say('Your friends fish by the sauna, I hear. Not that they ever catch anything.')],
    ['open-door', say('You found it! I would know that blue ribbon anywhere. Go on, open the door.')],
    ['bar', say('Thank you! Royal blue... that is the Royal Suite\'s light. The King slept there before every rehearsal.', 'The guests in the Ice Bar knew him best. Ask them, at the end of the corridor.')],
    ['rooms', say('He always walked the art rooms before his rehearsal. Every room hides a little carving, if you look closely.')],
    ['headboard', say('The Royal Suite is the last room on the left. Mind the headboard, it is a work of art.')],
    ['crypt', say('A staircase under the bed? Twenty years here and nobody told me!')],
  ],
  Sven: guest('The King walked the rooms every night before rehearsal. Cat first, lotus last. Skål!'),
  Maja: guest('Have you seen the cat room? Those eyes follow you. Look for the carving by the door.'),
  Lars: guest('My drink froze to my mitten. And the tram in the Ice Express has a number on it, I think.'),
  Ingrid: guest('The Royal Suite headboard is a sunburst. Seven bars, like the rays of a winter sun.'),
  Elin: guest('Count the bars from the left, like reading. Everybody counts from the left.'),
  Johan: guest('The throne is empty. This place is not the same without him.'),
  Kaisa: guest('Those numbers carved in the rooms? Roman. Two, four, six, seven... I lost count after my third drink.'),
  Nils: guest('The King sang the rooms in order, down the corridor. Cat, birds, train, lotus. Then bed.'),
  Alex: [
    ['fish-key', say('A key in the lake? Take the free fur. When the line twitches, reel in. Fast!')],
    ['open-door', say('Twenty years of fishing and the first thing we catch is a key.')],
  ],
  Boti: [
    ['fish-key', say('How much is the fish? Today: one key, apparently.')],
    ['open-door', say('How much is the key? Priceless.')],
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
