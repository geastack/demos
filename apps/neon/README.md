# Neon Drift

A synthwave 3D endless runner for the STM32F746G-Discovery, in TypeScript on
gea3d. Race a low-poly craft down a three-lane neon highway toward a striped
setting sun: swipe or tap left/right to change lanes, swipe up to jump (down
to drop early), dodge pylons and barriers, collect energy shards. Speed ramps
up; the best score is kept in `localStorage`.

On boot the camera swoops from high above the grid down to the title shot
while the craft drives itself (attract mode) until the first tap. The Escape
key returns to the title. Neither Mosaico nor the AMOLED 2.06 has a button
that sends Escape (their side buttons are handled by the firmware); send it
over USB with `npx --no-install gea devctl key 27 --board mosaico`.

Built with [`@geastack/gea3d`](https://github.com/geastack/gea3d).

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

Gea selects the matching ESP-IDF installation for each board. An `IDF_PATH`
set in your terminal is used only when it is the version that board needs.

Confirm the saved board and check the toolchain:

```sh
npx --no-install gea boards show mosaico
npx --no-install gea doctor
```

### Build, flash, and monitor

```sh
npx --no-install gea run --board mosaico --app neon
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app neon
npx --no-install gea flash --board mosaico --app neon
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
npx --no-install gea run --board amoled --app neon
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## How it is built

- `src/game/world.ts`: the craft, a 16-slot prop pool, spawning,
  collisions and the autopilot. `src/game/camera.ts`: the swoop, title and
  chase poses. `src/stores/game.ts`: the frame loop and the title / run /
  game-over flow; the overlays (`src/screens/`) are retained UI that gea3d
  composites on top of the 3D view.
- `src/game/stage.ts` holds the gea3d scene, all static geometry built once:
  - a backdrop that follows the camera "at infinity" (`backdrop.ts`): banded
    sky, a shaded halo, the striped sun and two low-poly ridges with rims;
  - the ground (`ground.ts`): off the road it is the renderer's background
    gradient, anchored to the horizon every frame; the road mesh, the grid
    lines and the scrolling cross lines and dashes are thin quads;
  - the craft with a neon outline and three instanced prop pools
    (`models.ts`), flat-shaded at build time.
- The ground is drawn scaled about the camera (and the scrolling marks a
  little less), so the painter's order always puts it behind the craft and
  the props.

Performance notes (gea3d on the STM32F746G-Discovery): lines are walked in full for every
raster band, so ground lines are quads; flat-coloured triangles fill much
faster than shaded ones, so the sky and sun are flat bands; tall thin
triangles cost per row, so the grid is kept sparse.

## Check

```sh
npx tsc --noEmit                  # in apps/neon
npx biome check apps/neon         # from the workspace root
npx --no-install gea build --board mosaico --app neon       # from the workspace root
```

## Screen sizes

Sizes derive from `window.innerWidth/innerHeight` at startup
(`cssDevicePixelRatio` 1). The camera focal length is `250 * width / 480` px
and the vertical FOV follows from the height (57 deg at 480x272, 87 deg at
480x480, ~97 deg at 410x502); the backdrop, ground marks and horizon anchor use
the same focal. Taps steer by the screen's half width. Panels taller than 320
px use the `-l` class variants (wordmark 72, score 28, body 16, card 280x200,
32 px insets for the amoled's rounded corners); shorter ones use the original
classes (48 / 24 / 14, card 240x160, 16 px insets).

480x272 (not buildable, worked out): focal 250 px, FOV 57.1 deg and horizon,
sky and sun geometry are exactly the original; height 272 <= 320 so the small
classes and 16 px insets apply; tap split at x = 240. It is the original layout.

PRODFPS mosaico (480x480): ~34
PRODFPS amoled (410x502): not measured

## Apple TV

On Apple TV, press the center of the clickpad to start, jump, or retry.
Click left or right to change lanes and down to dive. With a motion-capable
Siri Remote, hold it upright with the buttons facing you. Tilt left or right
to change one lane, then return to center before tilting again.

The tvOS build needs a Mac with Xcode and newer GeaStack packages than this
repository's lockfile installs: `@geastack/cli` 0.1.112 or later (tvOS
builds with native sources), `@geastack/core` 0.1.51 or later (the native 3D
underlay) and `@geastack/apple`, which is not a dependency here. From the
repository root:

```sh
npm install @geastack/core@latest
npm install -D @geastack/cli@latest @geastack/targets@latest @geastack/apple@latest
GEA_IOS_CONFIGURATION=Release \
GEA_IOS_FONT_DEVICE_PIXEL_RATIOS=1 \
GEA_IOS_FONT_VIEWPORT_WIDTHS=1920 \
npx --no-install gea run --target tvos --mode device --app neon
```

The two `npm install` commands update `package.json` and `package-lock.json`.
`--mode device` signs with your Xcode development team (set
`GEA_IOS_DEVELOPMENT_TEAM` if it is not detected) and installs on a paired
Apple TV; `--mode simulator` uses the tvOS simulator instead.

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
