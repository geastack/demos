import { DYE_SIZE, DYE_UNIT, type Fluid } from "./fluid";
import { DYE_H, DYE_W, FIELD_W } from "./layout";
import type { Mode } from "./modes";

// The image is the fluid field exactly (a whole number of dye cells): the
// blit takes the whole image. Pixel writes index through `& 262143` (a
// literal mask, as the compiler recognises); the largest panel (480x480) has
// 230400 pixels.
// RGB565 spread over 32 bits (G in 21-26, R in 11-15, B in 0-4): the gaps
// absorb a blend's borrows, so one multiply interpolates all three channels.
const SPREAD = 0x07e0f81f;

// Tone map, indexed by the dye's brightest channel >> 8. Below the threshold
// dye fades to pure background instead of a murky haze; dense dye glows
// faintly toward white.
const LUT_SIZE = 256;
const LINE_SIZE = 512; // >= FIELD_W, a power of two for masked writes
const EXPOSURE = 1.6;
const THRESHOLD_START = 0.06;
const THRESHOLD_FULL = 0.45;
const WHITE_START = 2.2;
const WHITE_MAX = 0.12;

// Turns the dye into panel pixels: a hue-preserving tone map per dye cell into
// RGB565, then a bilinear upsample in 2 x 2 pixel blocks (a dye cell is 8 x 8
// pixels, so its four block rows and columns sit at -3/8, -1/8, +1/8 and +3/8
// of a cell from its centre).
export class Renderer {
  private readonly dyeW = DYE_W;
  private readonly dyeH = DYE_H;
  private readonly dyeCells = DYE_W * DYE_H;
  private readonly rowPixels = FIELD_W;
  private readonly colors = new Int32Array(DYE_SIZE);
  private readonly band = new Int32Array(64); // 0..59, plus edge copies at 60 and 63
  // One pixel row, built two pixels per 32-bit store and copied into both of
  // the band's rows. The image (480 x 480 = 230400 pixels) is not a power of
  // two, so masked stores straight into it could not be proved in range once
  // per loop and each one took the checked path.
  private readonly line = new Uint16Array(LINE_SIZE);
  private readonly lineWords = new Uint32Array(this.line.buffer);
  private readonly lineView = this.line.subarray(0, FIELD_W);
  // Per LUT step, Q16: dye gain to a 5- or 6-bit channel, and the background
  // plus white lift per channel (with +0.5 for rounding).
  private readonly gain31 = new Int32Array(LUT_SIZE);
  private readonly gain63 = new Int32Array(LUT_SIZE);
  private readonly offsetRed = new Int32Array(LUT_SIZE);
  private readonly offsetGreen = new Int32Array(LUT_SIZE);
  private readonly offsetBlue = new Int32Array(LUT_SIZE);

  setMode(mode: Mode) {
    const lutMax = 65536 / DYE_UNIT;
    const red = mode.background[0];
    const green = mode.background[1];
    const blue = mode.background[2];
    for (let k = 0; k < LUT_SIZE; k++) {
      const m = ((k + 0.5) * lutMax) / LUT_SIZE;
      const edge = Math.min(1, Math.max(0, (m - THRESHOLD_START) / (THRESHOLD_FULL - THRESHOLD_START)));
      const mapped = (1 - Math.exp(-EXPOSURE * m)) * edge * edge * (3 - 2 * edge);
      const hot = Math.min(1, Math.max(0, (m - WHITE_START) / (lutMax - WHITE_START)));
      const gain = mapped / m / DYE_UNIT;
      const fade = 1 - mapped;
      const white = WHITE_MAX * hot * hot;
      this.gain31[k] = Math.round(gain * 31 * 65536);
      this.gain63[k] = Math.round(gain * 63 * 65536);
      this.offsetRed[k] = Math.round((red * fade + white) * 31 * 65536 + 32768);
      this.offsetGreen[k] = Math.round((green * fade + white) * 63 * 65536 + 32768);
      this.offsetBlue[k] = Math.round((blue * fade + white) * 31 * 65536 + 32768);
    }
  }

  /** Tone-maps every dye cell into an RGB565 spread colour. */
  tone(fluid: Fluid) {
    const dyeCells = this.dyeCells | 0;
    const red = fluid.red;
    const green = fluid.green;
    const blue = fluid.blue;
    const colors = this.colors;
    const gain31 = this.gain31;
    const gain63 = this.gain63;
    const offsetRed = this.offsetRed;
    const offsetGreen = this.offsetGreen;
    const offsetBlue = this.offsetBlue;

    for (let c = 0; c < dyeCells; c++) {
      const r = red[c];
      const g = green[c];
      const b = blue[c];
      const k = (Math.max(r, Math.max(g, b)) >> 8) & 255;
      const r5 = Math.min(31, (offsetRed[k] + r * gain31[k]) >> 16);
      const g6 = Math.min(63, (offsetGreen[k] + g * gain63[k]) >> 16);
      const b5 = Math.min(31, (offsetBlue[k] + b * gain31[k]) >> 16);
      colors[c] = (g6 << 21) | (r5 << 11) | b5;
    }
  }

  /** Upsamples the colours into the image's RGB565 pixels. */
  draw(pixels: Uint16Array) {
    const colors = this.colors;
    const band = this.band;
    const dyeW = this.dyeW | 0;
    const lastDyeRow = ((this.dyeH | 0) - 1) | 0;
    const bands = ((this.dyeH | 0) * 4) | 0; // two pixel rows each
    const rowPixels = this.rowPixels | 0;
    const bandPixels = (rowPixels * 2) | 0;

    for (let b = 0; b < bands; b++) {
      const cell = b >> 2;
      const sub = b & 3;
      const other = sub < 2 ? Math.max(cell - 1, 0) : Math.min(cell + 1, lastDyeRow);
      const weight = sub === 0 || sub === 3 ? 3 : 1; // of 8, toward `other`
      const near = cell * dyeW;
      const far = other * dyeW;

      for (let x = 0; x < dyeW; x++) {
        const a = colors[(near + x) & 4095];
        const z = colors[(far + x) & 4095];
        band[x & 63] = (a + (((z - a) * weight) >> 3)) & SPREAD;
      }
      band[dyeW] = band[dyeW - 1];
      band[63] = band[0];

      const lineWords = this.lineWords;
      for (let x = 0; x < dyeW; x++) {
        const previous = band[(x - 1) & 63];
        const centre = band[x & 63];
        const next = band[(x + 1) & 63];
        const c0 = (centre + (((previous - centre) * 3) >> 3)) & SPREAD;
        const c1 = (centre + ((previous - centre) >> 3)) & SPREAD;
        const c2 = (centre + ((next - centre) >> 3)) & SPREAD;
        const c3 = (centre + (((next - centre) * 3) >> 3)) & SPREAD;
        const p0 = (c0 | (c0 >> 16)) & 0xffff;
        const p1 = (c1 | (c1 >> 16)) & 0xffff;
        const p2 = (c2 | (c2 >> 16)) & 0xffff;
        const p3 = (c3 | (c3 >> 16)) & 0xffff;

        const word = x << 2;
        lineWords[word & 255] = p0 | (p0 << 16);
        lineWords[(word + 1) & 255] = p1 | (p1 << 16);
        lineWords[(word + 2) & 255] = p2 | (p2 << 16);
        lineWords[(word + 3) & 255] = p3 | (p3 << 16);
      }

      const top = b * bandPixels;
      pixels.set(this.lineView, top);
      pixels.set(this.lineView, top + rowPixels);
    }
  }
}
