import type { BufferGeometry } from "@geastack/gea3d/three";
import { Builder, fastSin, hash, Rgb } from "./geometry";
import { BANK, FAR_LAND, FOAM, MEADOW, SHORE, WATER, WATER_DEEP } from "./palette";
import { HALF_WIDTH, type River, ROW_GAP, ROWS } from "./river";

// The river and its banks as one grid over the river's row window: per row
// the water (5 columns, its inner vertices riding the waves every frame)
// and the banks (4 columns a side, from the waterline out to the far
// meadow). It is flat-shaded by the scene lights; rows are laid as the
// window slides.

const WATER_COLUMNS = 5;
const WATER_U = [-HALF_WIDTH, -HALF_WIDTH / 2, 0, HALF_WIDTH / 2, HALF_WIDTH];
const BANK_COLUMNS = 4;
// Distance out from the waterline, base height and random extra height.
const BANK_OUT = [0, 1.3, 5.5, 26];
const BANK_BASE = [0.02, 0.42, 0.7, 0.9];
const BANK_RISE = [0, 0.26, 0.5, 2.4];
const BANK_COLORS = [SHORE, BANK, MEADOW, FAR_LAND];

const WAVE_CALM = 0.08;
const WAVE_RAPIDS = 0.2;

// Wave height at (s, u) and time t; the shores stay still.
// Single precision (Math.fround): 0.0566893 is 1 / HALF_WIDTH^2, 0.08 and
// 0.2 are WAVE_CALM and WAVE_RAPIDS.
export function waveAt(s: number, u: number, t: number, rapids: number): number {
  const fs = Math.fround(s);
  const fu = Math.fround(u);
  const ft = Math.fround(t);
  const fr = Math.fround(rapids);
  const edge = Math.fround(1 - Math.fround(Math.fround(fu * fu) * Math.fround(0.0566893)));
  const amplitude = Math.fround(Math.fround(Math.fround(0.08) + Math.fround(Math.fround(0.2) * fr)) * edge);
  const a = Math.fround(Math.fround(Math.fround(Math.fround(0.9) * fs) - Math.fround(Math.fround(2.2) * ft)) + Math.fround(Math.fround(0.6) * fu));
  const b = Math.fround(Math.fround(Math.fround(Math.fround(0.37) * fs) + Math.fround(Math.fround(1.6) * ft)) - Math.fround(Math.fround(1.1) * fu));
  const wa = Math.fround(fastSin(a));
  const wb = Math.fround(fastSin(b));
  return Math.fround(amplitude * Math.fround(Math.fround(Math.fround(0.6) * wa) + Math.fround(Math.fround(0.4) * wb)));
}

// The banks' mean height `out` units beyond the waterline.
export function bankHeight(out: f32): f32 {
  for (let c = 1; c < BANK_COLUMNS; c++) {
    if (out > BANK_OUT[c]) continue;

    const t = Math.max(0, out - BANK_OUT[c - 1]) / (BANK_OUT[c] - BANK_OUT[c - 1]);
    const low = BANK_BASE[c - 1] + BANK_RISE[c - 1] / 2;
    const high = BANK_BASE[c] + BANK_RISE[c] / 2;
    return low + (high - low) * t;
  }
  return BANK_BASE[BANK_COLUMNS - 1];
}

// Vertices per row: the water's columns, then each bank's.
const ROW_VERTICES = WATER_COLUMNS + BANK_COLUMNS * 2;

export class Terrain {
  readonly geometry: BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private builtRow = -1;

  constructor() {
    const grid = new Builder();
    const black = new Rgb(0, 0, 0);
    for (let i = 0; i < ROWS * ROW_VERTICES; i++) grid.vertex(0, 0, 0, black);
    for (let r = 0; r + 1 < ROWS; r++) {
      const row = r * ROW_VERTICES;
      for (let c = 0; c + 1 < WATER_COLUMNS; c++) {
        const a = row + c;
        grid.quad(a, a + ROW_VERTICES, a + ROW_VERTICES + 1, a + 1);
      }
      for (let side = 0; side < 2; side++) {
        for (let c = 0; c + 1 < BANK_COLUMNS; c++) {
          const a = row + WATER_COLUMNS + side * BANK_COLUMNS + c;
          grid.quad(a, a + ROW_VERTICES, a + ROW_VERTICES + 1, a + 1);
        }
      }
    }
    this.geometry = grid.geometry();
    this.positions = this.geometry.attributes.position.array;
    this.colors = this.geometry.attributes.color.array;
  }

  // Lays the grid over the river's rows: when the window slid by a few
  // rows, the kept rows move down and only the new far rows are laid.
  update(river: River) {
    const shift = river.firstRow - this.builtRow;
    if (shift === 0) return;

    const keep = shift > 0 && shift < ROWS ? ROWS - shift : 0;
    if (keep > 0) {
      moveDown(this.positions, shift * ROW_VERTICES * 3, keep * ROW_VERTICES * 3);
      moveDown(this.colors, shift * ROW_VERTICES * 3, keep * ROW_VERTICES * 3);
    }
    for (let r = keep; r < ROWS; r++) this.layRow(river, r);
    this.builtRow = river.firstRow;
    this.geometry.attributes.color.needsUpdate = true;
  }

  private layRow(river: River, r: number) {
    const p = this.positions;
    const color = this.colors;
    const k = river.firstRow + r;
    const rightX = Math.cos(river.heading[r]);
    const rightZ = Math.sin(river.heading[r]);
    const x = river.x[r];
    const z = river.z[r];
    const row = r * ROW_VERTICES;

    const foam = river.rapids[r] * 0.7;
    for (let c = 0; c < WATER_COLUMNS; c++) {
      const o = (row + c) * 3;
      p[o] = x + rightX * WATER_U[c];
      p[o + 1] = 0;
      p[o + 2] = z + rightZ * WATER_U[c];
      const inner = c === 0 || c === WATER_COLUMNS - 1 ? 0 : 1;
      const depth = inner * (0.6 + 0.4 * hash(k * 7 + c));
      const froth = foam * inner;
      color[o] = blend(blend(WATER_DEEP.r, WATER.r, depth), FOAM.r, froth);
      color[o + 1] = blend(blend(WATER_DEEP.g, WATER.g, depth), FOAM.g, froth);
      color[o + 2] = blend(blend(WATER_DEEP.b, WATER.b, depth), FOAM.b, froth);
    }

    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      for (let c = 0; c < BANK_COLUMNS; c++) {
        const o = (row + WATER_COLUMNS + side * BANK_COLUMNS + c) * 3;
        const u = sign * (HALF_WIDTH + BANK_OUT[c]);
        p[o] = x + rightX * u;
        p[o + 1] = BANK_BASE[c] + BANK_RISE[c] * hash(k * 13 + side * 5 + c);
        p[o + 2] = z + rightZ * u;
        const tone = 0.86 + 0.28 * hash(k * 31 + side * 3 + c);
        const albedo = BANK_COLORS[c];
        color[o] = albedo.r * tone;
        color[o + 1] = albedo.g * tone;
        color[o + 2] = albedo.b * tone;
      }
    }
  }

  // Moves the water's inner vertices on the waves (every frame).
  waves(river: River, t: number) {
    const p = this.positions;
    for (let r = 0; r < ROWS; r++) {
      const s = (river.firstRow + r) * ROW_GAP;
      const rapids = river.rapids[r];
      for (let c = 1; c + 1 < WATER_COLUMNS; c++) {
        p[(r * ROW_VERTICES + c) * 3 + 1] = waveAt(s, WATER_U[c], t, rapids);
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
}

// array[i] = array[i + by] for the first `count` values.
function moveDown(array: Float32Array, by: i32, count: i32) {
  for (let i = 0; i < count; i++) array[i] = array[i + by];
}

function blend(from: f32, to: f32, t: f32): f32 {
  return from + (to - from) * t;
}
