/** Places an objective can point the beacon at (positions are registered in main.ts). */
export type TargetId = 'igloo' | 'sauna' | 'gyuri' | 'spruce' | 'farm' | 'hotel' | 'fishing' | 'suite';

export interface Step {
  id: string;
  chapter: number;
  /** The one sentence at the top of the screen. */
  objective: string;
  target?: TargetId;
}

export const CHAPTERS = [
  'The Ice Hostel',
  'Heat for the girls',
  'Watch out for the trees',
  'The small print',
  'How much is the fish?',
  'Five rooms',
  'The King below',
];

/**
 * The whole story as one ordered list (see docs/STORY_BRIEF.md). Mini-games in later milestones
 * move it on with `story.advance(id)`; gates and dialogue ask `story.reached(id)`.
 */
export const STEPS: Step[] = [
  { id: 'arrive', chapter: 1, objective: 'Say hello to Balazs and Richard by the Ice Hostel', target: 'igloo' },
  { id: 'build-igloo', chapter: 1, objective: 'Build the Ice Hostel: cut snow blocks and stack them', target: 'igloo' },
  { id: 'igloo-done', chapter: 1, objective: 'Hear what Richard found', target: 'igloo' },
  { id: 'sauna-ask', chapter: 2, objective: 'Check on Barbara and Zsofia in the sauna', target: 'sauna' },
  { id: 'heat-sauna', chapter: 2, objective: 'Bring wood and heat the sauna to 80 °C', target: 'sauna' },
  { id: 'sauna-done', chapter: 2, objective: 'Ask Barbara and Zsofia about the King', target: 'sauna' },
  { id: 'find-gyuri', chapter: 3, objective: 'Ask Gyuri for the snowmobile key', target: 'gyuri' },
  { id: 'snowmobile-run', chapter: 3, objective: 'Follow the trail poles to find the camp leader', target: 'spruce' },
  { id: 'crash', chapter: 4, objective: 'Talk to Yoppi', target: 'spruce' },
  { id: 'harness', chapter: 4, objective: 'Harness the dogs at the husky farm', target: 'farm' },
  { id: 'ride', chapter: 4, objective: 'Ride the dog sled across the lake to the ICEHOTEL', target: 'hotel' },
  { id: 'linnea', chapter: 5, objective: 'Talk to Linnéa outside the ICEHOTEL', target: 'hotel' },
  { id: 'fish-key', chapter: 5, objective: 'Fish for the key with Alex and Boti', target: 'fishing' },
  { id: 'open-door', chapter: 5, objective: 'Unlock the ICEHOTEL', target: 'hotel' },
  { id: 'rooms', chapter: 6, objective: 'Find the carved symbol in each of the four art rooms', target: 'hotel' },
  { id: 'headboard', chapter: 6, objective: 'Press the Royal Suite headboard bars in the right order', target: 'suite' },
  { id: 'crypt', chapter: 7, objective: 'Go down to the crypt and wake the King', target: 'suite' },
];
