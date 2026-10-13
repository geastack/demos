# Neon Drift

A synthwave 3D endless runner for the STM32F746G-Discovery, in TypeScript on
gea3d. Race a low-poly craft down a three-lane neon highway toward a striped
setting sun: swipe or tap left/right to change lanes, swipe up to jump (down
to drop early), dodge pylons and barriers, collect energy shards. Speed ramps
up; the best score is kept in `localStorage`.

On boot the camera swoops from high above the grid down to the title shot
while the craft drives itself (attract mode) until the first tap. The USER
button returns to the title.

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

Run `npx --no-install gea setup`, choose the supported AMOLED 2.06 board and its
USB identity, and save the alias as **amoled**. Follow setup's ESP-IDF installation
prompt for that board. Then run:

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

Performance notes (gea3d on this board): lines are walked in full for every
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
PRODFPS amoled (410x502): not measured (builds clean; board not flashed, flashing amoled was stopped)

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
