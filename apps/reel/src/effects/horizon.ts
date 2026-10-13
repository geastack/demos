import { blend565, clamp01, HEIGHT, rgb565, sinTurns, WIDTH } from "../lib/frame";

// The title card and the finale's backdrop: a baked sunset sky over a
// perspective grid floor drawn per row. The horizon, sun and floor derive
// from the panel: the horizon sits at 63% of the height, the sun's radius is
// 23.5% of the height (at most 15% of the width), and the floor's perspective
// scales with its row count, so the picture keeps its proportions from
// 480x272 to 480x480 and 410x502.

const SUN_R_OF_HEIGHT = 0.235;
const SUN_R_OF_WIDTH = 0.15;
const LINES = 18; // vertical lines either side of centre
const REFERENCE_FLOOR = 100; // floor rows of the 480x272 look the constants were tuned on

// Sun distances in the sky bake are taken from a table indexed by the
// squared distance in half pixels (d2 = (2d)^2), in 1/64 px. A literal mask
// (32767) keeps the lookup unchecked; the halo's reach never exceeds it.
const DISTANCE_MASK_SIZE = 32768;

// Deep indigo at the zenith, through violet and magenta to a warm horizon.
const SKY_KEYS = [0, 12, 10, 38, 0.45, 44, 16, 86, 0.8, 132, 34, 120, 1, 236, 92, 110];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const HAZE = rgb565(236, 92, 110);
const GROUND = rgb565(16, 8, 36);
const GRID = rgb565(255, 96, 208);

function mix(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

// One channel of the sky gradient at `v` (0 zenith, 1 horizon), 0..255.
function skyChannel(v: number, channel: number): number {
  let k = 0;
  while (k < 2 && v > SKY_KEYS[(k + 1) * 4]) k++;

  const a = k * 4;
  const f = clamp01((v - SKY_KEYS[a]) / (SKY_KEYS[a + 4] - SKY_KEYS[a]));
  return mix(SKY_KEYS[a + channel], SKY_KEYS[a + 4 + channel], f);
}

export class Horizon {
  private readonly horizon = Math.round((HEIGHT * 172) / 272);
  private readonly sunX = WIDTH / 2;
  private readonly sunR = Math.round(Math.min(WIDTH * SUN_R_OF_WIDTH, HEIGHT * SUN_R_OF_HEIGHT));
  private readonly sunY = this.horizon - 10;
  private readonly floorRows = HEIGHT - this.horizon;
  private readonly sky = new Uint16Array(WIDTH * this.horizon);
  private readonly distance = new Uint16Array(DISTANCE_MASK_SIZE);
  private readonly bayer = new Uint8Array(BAYER);
  private readonly haloQ6 = Math.round(2.6 * this.sunR * 64); // the halo's reach in 1/64 px
  private readonly haloD2 = Math.floor(2 * 2.6 * this.sunR) * Math.floor(2 * 2.6 * this.sunR);
  private readonly haloScale = Math.round((256 * 65536) / this.haloQ6);

  bake() {
    const distance = this.distance;
    const limit = (this.haloD2 >> 3) + 2;
    for (let i = 0; i < limit; i++) distance[i] = Math.round(Math.sqrt(i * 8 + 4) * 32);
    const horizon = this.horizon;
    for (let y = 0; y < horizon; y++) this.bakeRow(y);
  }

  render(pixels: Uint16Array, t: number) {
    pixels.set(this.sky);

    const width = WIDTH | 0;
    const horizon = this.horizon;
    const floorRows = this.floorRows;
    const sunX = this.sunX;
    // Floor projection: a row `dy` below the horizon lies at depth DEPTH / dy.
    const reach = floorRows / REFERENCE_FLOOR;
    const depthScale = 0.6 * floorRows;
    const lineSpacing = width / 10; // px between vertical lines DEPTH rows below the horizon
    const travel = t * 1.6;
    const drift = sinTurns(t * 0.05) * 0.5;
    for (let row = 0; row < floorRows; row++) {
      const dy = row + 0.5;
      const depth = depthScale / dy;
      // Rows near the horizon are hazy and their lines sub-pixel: fade both.
      const near = clamp01(dy / (50 * reach));
      const fog = near * near;
      const base = blend565(HAZE, GROUND, (clamp01(dy / (24 * reach)) * 32) | 0);

      // Horizontal line coverage: distance to the nearest line in world
      // units over the world size of one pixel on this row.
      const phase = (depth + travel) * 2;
      const f = phase - Math.floor(phase);
      const distance = (f < 0.5 ? f : 1 - f) / ((2 * depth) / dy);
      const across = clamp01(1.2 - distance) * fog;
      const line = (horizon + row) * width;
      pixels.fill(blend565(base, GRID, (across * 32) | 0), line, line + width);

      // Vertical lines converge on the vanishing point: their spacing grows
      // with the distance below the horizon. Positions in 16.16.
      const spacing = (lineSpacing * dy) / depthScale;
      const first = ((sunX + (drift - LINES) * spacing) * 65536) | 0;
      const step = (spacing * 65536) | 0;
      const along = (fog * 8192) | 0; // alpha 0..32, times 256
      for (let k = 0; k <= 2 * LINES; k++) {
        const at = (first + Math.imul(k, step)) | 0;
        const ix = at >> 16;
        if (ix < 0 || ix + 1 >= width) continue;

        const frac = (at >>> 11) & 31;
        const i = line + ix;
        pixels[i] = blend565(pixels[i], GRID, ((32 - frac) * along) >> 13);
        pixels[i + 1] = blend565(pixels[i + 1], GRID, (frac * along) >> 13);
      }
    }
  }

  // One sky row: the gradient, a soft halo around the sun, the sun disc cut
  // by widening slats in its lower half, ordered-dithered to RGB565.
  private bakeRow(y: number) {
    const sky = this.sky;
    const distance = this.distance;
    const bayer = this.bayer;
    const width = WIDTH | 0;
    const sunX = this.sunX;
    const sunY = this.sunY;
    const sunR = this.sunR;
    const haloD2 = this.haloD2;
    const haloQ6 = this.haloQ6;
    const haloScale = this.haloScale;
    const discEdge = sunR * 64 + 32;
    const grow = sunR / 64;
    const py = y + 0.5;
    const v = py / this.horizon;
    const red = (skyChannel(v, 1) * 256) | 0;
    const green = (skyChannel(v, 2) * 256) | 0;
    const blue = (skyChannel(v, 3) * 256) | 0;

    const sunV = (py - (sunY - sunR)) / (2 * sunR);
    const offset = py - sunY;
    const period = 11 * grow;
    const band = offset - period * Math.floor(offset / period);
    const slatted = sunV > 0.5 && band < (1 + (sunV - 0.5) * 14) * grow;
    const sunLit = !slatted && sunV >= 0 && sunV <= 1;
    const sunGreen = (mix(222, 70, sunV) * 256) | 0;
    const sunBlue = (mix(128, 136, sunV) * 256) | 0;

    const dy = 2 * y + 1 - 2 * sunY;
    const dy2 = dy * dy;
    const line = y * width;
    const dither = (y & 3) * 4;
    for (let x = 0; x < width; x++) {
      const dx = 2 * x + 1 - 2 * sunX;
      const d2 = dx * dx + dy2;
      const d = d2 < haloD2 ? distance[(d2 >> 3) & 32767] : haloQ6;

      // The halo: glow = 0.55 * (1 - d / haloRadius)^2, as 0..141 of 256.
      const halo = Math.max(0, 256 - ((d * haloScale) >> 16));
      const glow = (halo * halo * 141) >> 16;
      const hr = red + (Math.imul(65280 - red, glow) >> 8);
      const hg = green + (Math.imul(24576 - green, glow) >> 8);
      const hb = blue + (Math.imul(35840 - blue, glow) >> 8);

      // The disc's edge is antialiased over one pixel; cover is 0..64.
      const cover = sunLit ? Math.min(64, Math.max(0, discEdge - d)) : 0;
      const r = hr + (Math.imul(65280 - hr, cover) >> 6);
      const g = hg + (Math.imul(sunGreen - hg, cover) >> 6);
      const b = hb + (Math.imul(sunBlue - hb, cover) >> 6);

      const threshold = bayer[(dither + (x & 3)) & 15] * 16;
      const r8 = Math.min(255, (r + threshold * 8) >> 8);
      const g8 = Math.min(255, (g + threshold * 4) >> 8);
      const b8 = Math.min(255, (b + threshold * 8) >> 8);
      sky[line + x] = ((r8 & 0xf8) << 8) | ((g8 & 0xfc) << 3) | (b8 >> 3);
    }
  }
}
