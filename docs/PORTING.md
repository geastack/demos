# Porting a demo to every board

Each demo is one codebase with layouts for three screen shapes and lays itself out for
whichever screen it is on. Read [APP-GUIDE.md](APP-GUIDE.md) first: its engine
rules, fast-TypeScript shapes and design bar apply unchanged.

## The boards

| Board | Gea board alias | Chip | Panel (physical px) | Notes |
|---|---|---|---|---|
| ESP32-S31 Mosaico | `mosaico` | RISC-V, single-precision FPU | 480 x 480 | square; byte-swapped RGB565 panel (handled by the engine) |
| ESP32-S3 AMOLED 2.06" | `amoled` | Xtensa LX7 dual core, single-precision FPU | 410 x 502 | portrait, rounded corners: keep content ~16 px clear of the edges |
| STM32F746G-Discovery | — | Cortex-M7 200 MHz | 480 x 272 | landscape; no target in the geastack tree yet, so it cannot be built or flashed |

Plain `number` (double) math is software on all three. The fast shapes in the
guide (typed arrays, integers, `Float32Array`/`Math.fround`) matter everywhere.

## Responsive rules

- **Never hard-code the panel size.** Read it once at startup from
  `window.innerWidth` / `window.innerHeight` (CSS px) and derive everything
  from it. A module `const W = 480` that sizes buffers or layout must become a
  value computed from the screen.
- **CSS px vs physical px.** The boards' default `cssDevicePixelRatio` is 1.5,
  which makes the mosaico a 320x320 CSS screen. Demos that draw pixels
  (canvases, ImageData565 buffers) should keep `"cssDevicePixelRatio": 1` in
  `gea` so CSS px = panel px. A board-specific override goes in
  `gea.targets.esp32.boards.<alias>.cssDevicePixelRatio`.
- **Three aspect shapes:** landscape (480x272, ~1.76:1), square (480x480),
  portrait (410x502). Lay out with flex and percentages; branch on aspect
  (`w > h * 1.2` landscape, `h > w * 1.1` portrait, else square) only where
  a different arrangement reads better (e.g. a side panel becomes a bottom
  sheet in portrait).
- **Canvases** take their size from the screen: `<canvas width={w} height={h}>`
  with `w`/`h` computed at startup, or sized by the demo's own buffer. Pixel
  effects that render at a lower internal resolution and upscale must compute
  that resolution (and any lookup tables) from the screen too.
- **Fonts** are baked per (family, size) from single-class CSS rules, so pick
  a small fixed set of size classes (e.g. `.hero-l` / `.hero-m` / `.hero-s`)
  and choose one by screen size at startup. Don't compute font sizes.
- **Touch targets** stay >= 40 CSS px everywhere; hit areas scale with layout.
- **3D (gea3d):** set the camera aspect and renderer size from the screen;
  re-check the field of view in portrait so the subject still fits.
- The 480x272 landscape layout is the one you cannot see on hardware. It must
  come from the SAME code path as square and portrait (sizes derived from
  `innerWidth`/`innerHeight`), not a separate hand-tuned branch you cannot
  test. Do the arithmetic for 480x272 explicitly (buffer sizes, rows, font
  class choice) and note it in the app README.
- Web preview (best effort): `node ../simulator/targets/web/dev-web.mjs
  --app-dir $PWD/apps/<id> --port <unique> --host 127.0.0.1` serves the app in
  a real browser. Its canvas runtime does not implement every Gea canvas
  extension (e.g. `measureTextInkCenter`, number-returning `measureText`), so
  a canvas demo may not draw there; retained-UI demos usually do. Hardware is
  the source of truth.

## 480x272 (simulator)

There is no STM32 hardware deployment target in this repository. The WASM
browser simulator can preview the original 480x272 layout. It requires the
Gea simulator toolchain, including Emscripten; use `gea doctor` to check it.
Run from the app directory after `npm ci` at the workspace root:

```sh
cd apps/lantern
npx --no-install gea simulate --renderer wasm --width 480 --height 272 --dpr 1 --no-open --port 5311
```

Wait for the `Simulating <app>: http://localhost:5311/?app=...` line (about a
minute: Vite, geatsc, emcc), open that URL, give the app 5-10 s (boot screens
run), judge a screenshot (not blank, nothing clipped or overlapping, targets
reachable), drive the interactions, and check the console for errors. Stop the
server before starting the next app. The app reads `innerWidth`/`innerHeight`
once at startup, so change the size by restarting with other `--width/--height`
(or by loading `?app=<id>&width=480&height=480&dpr=1`).

Known limits of this stand-in (simulator/engine side, not the apps):

- gea3d apps (aviator, lantern, neon, orbit) do not link for web
  (`Display::rebindCanvasToFramebuffer` / `flushRectsRasterized` undefined),
  and `gea simulate --renderer dom` has no `gea3dNative`. Verify those by the
  arithmetic in each README only.
- `gea.nativeSources` entries of the form `@demos/shared/...` are treated as
  app-relative by `simulator/targets/web/build-web.sh` (the CLI manifest
  resolves them through node). terra and nimbus need that fixed to build.
- nimbus: `shared/native/sensors.cpp` has no web branch (it falls into the
  STM32 `board_sensors.h` one).
- CSS `@keyframes` entrances that start at `opacity: 0` (wander, sonora, ember)
  stay invisible in the WASM renderer, so their copy, chips and sheets never
  appear; `--renderer dom` shows the real layout for those.

## Native code

Most demos are pure TypeScript. Where one has `native/` C++ (terra) or uses
`shared/native` (surface, sensors, web_gpio), it must compile for ESP32 too:
guard STM32-only code (`#if defined(STM32F746xx)` or the HAL headers) and give
the ESP32 a working path, not a stub that draws nothing. `Board.temperature()`
and the other board sensors may not exist off the Discovery — degrade
gracefully (hide the reading) instead of failing to build.

## Build, flash, look

Use the installed Gea CLI from the demos repository root. Run `npm ci`, then
follow the app README to install the toolchain and register a board. Mosaico
requires ESP-IDF 6.2-dev with ESP32-S31 support. Resolve board identities with
`gea boards list` or `gea boards show`; use aliases rather than serial paths.

```sh
npx --no-install gea boards show mosaico
npx --no-install gea build --board mosaico --app lantern
npx --no-install gea run --board mosaico --app lantern
npx --no-install gea screenshot --board mosaico
npx --no-install gea monitor --board mosaico
```

Replace `lantern` with the app id and `mosaico` with the registered board alias.
`run` builds, flashes and monitors; `flash` builds and flashes without opening
the monitor. Exit the monitor with Ctrl+C before another USB operation.
Always build and flash through the Gea CLI rather than raw `idf.py`/`esptool`.

The 3D apps use the released `@geastack/gea3d` dependency and its exported
native source, `@geastack/gea3d/native/gea3d_native.cpp`. No local renderer
checkout or vendored directory is required. The package is GPL-3.0-only.

## Done means

1. `npx tsc --noEmit` in the app and `npx biome check apps/<id>` are clean.
2. Firmware builds for `mosaico` and `amoled`.
3. Flashed and screenshotted on both boards; the layout fills the screen, nothing
   clipped or overlapping, colours right, touch works where the demo has touch.
4. The 480x272 layout worked out from the shared sizing code (and previewed on the web where it runs).
5. PRODFPS noted for both boards in the app's README (one line per board).
