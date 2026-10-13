# Ripple

A real-time multi-touch fluid on the Mosaico (480x480), AMOLED 2.06" (410x502) and STM32F746G-Discovery
(480x272), in pure TypeScript from one codebase.
Every finger (up to five) drags the fluid and lays its own neon dye, which
swirls, curls and slowly fades. Idle for 5 s and two ghost fingers draw slow
Lissajous swirls; the first touch takes over. Modes: Ink (neon on ink), Smoke
(warm, rising) and Aurora (green / teal / violet).

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
npx --no-install gea run --board mosaico --app ripple
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app ripple
npx --no-install gea flash --board mosaico --app ripple
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
npx --no-install gea run --board amoled --app ripple
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## How it works

- `src/lib/fluid.ts`: a stable-fluids solver (Stam) with vorticity
  confinement, in integer fixed point. Velocity on 16 px cells (32x19 with a
  wall ring just outside the panel, Q8 cells/s), dye on 8 px cells (60x34,
  16-bit per channel). Per frame: confine vorticity, optional buoyancy,
  pressure projection (10 Gauss-Seidel sweeps, warm-started), then
  semi-Lagrangian advection of velocity and dye.
- `src/lib/render.ts`: a hue-preserving tone map per dye cell (LUT, with a
  threshold that sends faint dye to pure background) into RGB565, then a
  bilinear upsample in 2x2 pixel blocks into an `ImageData565`.
- `src/lib/motion.ts`: finger strokes and splashes, the boot bloom and the
  ghost fingers. `src/lib/modes.ts`: palettes and per-mode parameters.
- `src/lib/ripple.ts`: finger tracking, pill taps, the frame loop, idle and
  hint timing. `src/lib/painter.ts`: one canvas batch per frame: the pixels,
  the mode pill and brand dot, and the text. Nothing retained sits over the
  canvas: that would cost a full-screen compositing copy per frame.

Hot loops follow the fast TypeScript shapes in `docs/APP-GUIDE.md`: flat
sweeps with `cell + offset` indices, power-of-two masks on gathers and per-row
loops, and literal grid constants.

## Tuning

Grid sizes and pressure iterations are constants at the top of
`src/lib/fluid.ts`; force, radii, dye amounts and the bloom and ghost motion
at the top of `src/lib/motion.ts`; per-mode parameters in `src/lib/modes.ts`;
tone-map exposure and glow in `src/lib/render.ts`.

## Screen sizes

All sizes derive from `window.innerWidth/innerHeight` (`src/lib/layout.ts`,
`cssDevicePixelRatio` 1): dye grid = floor(size / 8), velocity grid =
ceil(field / 16) + 2 wall cells, field image = dye grid x 8 (centred; the few
pixels of margin are painted in the mode background). Chrome: 40 px pill,
large fonts when `min(w, h) >= 400`, 24 px margins in portrait.

| Board | Panel | Dye | Velocity | Field image | Chrome |
|---|---|---|---|---|---|
| Mosaico | 480x480 | 60x60 | 32x32 | 480x480 | large |
| AMOLED 2.06" | 410x502 | 51x62 | 28x33 | 408x496 | large, portrait |
| STM32F746G-Discovery (no target yet) | 480x272 | 60x34 | 32x19 | 480x272 | small |

## PRODFPS

- mosaico: ~15.7 fps (Ink, 480x480): fluid ~18 ms, draw ~11 ms, paint ~20 ms (of which ~12.7 ms is the panel wire).
- amoled: TBD

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
