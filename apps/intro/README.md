# GeaStack Intro

The opening shot of a GeaStack showcase video: the pixel-art Gea logo
assembles itself on the STM32F746G-Discovery in about eight seconds, then
holds on the lockup. Tap anywhere to replay.

| Time (s) | Phase | fps on the board |
|---|---|---|
| 0.0 – 2.05 | A cyan cursor blinks, `> GEA FLASH --BOARD DISCO` types, the board answers `OK` | 59–62 |
| 1.9 – 3.45 | A dot grid fades up, six circuit traces race in from the edges and draw the base bar from its ends to the stem's root | 37–50 |
| 3.44 – 4.95 | The sprout grows pixel by pixel along its strokes, white-hot at the tip, in a neon glow | 49–62 |
| 4.98 – 6.3 | The star ignites: a flash and a cross of light, a cyan and magenta bloom, a burst of pixel sparks | 53–62 |
| 5.55 – 7.25 | The chrome "Gea" dissolves in and a sheen crosses it | 37–42 |
| 6.75 – 7.8 | The hairline grows, "GeaStack" and the tagline rise in | 42–52 |
| 7.8 → | Hold: the star twinkles, dust drifts, the hairline's gradient flows | 50 |

The tagline is the website's hero headline (`website/index.html`,
`h1.hero-title`): "Write TypeScript. Build native apps."


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
npx --no-install gea run --board mosaico --app intro
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app intro
npx --no-install gea flash --board mosaico --app intro
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
npx --no-install gea run --board amoled --app intro
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## How it is built

Everything is drawn into one RGB565 frame the size of the panel (the composition
is the 480x272 "stage", centred; the grid, traces, dust and glow run to the
panel edges: see `src/lib/frame.ts`)
(`ctx.createImageData565`) and put on the canvas once per frame, so the
canvas presents straight to the display. Every pixel is a function of the
clock (`src/lib/timeline.ts`), so each playback looks the same.

- `scripts/bake-logo.mjs` resamples `assets/logo.png` (the website's
  `logo.webp`) onto its pixel grid (5.5 source px per cell) and writes
  `src/data/logo.ts`: each lit cell's position, RGB565 colour, part (bar,
  sprout, star, dots, wordmark, glow rings) and reveal order. The sprout's
  order is the stroke distance from the stem's root, so it grows the way it
  is drawn. `npm run logo` after changing the image.
- `scripts/bake-type.mjs` renders the type from `shared/fonts` (Hanken
  Grotesk ExtraBold at -0.035em, JetBrains Mono uppercase at 0.12em) into
  4-bit coverage masks in `src/data/type.ts`. `npm run type`.
- `src/lib/painter.ts` paints back to front: the star's dithered bloom
  (`spark.ts`), the board grid and traces (`traces.ts`), the logo's 2x2
  cells (`cells.ts`), the spark's flare and burst, the hairline and the type
  (`titles.ts`, `type.ts`). Once the type has settled its band is left in
  the frame instead of being redrawn.
- Hot loops blend in "spread" RGB565 (`(c | c << 16) & 0x07e0f81f`) with
  integer timing, so the generated code stays integer.

The bottom-right corner stays clear for the firmware's fps overlay, so it
can be masked when filming.

## Screen sizes

The frame is `window.innerWidth x innerHeight` (`cssDevicePixelRatio` 1). The
480x272 stage is centred: logo x = (width - 292) / 2 (even), rows shifted by
OY = (height - 272) / 2, the kicker and tagline centred on the width. Traces
start at the panel's own edges and are kept 20 px from the left edge.

| Board | Panel | OY | Logo x | Stage offset |
|---|---|---|---|---|
| Mosaico | 480x480 | 104 | 94 | (0, 104) |
| AMOLED 2.06" | 410x502 | 115 | 58 | (-36, 115) |
| STM32F746G-Discovery (no target yet) | 480x272 | 0 | 94 | (0, 0): the original |

## PRODFPS

- mosaico: ~27 fps through the hold (the full-panel clear is ~6 ms of PSRAM writes, the panel wire ~12.7 ms).
- amoled: TBD

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
