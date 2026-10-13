# Reel

A demoscene production: a ~63 s looping reel of classic effects, all written
in TypeScript and rendered into one panel-sized RGB565 frame (`ctx.createImageData565`, one `putImageData` per frame).

| # | Scene      | Technique                                                         | Touch               |
|---|------------|-------------------------------------------------------------------|---------------------|
| 0 | Title      | Baked dithered sunset sky, perspective grid floor per row         | -                   |
| 1 | Tunnel     | Angle/depth LUT (336x200, window slides to move the centre), 256² texture, 16 fog shades, half res | drag steers |
| 2 | Rotozoom   | 16.16 fixed-point texture walk over a Truchet texture, two pixels per store | drag turns / zooms |
| 3 | Vortex     | 3072 fixed-point particles, perspective streaks into a fading glow buffer | touch moves the eye |
| 4 | Fire       | Scrolling two-octave noise flames + averaging heat plumes, half res | touch feeds the fire |
| 5 | Metaballs  | Six balls summed from one falloff LUT at half res, iso palette    | drag a ball         |

Transitions (flash, iris, diagonal wipe, crossfade) composite the outgoing
scene from a second frame. Half-resolution fields are upscaled bilinearly.
Caption cards, washes and the progress bar are drawn with the canvas
(`fillText`, `fillRect` with `globalAlpha`) in the same batch as the frame,
so the canvas stays the only drawing node and presents straight to the
display.

Tap the left or right third to go to the previous or next scene.

- `src/effects/` one file per effect; `scenes.ts` bakes them a slice per
  frame behind the title card and runs the transitions
- `src/lib/frame.ts` frame constants, RGB565 helpers, sine tables, upscale
- `src/lib/presenter.ts` puts the frame and draws captions, washes, progress
- `src/lib/timeline.ts` running order, durations, transitions and caption cues
- `src/stores/reel.ts` clock, frame loop, touch and skipping

Hot loops follow the "Fast TypeScript" shapes in `docs/APP-GUIDE.md`: typed
arrays in `const` locals, window (`base + i`) or literal-masked
(`table[v & 255]`) indices, integer and 16.16 math. `npx --no-install gea build --board mosaico --app reel` builds it from the repository root.

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
npx --no-install gea run --board mosaico --app reel
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app reel
npx --no-install gea flash --board mosaico --app reel
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
npx --no-install gea run --board amoled --app reel
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## Screens

Every size derives from `window.innerWidth/innerHeight` (`cssDevicePixelRatio`
is 1, so CSS px = panel px) in `src/lib/frame.ts`; effects copy the extents
into locals before their loops. Half-resolution fields are `width/2 x height/2`.

| Board | Panel | Half-res field | Frame words | Caption class | Margin |
|---|---|---|---|---|---|
| mosaico | 480x480 | 240x240 | 115200 | large (name 56, dots 20, caption 14) | 16 |
| amoled | 410x502 | 205x251 | 102910 | large | 28 (rounded corners) |
| STM32F746G-Discovery (no target) | 480x272 | 240x136 | 65280 | small (name 48, dots 16, caption 12) | 16 |

480x272, worked out from the same code: horizon row round(272 * 172/272) = 172,
sun radius min(480 * 0.15, 272 * 0.235) = 64, floor 100 rows, iris reach
hypot(240, 136) + 14 = 290, 3072 vortex particles (3072 * 130560 / 130560),
tunnel table 336 x 200, caption lines at H - 56 / H - 23 / hint row 22. These
reproduce the original fixed 480x272 constants exactly.

## PRODFPS

- mosaico (480x480), render time per scene plus ~13 ms to put the frame on
  the panel: rotozoom ~21 ms (~30 fps), fire ~40 ms (~19), metaballs ~35 ms
  (~21), tunnel ~55 ms (~15), vortex ~56 ms (~14), title ~43 ms (~18). What
  remains in the slow scenes is 64-bit index and product arithmetic (rv32 has
  no 64-bit ALU); the hot loops are already dense and integer.
- amoled: not measured (board off limits during this port).

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
