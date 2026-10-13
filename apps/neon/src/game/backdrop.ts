import { type Builder, hex, MAGENTA, mix, NIGHT, Rgb, SUN } from "./geometry";

// The sky, sun and mountains. They sit "at infinity": the backdrop group
// follows the camera, and everything is built in camera-relative units
// measured in screen pixels (x from the screen centre, y above the horizon)
// and placed far enough to sort behind the ground.

// Distances of the layers, far to near (the painter sorts by depth).
const SKY_DEPTH = 1450;
const STAR_DEPTH = 1440;
const SUN_DEPTH = 1420;
const FAR_RIDGE_DEPTH = 1410;
const NEAR_RIDGE_DEPTH = 1400;
// Rims sit just in front of their ridge, 1.4 px thick.
const RIM_LIFT = 4;
const RIM_HALF = 0.7;

// The camera's focal length in pixels.
const FOCAL = 250;

// The sky is flat-coloured bands (a flat fill costs a fraction of a shaded
// one): edges in pixels above the horizon, narrow where the colour changes
// fast. It ends at the horizon, where the ground's background takes over.
const SKY_BANDS = [0, 4, 9, 15, 22, 30, 40, 52, 66, 82, 100, 122, 148, 180, 220, 270, 340];
const SKY_HALF_WIDTH = 400;
const GRADIENT_ROWS = [0, 14, 46, 96, 150, 230];
const GRADIENT = [0xff6a8a, 0xe8388c, 0x8a1c84, 0x3a1060, 0x1a0838, 0x080420];

// The sun: centre height above the horizon and radius, in pixels; its slits
// start below SLIT_TOP and repeat every SLIT_PERIOD rows, thickening.
const SUN_LIFT = 34;
const SUN_RADIUS = 60;
const SLIT_TOP = 42;
const SLIT_PERIOD = 10;
const SUN_SLICE = 6;
const HALO = hex(0xff4e80);
const HALO_DEPTH = 1445;
// The halo: a shaded ring around the sun's upper half, from the glow at the
// rim out to the sky's own colour.
const HALO_INNER = 58;
const HALO_OUTER = 130;
const HALO_SEGMENTS = 8;

const RIDGE_BASE = 0;
const STARS = 24;

// A point `depth` away, `px` pixels right of centre and `py` above the horizon.
function at(builder: Builder, px: number, py: number, depth: number, color: Rgb): number {
  const scale = depth / FOCAL;
  return builder.vertex(px * scale, py * scale, -depth, color);
}

function gradientAt(row: number): Rgb {
  for (let i = 1; i < GRADIENT_ROWS.length; i++) {
    if (row > GRADIENT_ROWS[i]) continue;

    const t = Math.max(0, (row - GRADIENT_ROWS[i - 1]) / (GRADIENT_ROWS[i] - GRADIENT_ROWS[i - 1]));
    return mix(hex(GRADIENT[i - 1]), hex(GRADIENT[i]), t);
  }
  return NIGHT;
}

export function buildSky(builder: Builder) {
  for (let b = 0; b + 1 < SKY_BANDS.length; b++) {
    const color = gradientAt((SKY_BANDS[b] + SKY_BANDS[b + 1]) / 2);
    const a = at(builder, -SKY_HALF_WIDTH, SKY_BANDS[b + 1], SKY_DEPTH, color);
    const c = at(builder, SKY_HALF_WIDTH, SKY_BANDS[b + 1], SKY_DEPTH, color);
    const d = at(builder, SKY_HALF_WIDTH, SKY_BANDS[b], SKY_DEPTH, color);
    const e = at(builder, -SKY_HALF_WIDTH, SKY_BANDS[b], SKY_DEPTH, color);
    builder.quad(a, c, d, e);
  }
}

export function buildHalo(builder: Builder) {
  for (let s = 0; s < HALO_SEGMENTS; s++) {
    const a0 = (s * Math.PI) / HALO_SEGMENTS;
    const a1 = ((s + 1) * Math.PI) / HALO_SEGMENTS;
    const p = ringPoint(builder, HALO_INNER, a0, 0.6);
    ringPoint(builder, HALO_OUTER, a0, 0);
    ringPoint(builder, HALO_OUTER, a1, 0);
    ringPoint(builder, HALO_INNER, a1, 0.6);
    builder.quad(p, p + 1, p + 2, p + 3);
  }
}

// A point on a ring around the sun (clamped to the horizon), the sky's
// colour there tinted toward the glow by `glow`.
function ringPoint(builder: Builder, radius: number, angle: number, glow: number): number {
  const x = radius * Math.cos(angle);
  const y = Math.max(0, SUN_LIFT + radius * Math.sin(angle));
  return at(builder, x, y, HALO_DEPTH, mix(gradientAt(y), HALO, glow));
}

// Yellow at the crown, through amber, to magenta at the waterline.
function sunAt(row: number): Rgb {
  const t = (SUN_LIFT + SUN_RADIUS - row) / (2 * SUN_RADIUS);
  if (t < 0.5) return mix(hex(0xffe45a), SUN, t * 2);
  return mix(SUN, MAGENTA, (t - 0.5) * 2);
}

function sunHalfWidth(row: number): number {
  const dy = row - SUN_LIFT;
  return Math.sqrt(Math.max(0, SUN_RADIUS * SUN_RADIUS - dy * dy));
}

// One flat-coloured slice of the sun (a flat fill is cheaper than a shaded
// one, and the banding suits it).
function sunSlice(builder: Builder, top: number, bottom: number) {
  const color = sunAt((top + bottom) / 2);
  const a = at(builder, -sunHalfWidth(top), top, SUN_DEPTH, color);
  const b = at(builder, sunHalfWidth(top), top, SUN_DEPTH, color);
  const c = at(builder, sunHalfWidth(bottom), bottom, SUN_DEPTH, color);
  const d = at(builder, -sunHalfWidth(bottom), bottom, SUN_DEPTH, color);
  builder.quad(a, b, c, d);
}

// The striped setting sun: solid slices above the slits, then bands whose
// gaps thicken toward the horizon.
export function buildSun(builder: Builder) {
  for (let top = SUN_LIFT + SUN_RADIUS; top > SLIT_TOP; top -= SUN_SLICE) {
    sunSlice(builder, top, Math.max(SLIT_TOP, top - SUN_SLICE));
  }
  for (let top = SLIT_TOP; top > SKY_BANDS[0]; top -= SLIT_PERIOD) {
    const gap = 1 + (SLIT_TOP - top + SLIT_PERIOD / 2) * 0.1;
    sunSlice(builder, top, Math.max(SKY_BANDS[0], top - (SLIT_PERIOD - gap)));
  }
}

// A low-poly ridge: seeded peaks alternating with saddles, low in the middle
// so the sun shows through. Returns the peak heights (pixels above the
// horizon) at x = (i - 1) * spacing - 240.
function ridgePeaks(spacing: number, low: number, high: number, valley: number, seed: number): number[] {
  const peaks: number[] = [];
  let state = seed;
  const count = Math.ceil(480 / spacing) + 3;
  for (let i = 0; i < count; i++) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const random = state / 4294967296;
    const x = (i - 1) * spacing - 240;
    const t = Math.min(1, Math.abs(x) / valley);
    const smooth = t * t * (3 - 2 * t);
    const height = i % 2 === 1 ? low * random : low + (high - low) * random;
    peaks.push(2 + height * smooth);
  }
  return peaks;
}

// Facets from each peak to the next, down to the horizon; facets facing the
// sun are lit. A thin rim quad runs along the peaks (a quad, not a line:
// gea3d walks a line in full for every raster band).
function buildRidge(builder: Builder, depth: number, spacing: number, peaks: number[], body: Rgb, lit: Rgb, rim: Rgb) {
  for (let i = 0; i + 1 < peaks.length; i++) {
    const x0 = (i - 1) * spacing - 240;
    const x1 = x0 + spacing;
    const facesSun = x0 + spacing / 2 < 0 ? peaks[i + 1] < peaks[i] : peaks[i + 1] > peaks[i];
    const color = facesSun ? lit : body;
    const a = at(builder, x0, peaks[i], depth, color);
    const b = at(builder, x1, peaks[i + 1], depth, color);
    const c = at(builder, x1, RIDGE_BASE, depth, color);
    const d = at(builder, x0, RIDGE_BASE, depth, color);
    builder.quad(a, b, c, d);

    const top0 = at(builder, x0, peaks[i] + RIM_HALF, depth - RIM_LIFT, rim);
    const top1 = at(builder, x1, peaks[i + 1] + RIM_HALF, depth - RIM_LIFT, rim);
    const bottom1 = at(builder, x1, peaks[i + 1] - RIM_HALF, depth - RIM_LIFT, rim);
    const bottom0 = at(builder, x0, peaks[i] - RIM_HALF, depth - RIM_LIFT, rim);
    builder.quad(top0, top1, bottom1, bottom0);
  }
}

export function buildRidges(builder: Builder) {
  const far = ridgePeaks(36, 8, 36, 150, 11);
  const near = ridgePeaks(58, 4, 20, 120, 29);
  buildRidge(builder, FAR_RIDGE_DEPTH, 36, far, hex(0x2a0f52), hex(0x44186e), hex(0x9a3a9a));
  buildRidge(builder, NEAR_RIDGE_DEPTH, 58, near, hex(0x140830), hex(0x24103f), MAGENTA);
}

// Seeded stars in the upper sky, clear of the sun's glow.
export function buildStars(builder: Builder) {
  let state = 7;
  let placed = 0;
  while (placed < STARS) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const x = (state % 480) - 240;
    state = (state * 1664525 + 1013904223) % 4294967296;
    const row = 90 + (state % 200);
    const dy = row - SUN_LIFT;
    if (x * x + dy * dy < (SUN_RADIUS + 50) * (SUN_RADIUS + 50)) continue;

    const bright = 0.45 + (Math.floor(state / 256) % 55) / 100;
    at(builder, x, row, STAR_DEPTH, new Rgb(0.94 * bright, 0.9 * bright, bright));
    placed++;
  }
}
