import {
  addLight,
  BRAND_RAMP,
  CYAN_SPREAD,
  clamp01,
  GRADIENT_X,
  GRADIENT_Y,
  HEIGHT,
  OVERLAY_LEFT,
  OVERLAY_TOP,
  PIXEL_MASK,
  SPREAD,
  SURFACE_SPREAD,
  WHITE_SPREAD,
  WIDTH,
} from "./frame";
import { LOGO_X, LOGO_Y } from "./logo";

// Circuit traces: 2 px right-angle paths from the panel's edges to the ends
// of the logo's base bar (x 94..191, y 136..151 on the 480x272 stage), three
// from each side. Each races in on its own cue and paints in the brand
// gradient, white-hot behind its head.

// Corners as x, y pairs in stage coordinates; trace i owns corners FIRST[i]
// .. FIRST[i + 1] - 1. Left traces land on the bar's left end (x 93), right
// ones on its right end (x 192), at its top, middle and bottom rows. The
// constructor moves the stage onto the panel: a corner on the stage's edge
// (x 0 or 478, y 0 or 270) goes to the panel's own edge, so on a taller panel
// the traces run in from its real edges; the others follow the logo, kept 20 px
// from the left edge on a narrow panel.
const STAGE_CORNERS = new Int16Array([
  // left edge, straight in
  0, 142, 93, 142,
  // bottom edge
  36, 270, 36, 180, 68, 180, 68, 148, 93, 148,
  // top edge
  52, 0, 52, 102, 76, 102, 76, 136, 93, 136,
  // right edge
  478, 166, 236, 166, 236, 142, 192, 142,
  // bottom edge
  300, 270, 300, 190, 210, 190, 210, 148, 192, 148,
  // top edge
  262, 0, 262, 106, 222, 106, 222, 136, 192, 136,
]);
const FIRST = [0, 2, 7, 12, 16, 21, 26];
const CORNER_COUNT = 26;
const LEFT_CLEAR = 20;
const STARTS = [2.1, 2.24, 2.18, 2.14, 2.28, 2.2];
const TRAVELS = [0.92, 0.84, 0.88, 0.94, 0.8, 0.86];
const TRACE_COUNT = 6;
const TAIL_PX = 26; // white-hot run behind the head
const HEAD_FADE_S = 0.16; // the head's glow after it lands
const HEAD_REACH = 6; // glow radius, px
const GRID_PITCH = 16;
const GRID_ALPHA = 6; // of 32

export class Traces {
  private readonly pixels: Uint16Array;
  // The corners on the panel, as x, y pairs.
  private readonly corners = new Int16Array(CORNER_COUNT * 2);
  private readonly lengths = new Int32Array(TRACE_COUNT);
  // White blended into the tail by distance behind the head, and the head's
  // glow by squared distance, both of 32.
  private readonly tail = new Uint8Array(TAIL_PX);
  private readonly halo = new Uint8Array(HEAD_REACH * HEAD_REACH + 1);

  constructor(pixels: Uint16Array) {
    this.pixels = pixels;
    const corners = this.corners;
    const shiftX = LOGO_X - 94;
    const shiftY = LOGO_Y - 32;
    for (let c = 0; c < CORNER_COUNT; c++) {
      const x = STAGE_CORNERS[c * 2];
      const y = STAGE_CORNERS[c * 2 + 1];
      corners[c * 2] = x === 0 ? 0 : x === 478 ? WIDTH - 2 : Math.max(x + shiftX, LEFT_CLEAR);
      corners[c * 2 + 1] = y === 0 ? 0 : y === 270 ? HEIGHT - 2 : y + shiftY;
    }
    for (let i = 0; i < TRACE_COUNT; i++) {
      let length = 0;
      for (let c = FIRST[i]; c < FIRST[i + 1] - 1; c++) {
        length +=
          Math.abs(corners[(c + 1) * 2] - corners[c * 2]) + Math.abs(corners[(c + 1) * 2 + 1] - corners[c * 2 + 1]);
      }
      this.lengths[i] = length;
    }
    for (let d = 0; d < TAIL_PX; d++) this.tail[d] = Math.round(((TAIL_PX - d) * 26) / TAIL_PX);
    for (let d2 = 0; d2 <= HEAD_REACH * HEAD_REACH; d2++) {
      const falloff = 1 - d2 / (HEAD_REACH * HEAD_REACH);
      this.halo[d2] = Math.round(28 * falloff * falloff);
    }
  }

  // A faint dot grid, like a bare board, `level` 0..1.
  grid(level: number) {
    const alpha = (level * GRID_ALPHA + 0.5) | 0;
    if (alpha <= 0) return;

    const pixels = this.pixels;
    const ramp = BRAND_RAMP;
    const columns = GRADIENT_X;
    const rows = GRADIENT_Y;
    const surface = Math.imul(SURFACE_SPREAD, 32 - alpha);
    for (let y = GRID_PITCH >> 1; y < HEIGHT; y += GRID_PITCH) {
      const right = y >= OVERLAY_TOP ? OVERLAY_LEFT : WIDTH;
      for (let x = GRID_PITCH >> 1; x < right; x += GRID_PITCH) {
        const colour = ramp[(columns[x] + rows[y]) & 255];
        const mixed = ((surface + Math.imul((colour | (colour << 16)) & SPREAD, alpha)) >>> 5) & SPREAD;
        pixels[(y * WIDTH + x) & PIXEL_MASK] = mixed | (mixed >>> 16);
      }
    }
  }

  // The traces at `time`; `level` 0..1 dims them once they have landed.
  draw(time: number, level: number) {
    const dim = (level * 32 + 0.5) | 0;
    if (dim <= 0) return;

    for (let i = 0; i < TRACE_COUNT; i++) {
      const progress = clamp01((time - STARTS[i]) / TRAVELS[i]);
      if (progress <= 0) continue;

      // Quadratic ease-out: fast off the edge, settling into the bar.
      const travelled = ((1 - (1 - progress) * (1 - progress)) * this.lengths[i]) | 0;
      this.path(i, travelled, dim);
      const landed = time - STARTS[i] - TRAVELS[i];
      if (landed < HEAD_FADE_S) this.head(i, travelled, ((1 - clamp01(landed / HEAD_FADE_S)) * 32) | 0);
    }
  }

  private path(trace: number, travelled: number, dim: number) {
    const pixels = this.pixels;
    const tail = this.tail;
    const ramp = BRAND_RAMP;
    const columns = GRADIENT_X;
    const rows = GRADIENT_Y;
    const keep = 32 - dim;
    const corners = this.corners;
    let walked = 0;
    for (let c = FIRST[trace]; c < FIRST[trace + 1] - 1; c++) {
      const x0 = corners[c * 2];
      const y0 = corners[c * 2 + 1];
      const x1 = corners[(c + 1) * 2];
      const y1 = corners[(c + 1) * 2 + 1];
      const stepX = x1 > x0 ? 1 : x1 < x0 ? -1 : 0;
      const stepY = y1 > y0 ? 1 : y1 < y0 ? -1 : 0;
      const length = Math.abs(x1 - x0) + Math.abs(y1 - y0);
      const shown = Math.min(length, travelled - walked);
      // The path is two pixels wide: the second beside a vertical run,
      // below a horizontal one.
      const beside = stepX === 0 ? 1 : WIDTH;
      for (let s = 0; s <= shown; s++) {
        const x = x0 + stepX * s;
        const y = y0 + stepY * s;
        const behind = travelled - walked - s;
        const colour = ramp[(columns[x] + rows[y]) & 255];
        let spread = (colour | (colour << 16)) & SPREAD;
        if (behind < TAIL_PX) {
          const white = tail[behind];
          spread = ((Math.imul(spread, 32 - white) + Math.imul(WHITE_SPREAD, white)) >>> 5) & SPREAD;
        }
        const ink = Math.imul(spread, dim);
        const at = (y * WIDTH + x) & PIXEL_MASK;
        const next = (at + beside) & PIXEL_MASK;
        const under = pixels[at];
        const beneath = pixels[next];
        const mixed = ((Math.imul((under | (under << 16)) & SPREAD, keep) + ink) >>> 5) & SPREAD;
        const nextMixed = ((Math.imul((beneath | (beneath << 16)) & SPREAD, keep) + ink) >>> 5) & SPREAD;
        pixels[at] = mixed | (mixed >>> 16);
        pixels[next] = nextMixed | (nextMixed >>> 16);
      }
      walked += length;
      if (walked >= travelled) return;
    }
  }

  // A soft cyan glow round the head, `strength` 0..32, fading once it lands.
  private head(trace: number, travelled: number, strength: number) {
    const corners = this.corners;
    let walked = 0;
    let x = 0;
    let y = 0;
    for (let c = FIRST[trace]; c < FIRST[trace + 1] - 1; c++) {
      const x0 = corners[c * 2];
      const y0 = corners[c * 2 + 1];
      const x1 = corners[(c + 1) * 2];
      const y1 = corners[(c + 1) * 2 + 1];
      const stepX = x1 > x0 ? 1 : x1 < x0 ? -1 : 0;
      const stepY = y1 > y0 ? 1 : y1 < y0 ? -1 : 0;
      const length = Math.abs(x1 - x0) + Math.abs(y1 - y0);
      const along = Math.min(length, travelled - walked);
      x = x0 + stepX * along + 1;
      y = y0 + stepY * along + 1;
      walked += length;
      if (walked >= travelled) break;
    }

    const pixels = this.pixels;
    const halo = this.halo;
    for (let dy = -HEAD_REACH; dy <= HEAD_REACH; dy++) {
      const py = y + dy;
      if (py < 0 || py >= HEIGHT) continue;

      for (let dx = -HEAD_REACH; dx <= HEAD_REACH; dx++) {
        const px = x + dx;
        const d2 = dx * dx + dy * dy;
        if (px < 0 || px >= WIDTH || d2 > HEAD_REACH * HEAD_REACH) continue;

        const light = (Math.imul(d2 <= 2 ? WHITE_SPREAD : CYAN_SPREAD, (halo[d2] * strength) >> 5) >>> 5) & SPREAD;
        addLight(pixels, (py * WIDTH + px) & PIXEL_MASK, light);
      }
    }
  }
}
