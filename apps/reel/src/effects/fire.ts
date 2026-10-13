import { buildRamp, HALF_CELLS, HALF_H, HALF_W, hash, random32, sinTurns, upscale } from "../lib/frame";
import { touch } from "../lib/touch";

// Two layers on a half-resolution field:
// - flames: a vertical heat gradient broken up by two octaves of noise
//   scrolling upwards (a function of time, so scrubbing stays exact);
// - plumes: a classic demoscene heat field a finger feeds. Each cell takes
//   the average of the cells below it, slightly cooled, so heat rises one
//   row (two screen px) per frame.

const ROWS = HALF_H + 2; // two hidden rows below the field
const PLUME_CELLS = HALF_W * ROWS;
const FEED_RADIUS = 8; // half-res cells
const KEEP = 1016; // plume heat kept per row, /1024
const RISE = 52; // noise rows per second
const BAKE_ROWS = 32; // noise rows per bake step

// Night indigo through magenta and sunset orange to a cream core.
const RAMP = [
  0, 10, 6, 24, 0.2, 44, 12, 84, 0.42, 176, 30, 108, 0.62, 250, 104, 56, 0.8, 255, 192, 92, 1, 255, 248, 225,
];

export class Fire {
  private readonly noise = new Uint8Array(65536); // 256x256 tileable value noise
  private readonly smooth = new Uint16Array(256); // smoothstep of i / 256, Q8
  private readonly plume = new Uint8Array(PLUME_CELLS);
  private readonly field = new Uint8Array(HALF_CELLS);
  private readonly palette = new Uint16Array(256);
  private bakedRows = 0;

  // A slice of the noise per call; true once done.
  bake(): boolean {
    if (this.bakedRows === 0) {
      for (let i = 0; i < 256; i++) {
        const f = i / 256;
        this.smooth[i] = Math.round(f * f * (3 - 2 * f) * 256);
      }
      buildRamp(this.palette, 0, 256, RAMP);
    }

    const end = Math.min(256, this.bakedRows + BAKE_ROWS);
    const noise = this.noise;
    for (let v = this.bakedRows; v < end; v++) {
      for (let u = 0; u < 256; u++) {
        const coarse = this.valueNoise(u, v, 5, 17);
        const fine = this.valueNoise(u, v, 4, 91);
        noise[v * 256 + u] = (coarse * 166 + fine * 89) >> 10;
      }
    }
    this.bakedRows = end;
    return end === 256;
  }

  render(words: Uint32Array, t: number) {
    // A finger feeds a plume; with no finger a wandering ember does.
    if (touch.down) {
      this.feed((touch.x | 0) >> 1, (touch.y | 0) >> 1, 255);
    } else {
      const x = HALF_W / 2 + ((sinTurns(t * 0.07) * HALF_W * 0.375) | 0);
      const y = HALF_H - ((HALF_H * 0.3) | 0) + ((sinTurns(t * 0.19) * 16) | 0);
      this.feed(x, y, 230);
    }
    this.rise();
    this.burn(t);
    upscale(this.field, this.palette, words);
  }

  // Value noise tiling over 256 texels, with lattice cells of 1 << `shift`
  // texels; 0..1023.
  private valueNoise(u: number, v: number, shift: number, seed: number): number {
    const cells = 256 >> shift;
    const cu = u >> shift;
    const cv = v >> shift;
    const mask = (1 << shift) - 1;
    const fu = this.smooth[(u & mask) << (8 - shift)];
    const fv = this.smooth[(v & mask) << (8 - shift)];
    const left = cu % cells;
    const right = (cu + 1) % cells;
    const top = (cv % cells) * cells;
    const bottom = ((cv + 1) % cells) * cells;
    const a = hash(top + left + seed) & 1023;
    const b = hash(top + right + seed) & 1023;
    const c = hash(bottom + left + seed) & 1023;
    const d = hash(bottom + right + seed) & 1023;
    const upper = a + (((b - a) * fu) >> 8);
    const lower = c + (((d - c) * fu) >> 8);
    return upper + (((lower - upper) * fv) >> 8);
  }

  // Stamps heat in a disc around a half-res cell.
  private feed(cx: number, cy: number, heat: number) {
    const plume = this.plume;
    const halfW = HALF_W | 0;
    const rows = ROWS | 0;
    const reach = FEED_RADIUS * FEED_RADIUS;
    for (let dy = -FEED_RADIUS; dy <= FEED_RADIUS; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= rows) continue;

      for (let dx = -FEED_RADIUS; dx <= FEED_RADIUS; dx++) {
        const x = cx + dx;
        const d2 = dx * dx + dy * dy;
        if (x < 0 || x >= halfW || d2 > reach) continue;

        const value = heat - (((d2 * heat) / (reach + 1)) | 0) - (random32() & 31);
        const at = y * halfW + x;
        if (value > plume[at]) plume[at] = value;
      }
    }
  }

  // Heat rises: each cell averages the three cells below it and the one
  // below those, cooled; the edge columns repeat themselves.
  private rise() {
    const plume = this.plume;
    const halfW = HALF_W | 0;
    const halfH = HALF_H | 0;
    const last = halfW - 1;
    for (let y = 0; y < halfH; y++) {
      const row = y * halfW;
      const below = row + halfW;
      const belowLeft = below - 1;
      const belowRight = below + 1;
      const below2 = below + halfW;
      const first = plume[below] * 2 + plume[below + 1] + plume[below2];
      const end = plume[below + last - 1] + plume[below + last] * 2 + plume[below2 + last];
      for (let x = 1; x < last; x++) {
        const sum = plume[belowLeft + x] + plume[below + x] + plume[belowRight + x] + plume[below2 + x];
        plume[row + x] = (sum * KEEP) >> 12;
      }
      plume[row] = (first * KEEP) >> 12;
      plume[row + last] = (end * KEEP) >> 12;
    }
  }

  // The flames' heat per cell, plus the plumes.
  private burn(t: number) {
    const noise = this.noise;
    const plume = this.plume;
    const field = this.field;
    const halfW = HALF_W | 0;
    const halfH = HALF_H | 0;
    // Noise rows per field row, Q8: flames keep their proportions of the
    // frame (the noise was tuned on 136 rows).
    const rowScale = Math.round((256 * 136) / halfH) | 0;
    const gradient = Math.round((330 * 256) / halfH) | 0;
    // The flames' height breathes over the scene.
    const lift = 95 + ((sinTurns(t * 0.11) * 25) | 0);
    const scroll = (t * RISE) | 0;
    for (let y = 0; y < halfH; y++) {
      // Heat from the gradient: cold at the top, hot at the bed.
      const base = ((y * gradient) >> 8) - lift;
      const ny = (y * rowScale) >> 8;
      const coarse = ((ny + scroll) & 255) * 256;
      const fine = ((ny * 2 + scroll * 2 + 128) & 255) * 256;
      const row = y * halfW;
      for (let x = 0; x < halfW; x++) {
        // Noise features are taller than they are wide: flame tongues.
        const n =
          noise[(coarse + ((x * 2) & 255)) & 0xffff] + (noise[(fine + ((x * 3 + 64) & 255)) & 0xffff] >> 1) - 191;
        const heat = Math.max(0, base + ((n * 3) >> 2)) + plume[row + x];
        field[row + x] = Math.min(255, heat);
      }
    }
  }
}
