import { addLight, HALF_WIDTH, PIXEL_MASK, SPREAD, SURFACE_SPREAD, sinTurns, WIDTH, WORD_MASK } from "./frame";
import { BASE, BASE_GLOW, DOT, Logo, SPROUT, SPROUT_GLOW, STAR, STAR_GLOW, WORD, WORD_LEFT_COLUMN } from "./logo";
import {
  BAR_S,
  BAR_START,
  DOTS_S,
  DOTS_START,
  HOT_MS,
  SPARK,
  SPROUT_S,
  SPROUT_START,
  STAR_REVEAL_S,
  WORD_S,
  WORD_START,
} from "./timeline";

const STAR_HOT_MS = 560;
const HOT_ALPHA = 28; // how white a freshly revealed cell starts, of 32
const GLOW_FADE_MS = 300;
const GLOW_RATE = 109; // 32 / GLOW_FADE_MS, x 1024
const CORE_ORDER = 77; // star cells within 30 % of its reach twinkle
// The sheen is a slanted band 7 cells either side of its centre, measured in
// sixteenths of a cell.
const SHEEN_REACH = 112;
const SHEEN_SLANT = 7; // sixteenths of a cell per row
const SHEEN_WHITE = 26;

// Draws the logo's cells as they are revealed: each part in its order, every
// cell white-hot for its first moments, the glow rings fading in behind the
// strokes. Timing is in integer milliseconds and colours blend inline in
// spread form (see SPREAD), so the per-cell work stays integer.
export class Cells {
  private readonly logo = new Logo();
  private readonly words: Uint32Array;
  private readonly pixels: Uint16Array;
  // White blended into a cell by its age in 4 ms steps.
  private readonly hot = new Uint8Array(HOT_MS / 4 + 1);
  private readonly starHot = new Uint8Array(STAR_HOT_MS / 4 + 1);
  // The sheen's white by distance from its centre, in 4/16 cell steps.
  private readonly shine = new Uint8Array(SHEEN_REACH / 4 + 1);
  // Each wordmark cell's place across the sheen's slant.
  private readonly slant: Int16Array;

  constructor(pixels: Uint16Array, words: Uint32Array) {
    this.pixels = pixels;
    this.words = words;
    const logo = this.logo;
    logo.schedule(BASE, BAR_START, BAR_S);
    logo.schedule(BASE_GLOW, BAR_START, BAR_S);
    logo.schedule(SPROUT, SPROUT_START, SPROUT_S);
    logo.schedule(SPROUT_GLOW, SPROUT_START, SPROUT_S);
    logo.schedule(STAR, SPARK, STAR_REVEAL_S);
    logo.schedule(STAR_GLOW, SPARK, STAR_REVEAL_S);
    logo.schedule(DOT, SPARK + DOTS_START, DOTS_S);
    logo.schedule(WORD, WORD_START, WORD_S);

    for (let i = 0; i < this.hot.length; i++) {
      const fade = 1 - (i * 4) / HOT_MS;
      this.hot[i] = Math.round(fade * fade * HOT_ALPHA);
    }
    for (let i = 0; i < this.starHot.length; i++) {
      const fade = 1 - (i * 4) / STAR_HOT_MS;
      this.starHot[i] = Math.round(fade * fade * 32);
    }
    for (let i = 0; i < this.shine.length; i++) {
      const fade = 1 - (i * 4) / SHEEN_REACH;
      this.shine[i] = Math.round(fade * fade * SHEEN_WHITE);
    }
    this.slant = new Int16Array(logo.count);
    for (let i = 0; i < logo.count; i++) {
      this.slant[i] = (logo.column[i] - WORD_LEFT_COLUMN) * 16 + logo.row[i] * SHEEN_SLANT;
    }
  }

  // `glint` 0..32 whitens the star's core; `sheen` is the sheen's centre in
  // sixteenths of a cell, or far off the word when it is not crossing.
  draw(ms: number, glint: number, sheen: number, time: number) {
    this.reveal(BASE, ms);
    this.glow(BASE_GLOW, ms);
    this.reveal(SPROUT, ms);
    this.glow(SPROUT_GLOW, ms);
    this.glow(STAR_GLOW, ms);
    this.star(ms, glint);
    this.dots(ms, time);
    this.word(ms, sheen);
  }

  private reveal(part: number, ms: number) {
    const words = this.words;
    const hot = this.hot;
    const reveal = this.logo.revealMs;
    const spreads = this.logo.spread;
    const pairs = this.logo.pair;
    const cells = this.logo.word;
    const end = this.logo.start[part + 1];
    for (let i = this.logo.start[part]; i < end; i++) {
      const age = ms - reveal[i];
      if (age < 0) return;

      let pair = pairs[i];
      if (age < HOT_MS) {
        const white = hot[age >> 2];
        const mixed = ((Math.imul(spreads[i], 32 - white) + Math.imul(SPREAD, white)) >>> 5) & SPREAD;
        const colour = (mixed | (mixed >>> 16)) & 0xffff;
        pair = colour | (colour << 16);
      }
      const at = cells[i];
      words[at & WORD_MASK] = pair;
      words[(at + HALF_WIDTH) & WORD_MASK] = pair;
    }
  }

  // Glow cells add their light over whatever is below them.
  private glow(part: number, ms: number) {
    const pixels = this.pixels;
    const reveal = this.logo.revealMs;
    const spreads = this.logo.spread;
    const cells = this.logo.word;
    const end = this.logo.start[part + 1];
    for (let i = this.logo.start[part]; i < end; i++) {
      const age = ms - reveal[i];
      if (age < 0) return;

      const alpha = age < GLOW_FADE_MS ? (age * GLOW_RATE) >> 10 : 32;
      const light = (Math.imul(spreads[i], alpha) >>> 5) & SPREAD;
      const at = cells[i] * 2;
      addLight(pixels, at & PIXEL_MASK, light);
      addLight(pixels, (at + 1) & PIXEL_MASK, light);
      addLight(pixels, (at + WIDTH) & PIXEL_MASK, light);
      addLight(pixels, (at + WIDTH + 1) & PIXEL_MASK, light);
    }
  }

  // The star ignites from its core out, hot for longer; then its core glints.
  private star(ms: number, glint: number) {
    const words = this.words;
    const starHot = this.starHot;
    const reveal = this.logo.revealMs;
    const spreads = this.logo.spread;
    const order = this.logo.order;
    const cells = this.logo.word;
    const end = this.logo.start[STAR + 1];
    for (let i = this.logo.start[STAR]; i < end; i++) {
      const age = ms - reveal[i];
      if (age < 0) return;

      let white = order[i] < CORE_ORDER ? glint : 0;
      if (age < STAR_HOT_MS && starHot[age >> 2] > white) white = starHot[age >> 2];
      const mixed = ((Math.imul(spreads[i], 32 - white) + Math.imul(SPREAD, white)) >>> 5) & SPREAD;
      const colour = (mixed | (mixed >>> 16)) & 0xffff;
      const pair = colour | (colour << 16);
      const at = cells[i];
      words[at & WORD_MASK] = pair;
      words[(at + HALF_WIDTH) & WORD_MASK] = pair;
    }
  }

  // The sparkle dots pop in around the star, then breathe out of step.
  private dots(ms: number, time: number) {
    const words = this.words;
    const reveal = this.logo.revealMs;
    const spreads = this.logo.spread;
    const order = this.logo.order;
    const cells = this.logo.word;
    const end = this.logo.start[DOT + 1];
    for (let i = this.logo.start[DOT]; i < end; i++) {
      if (ms < reveal[i]) return;

      const breath = 0.5 + 0.5 * sinTurns(time / 1.9 + order[i] / 128);
      const alpha = (14 + breath * 18) | 0;
      const mixed = ((Math.imul(SURFACE_SPREAD, 32 - alpha) + Math.imul(spreads[i], alpha)) >>> 5) & SPREAD;
      const colour = (mixed | (mixed >>> 16)) & 0xffff;
      const pair = colour | (colour << 16);
      const at = cells[i];
      words[at & WORD_MASK] = pair;
      words[(at + HALF_WIDTH) & WORD_MASK] = pair;
    }
  }

  // The wordmark dissolves in, each cell white-hot as it lands, and the
  // sheen whitens a slanted band as it crosses.
  private word(ms: number, sheen: number) {
    const words = this.words;
    const hot = this.hot;
    const shine = this.shine;
    const centre = sheen | 0;
    const slant = this.slant;
    const reveal = this.logo.revealMs;
    const spreads = this.logo.spread;
    const pairs = this.logo.pair;
    const cells = this.logo.word;
    const end = this.logo.start[WORD + 1];
    for (let i = this.logo.start[WORD]; i < end; i++) {
      const age = ms - reveal[i];
      if (age < 0) return;

      let white = age < HOT_MS ? hot[age >> 2] : 0;
      const across = Math.abs(slant[i] - centre);
      if (across < SHEEN_REACH && shine[across >> 2] > white) white = shine[across >> 2];
      let pair = pairs[i];
      if (white > 0) {
        const mixed = ((Math.imul(spreads[i], 32 - white) + Math.imul(SPREAD, white)) >>> 5) & SPREAD;
        const colour = (mixed | (mixed >>> 16)) & 0xffff;
        pair = colour | (colour << 16);
      }
      const at = cells[i];
      words[at & WORD_MASK] = pair;
      words[(at + HALF_WIDTH) & WORD_MASK] = pair;
    }
  }
}
