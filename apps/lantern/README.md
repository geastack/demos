# Lantern River

A paper boat drifting down a winding low-poly river at dusk, for the
STM32F746G-Discovery, in TypeScript on gea3d. Catch the floating paper
lanterns: each one rises into a glowing chain across the sky, and the whole
scene warms from indigo to amber as the sky fills. Rocks, logs and
whirlpools wait in the water; every few hundred metres the river quickens
into rapids, and the boat speeds up as the journey goes on.

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
npx --no-install gea run --board mosaico --app lantern
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app lantern
npx --no-install gea flash --board mosaico --app lantern
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
npx --no-install gea run --board amoled --app lantern
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## Play

- **Drag** left or right anywhere to steer the boat across the river.
- A hit spins the boat, costs one of its three folds of paper (the pips at
  the top right) and drops the newest lanterns back into the water.
  Whirlpools pull the boat toward their centre.
- After the third hit the boat sinks; the camera lifts to the sky of
  lanterns you kept and the tally settles in. Tap to sail again. The best
  sky is kept in `localStorage`.

On boot the camera tilts down from the sky onto the river, and the boat
sails itself behind the title (attract mode) until the first tap. The USER
button returns to the title.

## How it is built

- `src/stores/game.ts`: the frame loop (one simulation step and one gea3d
  frame per display frame), drag steering and the title / run / end flow.
  The overlays (`src/screens/`) are retained UI that gea3d composites on top
  of the 3D view.
- `src/game/world.ts`: the boat, a 72-slot prop pool (lanterns, hazards and
  bank scenery), collisions, lanterns flying to the sky or falling back, and
  the autopilot. Props live in river coordinates (along and across).
- `src/game/river.ts`: the river's course, sampled in rows in a window that
  slides with the boat, with the rapids. `src/game/terrain.ts`: the water and
  banks as one flat-shaded grid over that window, its water vertices riding
  the waves every frame.
- `src/game/sky.ts`: the sky "at infinity" around the camera (sky bands, far
  ridges, the moon) and the slots the lantern chain fills.
- `src/game/stage.ts` holds the gea3d scene: static geometry built once,
  instanced pools for every kind of prop and glow, and each frame writes the
  matrices directly, the waves and the few colours that change.
  `src/game/models.ts` builds the low-poly models; `src/game/foam.ts` draws
  the ripples and whirlpool spirals as one additive line mesh.

Performance notes (gea3d on this board, about 18-29 fps): the scene is
drawn in painter's order (sky, then ground, then everything standing on
it) through render orders; the lit models are flat-shaded and the lanterns
and glows unlit; the scene only recolours when the light has moved a step;
the frame loop allocates nothing.

## Check

```sh
npx tsc --noEmit                    # in apps/lantern
npx biome check apps/lantern        # from the workspace root
npx --no-install gea build --board mosaico --app lantern      # from the workspace root
```

## Screens and boards

The panel size is read once (`src/game/screen.ts`, `window.innerWidth/Height`,
`cssDevicePixelRatio` 1). From it come the renderer size, camera aspect, the
vertical field of view (`tan(fov/2) = tan(26 deg) * (1.76 / aspect)^0.6`, never
below 52), the glow/star pixel scale (`FOCAL`), the camera's distance behind the
boat (x `(1.76/aspect)^0.35`, so the river still fits across), the chain of
lanterns' azimuth squeeze, the steering gain (a full-width drag moves the boat
as far as on 480 px) and the type tier (shorter side < 400: 12/14/24/40/56,
otherwise 16/20/32/56/72). Overlays keep a 16 px margin; on large screens the
end card's prompt sits above the tally.

| Screen | aspect | FOV | camera back | chain azimuth | tier |
| --- | --- | --- | --- | --- | --- |
| 480x272 (STM32F746G-Discovery, not buildable) | 1.76 | 52.0 | x1.00 | x1.00 | small (original) |
| 480x480 (mosaico) | 1.00 | 68.2 | x1.22 | x0.86 | large |
| 410x502 (amoled) | 0.82 | 75.8 | x1.31 | x0.80 | large |

PRODFPS (title): amoled 8.5 (measured before the compiler's bounds-check
improvement); mosaico 20.

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
