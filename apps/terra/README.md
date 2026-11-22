# Terra

A Comanche-style voxel-space flyover (NovaLogic, 1992) on the
ESP32-S31 Mosaico and the ESP32-S3 AMOLED 2.06 (first on the
STM32F746G-Discovery): four procedurally baked landscapes (Alps, Dunes,
Glacier, Mars) rendered per column, front to back, with a y-buffer.

- **Fly:** an autopilot wanders until touched. Drag sideways to turn and bank,
  up and down to climb or dive, hold still to boost, pinch to set the throttle.
  Hands off for 3 s and the autopilot eases back in.
- **Switch:** tap a chip (or send the Escape key). Fog closes in, the new
  landscape bakes a slice per frame (its sky and title card show meanwhile),
  and the camera rises out of its lowest valley. Neither Mosaico nor the
  AMOLED 2.06 has a button that sends Escape (their side buttons are handled
  by the firmware); send it over USB with
  `npx --no-install gea devctl key 27 --board mosaico`.

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

Mosaico builds with ESP-IDF **6.2-dev** (ESP-IDF's `master` branch), which has
ESP32-S31 support. `gea setup` installs it and registers the board:

```sh
npx --no-install gea setup
```

Choose **Known supported board**, select **Espressif
ESP-Mosaico (V1.2)**, select its USB identity, and keep the suggested alias
**mosaico**. If setup offers to install a stable ESP-IDF release, decline:
Mosaico does not use it. If setup offers to build or flash an app, you can
skip that step and use the commands below. On Windows, use a native
PowerShell terminal.

Gea selects the matching ESP-IDF installation for each board. Leave
`IDF_PATH` unset in the terminal you build from: when it is set, every board
builds with that installation instead.

Confirm the saved board and check the toolchain:

```sh
npx --no-install gea boards show mosaico
npx --no-install gea doctor
```

### Build, flash, and monitor

```sh
npx --no-install gea run --board mosaico --app terra
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app terra
npx --no-install gea flash --board mosaico --app terra
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

The AMOLED 2.06 builds with ESP-IDF **6.0.2**. `gea setup` installs it and
registers the board:

```sh
npx --no-install gea setup
```

Choose **Known supported board**, select **Waveshare ESP32-S3
Touch AMOLED 2.06**, select its USB identity, and keep the suggested alias
**amoled**. Then run:

```sh
npx --no-install gea run --board amoled --app terra
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## How it works

- `native/bake.{h,cpp}` + `native/landscapes.cpp`: diamond-square noise shaped per
  landscape (ridges, dunes, ice terraces, mesas and craters), materials lit by
  a low sun with swept cast shadows, dithered to RGB565. One `uint32` texel per
  map cell (colour, height, water flag), 512 x 512 plus 3 mips in SDRAM.
- `native/voxel.cpp`: the renderer. Tunables at the top: field of view, draw
  distance, step growth, column step, mip threshold, fog start, near-field
  height interpolation distance, sun glow.
- `native/chrome.cpp`: HUD plates and compass ticks, queued per frame and
  blended into each row as the renderer writes it out.
- `src/lib/painter.ts`: HUD text on the canvas. The app is a single canvas:
  a UI node over a full-screen canvas would cost a compositing copy per frame.

Harness-checked on the host; `npx --no-install gea build --board mosaico --app terra` builds it.

## Screens

The panel size is read once at startup (`src/lib/layout.ts`); the surface, the
HUD plates, the fonts (small class 12/16/24, large class 14/18/28), the stick
ranges and the horizon row all follow from it. The native renderer takes any
surface up to 800 x 512 (3840 x 2160 on Apple hosts, 480 x 272 on the STM32
build, whose DTCM strip is unchanged) and runs on the ESP32 chips: the STM32-only DTCM placement is
`#if defined(__arm__)`, the sun scales with the width.

| Board | Panel | Bottom row | Chips |
|---|---|---|---|
| mosaico | 480x480 | telemetry left, chips right | 4 x 64x40 |
| amoled | 410x502 | telemetry centred above full-width chips (margin 28) | 4 x 85x40 |
| STM32F746G-Discovery (no target) | 480x272 | 16 + 136 + 12 + 252 + 16 = 432 <= 480: one row | 4 x 60x40 |

## PRODFPS

- mosaico: ~20 fps (16-23; terrain, HUD and title render).
- amoled: not measured.

## Apple TV rendering

The tvOS target selects a 3840 × 2160 rendering viewport independently of other targets through `gea.targets.tvos.build.display.width` and `height` in `package.json`. tvOS uses one ray per pixel, interpolated terrain heights, and finer depth steps. Other targets keep their existing quality settings.

The tvOS build needs a Mac with Xcode and newer GeaStack packages than this
repository's lockfile installs: `@geastack/targets` 0.1.109 or later (the
tvOS display setting above), `@geastack/cli` 0.1.112 or later and
`@geastack/apple`, which is not a dependency here. From the repository root:

```sh
npm install @geastack/core@latest
npm install -D @geastack/cli@latest @geastack/targets@latest @geastack/apple@latest
GEA_IOS_CONFIGURATION=Release npx --no-install gea run --target tvos --mode device --app terra
```

The two `npm install` commands update `package.json` and `package-lock.json`.
`--mode device` signs with your Xcode development team (set
`GEA_IOS_DEVELOPMENT_TEAM` if it is not detected) and installs on a paired
Apple TV; `--mode simulator` uses the tvOS simulator instead.

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
