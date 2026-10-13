# Building a demo

The STM32F746G-Discovery (the reference low end) is: a 4.3" 480x272 RGB565
capacitive touch panel (5 fingers, ~128 ppi), a Cortex-M7 at 200 MHz with a
single-precision FPU, 8 MB SDRAM. Apps are GeaStack TSX: a retained UI (a CSS
subset) plus an immediate-mode canvas, compiled to C++.

## Layout

```
apps/<id>/            one app
  src/index.tsx       entry: Display.setAA(4); mount(App) — nothing else
  src/app.tsx         the App component (MUST be a different module from mount())
  src/screens/        one component per screen
  src/stores/         Store classes (app state)
  src/styles/         CSS
  icons.config.json   Phosphor icons to render (npm run icons -> public/icons)
  public/             images referenced as <img src="icons/x.png" />
shared/               design fonts, styles and shared native modules
```

Import shared code only through `import "../../../shared";` (or named exports
from it). Fonts are declared in `shared/styles/fonts.css`; use the family names
listed there (e.g. "Fraunces SB", "Manrope B", "Outfit XL", "Plex Cond SB").

## Build and check

```sh
cd apps/<id> && npx tsc --noEmit        # types
npx biome check apps/<id>               # lint + format (from the workspace root)
npx --no-install gea build --board mosaico --app <id> # from workspace root
```

Use the Gea CLI and registered board aliases for device operations. Follow the
app README for setup. A successful build and a device screenshot are required
for each target you claim to have validated.

## Engine rules (verified on this board)

- **Screens:** mount only the open screen: `{shell.screen === X ? <XScreen /> : null}`.
  A hidden subtree still animates and repaints every frame.
- **Store `init()` is not called for you:** call each store's `init()` from
  `src/index.tsx` before `mount(App)` (timers, restored `localStorage`, boot flow).
- **Store reads** go inline in templates (`{store.value}`); don't copy a store
  value into a local and render the local.
- **Components** take plain props (strings/numbers/callbacks); no `children`.
- **Lists:** spell out initial arrays; a class field initialized with `.map()`
  breaks codegen. Typed arrays have no `indexOf`.
- **No `console`** — it does not link.
- **CSS supported:** flex, absolute positioning, border-radius, borders,
  `linear-gradient` / `radial-gradient` backgrounds, opacity, `transform`
  (translate / rotate / scale), `@keyframes` + `animation`, custom properties
  declared on a class (NOT `:root`), `font-family`/`font-size`/`color`/`text-align`.
- **CSS not supported (ignored):** `transition`, `letter-spacing`, `text-shadow`,
  `box-shadow`, `backdrop-filter`, `transform-origin` in px (percentages work).
  Motion therefore comes from `@keyframes`: an element animates when it mounts
  (mount a new element for an entrance; changing its class to a new animation
  name restarts it).
- **Fonts:** the atlas bakes each (family, size) pair it finds on a
  *single-class* rule (`.big-number { font-family: ...; font-size: 96px }`).
  Always set family + size together on one single-class rule.
- **Transforms on rounded gradients:** a rotated or non-uniformly scaled rounded
  gradient loses its corners; uniform scale (and rotating a circle) is fine.
- **Opacity animation on a subtree containing `<img>`** re-records the display
  list every frame (~4 ms). Animate a plain element instead.
- **Images:** `<img src="...">` must be a string literal (the build embeds it).
  One variant per colour; toggle variants with classes if needed.
- **Canvas:** `<canvas id="x" width="W" height="H" class="..."/>`, then after
  mount (in `requestAnimationFrame`) `document.getElementById("x") as unknown as
  GeaCanvasElement` and `getContext("2d")`. Keep the context in a local
  non-null variable before setting `fillStyle`; colours are CSS strings like
  `"rgb(233,75,255)"`. Wrap each frame in `beginBatch()` / `endBatch()`.
- **Canvas context is a value:** the compiler copies the context into every
  function parameter and on every property write (`ctx.fillStyle = …`), and
  the batch state lives in each copy. Never pass `ctx` to a helper: keep it in
  a class field and draw through `this.ctx` inside the method that opens the
  batch. Set `font`/`fillStyle` only when they change.
- **A full-screen canvas draws straight to the display only when nothing else
  draws:** any other visible node (text, background, border) switches it to an
  owned buffer, which costs an extra full-screen copy (~5 ms) plus repainting
  every overlapping node each frame. For full-screen pixel apps, draw the
  chrome with `ctx.fillText` inside the frame's batch (or into the pixels), and give
  the root no background.
- **Hit testing** picks the topmost node: a later sibling covers earlier ones
  even when transparent. Put touch layers last.
- **Clipping:** `overflow: hidden` does not clip transformed children. Keep
  every animated element inside its own box.
- **Animation fill:** use `both` (or `forwards`) for entrances; without it an
  element can rest on its first keyframe.
- **Touch:** `onClick`; `onPointerDown/Move/Up` with `event.pointerId`,
  `event.clientX/clientY` (up to 5 pointers). The USER button arrives as
  keyCode 27 (`onKeyDown`) — use it as "back".
- **Timers:** `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date.now()`.
  `localStorage` works (persisted on this board).

## Performance

- The UI runs at 60 fps when only small regions change. Every changed region is
  repainted each frame, so keep continuous animations small and few.
- **Plain `number` math is double** (soft-float on this chip): fine for UI logic,
  too slow per pixel. Per-pixel and per-sample loops must follow the fast
  TypeScript shapes below (typed arrays, integers, float32).
- `Display.setAA(4)` is on in every app: edges are antialiased analytically and
  cheaply.
- **Large animated areas are expensive:** an opacity animation or translucent
  layer re-blends its whole box every frame. Full-screen fades run at ~12 fps;
  animate `transform` on small elements, or step colours in a few discrete
  repaints.
- **Reactive updates relayout:** a Store field that changes every frame makes
  the tree refresh and relayout every frame. Keep per-frame animation state in
  plain (non-Store) fields and update store fields only when the shown value
  changes.

## Fast TypeScript (no native code)

Apps are pure TypeScript: no `native/` folder, no `nativeSources` (except
gea3d's own library file, `@geastack/gea3d/native/gea3d_native.cpp`, for
3D apps), no compiler plugins. Heavy work goes through these:

- **Pixels:** `const img = ctx.createImageData565(w, h)` gives
  `img.data16: Uint16Array` (RGB565: `((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)`);
  write it in a loop, then `ctx.putImageData(img, x, y)` once per frame (a
  straight blit, no conversion). `createImageData` (RGBA) works too but converts.
- **Board sensors:** `Board.temperature()` (°C), `Board.supplyVoltage()` (V),
  `crypto.getRandomValues(typedArray)` (hardware RNG).
- **3D:** the published `@geastack/gea3d` package (Three.js-style, GPL-3.0-only).
  Import scene classes from `@geastack/gea3d/three` and the renderer from
  `@geastack/gea3d`. Declare its native source in `gea.nativeSources` as shown
  above. Edit the library in [geastack/gea3d](https://github.com/geastack/gea3d);
  update the dependency and lockfile here after publishing. 3D renders as an underlay and
  retained HUD nodes draw on top. See apps/orbit and apps/neon.

The compiler turns these loop shapes into tight machine code (integer typed-array
access, float32 math, inlined Math) — write hot loops like this:

- Put typed arrays in `const` locals before the loop (`const px = img.data16`).
- Loop `for (let i = 0; i < N; i++)` where N is a module `const` integer,
  a local, or `arr.length`; index as `i` or `offset + i`.
- Module-scope `const W = 480` is a compile-time integer — use it.
- Table lookups `table[v & 255]` are bounds-checked once per loop.
- Integer math stays integer; use `|0`/`& mask` for wrapping, `Math.floor`,
  `Math.min/max/abs` (inlined).
- Float math: keep values in `Float32Array`s; a result stored straight back
  into a Float32Array (or wrapped in `Math.fround`) is computed in hardware
  float. Anything else is double (slow here).
- No closures, `Math.sin/cos/exp/pow` or allocation inside per-pixel loops:
  precompute tables (e.g. a 1024-entry sine `Float32Array`).
- Per-frame state lives in plain class fields, not Store fields.

## Design bar

These demos are judged on looking like a premium product, not a demo.

- Type: at most four sizes per screen (12 caption, 14-16 body, 20-24 title,
  56-120 hero numerals). Thin weights only at 48 px and up.
- Colour: one accent per screen; status colours (ok/warn/alarm) never decorate.
  Text hierarchy by opacity-like tints (100 / ~64 / ~40 %). Snap colours to
  RGB565 (R and B multiples of 8, G multiples of 4). Avoid long near-black
  gradients (they band); prefer hue-shifting gradients.
- Glow without blur: 2-3 stacked shapes at 10-25 % opacity.
- Layout: 8 px grid, 16 px outer margins, 40 px+ touch targets, generous space —
  hero content ~40 % of the screen.
- Motion: 120-200 ms micro-interactions, 300-450 ms screen entrances; decelerate
  in, accelerate out; dials overshoot slightly; stagger lists 30-40 ms; numbers
  never jump (tween or roll). Press feedback within one frame (scale 0.96 or a
  lighter surface).
- Every app has a boot moment (the first two seconds sell it) and an idle/attract
  state.
