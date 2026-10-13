// Bakes the pixel-art logo (assets/logo.png, the website's logo.webp) into
// src/data/logo.ts. The logo is drawn on a grid of about 5.5 source pixels,
// so it is resampled onto that grid: a cell is lit when its pixels are mostly
// opaque, and takes their alpha-weighted colour, snapped to RGB565.
//
// Each lit cell also gets a part (base bar, sprout, star, sparkle dot or
// wordmark) and a reveal order 0..255 inside its part, which the intro plays
// back: the bar fills from its ends, the sprout grows along its strokes from
// the stem's root, the star ignites from its core and the wordmark dissolves
// in left to right. Neon glow cells ring the mark's strokes.
//
// Run from the app folder: `npm run logo` (add a PNG path to also write a
// preview of the grid).

import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "assets/logo.png";
const OUTPUT = "src/data/logo.ts";
const LEFT = 2; // the logo's opaque bounds in the source
const TOP = 2;
const COLS = 146;
const ROWS = 60;
const CELL = 5.5;
const COVERAGE = 0.45;
const DOT_COVERAGE = 0.2; // the sparkle dots are faint
const WORD_COL = 56; // the wordmark starts right of this column
const BAR_ROW = 52; // the base bar's top row
const STAR = { col: 39.5, row: 11.5, reach: 12 }; // the star's core and ray length
const GLOW_RADIUS = 2;
const GLOW_GAIN = 0.12;
const GLOW_FLOOR = 20; // dimmest glow kept, as the brightest channel 0..255

// Parts, as src/lib/logo.ts reads them. A glow cell's part is GLOW plus the
// part it rings.
const BASE = 0;
const SPROUT = 1;
const STAR_PART = 2;
const DOT = 3;
const WORD = 4;
const GLOW = 5;
const PARTS = 8; // five parts and the glow rings of the bar, sprout and star

const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const index = (col, row) => row * COLS + col;
const inside = (col, row) => col >= 0 && row >= 0 && col < COLS && row < ROWS;

// Resample onto the grid.
const lit = new Uint8Array(COLS * ROWS);
const colour = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    let alpha = 0;
    let count = 0;
    const rgb = [0, 0, 0];
    for (let y = Math.floor(TOP + row * CELL); y < Math.floor(TOP + (row + 1) * CELL); y++) {
      for (let x = Math.floor(LEFT + col * CELL); x < Math.floor(LEFT + (col + 1) * CELL); x++) {
        count++;
        if (x >= info.width || y >= info.height) continue;

        const at = (y * info.width + x) * 4;
        const a = data[at + 3] / 255;
        alpha += a;
        for (let c = 0; c < 3; c++) rgb[c] += data[at + c] * a;
      }
    }
    const nearStar = Math.abs(col - STAR.col) <= STAR.reach && Math.abs(row - STAR.row) <= STAR.reach;
    const threshold = nearStar ? DOT_COVERAGE : COVERAGE;
    colour.push(rgb.map((v) => (alpha > 0 ? v / alpha : 0)));
    lit[index(col, row)] = alpha / count > threshold ? 1 : 0;
  }
}

// Connected parts of the mark, 8-neighbour.
function component(start) {
  const cells = [start];
  const seen = new Set(cells);
  for (let i = 0; i < cells.length; i++) {
    const col = cells[i] % COLS;
    const row = Math.floor(cells[i] / COLS);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const next = index(col + dx, row + dy);
        if (!inside(col + dx, row + dy) || !lit[next] || seen.has(next)) continue;

        seen.add(next);
        cells.push(next);
      }
    }
  }
  return cells;
}

const part = new Int8Array(COLS * ROWS).fill(-1);
const starCore = index(Math.floor(STAR.col), Math.floor(STAR.row));
for (const cell of component(starCore)) part[cell] = STAR_PART;
for (let i = 0; i < part.length; i++) {
  if (!lit[i] || part[i] >= 0) continue;

  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const nearStar = Math.abs(col - STAR.col) <= STAR.reach && Math.abs(row - STAR.row) <= STAR.reach;
  if (col > WORD_COL) part[i] = WORD;
  else if (nearStar) part[i] = DOT;
  else if (row >= BAR_ROW) part[i] = BASE;
  else part[i] = SPROUT;
}

// Reveal orders, 0..1 before scaling.
const order = new Float64Array(COLS * ROWS);
const cellsOf = (p) => [...part.keys()].filter((i) => part[i] === p);
const hash = (i) => ((Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) >>> 0) % 1000) / 1000;

// The sprout's root: its lowest cell, where the stem meets the bar.
const sprout = cellsOf(SPROUT);
const root = sprout.reduce((a, b) => (Math.floor(b / COLS) > Math.floor(a / COLS) ? b : a));
const rootCol = root % COLS;

// Base bar: from both ends in to the root.
const base = cellsOf(BASE);
const reach = Math.max(...base.map((i) => Math.abs((i % COLS) - rootCol)));
for (const i of base) order[i] = 1 - Math.abs((i % COLS) - rootCol) / reach;

// Sprout: stroke distance from the root. A stroke that does not touch the
// others starts where it comes closest to cells already reached.
const distance = new Map([[root, 0]]);
let frontier = [root];
while (distance.size < sprout.length) {
  for (let i = 0; i < frontier.length; i++) {
    const cell = frontier[i];
    const col = cell % COLS;
    const row = Math.floor(cell / COLS);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const next = index(col + dx, row + dy);
        if (!inside(col + dx, row + dy) || part[next] !== SPROUT || distance.has(next)) continue;

        distance.set(next, distance.get(cell) + Math.hypot(dx, dy));
        frontier.push(next);
      }
    }
  }
  if (distance.size === sprout.length) break;

  // Jump the gap to the nearest unreached cell.
  let best = null;
  for (const cell of sprout) {
    if (distance.has(cell)) continue;

    for (const [reached, d] of distance) {
      const gap = Math.hypot((cell % COLS) - (reached % COLS), Math.floor(cell / COLS) - Math.floor(reached / COLS));
      if (!best || gap + d < best.d) best = { cell, d: gap + d };
    }
  }
  distance.set(best.cell, best.d);
  frontier = [best.cell];
}
const longest = Math.max(...distance.values());
for (const [cell, d] of distance) order[cell] = d / longest;

// Star: out from the core; dots in turn around it.
for (const i of cellsOf(STAR_PART)) {
  order[i] = Math.hypot((i % COLS) - STAR.col, Math.floor(i / COLS) - STAR.row) / STAR.reach;
}
for (const i of cellsOf(DOT)) {
  const angle = Math.atan2(Math.floor(i / COLS) - STAR.row, (i % COLS) - STAR.col);
  order[i] = (angle / (2 * Math.PI) + 1.125) % 1;
}

// Wordmark: a left-to-right sweep with scatter.
const word = cellsOf(WORD);
const wordLeft = Math.min(...word.map((i) => i % COLS));
const wordWidth = Math.max(...word.map((i) => i % COLS)) - wordLeft;
for (const i of word) order[i] = 0.62 * (((i % COLS) - wordLeft) / wordWidth) + 0.38 * hash(i);

// Neon glow around the mark's strokes: a soft ring of dim cells tinted by
// their lit neighbours, shown once the nearest of those is revealed.
const glow = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col <= WORD_COL; col++) {
    const i = index(col, row);
    if (lit[i]) continue;

    const rgb = [0, 0, 0];
    let first = 1;
    let owner = -1;
    let strongest = 0;
    for (let dy = -GLOW_RADIUS; dy <= GLOW_RADIUS; dy++) {
      for (let dx = -GLOW_RADIUS; dx <= GLOW_RADIUS; dx++) {
        const j = index(col + dx, row + dy);
        if (!inside(col + dx, row + dy) || !lit[j] || part[j] === DOT) continue;

        const weight = Math.exp(-(dx * dx + dy * dy) / 2.2);
        for (let c = 0; c < 3; c++) rgb[c] += colour[j][c] * weight * GLOW_GAIN;
        first = Math.min(first, order[j]);
        if (weight > strongest) {
          strongest = weight;
          owner = part[j];
        }
      }
    }
    const peak = Math.max(...rgb);
    if (peak < GLOW_FLOOR) continue;

    const scale = Math.min(1, 255 / peak);
    colour[i] = rgb.map((v) => v * scale);
    glow.push(i);
    part[i] = GLOW + owner; // the glow shows with the part it rings
    order[i] = first;
  }
}

const hex = (value, digits) => value.toString(16).padStart(digits, "0");
const rgb565 = ([r, g, b]) => ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);

// Cells part by part, each part in reveal order; a cell is four hex fields:
// column (2), row (2), RGB565 colour (4) and order 0..255 (2).
const sizes = [];
let cells = "";
for (let p = 0; p < PARTS; p++) {
  const members = cellsOf(p).sort((a, b) => order[a] - order[b]);
  sizes.push(members.length);
  for (const i of members) {
    const rgb = colour[i].map((v) => Math.round(Math.min(255, v)));
    cells += hex(i % COLS, 2) + hex(Math.floor(i / COLS), 2) + hex(rgb565(rgb), 4) + hex(Math.round(order[i] * 255), 2);
  }
}
const lines = cells.match(/.{1,110}/g);

const source = `// Generated by scripts/bake-logo.mjs from assets/logo.png. Do not edit.
// The cells part by part (sizes below), each part in reveal order. A cell is
// ten hex digits: column (2), row (2), RGB565 colour (4), order 0..255 (2).

export const LOGO_COLS = ${COLS};
export const LOGO_ROWS = ${ROWS};
export const LOGO_PART_SIZES = [${sizes.join(", ")}];

export const LOGO_CELLS_HEX = [
${lines.map((line) => `  "${line}",`).join("\n")}
];
`;
await writeFile(OUTPUT, source);
console.log(`baked ${cells.length / 10} cells (${glow.length} glow) into ${OUTPUT}`);

const preview = process.argv[2];
if (preview) {
  const SCALE = 4;
  const pixels = Buffer.alloc(COLS * ROWS * 3, 8);
  for (let i = 0; i < COLS * ROWS; i++) {
    if (part[i] < 0) continue;

    for (let c = 0; c < 3; c++) pixels[i * 3 + c] = Math.min(255, colour[i][c]);
  }
  await sharp(pixels, { raw: { width: COLS, height: ROWS, channels: 3 } })
    .resize(COLS * SCALE, ROWS * SCALE, { kernel: "nearest" })
    .png()
    .toFile(preview);
}
