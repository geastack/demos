# Aviator

A recreation of Karim Maaloul's "The Aviator" (Codrops, 2016) for the
STM32F746G-Discovery, written from scratch in TypeScript on gea3d. A
low-poly red and white plane, its pilot's hair waving, flies over a turning,
rolling sea under a warm sky of block clouds: collect the blue coins for
energy, dodge the red enemies, and see how far you get before the tank runs
dry.

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
npx --no-install gea run --board mosaico --app aviator
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app aviator
npx --no-install gea flash --board mosaico --app aviator
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
npx --no-install gea run --board amoled --app aviator
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## Play

- **Touch or drag** anywhere: the plane follows the finger's height (and
  drifts a little ahead or back with its side), with a lag, pitching and
  banking as it catches up. Further right also flies faster and widens the
  view.
- **Coins** (blue) add energy; **enemies** (red) knock the plane back, flash
  the light and cost energy. Both burst into sparks.
- Energy drains with speed. The **level** rises every 1000 distance, and with
  it the speed and the number of enemies per wave.
- Out of energy, the plane noses into the sea; tap to replay. The best
  distance is kept in `localStorage`. The USER button returns to the title,
  where the plane flies itself.

## How it is built

| File | Role |
| --- | --- |
| `src/stores/game.ts` | Frame loop, touch, title / flight / game-over flow, HUD fields |
| `src/game/world.ts` | The flight in the original's units and tuning: plane, speed, energy, levels, coins, enemies, sparks |
| `src/game/stage.ts` | The gea3d scene: camera, lights, fog, and every matrix written per frame |
| `src/game/models.ts` | The plane, pilot, propeller, hair tuft and cloud block |
| `src/game/sea.ts` | The sea's visible arc and its per-vertex waves |
| `src/game/sky.ts` | The cloud ring, placed once |
| `src/game/builder.ts` | Boxes (with the original's corner tweaks) and tetrahedra as indexed geometry |
| `src/game/view.ts` | Camera and fog numbers shared by the stage and the sea |

The scene is seven drawables: the plane body (one mesh with vertex colours),
the propeller and the twelve hair tufts (an instanced mesh) under the plane's
group, the sea, the cloud blocks (one instanced mesh that turns with the
sea), and two instanced pools, for coins with their sparks and for enemies.
Lambert materials without normals shade every face flat, which is the
original's look. gea3d draws the frame under the retained HUD.

Performance notes (60-62 fps on the title and in flight; 45-55 at moments
late in a run, with many coins, enemies and sparks about):

- **Only the sea's top is a mesh**: 15 of the cylinder's 40 segments and 8
  rings (the nearer ones never come into view). The columns stay put while
  the cylinder's segments and their waves turn through them, which draws
  the same surface as turning the whole cylinder.
- **Waves in integers**: each vertex circles its rest point with a 16.16
  fixed-point phase into a sine table; the loop is integer and float32
  maths, and the positions are uploaded once per frame.
- **Baked sea fog**: the fog is folded into the sea's vertex colours ring by
  ring, so each face has one colour and fills flat (per-vertex fog shades
  every face).
- **Flyers in view only**: coins and enemies are placed, drawn and tested
  only near the top of their circle; the hair tufts only rewrite their
  height.
- **No depth buffer**: faces are drawn far to near, so the wing is two
  halves that start at the tapered cabin's sides (one slab through the cabin
  would sort behind it), and the crossed propeller blade is split too.

The original targets a large browser window: here the plane is drawn a
little over twice as large and the coins and enemies a third larger, with
the world, speeds and spawns unchanged; the lights are a little softer so
faces do not all saturate on the 16-bit panel.

## Check

```sh
npx tsc --noEmit                  # in apps/aviator
npx biome check apps/aviator      # from the workspace root
npx --no-install gea build --board mosaico --app aviator    # from the workspace root
```

## Screens and boards

The panel size is read once (`src/game/screen.ts`, `window.innerWidth/Height`,
`cssDevicePixelRatio` 1) and drives the renderer size, camera aspect, touch
mapping and type tier. The vertical field of view grows as the screen
narrows: `tan(fov/2) = tan(26 deg) * (1.76 / aspect)^0.6` (never below 52), so
the plane stays about as big across the width while more sky and sea show.
Type: shorter side < 400 uses the 12/14/24/48 classes, otherwise 16/20/32/56
and a 72 hero. The HUD keeps a 16 px margin (clear of the amoled's corners).

| Screen | aspect | FOV | type tier |
| --- | --- | --- | --- |
| 480x272 (STM32F746G-Discovery, not buildable) | 1.76 | 52.0 | small (original sizes) |
| 480x480 (mosaico) | 1.00 | 68.2 | large |
| 410x502 (amoled) | 0.82 | 75.8 | large |

The 480x272 row is the original tuning; it comes out of the same code (aspect
1.765 is above the reference, so the FOV stays 52 and every size class is the
original one).

PRODFPS (title, attract mode): amoled 19; mosaico 43-45.

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
