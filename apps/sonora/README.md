# Sonora

The touch screen of a premium smart speaker: dark glass whose tint and accent
follow the album art, a cover flow, a queue, a volume overlay, rooms and a
sleep timer. Playback is simulated: time runs, the equaliser dances to a
synthetic spectrum, nothing is heard.

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
npx --no-install gea run --board mosaico --app sonora
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app sonora
npx --no-install gea flash --board mosaico --app sonora
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
npx --no-install gea run --board amoled --app sonora
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## Screens

- **Boot** — five equaliser bars bounce up inside two rings rippling out like
  a speaker cone; "Sonora" and "Sound for every room" rise beneath (~2.4 s).
  Tap to skip.
- **Now Playing** — the 192 px art on a glow in the cover's own hue; the room
  chip, sleep timer and library at the top; title and artist (they slide in
  from the side you skipped toward); a 26-band equaliser; a scrubber you drag
  (the knob grows while held); queue, previous, play/pause, next and volume.
  Play/pause pops its icon and bursts a ring; a new album bounces the art and
  steps the whole screen to the new tint.
- **Library** — a cover flow: swipe with momentum, covers grow and brighten
  into the centre, the background re-tints to the centred album. Tap a side
  cover to bring it over, tap the centred one to play it: its cover flies
  into the Now Playing art. Opening the library does the reverse.
- **Queue** — the playing album's cover (flown in from Now Playing) and the
  next five tracks. Tap a row to play it (the rows above it are skipped),
  swipe it left to remove it (the rows below close the gap), or drag its grip
  to move it (the others step aside).
- **Volume** — drag vertically on the art (or tap the speaker button): a
  panel slides over the right column with a rolling numeral and a tall pill
  whose accent fill follows the finger. It slides away 2 s after the last
  touch. The level persists.
- **Play on** — the room chip opens a sheet with three speakers (Living room,
  Kitchen, Bedroom); the playing one dances. Pick another: a dot circles its
  card while the music moves, a check pops, the sheet goes.
- **Sleep timer** — Off, 15 min, 30 min, 1 hour or end of track; the moon
  button then counts down ("29m") and playback pauses when it runs out.
- **Ambient** — after 45 s untouched on Now Playing: the cover, the time,
  the track with a dancing equaliser and a hairline of progress. Any touch
  wakes it.

The USER button closes an overlay, or returns to Now Playing.

## How it is built

- `src/stores/player.ts` — the simulated playback and the queue (the album
  playing, then the next album, topped up as it drains). Shown values are
  written only when they change: texts once a second, the scrubber once a
  pixel.
- `src/stores/tint.ts` — the background, accent and muted accent, stepped
  across in six whole-screen repaints when the album changes.
- `src/render/spectrum.ts` — the equaliser canvas. Each band follows a
  spectral tilt, two slow wobbles from a sine table and the album's beat
  (kick, snare, hats at its tempo), scaled by its energy; bars rise fast,
  fall slowly, and leave white peak caps. Paused, the bars sink to dots and
  the canvas stops drawing.
- `src/stores/flow.ts` — the cover flow is one fractional `position`; drag,
  momentum and an exponential settle move it, and five slots are placed and
  sized by layout. A slot blits its image 1:1 at rest (144 px centre, 96 px
  sides) and scales down the next bigger image between, never up.
- `src/stores/queue.ts` — the queue's gestures on five fixed row slots,
  positioned by layout so the list clips them, eased in whole pixels.
- Shared-element moves are `@keyframes` from the other screen's pose
  (translate + scale) to the element's own; overlays enter and leave with
  slides, the leave playing before they unmount.

## Assets

- `public/art/` — the six covers (`scripts/generate.py`, OpenAI
  `gpt-image-1`; it reads `OPENAI_API_KEY` from the environment), resized by
  `npm run art -- <folder>` (`scripts/build-art.mjs`) to the sizes shown
  (192, 144, 96 and 32 px) with anti-aliased rounded corners, dithered to
  RGB565. The same script measures each cover's palette (k-means) into
  `src/data/palette.ts` and `src/styles/halo.css`.
- `npm run icons` renders the Phosphor icons in `icons.config.json`.
- Albums, artists and tracks are fictional.

## Not yet

- The cover flow runs at ~27 fps while the covers move (five scaled covers
  with alpha corners and dimming veils repaint every frame); at rest it is
  62 fps.
- The queue shows only the next five tracks (no scrolling).

## Layouts (one codebase, three screens)

`src/layout.ts` reads `window.innerWidth/innerHeight` once and derives every
position, width and size; templates apply them inline, the CSS holds the look.
`LAND` is w > 1.2 h, `PORT` is h > 1.1 w, otherwise square.

- **480x272 landscape (the design size, no build target; arithmetic only):**
  art 192 px at (24, 40); 208 px column at x 248 (top row y 16, title y 62,
  26 bars of 8 px at y 124, scrubber y 172, transport y 210); cover flow 144 px
  centre, 96 px neighbours, centred (240, 114); queue 42 px rows at (176, 56),
  288 px wide; sheets 192/132 px tall; 30 px pills. Identical to the original
  hand-tuned numbers because the formulas reduce to them at 480x272.
- **480x480 square / 410x502 portrait:** the column stacks under a centred 192
  px cover; column width 312 / 338 px (12 / 13 px equaliser pitch); 40 px
  chips and pills; the cover flow's centre cover is the 192 px image with 128 /
  104 px neighbours; the queue shows a 96 px card above a full-width list with
  48 / 52 px rows; the volume panel is 256 / 280 px tall; sheets wrap their
  options. Portrait keeps corner controls 24 px from the rounded corners.
- The shared-element moves (art to library / queue) are landscape-only; stacked
  layouts pop the cover in.

## Measured

- mosaico (480x480): PRODFPS 62.5 on Now Playing, playing, equaliser dancing.
- amoled (410x502): not measured (out of bounds for this pass).

The equaliser looks its canvas up every frame until the screen has mounted
(a single lookup one frame after `attach()` raced the mount on hardware and
left it blank; computed canvas sizes were not the cause).

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
