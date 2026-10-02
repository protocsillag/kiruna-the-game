# Kiruna – the game

*Relive the core memories of the north.*

A relaxed, cozy 3D open-world browser game set at **Camp Alta, Kiruna, Swedish Lapland, in January**. No combat, no score, no fail state: walk around in the snow, warm up in a sauna on the frozen lake, take a cold dip, and ride a snowmobile under the northern lights. Made for a group of friends who were there in 2018.

**▶ Play: https://protocsillag.github.io/kiruna-the-game/**

## Controls

| Key | Action |
|---|---|
| **WASD** | walk · drive (W throttle, S brake/reverse) |
| **Mouse** / **Wheel** | look around / zoom |
| **Shift** | jog |
| **E** | interact: ride / get off the snowmobile, add wood, sit, cold dip |
| **P** | pause the time of day |
| **F** | forward the clock one hour |
| **Q** | toggle Low / High quality |
| **Esc** | pause |

**On a phone or tablet** (touch controls appear automatically, desktop is unchanged): left thumb = joystick (walk / drive), right thumb = look, pinch = zoom, tap the prompt to interact, **Jog** button, and ❚❚ / ◷ / +1h / HQ buttons for pause, pause time, forward time and quality. Phones start on Low quality with a lighter forest; landscape works best.

## What's there

- **Camp Alta** on the lakeshore: lodge with chimney smoke, five timber cabins, a glass-roof cabin, woodpile, spruce and frosted-birch forest, red-cross trail poles across the ice.
- **Sauna on the ice**: walk in, stoke the stove (E), watch the temperature climb, sit on the bench. The **ice hole** next to it is for a cold dip.
- **Dog sled** at the husky farm east of camp: six huskies pull you on their own; you only brake (S) and steer (A/D). They stop when you step off, and now and then one of them has to go.
- **People around camp** to talk to (E): Balazs & Richard sharing a smoky whiskey by the Ice Hostel, Gyuri at the snowmobile, Thomasz at the husky farm, Barbara & Zsofia in the sauna.
- **Ice fishing** next to the sauna with Alex & Boti by a campfire on the ice: sit down on the free reindeer fur and try your luck (you won't catch anything).
- **ICEHOTEL** across the lake (follow the red-cross poles, or the sign next to Gyuri): reception, a long ice corridor with five themed art rooms (Cat & Mouse, Birds of the North, Ice Express, Lotus Dreams, Royal Suite), and the Ice Bar at the end, where you can order a drink in a glass made of ice.
- **Snowmobile** parked at camp: arcade handling that slides a little on the ice, headlight, tracks, snow spray and engine sound.
- **Polar January light**: a 24-minute day where the sun barely clears the horizon at noon, long blue hours, stars and a drifting **aurora** at night, light snowfall and wind.

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

Every push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Tech

Vite + TypeScript + [three.js](https://threejs.org), physics with [Rapier](https://rapier.rs). Everything (models, textures, sound) is generated in code; see [CREDITS.md](CREDITS.md).

```
src/
  world/       terrain, frozen lake, buildings, camp, trees, trail, smoke
  player/      input, character, controller, orbit camera, footprints, breath
  vehicles/    snowmobile model, handling, tracks
  sky/         day clock, palette, sky dome, stars, aurora, snowfall, bloom
  activities/  sauna, ice hole
  audio/       wind, engine
  ui/          title/pause card, HUD, prompts, screen effects, quality
```

Project brief and progress notes live in [CLAUDE.md](CLAUDE.md).
