# Wander

A travel-inspiration app for the STM32F746G-Discovery: five gouache travel
posters (Kyoto, Santorini, Iceland, Marrakech, Patagonia) to swipe through,
open and save.

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
npx --no-install gea run --board mosaico --app wander
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app wander
npx --no-install gea flash --board mosaico --app wander
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
npx --no-install gea run --board amoled --app wander
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## Screens

- **Boot** (~2 s) — on cream paper a vermilion sun rises over a drawn horizon,
  "Wander" and "Go somewhere beautiful" rise beneath it, then the Kyoto poster
  slides up over the paper and Discover takes over from the same pose. Tap to
  skip.
- **Discover** — a full-bleed poster with the destination in Fraunces over its
  sky, the country and a one-line tagline, dark-glass chips (best season,
  flight time, price level), page dots and, once something is saved, a
  "N saved" badge. Swipe or flick to travel (it wraps around); tap to open.
  Left alone, it advances every 7 s; the active dot fills over the countdown.
- **Detail** — the poster lifts into a top band while a cream sheet rises over
  it: title, two lines of story, a facts row (season, flight, time zone), a
  taste and a sight as cards, and a "Plan my trip" button in the
  destination's accent. Tapping it saves the trip ("Saved to your trips" with
  a popping check); tapping again removes it. Saved trips persist in
  `localStorage`. The back chevron or the USER button returns to Discover;
  after a minute untouched it returns by itself.

## How the motion works

- **Hero strip** (`src/stores/carousel.ts`): one fractional `position` (the
  destination at the screen's left edge) drives two slots, the destination
  under the left edge and the next one, each a literal `<img>` moved by
  `translate`. Dragging sets it from the finger, a release eases it (cubic
  out, duration scaled to the distance left) to the nearest destination or
  the flung one, and the attract timer slides it one step. No opacity ever
  touches the posters.
- **Copy and chips** are unmounted while the strip moves (overlays repainting
  over moving posters cost frames; only the small page dots stay), and remount
  when it lands, so their `@keyframes` entrances replay: the title and tagline
  rise, the chips slide up from the bottom edge (transform only, since they
  hold icons).
- **Discover <-> Detail** is a shared-element move: Detail's band starts at
  the Discover pose and shifts up 64 px while the sheet rises 176 px; coming
  back, the poster drops from the band pose onto the paper.
- **Colour**: every value is snapped to RGB565. Titles use a per-destination
  ink chosen from the sky under them (dark over the bright dusk and morning
  skies, cream over Iceland's night) so they read without shadows; the pills
  are opaque colours pre-blended from each poster's lower edge.

## Assets

- `public/art/` — the posters (480x272) and 88x88 vignettes were generated with
  OpenAI `gpt-image-1` by `scripts/generate-art.py` (it reads `OPENAI_API_KEY`
  from the environment), then dithered to RGB565.
- `npm run icons` renders the Phosphor icons listed in `icons.config.json`.

## Boards and layout

One codebase, three panel shapes. `src/layout.ts` reads `window.innerWidth/innerHeight`
once and everything (art placement, copy, chips, dots, the Detail sheet, boot,
carousel width) derives from it; there is no per-board branch.

| Panel | Shape | Discover | Detail |
|---|---|---|---|
| 480x272 (STM32F746G-Discovery, not buildable yet) | landscape | the original layout: copy top left, chips bottom left, dots bottom right | poster band 96 px over a sheet with two columns (story, facts, button | two 104 px cards) |
| 480x480 (mosaico) | square | same arrangement, larger title (`t-hero-l`, 56 px), the poster's sky fills the top | the whole poster as a 272 px band, the landscape sheet below it |
| 410x502 (amoled) | portrait, rounded corners | title and badge 14 px lower, chips on their own row with the page dots centred under them, 28 px clear of the bottom | 90 px band, one column sheet: story, facts, the two cards as full-width rows, full-width button |

480x272 worked out from the same code: `WIDE` is true, so the art window is the
poster itself (offset `H - 502 = -230`), `STACKED` is false (chips and dots share
the row at y = 228), the title class is `t-hero` (44 px), the Detail band shifts
64 px and the sheet starts at y 96 with the columns body: identical to the
original 480x272 design (checked in the DOM simulator at that size).

Artwork: each poster is one 480x502 image: the 480x272 poster at the bottom and a
synthetic sky above it (`scripts/extend-art.py`; flat gradient or mirrored top
band per poster; re-running it re-crops the original first). The panel shows the
image's bottom `H` rows (landscape: the poster exactly) and its middle `W` columns
when narrower than 480 (crop offsets per destination in `layout.ts`). The firmware
embeds one image set; the build reports 54% of the app partition free.

The amoled layout was checked in the DOM simulator at 410x502 only: the board was
taken off limits before it could be flashed.

## Performance

- mosaico (480x480): PRODFPS 62.5 at rest on Discover, ~45 during a poster slide
  (a full 480x480 frame takes ~12.7 ms on the 80 MHz QSPI wire alone).
- amoled: not measured (board not flashed).

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
