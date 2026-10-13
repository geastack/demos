import type { BufferGeometry } from "@geastack/gea3d/three";
import { Builder, hash, hex, mix, type Rgb, scale } from "./geometry";
import { DUSK_RIDGES, DUSK_SKY, LIT_RIDGES, LIT_SKY, MOON, STAR } from "./palette";
import { AZIMUTH_SCALE, BIG, FOCAL } from "./screen";

// The sky "at infinity": everything here is placed around the camera by
// direction (azimuth from -z toward +x, elevation above the horizon) and
// moves with it without turning. The backdrop (sky bands, far ridges and
// the moon) recolours from dusk to lantern-lit as the lantern count grows.

// Distances, far to near (the painter's order).
const SKY_DISTANCE = 950;
const MOON_DISTANCE = 920;
const BACK_RIDGE_DISTANCE = 890;
const FRONT_RIDGE_DISTANCE = 870;
const STAR_DISTANCE = 930;
export const LANTERN_DISTANCE = 600;

const AZIMUTH_REACH = 2.0;
const SKY_SEGMENTS = 10;
// Band rows by elevation, and the sky palette position at each (0 zenith,
// 4 horizon, fractions blend neighbours).
const SKY_ROWS = [-0.16, 0, 0.035, 0.09, 0.18, 0.32, 0.55, 0.95, 1.45];
const SKY_TONES = [4, 4, 3.5, 3, 2.3, 1.6, 1, 0.35, 0];

// Right of centre on large screens, clear of the title's second line.
export const MOON_AZIMUTH = BIG ? 0.3 : 0.05;
export const MOON_ELEVATION = 0.16;
const MOON_RADIUS = 0.034;
const STARS = 26;
// A star's half size in pixels.
const STAR_PX = 1.1;

// Constellation slots: the chain snakes back and forth across the sky in
// passes of CHAIN_RUN lanterns, climbing a little each pass.
const CHAIN_RUN = 14;
const CHAIN_PASSES = 4;
const CHAIN_LEFT = -0.66;
const CHAIN_STEP = 0.1;
const CHAIN_LOW = 0.075;
const CHAIN_RISE = 0.062;

// Writes the unit direction toward (azimuth, elevation) into out[0..2].
export function direction(azimuth: number, elevation: number, out: Float32Array) {
  const flat = Math.cos(elevation);
  out[0] = Math.sin(azimuth) * flat;
  out[1] = Math.sin(elevation);
  out[2] = -Math.cos(azimuth) * flat;
}

// The sky direction of lantern `index` in the chain.
export function slotDirection(index: number, out: Float32Array) {
  if (index >= CHAIN_RUN * CHAIN_PASSES) {
    direction((-0.8 + 1.6 * hash(index * 5 + 1)) * AZIMUTH_SCALE, 0.07 + 0.24 * hash(index * 5 + 2), out);
    return;
  }

  const pass = Math.floor(index / CHAIN_RUN);
  const step = index % CHAIN_RUN;
  const along = pass % 2 === 0 ? step : CHAIN_RUN - 1 - step;
  const azimuth = CHAIN_LEFT + along * CHAIN_STEP + (hash(index * 3 + 1) - 0.5) * 0.05;
  const wave = 0.022 * Math.sin(along * 0.8 + pass * 1.7);
  const elevation = CHAIN_LOW + pass * CHAIN_RISE + wave + (hash(index * 3 + 2) - 0.5) * 0.02;
  direction(azimuth * AZIMUTH_SCALE, elevation, out);
}

// The sky palette position at an elevation.
function skyTone(elevation: number): number {
  for (let i = 1; i < SKY_ROWS.length; i++) {
    if (elevation > SKY_ROWS[i]) continue;

    const t = (elevation - SKY_ROWS[i - 1]) / (SKY_ROWS[i] - SKY_ROWS[i - 1]);
    return SKY_TONES[i - 1] + (SKY_TONES[i] - SKY_TONES[i - 1]) * t;
  }
  return 0;
}

// Blends a five-stop palette at a fractional position (0..4).
function paletteAt(stops: number[], tone: number): Rgb {
  const i = Math.min(3, Math.floor(tone));
  return mix(hex(stops[i]), hex(stops[i + 1]), tone - i);
}

// The sky bands, the ridges and the moon in one mesh. Each vertex keeps its
// dusk and lit colour; recolor(light) blends them.
export class Backdrop {
  readonly geometry: BufferGeometry;
  private readonly dusk: Float32Array;
  private readonly lit: Float32Array;

  constructor() {
    const dusk = new Builder();
    const lit: number[] = [];
    this.buildSky(dusk, lit);
    this.buildRidge(dusk, lit, BACK_RIDGE_DISTANCE, 0.15, 0.012, 0.045, 3, hex(DUSK_RIDGES[0]), hex(LIT_RIDGES[0]));
    this.buildRidge(dusk, lit, FRONT_RIDGE_DISTANCE, 0.23, 0.006, 0.03, 9, hex(DUSK_RIDGES[1]), hex(LIT_RIDGES[1]));
    this.buildMoon(dusk, lit);
    this.buildStars(dusk, lit);
    this.geometry = dusk.geometry();
    const colors = this.geometry.attributes.color.array;
    this.dusk = new Float32Array(colors.length);
    for (let i = 0; i < colors.length; i++) this.dusk[i] = colors[i];
    this.lit = new Float32Array(lit.length);
    for (let i = 0; i < lit.length; i++) this.lit[i] = lit[i];
  }

  // Blends every vertex between its dusk (0) and lit (1) colour.
  recolor(light: number) {
    const color = this.geometry.attributes.color;
    const out = color.array;
    const dusk = this.dusk;
    const lit = this.lit;
    for (let i = 0; i < out.length; i++) out[i] = dusk[i] + (lit[i] - dusk[i]) * light;
    color.needsUpdate = true;
  }

  private at(b: Builder, lit: number[], azimuth: number, elevation: number, distance: number, dusk: Rgb, warm: Rgb) {
    const flat = Math.cos(elevation) * distance;
    b.vertex(Math.sin(azimuth) * flat, Math.sin(elevation) * distance, -Math.cos(azimuth) * flat, dusk);
    lit.push(warm.r, warm.g, warm.b);
  }

  private buildSky(b: Builder, lit: number[]) {
    const columns = SKY_SEGMENTS + 1;
    for (let row = 0; row < SKY_ROWS.length; row++) {
      const dusk = paletteAt(DUSK_SKY, SKY_TONES[row]);
      const warm = paletteAt(LIT_SKY, SKY_TONES[row]);
      for (let c = 0; c < columns; c++) {
        const azimuth = -AZIMUTH_REACH + (2 * AZIMUTH_REACH * c) / SKY_SEGMENTS;
        this.at(b, lit, azimuth, SKY_ROWS[row], SKY_DISTANCE, dusk, warm);
      }
    }
    for (let row = 0; row + 1 < SKY_ROWS.length; row++) {
      for (let c = 0; c < SKY_SEGMENTS; c++) {
        const a = row * columns + c;
        b.quad(a, a + 1, a + columns + 1, a + columns);
      }
    }
  }

  // A ridge line: peaks every `spacing` radians, each facet from the base
  // below the horizon up to two neighbouring peaks, one flat colour.
  private buildRidge(
    b: Builder,
    lit: number[],
    distance: number,
    spacing: number,
    low: number,
    high: number,
    seed: number,
    dusk: Rgb,
    warm: Rgb,
  ) {
    const count = Math.ceil((2 * AZIMUTH_REACH) / spacing);
    let previous = low;
    for (let i = 0; i < count; i++) {
      const a0 = -AZIMUTH_REACH + i * spacing;
      const a1 = a0 + spacing;
      const peak = low + (high - low) * hash(seed * 97 + i);
      const shade = 0.92 + 0.16 * hash(seed * 31 + i);
      const facetDusk = scale(dusk, shade);
      const facetLit = scale(warm, shade);
      const first = b.vertexCount();
      this.at(b, lit, a0, -0.03, distance, facetDusk, facetLit);
      this.at(b, lit, a1, -0.03, distance, facetDusk, facetLit);
      this.at(b, lit, a1, peak, distance, facetDusk, facetLit);
      this.at(b, lit, a0, previous, distance, facetDusk, facetLit);
      b.quad(first, first + 1, first + 2, first + 3);
      previous = peak;
    }
  }

  // Seeded stars in the upper sky, clear of the moon: small diamonds that
  // fade into the sky as it warms.
  private buildStars(b: Builder, lit: number[]) {
    let placed = 0;
    let seed = 1;
    const half = (STAR_PX * STAR_DISTANCE) / FOCAL;
    while (placed < STARS) {
      const azimuth = -AZIMUTH_REACH + 2 * AZIMUTH_REACH * hash(seed * 7);
      const elevation = 0.1 + 0.8 * hash(seed * 7 + 3);
      seed++;
      const da = azimuth - MOON_AZIMUTH;
      const de = elevation - MOON_ELEVATION;
      if (da * da + de * de < 0.02) continue;

      const star = scale(STAR, 0.45 + 0.55 * hash(seed * 13));
      const fade = paletteAt(LIT_SKY, skyTone(elevation));
      const flat = Math.cos(elevation) * STAR_DISTANCE;
      const x = Math.sin(azimuth) * flat;
      const y = Math.sin(elevation) * STAR_DISTANCE;
      const z = -Math.cos(azimuth) * flat;
      const rx = Math.cos(azimuth) * half;
      const rz = Math.sin(azimuth) * half;
      const first = b.vertexCount();
      b.vertex(x - rx, y, z - rz, star);
      b.vertex(x, y - half, z, star);
      b.vertex(x + rx, y, z + rz, star);
      b.vertex(x, y + half, z, star);
      for (let i = 0; i < 4; i++) lit.push(fade.r, fade.g, fade.b);
      b.quad(first, first + 1, first + 2, first + 3);
      placed++;
    }
  }

  private buildMoon(b: Builder, lit: number[]) {
    const centre = b.vertexCount();
    this.at(b, lit, MOON_AZIMUTH, MOON_ELEVATION, MOON_DISTANCE, MOON, MOON);
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI * 2) / 10;
      const azimuth = MOON_AZIMUTH + (Math.cos(angle) * MOON_RADIUS) / Math.cos(MOON_ELEVATION);
      this.at(b, lit, azimuth, MOON_ELEVATION + Math.sin(angle) * MOON_RADIUS, MOON_DISTANCE, MOON, MOON);
    }
    for (let i = 0; i < 10; i++) b.triangle(centre, centre + 1 + i, centre + 1 + ((i + 1) % 10));
  }
}
