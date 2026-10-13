import { LOGO_CELLS_HEX, LOGO_PART_SIZES } from "../data/logo";
import { OY, SPREAD, WIDTH } from "./frame";

// The baked pixel-art logo (scripts/bake-logo.mjs) as flat arrays, one entry
// per cell. A cell is 2x2 panel pixels; the cells of part p are
// [start[p], start[p + 1]), earliest revealed first.

export const BASE = 0;
export const SPROUT = 1;
export const STAR = 2;
export const DOT = 3;
export const WORD = 4;
export const BASE_GLOW = 5;
export const SPROUT_GLOW = 6;
export const STAR_GLOW = 7;
export const PARTS = 8;

// Placement on the panel: the 146x60 grid at 2 px per cell, centred
// horizontally (x even so a cell's pixel pair is one 32-bit word) and, with
// the rest of the 480x272 stage, vertically. 94 and 32 at 480x272.
export const CELL_PX = 2;
export const LOGO_WIDTH = 292;
export const LOGO_X = ((WIDTH - LOGO_WIDTH) >> 1) & ~1;
export const LOGO_Y = (32 + OY) | 0;
export const LOGO_CENTRE_X = (LOGO_X + (LOGO_WIDTH >> 1)) | 0;

// The star's core (the bake's cell 39.5, 11.5) and the wordmark's first
// column.
export const STAR_X = (LOGO_X + 80) | 0;
export const STAR_Y = (LOGO_Y + 24) | 0;
export const WORD_LEFT_COLUMN = 62;

const DIGITS = 10; // hex digits per cell

function hexDigit(code: number): number {
  return code < 58 ? code - 48 : code - 87;
}

export class Logo {
  readonly count: number;
  readonly start = new Int32Array(PARTS + 1);
  // Per cell: its top-left 32-bit word in the frame (the row below is
  // HALF_WIDTH words on), its colour and that colour doubled into a word,
  // that colour spread for blending (see SPREAD), its grid position, and its
  // reveal order 0..255 inside its part.
  readonly word: Int32Array;
  readonly colour: Uint16Array;
  readonly pair: Uint32Array;
  readonly spread: Int32Array;
  readonly column: Uint8Array;
  readonly row: Uint8Array;
  readonly order: Uint8Array;
  // When each cell appears, in ms from the start (see schedule()).
  readonly revealMs: Int32Array;

  constructor() {
    for (let p = 0; p < PARTS; p++) this.start[p + 1] = this.start[p] + LOGO_PART_SIZES[p];
    const count = this.start[PARTS];
    this.count = count;
    this.word = new Int32Array(count);
    this.colour = new Uint16Array(count);
    this.pair = new Uint32Array(count);
    this.spread = new Int32Array(count);
    this.column = new Uint8Array(count);
    this.row = new Uint8Array(count);
    this.order = new Uint8Array(count);
    this.revealMs = new Int32Array(count);

    const values = new Int32Array(DIGITS);
    let cell = 0;
    for (let l = 0; l < LOGO_CELLS_HEX.length; l++) {
      const line = LOGO_CELLS_HEX[l];
      for (let at = 0; at < line.length; at += DIGITS) {
        for (let d = 0; d < DIGITS; d++) values[d] = hexDigit(line.charCodeAt(at + d));
        const column = values[0] * 16 + values[1];
        const row = values[2] * 16 + values[3];
        const colour = ((values[4] * 16 + values[5]) << 8) | (values[6] * 16 + values[7]);
        this.word[cell] = ((LOGO_Y + row * CELL_PX) * WIDTH + LOGO_X + column * CELL_PX) >> 1;
        this.colour[cell] = colour;
        this.pair[cell] = colour | (colour << 16);
        this.spread[cell] = (colour | (colour << 16)) & SPREAD;
        this.column[cell] = column;
        this.row[cell] = row;
        this.order[cell] = values[8] * 16 + values[9];
        cell++;
      }
    }
  }

  // Spreads a part's reveal over `spanS` seconds from `startS`, by order.
  schedule(part: number, startS: number, spanS: number) {
    for (let i = this.start[part]; i < this.start[part + 1]; i++) {
      this.revealMs[i] = Math.round((startS + (spanS * this.order[i]) / 255) * 1000);
    }
  }
}
