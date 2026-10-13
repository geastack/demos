// Gray-Scott reaction-diffusion on a coarse grid that wraps at every edge.
// Each cell holds two chemicals: U, the feed, and V, which grows by eating U.
//
// The hot loops follow the compiler's fast shapes: typed arrays in `const`
// locals, `cell + offset` indices, and float math that stays float because
// every step is stored into a Float32Array or wrapped in Math.fround. Each
// sweep is ONE flat loop over the padded grid: every loop entry proves its
// index ranges once, and that proof is costly, so it is paid per sweep rather
// than per row.

import { GRID_H, GRID_W } from "./layout";

/** Tone storage: the padded grid (at most 122 x 122), rounded up to a power of two for masked reads. */
export const TONE_SIZE = 16384;

const SEED_RADIUS = 3;
const SEED_U = 0.5;
const SEED_V = 0.25;

// Tone = V * gain, lifted by V's slope toward the light (up-left) for relief.
const TONE_GAIN = 520;
const TONE_RELIEF = 900;
// Adding 1.5 * 2^23 to a float leaves round(value) + 2^22 in the low mantissa
// bits: a float to integer conversion without leaving float math.
const ROUND_MAGIC = 12582912;
const MANTISSA = 0x7fffff;
const MAGIC_OFFSET = 0x400000;

export class Reaction {
  /** Shaded tone per cell, 0..255, in the padded layout (ghost columns included). */
  readonly tone = new Uint8Array(TONE_SIZE);

  // One ghost cell around the grid mirrors the opposite edge (a torus): cell
  // (x, y) lives at (y + 1) * pitch + x + 1.
  private readonly gridW = GRID_W;
  private readonly gridH = GRID_H;
  private readonly pitch = GRID_W + 2;
  private readonly cells = (GRID_W + 2) * (GRID_H + 2);
  private u: Float32Array;
  private v: Float32Array;
  private nextU: Float32Array;
  private nextV: Float32Array;
  // Rounded tone as floats, and the same bytes read back as integers.
  private readonly rounded: Float32Array;
  private readonly roundedBits: Int32Array;
  private feed = 0;
  private kill = 0;

  constructor() {
    this.u = new Float32Array(this.cells);
    this.v = new Float32Array(this.cells);
    this.nextU = new Float32Array(this.cells);
    this.nextV = new Float32Array(this.cells);
    const roundBuffer = new ArrayBuffer(this.cells * 4);
    this.rounded = new Float32Array(roundBuffer);
    this.roundedBits = new Int32Array(roundBuffer);
    this.clear();
  }

  setRates(feed: number, kill: number) {
    this.feed = feed;
    this.kill = kill;
  }

  clear() {
    this.u.fill(1);
    this.v.fill(0);
  }

  /** Drops a disc of V at a grid cell. */
  seed(cellX: number, cellY: number) {
    for (let dy = -SEED_RADIUS; dy <= SEED_RADIUS; dy++) {
      for (let dx = -SEED_RADIUS; dx <= SEED_RADIUS; dx++) {
        if (dx * dx + dy * dy > SEED_RADIUS * SEED_RADIUS) continue;

        const x = (cellX + dx + this.gridW) % this.gridW;
        const y = (cellY + dy + this.gridH) % this.gridH;
        const cell = (y + 1) * this.pitch + x + 1;
        this.u[cell] = SEED_U;
        this.v[cell] = SEED_V;
      }
    }
  }

  /**
   * One step with a 9-point Laplacian (0.2 edges, 0.05 corners), diffusion
   * 1.0 for U and 0.5 for V, folded into the weights:
   *   U' = 0.2 E + 0.05 C - UVV + f (1 - U)
   *   V' = 0.1 E + 0.025 C + UVV + V (0.5 - f - k)
   * The sweep also runs over the ghost columns; wrapEdges overwrites them.
   */
  step() {
    this.wrapEdges();

    const u = this.u;
    const v = this.v;
    const nextU = this.nextU;
    const nextV = this.nextV;
    const edgeU = Math.fround(0.2);
    const cornerU = Math.fround(0.05);
    const edgeV = Math.fround(0.1);
    const cornerV = Math.fround(0.025);
    const feed = Math.fround(this.feed);
    const keepV = Math.fround(0.5 - this.feed - this.kill);
    const left = -1;
    const right = 1;
    const pitch = this.pitch | 0;
    const up = -pitch;
    const down = pitch;
    const upLeft = -pitch - 1;
    const upRight = -pitch + 1;
    const downLeft = pitch - 1;
    const downRight = pitch + 1;
    const first = pitch + 1;
    const end = ((this.gridH | 0) + 1) * pitch - 1;

    for (let c = first; c < end; c++) {
      const uc = u[c];
      const vc = v[c];
      const edgesU = Math.fround(Math.fround(u[c + left] + u[c + right]) + Math.fround(u[c + up] + u[c + down]));
      const cornersU = Math.fround(
        Math.fround(u[c + upLeft] + u[c + upRight]) + Math.fround(u[c + downLeft] + u[c + downRight]),
      );
      const edgesV = Math.fround(Math.fround(v[c + left] + v[c + right]) + Math.fround(v[c + up] + v[c + down]));
      const cornersV = Math.fround(
        Math.fround(v[c + upLeft] + v[c + upRight]) + Math.fround(v[c + downLeft] + v[c + downRight]),
      );
      const spreadU = Math.fround(Math.fround(edgesU * edgeU) + Math.fround(cornersU * cornerU));
      const spreadV = Math.fround(Math.fround(edgesV * edgeV) + Math.fround(cornersV * cornerV));
      const uvv = Math.fround(Math.fround(uc * vc) * vc);
      const fed = Math.fround(feed - Math.fround(feed * uc));

      nextU[c] = Math.fround(spreadU - uvv) + fed;
      nextV[c] = Math.fround(spreadV + uvv) + Math.fround(vc * keepV);
    }

    this.u = nextU;
    this.v = nextV;
    this.nextU = u;
    this.nextV = v;
  }

  /** Tone per cell: V, lifted where the surface faces the light. */
  shade() {
    this.wrapEdges();

    const v = this.v;
    const tone = this.tone;
    const rounded = this.rounded;
    const roundedBits = this.roundedBits;
    const gain = Math.fround(TONE_GAIN);
    const relief = Math.fround(TONE_RELIEF);
    const left = -1;
    const right = 1;
    const pitch = this.pitch | 0;
    const up = -pitch;
    const down = pitch;
    const first = pitch;
    const end = ((this.gridH | 0) + 1) * pitch;

    for (let c = first; c < end; c++) {
      const slope = Math.fround(Math.fround(v[c + left] - v[c + right]) + Math.fround(v[c + up] - v[c + down]));
      const lit = Math.fround(Math.fround(v[c] * gain) + Math.fround(slope * relief));
      rounded[c] = lit + ROUND_MAGIC;
      const level = (roundedBits[c] & MANTISSA) - MAGIC_OFFSET;
      tone[c] = Math.min(255, Math.max(0, level));
    }
  }

  // Ghost rows first, then ghost columns over every row, so the corners wrap too.
  private wrapEdges() {
    const u = this.u;
    const v = this.v;
    const pitch = this.pitch | 0;
    const gridW = this.gridW | 0;
    const firstRow = pitch;
    const gridH = this.gridH | 0;
    const lastRow = gridH * pitch;
    const bottomGhostRow = (gridH + 1) * pitch;

    for (let x = 0; x < pitch; x++) {
      u[x] = u[lastRow + x];
      v[x] = v[lastRow + x];
      u[bottomGhostRow + x] = u[firstRow + x];
      v[bottomGhostRow + x] = v[firstRow + x];
    }

    const lastColumn = gridW;
    const rightGhost = gridW + 1;
    const firstColumn = 1;
    for (let row = 0; row <= bottomGhostRow; row += pitch) {
      u[row] = u[row + lastColumn];
      v[row] = v[row + lastColumn];
      u[row + rightGhost] = u[row + firstColumn];
      v[row + rightGhost] = v[row + firstColumn];
    }
  }
}
