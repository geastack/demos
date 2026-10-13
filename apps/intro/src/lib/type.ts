import { BRAND_RAMP, PIXEL_MASK, SPREAD, WIDTH } from "./frame";

// Pass as the colour to paint type in the brand gradient.
export const GRADIENT = -1;

// A line of baked type (data/type.ts): a coverage mask, 0..15 per pixel,
// that blends into the frame in one colour or the brand gradient.
export class TypeLine {
  readonly width: number;
  readonly height: number;
  readonly mask: Uint8Array;
  // The brand gradient across the line, left to right, spread for blending;
  // and the ink of one draw, per column.
  private readonly gradient: Int32Array;
  private readonly ink: Int32Array;
  private readonly alphas = new Uint8Array(16);

  constructor(width: number, height: number, rows: string[]) {
    this.width = width;
    this.height = height;
    this.mask = new Uint8Array(width * height);
    this.gradient = new Int32Array(width);
    this.ink = new Int32Array(width);
    let at = 0;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let i = 0; i < row.length; i++) {
        const code = row.charCodeAt(i);
        this.mask[at++] = code < 58 ? code - 48 : code - 87;
      }
    }
    for (let x = 0; x < width; x++) {
      const colour = BRAND_RAMP[((x * 255) / (width - 1)) | 0];
      this.gradient[x] = (colour | (colour << 16)) & SPREAD;
    }
  }

  // Blends columns [from, to) with the mask's top-left at (left, top), at
  // `opacity` 0..32, in `colour` (RGB565) or GRADIENT.
  draw(pixels: Uint16Array, left: number, top: number, colour: number, opacity: number, from: number, to: number) {
    if (opacity <= 0 || to <= from) return;

    // Integer copies of the arguments keep the per-pixel work integer.
    const first = from | 0;
    const end = Math.min(this.width, to) | 0;
    const solid = (colour | (colour << 16)) & SPREAD;
    const alphas = this.alphas;
    for (let c = 0; c < 16; c++) alphas[c] = ((c * opacity) / 15 + 0.5) | 0;
    const ink = this.ink;
    for (let x = first; x < end; x++) ink[x] = colour < 0 ? this.gradient[x] : solid;

    // Offsets only ever step by constants: a sum or product of two runtime
    // integers is computed in double.
    const mask = this.mask;
    const width = this.width | 0;
    const height = this.height | 0;
    let m = 0;
    let out = (top * WIDTH + left) | 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = alphas[mask[m] & 15];
        m++;
        if (alpha === 0 || x < first || x >= end) continue;

        const at = (out + x) & PIXEL_MASK;
        const under = pixels[at];
        const mixed =
          ((Math.imul((under | (under << 16)) & SPREAD, 32 - alpha) + Math.imul(ink[x], alpha)) >>> 5) & SPREAD;
        pixels[at] = mixed | (mixed >>> 16);
      }
      out += WIDTH;
    }
  }
}
