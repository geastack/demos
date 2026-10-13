// Crops the generated photography (scripts/generate.py, 1536x1024) into the
// exact sizes Ember shows, in public/art:
//   hero-<dish>.png  480x272  the dish on the right, the left third fading into
//                             the background colour for the copy (Detail, Ready)
//   card-<dish>.png  256x152  the dish centred (carousel; side cards crop it)
//   thumb-<dish>.png  56x56   rounded tile on the card surface (cook flow)
//   corner-*.png      12x12   background-coloured corner masks for the cards
// Colours are snapped to the panel's RGB565 grid with a 4x4 ordered dither,
// then stored as palette PNGs to keep flash small.
//
//   node scripts/prepare-art.mjs <dir with ember/*.png>

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE = path.resolve(process.argv[2] ?? ".", "ember");
const OUT = path.resolve(import.meta.dirname, "..", "public", "art");

const BG = [24, 20, 16];
const SURFACE = [32, 28, 24];
const CORNER = 12;
const THUMB_RADIUS = 12;

// Dish centre in the source and how much of it a hero shows (source px).
const DISHES = [
  { id: "chicken", file: "roast-chicken", cx: 765, cy: 486 },
  { id: "pizza", file: "pizza", cx: 774, cy: 492 },
  { id: "sourdough", file: "sourdough", cx: 740, cy: 495 },
  { id: "salmon", file: "salmon", cx: 765, cy: 508 },
  { id: "lasagna", file: "lasagna", cx: 760, cy: 470 },
  { id: "lava-cake", file: "lava-cake", cx: 768, cy: 504 },
];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

// Rounds a channel to `bits` with an ordered dither.
function quantize(value, bits, x, y) {
  const step = 1 << (8 - bits);
  const threshold = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;
  const level = Math.round(value / step + threshold);
  return Math.min(Math.max(level, 0), (1 << bits) - 1) * step;
}

// A window of the source scaled to width x height, centred on (cx, cy); parts
// outside the source come out in the background colour.
async function crop(file, cx, cy, scale, width, height, anchorX, anchorY) {
  const resized = await sharp(path.join(SOURCE, `${file}.png`))
    .resize(Math.round(1536 * scale), Math.round(1024 * scale))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const left = Math.round(cx * scale - anchorX);
  const top = Math.round(cy * scale - anchorY);
  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = x + left;
      const sy = y + top;
      const inside = sx >= 0 && sy >= 0 && sx < resized.info.width && sy < resized.info.height;
      for (let c = 0; c < 3; c++) {
        out[(y * width + x) * 3 + c] = inside ? resized.data[(sy * resized.info.width + sx) * 3 + c] : BG[c];
      }
    }
  }
  return out;
}

async function save(name, rgb, width, height, alpha) {
  const channels = alpha ? 4 : 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      pixels[i * channels] = quantize(rgb[i * 3], 5, x, y);
      pixels[i * channels + 1] = quantize(rgb[i * 3 + 1], 6, x, y);
      pixels[i * channels + 2] = quantize(rgb[i * 3 + 2], 5, x, y);
      if (alpha) pixels[i * 4 + 3] = alpha[i];
    }
  }
  await sharp(pixels, { raw: { width, height, channels } })
    .png({ palette: true, colours: 256, dither: 0, effort: 10, compressionLevel: 9 })
    .toFile(path.join(OUT, `${name}.png`));
}

function blend(rgb, i, color, amount) {
  for (let c = 0; c < 3; c++) rgb[i * 3 + c] = rgb[i * 3 + c] * (1 - amount) + color[c] * amount;
}

async function hero(dish) {
  const width = 480;
  const height = 272;
  const rgb = await crop(dish.file, dish.cx, dish.cy, 0.29, width, height, 336, 136);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const side = 1 - smoothstep(96, 312, x);
      const top = 0.55 * (1 - smoothstep(0, 64, y));
      const bottom = 0.5 * smoothstep(196, 272, y);
      blend(rgb, y * width + x, BG, Math.max(side, top, bottom));
    }
  }
  await save(`hero-${dish.id}`, rgb, width, height);
}

async function card(dish) {
  await save(`card-${dish.id}`, await crop(dish.file, dish.cx, dish.cy, 0.19, 256, 152, 128, 76), 256, 152);
}

// Anti-aliased rounded corners baked against the card surface.
async function thumb(dish) {
  const size = 56;
  const rgb = await crop(dish.file, dish.cx, dish.cy, 0.072, size, size, 28, 28);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.max(THUMB_RADIUS - (x + 0.5), x + 0.5 - (size - THUMB_RADIUS), 0);
      const dy = Math.max(THUMB_RADIUS - (y + 0.5), y + 0.5 - (size - THUMB_RADIUS), 0);
      const outside = Math.min(Math.max(Math.hypot(dx, dy) - THUMB_RADIUS + 0.5, 0), 1);
      blend(rgb, y * size + x, SURFACE, outside);
    }
  }
  await save(`thumb-${dish.id}`, rgb, size, size);
}

// Background outside a quarter circle, clear inside; flipped per corner.
async function corners() {
  const names = ["tl", "tr", "bl", "br"];
  for (let k = 0; k < 4; k++) {
    const rgb = Buffer.alloc(CORNER * CORNER * 3);
    const alpha = Buffer.alloc(CORNER * CORNER);
    for (let y = 0; y < CORNER; y++) {
      for (let x = 0; x < CORNER; x++) {
        const fx = k % 2 === 0 ? x : CORNER - 1 - x;
        const fy = k < 2 ? y : CORNER - 1 - y;
        const distance = Math.hypot(CORNER - (fx + 0.5), CORNER - (fy + 0.5));
        const i = y * CORNER + x;
        blend(rgb, i, BG, 1);
        alpha[i] = Math.round(Math.min(Math.max(distance - CORNER + 0.5, 0), 1) * 255);
      }
    }
    await save(`corner-${names[k]}`, rgb, CORNER, CORNER, alpha);
  }
}

await mkdir(OUT, { recursive: true });
for (const dish of DISHES) {
  await hero(dish);
  await card(dish);
  await thumb(dish);
}
await corners();
console.log(`wrote ${DISHES.length * 3 + 4} images into ${path.relative(process.cwd(), OUT)}`);
