# Bloom

Gray-Scott reaction-diffusion on the Mosaico (480x480), the AMOLED 2.06"
(410x502) and the STM32F746G-Discovery (480x272), in pure TypeScript, from one
codebase. Touch plants growth; four chips switch between Karl Sims'
patterns (Coral, Cells, Prints, Waves), each with its own palette. The boot
moment is a ring of seeds blooming from the centre; left alone, seeds keep
landing on their own.

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
npx --no-install gea run --board mosaico --app bloom
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app bloom
npx --no-install gea flash --board mosaico --app bloom
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
npx --no-install gea run --board amoled --app bloom
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## How it works

- `src/lib/reaction.ts`: the reaction on a grid of 4 px cells sized from the screen that wraps
  like a torus, in float32 (`Float32Array` + `Math.fround`), 9-point
  Laplacian, two steps per frame; then a shaded tone per cell (V plus relief
  from its slope).
- `src/lib/upscale.ts`: a bilinear 4x upscale in integers through a
  256-entry RGB565 palette into an `ImageData565`.
- `src/lib/patterns.ts`: feed/kill rates and palette stops.
- `src/lib/painter.ts`: one canvas batch per frame: the pixels, the wordmark,
  hint and pattern chips. Nothing retained sits over the canvas.
- `src/lib/bloom.ts`: the frame loop, touch, chips, attract mode and hint.

## Screen sizes

Everything derives from `window.innerWidth/innerHeight` (`src/lib/layout.ts`,
`cssDevicePixelRatio` 1): grid = floor(size / 4), field image = grid x 4
(centred, with a 1 px margin on the amoled), font class by `min(w, h) >= 400`,
chip bar centred in portrait, 24 px margins in portrait for the rounded corners.

| Board | Panel | Grid | Field image | Fonts |
|---|---|---|---|---|
| Mosaico | 480x480 | 120x120 | 480x480 | large (32/14/14) |
| AMOLED 2.06" | 410x502 | 102x125 | 408x500 | large |
| STM32F746G-Discovery (no target yet) | 480x272 | 120x68 | 480x272 | small (24/12/12) |

The 480x272 numbers are the original design: the same code yields them, with
16 px margins, the chip bar bottom right and 40 px chips.

## PRODFPS

- mosaico: ~16.3 fps (Coral, 4 px cells): step ~15 ms, upscale ~17 ms (memory-bound), paint ~25 ms (of which ~12.7 ms is the panel wire).
- amoled: TBD

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
