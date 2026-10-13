import { CELL_SIZE, GRID_H, GRID_W, IMAGE_H, IMAGE_W } from "./layout";

// A grid cell covers 4 x 4 panel pixels. The four pixels of a cell sit at
// -3/8, -1/8, +1/8 and +3/8 of a cell from its centre, so bilinear taps (of 8)
// are 5:3, 7:1, 7:1, 5:3: the first two blend with the previous cell, the last
// two with the next.
const TAPS = 8;

// Tone (padded grid, at most 16384) and the vertically blended rows (at most
// 65536) are indexed through power-of-two masks, `& 16383` and `& 65535`: a
// masked index needs no per-loop range proof, which is what keeps the per-row
// loop cheap. The masks are spelled as literals because only a literal mask is
// recognised.
const ROWS_SIZE = 65536; // >= GRID_W * IMAGE_H

// Bilinear 4x upscale of the tone grid, in integers, mapped through a
// 256-entry RGB565 palette. Vertical first (one blended row per image row,
// gridW wide), then horizontal in one flat sweep over the image: pixel p
// belongs to blended cell p / 4. The field is a torus, so the first and last
// cell of a row blend with each other.
export class Upscaler {
  private readonly rows = new Uint16Array(ROWS_SIZE);
  private readonly gridW = GRID_W;
  private readonly gridH = GRID_H;
  private readonly width = IMAGE_W;
  private readonly height = IMAGE_H;
  private readonly pitch = GRID_W + 2;

  draw(tone: Uint8Array, palette: Uint16Array, pixels: Uint16Array) {
    this.blendRows(tone);
    this.expandRows(palette, pixels);
    this.wrapRowEnds(palette, pixels);
  }

  private blendRows(tone: Uint8Array) {
    const rows = this.rows;
    const gridW = this.gridW | 0;
    const lastCell = (this.gridH | 0) - 1;
    const pitch = this.pitch | 0;
    const height = this.height | 0;

    for (let y = 0; y < height; y++) {
      const cell = y >> 2;
      const sub = y & 3;
      const other = sub < 2 ? Math.max(cell - 1, 0) : Math.min(cell + 1, lastCell);
      // `| 0` keeps these int32, so `(near + x) & 16383` below is plain integer
      // math; unbounded, the offsets are wide integers checked on every add.
      const near = ((cell + 1) * pitch + 1) | 0;
      const far = ((other + 1) * pitch + 1) | 0;
      const nearWeight = sub === 1 || sub === 2 ? 7 : 5;
      const farWeight = TAPS - nearWeight;
      const row = (y * gridW) | 0;

      for (let x = 0; x < gridW; x++) {
        const blended = tone[(near + x) & 16383] * nearWeight + tone[(far + x) & 16383] * farWeight;
        rows[(row + x) & 65535] = blended;
      }
    }
  }

  // Cell p / 4 spans pixels p..p+3 and blends with the cells either side.
  private expandRows(palette: Uint16Array, pixels: Uint16Array) {
    const rows = this.rows;
    const lastQuad = ((this.width | 0) * (this.height | 0) - CELL_SIZE) | 0;
    const second = 1;
    const third = 2;
    const fourth = 3;
    let previous = rows[0];
    let centre = rows[0];

    for (let p = 0; p <= lastQuad; p += 4) {
      const next = rows[((p >> 2) + 1) & 65535];
      pixels[p] = palette[((previous * 3 + centre * 5) >> 6) & 255];
      pixels[p + second] = palette[((previous + centre * 7) >> 6) & 255];
      pixels[p + third] = palette[((centre * 7 + next) >> 6) & 255];
      pixels[p + fourth] = palette[((centre * 5 + next * 3) >> 6) & 255];
      previous = centre;
      centre = next;
    }
  }

  // The flat sweep blended each row's end with the neighbouring row; redo the
  // outer two pixels at both ends with the cell across the wrap.
  private wrapRowEnds(palette: Uint16Array, pixels: Uint16Array) {
    const rows = this.rows;
    const width = this.width | 0;
    const gridW = this.gridW | 0;
    const second = 1;
    const secondLast = width - 2;
    const last = width - 1;
    const lastCell = gridW - 1;
    const lastLine = (width * ((this.height | 0) - 1)) | 0;
    let i = 0;

    for (let line = 0; line <= lastLine; line += width) {
      const first = rows[i & 65535];
      const final = rows[(i + lastCell) & 65535];
      pixels[line] = palette[((final * 3 + first * 5) >> 6) & 255];
      pixels[line + second] = palette[((final + first * 7) >> 6) & 255];
      pixels[line + secondLast] = palette[((final * 7 + first) >> 6) & 255];
      pixels[line + last] = palette[((final * 5 + first * 3) >> 6) & 255];
      i += gridW;
    }
  }
}
