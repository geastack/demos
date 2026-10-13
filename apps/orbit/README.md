# Orbit

A faceted gem floating over a glowing floor that faintly reflects it, circled by two tilted
orbit rings and their moons. Rendered with gea3d, GeaStack's three.js-style 3D
API: the scene graph and matrices live in TypeScript, the per-triangle work
(transform, flat Lambert shading, painter's sort, present) is native.

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
npx --no-install gea run --board mosaico --app orbit
```

This builds the firmware, flashes the registered board, and opens its USB
serial monitor. Press **Ctrl+C** to leave the monitor; the app keeps running.
For separate steps, use:

```sh
npx --no-install gea build --board mosaico --app orbit
npx --no-install gea flash --board mosaico --app orbit
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
npx --no-install gea run --board amoled --app orbit
```

Use `--board amoled` for the other device commands as well. STM32 layouts
mentioned below describe the original design; an STM32 deployment target is
not currently available in this repository.

## Interaction

- **Drag**: spin the gem (horizontal) and tip it (vertical). On release it
  keeps the fling, then eases back to its idle spin and rest tilt.
- **Pinch**: zoom the camera (clamped).
- **Tap**: next colour theme (Sapphire, Lagoon, Ember), with a spin kick and a
  brief swell. The background, floor, gem and moons all change.
- **Boot**: the camera swoops in while the gem and then each orbit grow into
  place (1.5 s). **Idle**: the camera drifts slowly around the scene.

## How it is built

| File | Role |
| --- | --- |
| `src/lib/orbit.ts` | Touch gestures, motion, the frame loop |
| `src/lib/stage.ts` | gea3d scene: camera, lights, five meshes, per-frame matrices |
| `src/lib/pieces.ts` | Gem, orbit and floor geometry (lathe profiles) |
| `src/lib/shape.ts` | Lathe builder, geometry output and theme re-baking |
| `src/lib/palette.ts` | The three palettes and vertex-colour baking |

The only retained node is a transparent touch layer: gea3d presents straight
to the display, so nothing else is mounted.

### Budget

gea3d costs about 1.5 ms of TypeScript per live mesh per frame, and every
triangle costs native transform, sort and fill time, so the scene is five
meshes and about a thousand triangles:

| Mesh | Triangles |
| --- | --- |
| Gem (16-fold brilliant cut) | 160 |
| Floor (5 flat colour bands, unlit) | 216 |
| Gem reflection (the culet tip, unlit) | 16 |
| Orbit A (ring + 2 moons) | 336 |
| Orbit B (ring + 1 moon) | 312 |

### Tricks

- **Fast boot**: the first frame builds only the gem; the other meshes are
  built one per frame behind it.
- **Themes without rebuilding**: each vertex stores the weight of every
  palette slot in its colour, so a theme change re-bakes the colour buffer
  and re-uploads it (`gea3dNative.bufferDataF32`); the geometry is kept.
- **Reflection**: the culet tip is drawn again through the gem's matrix with
  the Y row negated (a mirror through the floor), with reversed winding (the
  mirror flips it back), faint at the point and sunk into the floor colour
  by its rim.
- **Floor always behind**: gea3d sorts by depth (painter's algorithm, no
  z-buffer), so a floor at y = 0 would paint over the reflection below it.
  The floor is drawn scaled about the camera by 4x: it lands on the same
  pixels but sorts behind everything.
- **No per-frame composition**: every matrix is written directly
  (`T · Ry(heading) · Rx(tilt) · Ry(spin) · S`), and all meshes and lights have
  `matrixAutoUpdate = false`, so the scene walk composes nothing.

## Screen sizes

Everything derives from `window.innerWidth/innerHeight` at startup
(`cssDevicePixelRatio` 1): renderer size and camera aspect in `Stage`; the
vertical FOV keeps the 480x272 horizontal span (36 deg there, ~60 deg at
480x480, ~70 deg at 410x502); screens narrower than 1.3:1 start the camera at
0.8x distance so the gem fills more of them. One 14 px caption sits 32 px in
from the edges (clear of the amoled's rounded corners).

480x272 (not buildable, worked out): aspect 1.76 >= reference, so FOV 36 deg,
fit 1.0, caption at (32, 32): the original framing, unchanged.

PRODFPS mosaico (480x480): ~45
PRODFPS amoled (410x502): not measured (builds clean; board not flashed, flashing amoled was stopped)

## License

Copyright 2026 Geastack contributors. GPL-3.0-only; see [LICENSE](LICENSE).
Third-party dependencies, fonts and assets retain their respective licenses
and attribution notices.
