import { Cells } from "./cells";
import {
  addLight,
  BRAND_RAMP,
  clamp01,
  ease,
  FLOW_RAMP,
  GRADIENT_X,
  GRADIENT_Y,
  HALF_WIDTH,
  HEIGHT,
  hash,
  OVERLAY_LEFT,
  OVERLAY_TOP,
  PIXEL_MASK,
  SPREAD,
  SURFACE,
  SURFACE_SPREAD,
  sinTurns,
  WHITE_SPREAD,
  WIDTH,
} from "./frame";
import { LOGO_CENTRE_X, LOGO_WIDTH, LOGO_X, LOGO_Y } from "./logo";
import { Spark } from "./spark";
import {
  DUST_FADE_S,
  DUST_IN,
  FLOW_S,
  GRID_FADE_S,
  GRID_IN,
  RULE_S,
  RULE_START,
  SHEEN_S,
  SHEEN_START,
  TRACE_REMNANT,
  TRACES_DIM_S,
  TRACES_DIM_START,
  TRACES_OUT_S,
  TRACES_OUT_START,
  TWINKLE_S,
  TYPE_SETTLED,
} from "./timeline";
import { Titles } from "./titles";
import { Traces } from "./traces";

// The hairline and the rows the name and tagline occupy below it: 170, 180
// and 236 on the 480x272 stage, which sits OY rows down the panel.
const RULE_Y = (LOGO_Y + 138) | 0;
const TYPE_TOP = (LOGO_Y + 148) | 0;
const TYPE_BOTTOM = (LOGO_Y + 204) | 0;
const SCREEN_WORDS = (HEIGHT * HALF_WIDTH) | 0;
const TYPE_TOP_WORD = (TYPE_TOP * HALF_WIDTH) | 0;
const TYPE_BOTTOM_WORD = (TYPE_BOTTOM * HALF_WIDTH) | 0;
const DUST_COUNT = 26;
const SHEEN_OFF = -32768; // sheen centre while it is not crossing

// Renders the intro at a point in time into an RGB565 frame, back to front:
// surface, the star's glow, the board's grid and dust, traces, the logo's
// cells, the spark's flare and burst, the hairline and the type. Every
// pixel is a function of the clock alone.
export class Painter {
  private readonly pixels: Uint16Array;
  private readonly words: Uint32Array;
  private readonly spark: Spark;
  private readonly traces: Traces;
  private readonly cells: Cells;
  private readonly titles: Titles;
  // Per dust mote: x, starting y, rise speed, sway rate.
  private readonly motes = new Float32Array(DUST_COUNT * 4);
  // Whether the settled type is already in the frame (see paint).
  private typeset = false;

  constructor(pixels: Uint16Array) {
    this.pixels = pixels;
    const buffer: ArrayBuffer = pixels.buffer as ArrayBuffer;
    this.words = new Uint32Array(buffer);
    this.spark = new Spark(pixels, this.words);
    this.traces = new Traces(pixels);
    this.cells = new Cells(pixels, this.words);
    this.titles = new Titles(pixels);
    for (let i = 0; i < DUST_COUNT; i++) {
      const seed = hash(i + 101);
      this.motes[i * 4] = 12 + (seed % (WIDTH - 28));
      this.motes[i * 4 + 1] = (seed >>> 9) % HEIGHT;
      this.motes[i * 4 + 2] = 3 + ((seed >>> 17) & 7); // px per second
      this.motes[i * 4 + 3] = 1 / (5 + ((seed >>> 20) & 3)); // sways per second
    }
  }

  paint(time: number) {
    const ms = (time * 1000) | 0;
    const twinkle = this.twinkle(time);
    const board = ease((time - GRID_IN) / GRID_FADE_S) * (1 - clamp01((time - TRACES_OUT_START) / TRACES_OUT_S));
    // Once the type has settled it stays in the frame: later frames leave
    // its band uncleared and undrawn.
    const keepType = this.typeset && time >= TYPE_SETTLED;
    this.clear(keepType);
    this.spark.bloom(time, twinkle);
    this.traces.grid(board);
    this.dust(time, keepType);
    this.traces.draw(time, this.traceLevel(time));
    const glint = (twinkle * 18) | 0;
    const sheen = this.sheen(time) | 0;
    this.cells.draw(ms, glint, sheen, time);
    this.spark.flare(time);
    this.spark.burst(time);
    this.rule(time);
    if (!keepType) this.titles.draw(time);
    this.typeset = time >= TYPE_SETTLED;
  }

  // The whole surface, or all of it but the type band.
  private clear(keepType: boolean) {
    const words = this.words;
    const surface = SURFACE | (SURFACE << 16);
    if (!keepType) {
      words.fill(surface, 0, SCREEN_WORDS);
      return;
    }

    words.fill(surface, 0, TYPE_TOP_WORD);
    words.fill(surface, TYPE_BOTTOM_WORD, SCREEN_WORDS);
  }

  // 0..1, a soft pulse with a brief glint at its peak.
  private twinkle(time: number): number {
    const wave = 0.5 + 0.5 * sinTurns(time / TWINKLE_S);
    const glint = wave * wave * wave * wave;
    return 0.6 * wave + 0.4 * glint * glint;
  }

  private traceLevel(time: number): number {
    if (time < TRACES_DIM_START) return 1;

    const dimmed = 1 - (1 - TRACE_REMNANT) * ease((time - TRACES_DIM_START) / TRACES_DIM_S);
    return dimmed * (1 - clamp01((time - TRACES_OUT_START) / TRACES_OUT_S));
  }

  // The sheen's centre across the wordmark, in sixteenths of a cell.
  private sheen(time: number): number {
    const progress = (time - SHEEN_START) / SHEEN_S;
    if (progress <= 0 || progress >= 1) return SHEEN_OFF;

    return ((-16 + 118 * ease(progress)) * 16) | 0;
  }

  // Faint motes in the brand gradient, drifting up with a slow sway, kept
  // out of the type band once the type is cached there.
  private dust(time: number, aroundType: boolean) {
    const since = time - DUST_IN;
    const fade = clamp01(since / DUST_FADE_S);
    if (fade <= 0) return;

    const pixels = this.pixels;
    const motes = this.motes;
    for (let i = 0; i < DUST_COUNT; i++) {
      const at4 = i * 4;
      const rise = motes[at4 + 1] - motes[at4 + 2] * since;
      const x = (motes[at4] + sinTurns(since * motes[at4 + 3] + i * 0.37) * 5) | 0;
      const y = (rise - Math.floor(rise / HEIGHT) * HEIGHT) | 0;
      if ((x >= OVERLAY_LEFT && y >= OVERLAY_TOP) || y >= HEIGHT - 1) continue;
      if (aroundType && y >= TYPE_TOP - 1 && y < TYPE_BOTTOM) continue;

      const alpha = (fade * (10 + (i & 7))) | 0;
      const colour = BRAND_RAMP[(GRADIENT_X[x] + GRADIENT_Y[y]) & 255];
      const light = (Math.imul((colour | (colour << 16)) & SPREAD, alpha) >>> 5) & SPREAD;
      const at = y * WIDTH + x;
      addLight(pixels, at & PIXEL_MASK, light);
      if ((i & 1) === 0) continue;

      addLight(pixels, (at + 1) & PIXEL_MASK, light);
      addLight(pixels, (at + WIDTH) & PIXEL_MASK, light);
      addLight(pixels, (at + WIDTH + 1) & PIXEL_MASK, light);
    }
  }

  // The hairline under the lockup grows from the centre with white-hot tips;
  // once drawn, its palindromic gradient slowly flows along it.
  private rule(time: number) {
    const grow = ease((time - RULE_START) / RULE_S);
    if (grow <= 0) return;

    const pixels = this.pixels;
    const half = ((LOGO_WIDTH / 2) * grow) | 0;
    const left = LOGO_CENTRE_X - half;
    const right = LOGO_CENTRE_X + half;
    const flowing = time - RULE_START - RULE_S;
    const offset = flowing > 0 ? ((flowing / FLOW_S) * 256) | 0 : 0;
    const tip = ((1 - grow) * 32) | 0;
    const top = RULE_Y * WIDTH;
    const surface = Math.imul(SURFACE_SPREAD, 23); // the lower row: 9/32 line
    const ramp = FLOW_RAMP;
    for (let x = left; x < right; x++) {
      const colour = ramp[((((x - LOGO_X) * 449) >> 10) + offset) & 255];
      let spread = (colour | (colour << 16)) & SPREAD;
      const fromEnd = Math.min(x - left, right - 1 - x);
      if (fromEnd < 6) {
        const white = ((tip * (6 - fromEnd)) / 6) | 0;
        spread = ((Math.imul(spread, 32 - white) + Math.imul(WHITE_SPREAD, white)) >>> 5) & SPREAD;
      }
      const shade = ((surface + Math.imul(spread, 9)) >>> 5) & SPREAD;
      pixels[(top + x) & PIXEL_MASK] = spread | (spread >>> 16);
      pixels[(top + WIDTH + x) & PIXEL_MASK] = shade | (shade >>> 16);
    }
  }
}
