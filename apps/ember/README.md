# Ember

The touch UI of a premium smart oven with guided cooking: charcoal surfaces,
ember and amber accents, Fraunces titles over Manrope, thin Outfit numerals,
and real food photography.

## Run on a board

Install Git, Node.js 22.18+ (22.x) or 24+, npm, Python 3, CMake and Ninja.
Run these commands from the **demos repository root**.

```sh
git clone https://github.com/geastack/demos.git
cd demos
npm ci
```

Connect a powered-on board with a USB data cable.

### Set up Mosaico

Mosaico requires ESP-IDF **6.2-dev** with ESP32-S31 support. Install its toolchain
into the directory Gea searches for this target:

```sh
npx --no-install gea setup --esp-idf --idf-version master --idf-dir "$HOME/esp32/esp-idf-v6.2-dev"
npx --no-install gea setup
```

In the second command, choose **Known supported board**, select **ESP32-S31
Mosaico**, select its USB identity, and save the alias as **mosaico**. If setup
offers to build or flash an app, you can skip that step and use the commands
below. On Windows, use a native
PowerShell terminal and `$env:USERPROFILE/esp32/esp-idf-v6.2-dev` in place of
`$HOME/esp32/esp-idf-v6.2-dev`.

Confirm the saved board and check the toolchain:

```sh
npx --no-install gea boards show mosaico
npx --no-install gea doctor
```

### Build, flash, and monitor

```sh
npx --no-install gea run --board mosaico --app ember
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app ember
npx --no-install gea flash --board mosaico --app ember
npx --no-install gea monitor --board mosaico
```

`flash` builds before flashing. Stop the monitor before using another command
that accesses the board's USB connection. To capture the screen:

```sh
npx --no-install gea screenshot --board mosaico
```

If Gea requests download mode because the running firmware cannot accept an
update, hold **BOOT** while resetting or powering on the board, then release it
once the downloader connects. Gea resolves the saved board identity.

### Use the AMOLED 2.06 instead

Run `npx --no-install gea setup`, choose the supported AMOLED 2.06 board and its
USB identity, and save the alias as **amoled**. Follow setup's ESP-IDF installation
prompt for that board. Then run:

```sh
npx --no-install gea run --board amoled --app ember
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## Screens

- **Boot** (~2.6 s): a glow blooms, the coal ignites in its ring and sparks
  drift up, "Ember" and "Guided cooking, perfected" rise, and an ember line
  draws out beneath. Tap to skip.
- **Recipes**: a carousel of six dishes. Drag, flick (it carries momentum
  and snaps on a slightly under-damped spring) or tap a side card; the centre
  card grows to full size, the side cards shrink under a veil, and every
  photo drifts against its card's travel (parallax). Below: the name, time,
  temperature and mode. Tap the centre card (it presses in) to open it.
  "Manual" in the top bar opens manual mode.
- **Detail**: the dish photo pushes in full-bleed on the right; on the left
  the title, time / temperature / mode and the steps on a timeline, with
  "Start cooking" floating over the photo.
- **Preheat**: a big 270° heat arc fills (ember to amber, with a soft glow
  and a cream tip) as the oven warms on an easing curve; its inside glows
  warmer as it heats and breathes. The live temperature is in the middle, the
  flow ahead on the left, time left and the next step on the right. On
  reaching the setpoint two rings burst out of the arc and the first prompt
  follows.
- **Cook**: a segment per step across the top. Timed steps show what to
  expect, Pause / Resume and +1 min, and a countdown ring that empties toward
  its start. Prompts ("Add the chicken", "Baste & turn", "Remove the foil")
  wait for the cook with an animated tile (an arrow pointing into the oven,
  or arrows swinging half a turn) and a calling ring.
- **Ready**: the dish pushes in again, an amber check pops with two rings
  bursting out, sparks rise over the food and "Ready" settles with the
  summary. Done, or Keep warm (the oven holds 70 °C).
- **Manual**: drag the dial around the heat arc (50-250 °C in 5° steps; the
  arc follows on a spring, the numeral rolls from the direction of travel,
  the inside glows warmer), pick Bake / Convection / Grill / Air-fry (the lit
  highlight slides over), set a timer, Start. It then runs the same preheat,
  "Put your food in" and timer flow.
- **Idle**: after 90 s untouched on the browsing screens: a breathing ember,
  the time and a greeting. Any touch wakes it.

The close button in the cooking flow arms on the first press ("Tap to stop")
and stops on the second. The USER button is "back" everywhere (in the
cooking flow it is the close button).

## Simulation and demo speed

A real oven takes about 2.4 s per degree to preheat (about 7 minutes to
200 °C) and holds its setpoint with a slow first-order settle; timers count
the recipe's real minutes. The "Demo speed" chip (on by default, remembered
in `localStorage`) compresses every preheat to 7 s and every timed step to
10 s, so a whole recipe plays in well under a minute for a video; tap it for
"Real time".

## How it is built

- `src/lib/ring.ts`: the heat arcs, rendered in TypeScript into an RGB565
  `ImageData565` shown by a canvas (after velo's speed ring). Every band
  pixel's static layers are built once and sorted by angle, so a frame
  repaints only the arc between the old and the new tip (behind it one
  stored word, past it another, around it a blend of track, glow, gradient
  fill and the round cap and tip dot looked up by squared distance). The
  inner glow is a dithered radial weight per pixel, repainted in small steps
  as it breathes. The tables build in the background from the boot screen on
  (a few ms a frame, paused while the panel is touched, rushed if a screen
  needs a ring first); `src/lib/ring-view.ts` blits only the rows that
  changed.
- `src/stores/carousel.ts`: one fractional `position` drives three mounted
  cards. Each card is a clipping window placed and sized by layout, with the
  photo inside placed by left/top (a transform would escape the clip) and
  four background-coloured corner masks; nothing in the stage is ever
  transformed.
- `src/stores/cook.ts`: the session (preheat, prompts, timers, Ready) in
  plain fields, updating store fields only when what they show changes.
- `src/stores/manual.ts`: the dial (angle to 5° steps, spring, knob) and
  the sliding mode highlight.
- Motion elsewhere is CSS keyframes: staggered rises, the photo push-in,
  pops, bursts, sparks, calling rings, the swinging turn arrows.

## Performance (measured on the board)

Recipes at rest 62 fps, swiping 33-39; Detail 62; Preheat 49-62; Cook
timer 52-58, prompts 62.5 (the panel's cap) outside the ~1 s pop-in; Ready 60-62; Manual dial drag 48-52; Idle 62. The
ring tables take ~9 s to build after boot (the UI runs at ~40-50 fps
meanwhile, and the build pauses while the panel is touched).

Not yet: a faster ring build (mirror symmetry, cheaper per-pixel setup) and
a cheaper carousel frame (the side-card veils and corner masks repaint the
whole stage while it moves).

## Assets

- `public/art/`: `scripts/generate.py` made the 1536x1024 photographs with
  OpenAI `gpt-image-1` (it reads `OPENAI_API_KEY` from the environment);
  `node scripts/prepare-art.mjs <dir>` crops them to the exact sizes shown
  (480x272 heroes with the left side fading into the background, 256x152
  cards, 56x56 tiles, 12x12 corner masks), dithers to RGB565 and stores
  256-colour PNGs (~550 KB in all).
- `npm run icons` renders the Phosphor icons in `icons.config.json`.

## Layouts (one codebase, three screens)

`src/layout.ts` reads `window.innerWidth/innerHeight` once and derives every
position and size; templates apply them inline, the CSS holds the look. Heat
arc 216 / 232 / 256 px and timer ring 176 / 200 / 224 px (landscape / square /
portrait); the ring specs scale with the canvas.

- **480x272 landscape (the design size, no build target; arithmetic only):**
  the original columns: 256x152 carousel cards at y 44 spacing 236, 216 px arc
  at (132, 52), 176 px timer ring at (288, 84), mode chips column at x 344,
  480x272 hero. The formulas reduce to the original numbers at 480x272.
- **Square / portrait:** carousel cards 320x190 / 288x171 (the 256x152 photo
  scaled up); Detail keeps the hero on top (portrait crops it to 232 px with
  the title, specs and steps beneath) and steps at 28 px pitch; Manual stacks
  the dial, a 2x2 mode grid, and a timer + Start row; Preheat puts the flow
  list and stats under the arc; Cook centres the ring, copy and buttons;
  Ready, Idle and Boot centre on the panel.

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
