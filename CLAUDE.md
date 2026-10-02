# CLAUDE.md — Kiruna – the game

Read this file at the start of every session. It is the single source of truth: do not ask for the original long prompt or past chats. Keep this file short; update the **Progress** section at the end of each session.

## What we're building

A relaxed, cozy 3D open-world browser game set at **Camp Alta, Kiruna, Swedish Lapland, in January**. No combat, no score, no fail state. You walk around in the snow, warm up in a sauna on the frozen lake, and ride a snowmobile under the northern lights. It's for a group of friends who were there in 2018 to revisit the memory after a tough day. The movement and camera should feel a bit like GTA (third-person, hop on/off vehicles), at a slow, calm pace.

## Version 1 scope (only this — nothing else)

1. **Camp Alta**: frozen lakeshore, 5–6 small wooden cabins (dark-stained/falu-red timber, snow on roofs, warm yellow windows), one glass-roof cabin, a lodge with chimney smoke, woodpile, birch and spruce trees, trail poles with red crosses.
2. **Sauna on the frozen lake**: small wooden sauna on/at the lake edge with a stove. Walk in, press E to add wood, temperature rises, steam and warm orange light, sit on the bench. Next to it, an ice hole for an optional cold dip (screen shiver effect).
3. **Snowmobile**: parked at camp. E to get on/off, arcade handling, a slight slide on ice, headlight at night, snow spray, tracks, engine sound. Free roam across the lake.
4. **Sky & light** (the setting, kept simple): January polar light. Short pink/orange horizon glow around midday, otherwise blue hour and night. Stars, and a **shader aurora** (green ribbons, slow drift) at night. Light snowfall. A 24-minute day cycle, which can be paused.
5. **Player**: third-person character in a winter jacket and hat, walking/jogging, orbit camera, footprints, slower in deep snow, breath vapor.

**Later (not v1):** ice fishing, Ice Hotel across the lake, map, photo mode, save system.

## Mood references (from our photos)

- Midday: sun never fully rises, a thin pink-orange band under grey-lilac clouds, frosted birches.
- Friends on a vast flat frozen lake at blue hour, a single snowy spruce, snowmobile tracks, low treeline in the distance.
- On the horizon: the LKAB mine mountain with steam plumes and a faint town glow (simple distant silhouette).
- Warm vs cold: amber windows and neon-like warm lights against blue snow.

## Tech

- Vite + TypeScript + Three.js. Physics: `@dimforge/rapier3d-compat`.
- Prefer **free CC0 low-poly models** (Kenney, Quaternius, Poly Pizza) over modelling in code. Log every asset in `CREDITS.md`.
- Deploy to GitHub Pages via GitHub Actions.
- Target 60 fps on a mid-range laptop. Low/High quality toggle (shadows, snow particles).
- Folders: `src/world`, `src/player`, `src/vehicles`, `src/sky`, `src/activities`, `src/ui`, `src/audio`. Keep modules small (<300 lines).
- Controls: WASD + mouse, E = interact, Shift = jog, P = pause time. F = +1 hour (listed on the title card).

## Session rules (to save tokens)

- One milestone per session. Start a new session for the next one.
- Read only the files needed for the current task; don't scan the whole repo.
- Don't run browser or screenshot test loops. Make sure `npm run build` passes, and the user playtests.
- Make small, targeted edits; don't rewrite whole files unless needed.
- At the end: commit, push, update **Progress** below (3–5 lines max).

## Milestones

- [x] **M1 Foundation**: project setup, Pages deploy, snowy terrain, frozen lake, player + camera.
- [x] **M2 Sky**: day/night curve, stars, aurora shader, snowfall, fog, bloom, ambient wind audio.
- [x] **M3 Camp & sauna**: cabins, lodge, trees, trail poles, sauna interior + stove interaction, ice hole.
- [x] **M4 Snowmobile & polish**: snowmobile enter/exit, handling, tracks, sound, headlight; interaction prompts, quality toggle, README.

## Progress

_(Update at the end of each session: what was done, what's next, known issues.)_

- **M1+M2 (2026-10-01):** Vite 8/TS 7/three 0.186/Rapier 0.21. Noise terrain + frozen lake, orbit cam, code-built player (footprints, breath). `src/sky/`: 24-min Kiruna-January day clock (P pause, F +1 h), palette, dome, stars, aurora, snowfall, fog, bloom; synthesised wind in `src/audio/`.
- **M3 done (2026-10-01):** `world/buildings.ts` timber builder → lodge (smoke, porch light), 5 cabins, glass-roof cabin, woodpile (`camp.ts`); instanced spruce + frosted birch, lone spruce on ice (`trees.ts`); red-cross trail poles (`trail.ts`). `activities/`: walk-in sauna (E add wood → temp, steam, fire light; E sit), ice hole cold dip with shiver. Camera raycasts against walls. Placement follows `shoreZ()`.
- **Deploy:** public repo, Pages via Actions → https://protocsillag.github.io/kiruna-the-game/
- **M4 done (2026-10-01):** `vehicles/`: code-built sled, arcade handling (ice grip 1.6 vs snow 7), capsule collider + character controller, tracks, spray, headlight by darkness; `audio/engine.ts` synth (shared ctx in `audio/context.ts`). Camera auto-follows behind the sled. Interaction providers list in `main.ts`. Q / title button: quality (shadows, bloom, 1× DPR, 35% snow). README.
- **Iteration 1 (2026-10-01):** sled keeps full speed on ice (forward = throttle, only sideways slip decays: ice 2.2 vs snow 10); trail poles have no colliders; terrain trimesh uses FIX_INTERNAL_EDGES. Sauna 7.2 m wide (16 seats, sit where you stand), ice hole is *inside* through the floor; heat target 1 log≈36 °C…5≈96 °C, rate scales with logs, slower cooling. New `activities/yurt.ts`: round kåta, campfire, reindeer-fur seats (E sit), door steps fitted to terrain.
- **Ice Hostel (2026-10-01):** `activities/igloo.ts` snow mound + arched tunnel right of the lodge (woodpile moved to the left), "ICE HOSTEL" sign. E "listen to the king" plays `public/audio/the-king.mp3` (Zámbó Jimmy; Drive streaming failed in-browser, owner chose to commit the file). Loops, fades over ~38 m, pauses with Esc.
- **Mobile (2026-10-02):** `ui/touch.ts` gated on `(hover: none) and (pointer: coarse)` → `body.touch`; all touch UI hidden otherwise. Floating left-thumb stick (analog via `input.move()`, also drives the sled), right-thumb look, pinch zoom, prompt is tappable, Jog/❚❚/◷/+1h/HQ buttons. Phones: Low quality default, 50% trees, DPR ≤ 1.5, Android fullscreen on tap. iPhone has no pointer lock (guarded). Explicit z-index layers in style.css.
- **Dog sled (2026-10-02):** `world/dogfarm.ts` husky farm east of cabins (gate x=58, faces lake; yard, 5 dog houses, shed, sign, resting dogs). `vehicles/dogsled.ts`: 6 huskies (`husky.ts`) in 3 pairs; only the lead pair has a collider, the rest + sled + musher follow its trail. Dogs pull on their own while ridden (≈23 km/h), S brakes, A/D steer, no throttle; stops when you get off. A dog poops every ~50–75 s (steaming pile, named in status). **Physics lesson:** no push-down velocity while grounded — it made Rapier's KCC stall/sink on the ice (verified headless); snap-to-ground is enough.
- **v1 complete. Next (later list):** ice fishing, Ice Hotel, map, photo mode, save; swap code-built models for CC0.
- **Known:** Node at `~/.local/node/bin`, gh at `~/.local/bin` (not on PATH). All models are code-built placeholders (no CC0 assets yet). Shader NaNs → bloom black boxes: keep pow() bases ≥ 0. LKAB mine silhouette not in any milestone.
