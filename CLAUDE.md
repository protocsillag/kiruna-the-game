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

**Later (not v1):** dog sledding, ice fishing, Ice Hotel across the lake, map, photo mode, save system.

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
- Controls: WASD + mouse, E = interact, Shift = jog, P = pause time.

## Session rules (to save tokens)

- One milestone per session. Start a new session for the next one.
- Read only the files needed for the current task; don't scan the whole repo.
- Don't run browser or screenshot test loops. Make sure `npm run build` passes, and the user playtests.
- Make small, targeted edits; don't rewrite whole files unless needed.
- At the end: commit, push, update **Progress** below (3–5 lines max).

## Milestones

- [x] **M1 Foundation**: project setup, Pages deploy, snowy terrain, frozen lake, player + camera.
- [ ] **M2 Sky**: day/night curve, stars, aurora shader, snowfall, fog, bloom, ambient wind audio.
- [ ] **M3 Camp & sauna**: cabins, lodge, trees, trail poles, sauna interior + stove interaction, ice hole.
- [ ] **M4 Snowmobile & polish**: snowmobile enter/exit, handling, tracks, sound, headlight; interaction prompts, quality toggle, README.

## Progress

_(Update at the end of each session: what was done, what's next, known issues.)_

- **M1 done (2026-10-01):** Vite 8 + TS 7 + three 0.186 + Rapier 0.21. 800 m noise terrain (trimesh collider), frozen lake (ice slab collider, drift texture), fixed blue-hour light in `src/world/lighting.ts`. Orbit cam; code-built placeholder player: walk/jog, deep-snow slowdown, slippery ice, footprints, breath.
- **Deploy:** repo made public 2026-10-01; Pages (GitHub Actions) live at https://protocsillag.github.io/kiruna-the-game/
- **Next: M2 Sky** — replace `lighting.ts` with day cycle (add P = pause there).
- **Known:** Node lives at `~/.local/node/bin`, gh at `~/.local/bin` (not on PATH). Player is a placeholder; swap for CC0 model later. Bundle ~1.8 MB gz (Rapier WASM).
