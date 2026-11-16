import { blend565, buildRamp, HALF_CELLS, HALF_H, HALF_W, HEIGHT, rgb565, sinTurns, upscaleRows } from "../lib/frame";
import { Simd } from "@geastack/core";
import { touch } from "../lib/touch";

// The iso-surface of six summed inverse-square fields, at half resolution.
// One falloff table spans every offset between a cell and a ball: each
// ball reads it through its own window. A cell's sum is clamped to 255, so
// each entry is too: the field comes out the same and the table fits bytes.

const BALLS = 6;
const LUT_W = 2 * HALF_W;
const LUT_H = 2 * HALF_H;
const LUT_CELLS = LUT_W * LUT_H;
// radius^2 of one ball, in half-res cells: 420 on a 136-row frame, scaled
// with the frame's smaller side.
const BALL_SIZE = Math.min(HALF_W, HALF_H) / 136;
const STRENGTH = 420 * BALL_SIZE * BALL_SIZE;
const THRESHOLD = 64; // field value of the surface; the rest shades the inside
const BAKE_ROWS = 24; // table rows per bake step

// Outside: a deep teal night with faint contour lines. At the threshold a
// thin cream rim, then magenta heating through coral to gold at the cores.
const OUTSIDE = [0, 6, 14, 34, 1, 18, 60, 92];
const INSIDE = [0, 200, 40, 120, 0.45, 255, 124, 104, 1, 255, 220, 168];

export class Metaballs {
  private readonly falloff = new Uint8Array(LUT_CELLS);
  private readonly field = new Uint8Array(HALF_CELLS);
  private readonly palette = new Uint16Array(256);
  private readonly windows = new Int32Array(BALLS); // each ball's offset into the falloff table
  private bakedRows = 0;

  // A slice of the falloff table per call; true once done.
  bake(): boolean {
    if (this.bakedRows === 0) this.bakePalette();

    const falloff = this.falloff;
    const lutW = LUT_W | 0;
    const lutH = LUT_H | 0;
    const end = Math.min(lutH, this.bakedRows + BAKE_ROWS);
    for (let y = this.bakedRows; y < end; y++) {
      const dy = y - HALF_H;
      for (let x = 0; x < lutW; x++) {
        const dx = x - HALF_W;
        const value = (STRENGTH * THRESHOLD) / (dx * dx + dy * dy + 1);
        falloff[y * lutW + x] = Math.min(255, value);
      }
    }
    this.bakedRows = end;
    return end === lutH;
  }

  render(words: Uint32Array, t: number) {
    this.prepare(t);
    this.rows(words, 0, HEIGHT);
  }

  // The frame's state at `t`; `rows` then draws any band of it.
  prepare(t: number) {
    const windows = this.windows;
    for (let b = 0; b < BALLS; b++) {
      const phase = b * 0.17;
      let x = HALF_W * 0.5 + sinTurns(t * (0.05 + 0.013 * b) + phase) * HALF_W * 0.36;
      let y = HALF_H * 0.5 + sinTurns(t * (0.07 + 0.011 * b) + phase * 2) * HALF_H * 0.34;
      if (b === 0 && touch.down) {
        x = touch.x * 0.5;
        y = touch.y * 0.5;
      }
      windows[b] = (HALF_H - (y | 0)) * LUT_W + HALF_W - (x | 0);
    }

    this.sum();
  }

  rows(words: Uint32Array, first: number, count: number) {
    upscaleRows(this.field, this.palette, words, first, count);
  }

  // Each cell is the clamped sum of six windows into the falloff table, one per
  // ball: a strided byte-window sum the chip vectorizes.
  private sum() {
    Simd.sumWindowsU8(this.field, 0, HALF_W, this.falloff, this.windows, BALLS, LUT_W, HALF_W, HALF_H, 1, 0);
  }

  private bakePalette() {
    const palette = this.palette;
    buildRamp(palette, 0, THRESHOLD, OUTSIDE);
    buildRamp(palette, THRESHOLD, 256 - THRESHOLD, INSIDE);
    for (let i = 12; i < THRESHOLD - 6; i += 12) palette[i] = blend565(palette[i], palette[THRESHOLD - 1], 12);
    for (let i = THRESHOLD - 2; i < THRESHOLD + 2; i++) palette[i] = rgb565(255, 236, 214);
  }
}
