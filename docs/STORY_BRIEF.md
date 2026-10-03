# Kiruna: The Game — Story Brief

Design brief for adding a **Story** mode next to today's **Free roam** game. Save as `docs/STORY_BRIEF.md`. As of Oct 3, 2026.

## Rules for implementation

- Free roam is today's game and must stay identical. Story mode is a layer on top, selected on the title card.
- In story mode there is no aurora and no King's song anywhere until the finale.
- No combat, no timer, no fail state. Every mini-game can be retried forever.
- English only.
- Use only the existing controls (walk, E, steer, brake) so everything works on touch.
- Audio: `public/audio/the-king.mp3` is the existing Ice Hostel track. `public/audio/meg-nem-veszithetek.mp3` ("Még nem veszíthetek") is the finale song the King was rehearsing.
- Follow the session rules in `CLAUDE.md`: one milestone per session, modules under 300 lines, `npm run build` must pass.

## Where the game is today

The current build is a finished place with no reason to move through it. Almost every location the story needs already exists, so the work is mostly rules and dialogue, not world-building.

| Already in the build | What the story does with it |
| --- | --- |
| Ice Hostel mound by the lodge; E plays the King's song | Starts small and silent; building it up is chapter 1 |
| Balazs and Richard with the whiskey. Richard already asks "Do you want to build a bigger ice hostel with us?" | The quest giver line is written; it only needs a yes |
| Sauna with stove, logs, temperature; Barbara and Zsofia inside | Heating is already a mechanic; add a target and a cold start |
| Ice hole and cold dip | Unlocked with the sauna |
| Snowmobile with Gyuri: "Watch out for the trees" | Foreshadows the crash |
| Husky farm, Thomasz, six-dog sled with brake and steer | The second vehicle, gated behind the crash |
| Ice fishing with Alex and Boti, where you never catch anything | The running gag that finally pays off |
| ICEHOTEL: Linnéa at reception, five art rooms, Royal Suite, Ice Bar with Oskar | The last act; the door only needs a lock |
| Jimmy the King on an ice throne in the bar: "I can't lose yet. Not yet. I still want to live." | The ending. In story mode the throne starts empty |
| Aurora, 24-minute day clock, snowfall | World state the story switches off and gives back |

Missing today: any quest state, multi-line or changing dialogue, an inventory, saving, the camp leader character (Yoppi), and the crypt.

## Vision and pillars

**Pitch:** The King has gone silent and the northern lights went out with him. Help your friends around camp, follow the clues across the frozen lake, and bring him back to his throne.

A full playthrough should take 25 to 35 minutes, short enough for a friend to finish in one sitting.

- **Still cozy.** No combat, no timer, no game over. The crash is a joke, not a punishment.
- **Every task is a memory.** Each chapter is something the group did in 2018, slightly exaggerated.
- **Friends are the quest givers.** Clues come from talking to people, never from a menu.
- **The reward is the world.** Each chapter switches on a piece of the open world that exists today.

## The core idea: you earn the open world

Story mode starts with the world dimmed, and each chapter gives one piece back until the game looks exactly like today's build. The ending state is the current game, and nothing already built is thrown away.

| Starts in story mode | Restored by |
| --- | --- |
| Ice Hostel is a small, silent mound | Ch. 1, building it |
| Sauna is cold and empty | Ch. 2, heating it |
| Snowmobile has no key | Ch. 3, Gyuri hands it over |
| Husky farm gate is shut | Ch. 4, Yoppi's offer |
| ICEHOTEL door is locked | Ch. 5, the key |
| Throne in the Ice Bar is empty | Ch. 7, the rescue |
| No aurora, no King's song, clock stuck in blue hour and night | The finale |

The title card offers **Story** and **Free roam**. Free roam is today's game, unchanged, and is available from the start. When the story is completed, a short "Congratulations, you completed the game" screen appears and then free roam loads, with the King on his throne.

## Story premise

The official story is that the King died on New Year's Eve 2001 and nobody ever saw him again. Then Richard spotted someone who looked exactly like Jimmy in an Instagram post from Kiruna. So the friends flew north for two reasons: to find out whether the King still lives, and to see the aurora once in their lives.

At camp they learn he really was living at Camp Alta, playing songs for the locals. One night he left for his usual rehearsal and never came back, and the aurora has not shown since. He was rehearsing "Még nem veszíthetek" in the crypt under the Royal Suite when the ice door froze shut behind him. Nobody is a villain; the cold is. That is why his line in the build, "I can't lose yet. Not yet. I still want to live", is the rescue moment. There is no aurora and no King's song anywhere until he is saved.

The mystery unfolds as three questions, one per act:

1. **Who is the King and where did he go?** Camp side: Ice Hostel and sauna.
2. **How do I get across and get in?** The lake: snowmobile, crash, dog sled, key.
3. **Where in the hotel is he?** ICEHOTEL: art rooms, Royal Suite, crypt.

## Quest chain

Seven chapters in a straight line, each ending with one clue and one unlock.

| # | Chapter | Where and who | What you do | Clue you leave with | Unlocks |
| --- | --- | --- | --- | --- | --- |
| 1 | The Ice Hostel | Balazs, Richard | Build the mound into a proper igloo | Richard shows the Instagram post: the King is alive and was living right here at Camp Alta, playing for the locals | Ice Hostel (silent), Balazs's whiskey flask |
| 2 | Heat for the girls | Barbara, Zsofia | Carry wood, bring the sauna to 80 °C | He left for his usual rehearsal one night and never came back; the aurora stopped that night. Ask the camp leader where he rehearsed | Sauna, cold dip |
| 3 | Watch out for the trees | Gyuri | Take the snowmobile to look for the camp leader; crash at the lone spruce. The crash is forced | None. You are stranded on the lake | Snowmobile (after the story) |
| 4 | The small print | Yoppi, Gyuri, Thomasz | Yoppi arrives at the crash for the insurance talk, a silly conversation where any option you choose ends the same way: Gyuri's insurance covers the damage and Yoppi lets you take the dog sled | Yoppi welcomed the King to camp himself: he rehearses in the ICEHOTEL | Dog sled |
| 5 | How much is the fish? | Linnéa, Alex, Boti | The hotel is locked and Linnéa has no key. She hints that the King had it when he crossed the ice and it may have fallen in the lake ("if only someone here knew how to fish"). Go back and ice fish for it with Alex and Boti | The ribbon on the key is royal blue, like one room's light | ICEHOTEL door |
| 6 | Five rooms | Oskar, bar guests | Find one symbol in each art room; the throne is empty | The symbols give the order to press the sunburst headboard | Art rooms, Ice Bar |
| 7 | The King below | Jimmy | Open the crypt under the Royal Suite and give him the whiskey | None needed | "Még nem veszíthetek" plays, the aurora returns, congratulations screen, then free roam loads |

Two payoffs worth protecting. The fishing spot where "you won't catch anything" becomes the one place you finally catch something. And the whiskey flask from chapter 1 is what warms the King in chapter 7, so the first friend you help saves him.

## Mini-games

Every mini-game uses only the controls the game already has (walk, E, steer, brake), so it works on phones without new touch UI. Effort is relative: S is one session, M is one to two.

| Mini-game | How it plays | Reuses | Effort |
| --- | --- | --- | --- |
| Build the igloo | Cut snow blocks at a drift (E), carry one at a time, place it on a glowing outline. The mound grows in 4 stages. Balazs and Richard comment and pass the bottle instead of helping | Igloo mound, whiskey animation | M |
| Heat the sauna | Carry logs from the woodpile, 2 per trip. Stoke to 80 °C and keep it there for 20 seconds while the girls complain it is still cold | Stove, temperature, woodpile | S |
| Snowmobile run | Follow the red-cross poles through light checkpoints. Past the midpoint a whiteout rolls in and the lone spruce appears. The crash always happens | Snowmobile, trail poles, lone spruce, screen effects | M |
| Insurance talk | A dialogue gag at the wreck: Yoppi reads out the small print and adds up the damage while you pick from reply choices that get sillier each round ("The tree came out of nowhere", "I'll pay in whiskey", "Is the tree insured?"). Gyuri steps in and offers his insurance to cover it. Every choice leads to the same ending: Yoppi sighs and lets you take the dog sled | New dialogue system | S |
| Harness the dogs | Six huskies with names and moods; put each in the right pair from Thomasz's hints (leaders up front, the strong ones at the back). Then ride, braking for the usual stop | Dog sled, husky farm | M |
| Fish for the key | Sit on the free fur. A timing bar: press E when the line twitches. Three junk catches (boot, ice glass, frozen mitten), then the key | Ice fishing spot | S |
| Five rooms | Each art room hides one carved symbol (the cat's eyes, a bird, the train number, a lotus). Order them on the Royal Suite headboard, whose sunburst has 7 bars | Rooms, Royal Suite headboard | M |
| Wake the King | Stairs under the ice bed into a small blue crypt. He is frozen mid-pose. Give him the whiskey (E). He drinks, thaws, and finishes the song he was rehearsing: "Még nem veszíthetek" plays in full while the aurora lights up outside | The new track, Jimmy's model | M |

If scope gets tight, cut Harness the dogs to a plain ride and Five rooms to a single hidden lever. The chain still holds.

## Characters

Everyone in the build keeps their spot; story mode gives each a job and lines that change as chapters complete.

| Character | Role in the story | Note |
| --- | --- | --- |
| Balazs and Richard | Open the story; the King's biggest fans | Their bottle becomes a key item |
| Barbara and Zsofia | Witnesses; they saw him leave | Zsofia's "Is the aurora visible outside?" becomes a real question |
| Gyuri | Hands over the snowmobile, warns about trees | Offers his insurance to cover the crash |
| Yoppi, camp leader | New. Knew the King personally and welcomed him to camp. Arrives at the crash, lends the dogs, and says the King rehearses in the ICEHOTEL | Look still to be decided |
| Thomasz | Teaches the dog team | |
| Alex and Boti | Lend the fishing spot | Boti's "How much is the fish?" names the chapter |
| Linnéa | Locked out of her own hotel; hints the key may have fallen in the lake | Stands outside until chapter 5 |
| Oskar and the bar guests | Each guest has one hint for the room puzzle | Maja already mentions the cat's eyes |
| Jimmy, the King | The goal; absent until the finale | Throne empty in story mode |

The player stays unnamed, as now: "the one who just arrived".

## Systems to build

Five small systems carry the whole story, and all of them sit on top of the existing code without rewriting it.

| System | What it does | Where it hooks in |
| --- | --- | --- |
| Story state | One ordered list of steps plus a set of flags; the single place that knows which chapter you are in | New `src/story/`; read by everything below |
| Objective line | One sentence at the top of the screen ("Bring wood to the sauna") and a soft beacon on the target | `ui/hud.ts` |
| Dialogue | Several lines per person, chosen by story step, with E to advance and optional reply choices | `npc/npcs.ts`, which holds one fixed `line` per person today |
| Pockets | Three or four items shown as icons: flask, key, symbols. No inventory screen | `ui/` |
| Save | Story step, flags and items in localStorage, written at each chapter end | Same approach `ui/quality.ts` already uses |

Gating is the cheap part. Interactions already come from a list of providers in `main.ts`, so a locked sled, a shut gate or a closed door is a provider that returns a different prompt ("Gyuri has the key") until its flag is set.

Two things to add to the world: Yoppi, and the crypt, which can reuse the hotel's vaulted hall builder at a small size.

## Build plan

Six phases, each playable on its own and each sized to the one-milestone-per-session rule. These become milestones M5 to M10 in `CLAUDE.md`.

1. **M5 Story spine.** Story state, objective line, changing dialogue, save, and the Story / Free roam choice on the title card. Nothing new to play yet, but the dimmed world is visible.
2. **M6 Camp act (ch. 1 and 2).** Igloo build and sauna heating. This is the vertical slice: stop here and playtest whether tasks feel cozy or like chores.
3. **M7 Lake act (ch. 3 and 4).** Checkpoint run, scripted crash, Yoppi and the insurance dialogue, dog harnessing and the ride across.
4. **M8 The key (ch. 5).** Locked hotel door, Linnéa outside with her hint, fishing mini-game.
5. **M9 Hotel act (ch. 6 and 7).** Room symbols, headboard puzzle, crypt, waking the King, finale with aurora and song, congratulations screen, hand-off to free roam.
6. **M10 Polish.** Hints when a player is stuck for a few minutes, phone pass, playtest with the group.

The risk is in M9: the crypt is the only large new piece of world. The finale itself is simple, a drink, a song and the aurora switching on.

## Decisions

Settled:

- The world starts dimmed: no aurora and no King's song until the rescue.
- The camp leader is Yoppi, who knew the King and points to the ICEHOTEL.
- The snowmobile crash is forced; Gyuri's insurance covers it.
- The insurance talk is a silly conversation where every choice ends with Yoppi lending the dog sled.
- Linnéa hints that the key fell in the lake, which sends the player ice fishing.
- The finale song is "Még nem veszíthetek", played after the King drinks the whiskey.
- A short congratulations screen, then free roam loads.
- English only. No photo rewards.

Still open:

- [ ] **Yoppi's look.** Jacket, hat and anything he is known for.
- [ ] **True anecdotes.** One real line per friend would replace the placeholder dialogue.
- [ ] **Scope of chapters 5 and 6.** The key hunt and the room puzzle can each be cut to a single step.
- [ ] **The songs.** Both tracks belong to their rights holders and the repo is public; `CREDITS.md` already notes this.
- [ ] **Replay.** One-time story, or extras afterwards such as a real fish to catch.
