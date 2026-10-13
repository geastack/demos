import { ACCENT, BACKGROUND, GEM_HIGH, GEM_LOW, GLOW, HALO, SLOTS } from "./palette";
import { Shape } from "./shape";

// Lathe profiles: (radius, y, offset) triples, top to bottom (see Shape.lathe).

// A 16-fold brilliant cut: table, crown, girdle band, pavilion, culet.
// 160 triangles; the girdle sits at y 0.
const GEM = [0, 0.5, 0, 0.56, 0.5, 0, 0.86, 0.28, 0.5, 1, 0.08, 0, 1, -0.02, 0, 0.58, -0.5, 0.5, 0, -1.05, 0];

// Only the tip of the pavilion is reflected: it sits over the middle of the
// floor's glow, and fades out into it within a third of the pavilion.
// 16 triangles.
const CULET_TIP = [0.32, -0.75, 0.5, 0, -1.05, 0];

// A six-sided double point: 24 triangles.
const MOON = [0, 1, 0, 0.8, 0.2, 0, 0.8, -0.2, 0.5, 0, -1, 0];

// The floor: concentric flat bands, one colour each (per-triangle colour
// between rings would draw a star pattern). The glow fades out by
// GLOW_RADIUS; the narrow band at HALO_RADIUS is the halo. 216 triangles.
const FLOOR_BANDS = [0, 0.8, 1.44, 1.56, 2.5, 3.6];
const FLOOR_SEGMENTS = 24;
const GLOW_RADIUS = 3.6;
const HALO_RADIUS = 1.5;
const HALO_STRENGTH = 0.5;

const REFLECTION_GAIN = 0.8;
const GOLDEN = 0.618034;

export function gemShape(): Shape {
  const shape = new Shape();
  shape.lathe(GEM, 16, 1, 0, 0, 0);
  paint(shape, GEM_LOW, GEM_HIGH, 0, 1, 1, 0.28);
  return shape;
}

// The culet tip's reflection: faint at the point (nearest the floor), sunk
// fully into the floor's centre colour by its rim.
export function gemReflectionShape(): Shape {
  const shape = new Shape();
  shape.lathe(CULET_TIP, 16, 1, 0, 0, 0);
  const heights = shape.heights(0);
  for (let i = 0; i < heights.length; i++) {
    const fade = 0.3 * (1 - heights[i]);
    pushColor(shape, GEM_LOW, GEM_HIGH, 0.15, fade * REFLECTION_GAIN, 1 - fade, FLOOR_BANDS[1] / 2);
  }
  return shape;
}

// A thin ring (triangular cross-section, apex up) carrying `moons` evenly
// spaced moons, in the ring's local XZ plane.
export function orbitShape(radius: number, moons: number, moonSize: number): Shape {
  const shape = new Shape();
  const tube = 0.035;
  const ring = [radius, tube, 0, radius + tube, -tube / 2, 0, radius - tube, -tube / 2, 0, radius, tube, 0];
  shape.lathe(ring, 48, 1, 0, 0, 0);
  paint(shape, ACCENT, HALO, 0.45, 0.45, 0.8, 0.06);

  for (let i = 0; i < moons; i++) {
    const angle = (i * Math.PI * 2) / moons;
    shape.lathe(MOON, 6, moonSize, radius * Math.sin(angle), 0, radius * Math.cos(angle));
    paint(shape, ACCENT, HALO, 0, 0, 1, 0.18);
  }
  return shape;
}

export function floorShape(): Shape {
  const shape = new Shape();
  for (let i = 1; i < FLOOR_BANDS.length; i++) {
    const inner = FLOOR_BANDS[i - 1];
    const outer = FLOOR_BANDS[i];
    shape.lathe([inner, 0, 0, outer, 0, 0], FLOOR_SEGMENTS, 1, 0, 0, 0);
    const middle = (inner + outer) / 2;
    const count = shape.vertexCount();
    for (let v = shape.coloredCount(); v < count; v++) pushColor(shape, BACKGROUND, BACKGROUND, 0, 0, 1, middle);
  }
  return shape;
}

// Colours the vertices added since the last call: mix(low, high) with tone
// running from toneLow at the lowest to toneHigh at the highest, times a gain
// jittered by up to ±jitter so facets sparkle.
function paint(
  shape: Shape,
  low: number,
  high: number,
  toneLow: number,
  toneHigh: number,
  gain: number,
  jitter: number,
) {
  const from = shape.coloredCount();
  const heights = shape.heights(from);
  for (let i = 0; i < heights.length; i++) {
    const tone = toneLow + (toneHigh - toneLow) * heights[i];
    const sparkle = (((from + i) * GOLDEN) % 1) * 2 - 1;
    pushColor(shape, low, high, tone, gain * (1 + jitter * sparkle), 0, 0);
  }
}

// Appends one vertex's slot weights: `lit` of mix(low, high, tone) plus
// `floor` of the floor colour at `radius`.
function pushColor(shape: Shape, low: number, high: number, tone: number, lit: number, floor: number, radius: number) {
  const at = shape.weights.length;
  for (let s = 0; s < SLOTS; s++) shape.weights.push(0);

  const weights = shape.weights;
  weights[at + low] += lit * (1 - tone);
  weights[at + high] += lit * tone;
  if (floor === 0) return;

  const falloff = 1 - Math.min(1, radius / GLOW_RADIUS);
  const glow = falloff * falloff;
  const halo = Math.abs(radius - HALO_RADIUS) < 0.1 ? HALO_STRENGTH : 0;
  weights[at + BACKGROUND] += floor * (1 - glow) * (1 - halo);
  weights[at + GLOW] += floor * glow * (1 - halo);
  weights[at + HALO] += floor * halo;
}
