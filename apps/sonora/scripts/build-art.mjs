// Resizes the six album covers (1024x1024, made by scripts/generate.py) into
// public/art at the exact sizes the app shows them, with anti-aliased rounded
// corners in the alpha plane, dithered to RGB565. It also measures each
// cover's palette and writes src/data/palette.ts (a dark background tint, an
// accent and a muted accent pre-blended over the tint) and src/styles/halo.css
// (a dithered glow in the cover's own hue that fades out over any tint).
//
// Run from the app folder: `npm run art -- <folder with cover-1..6.png>`.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const COVERS = 6;
// name: [size, corner radius]. np = Now Playing, flow / side = the cover flow
// centre and its neighbours at rest, thumb = queue rows and the ambient card.
const SIZES = { np: [192, 12], flow: [144, 10], side: [96, 8], thumb: [32, 6] };
const SUPERSAMPLE = 4;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const source = process.argv[2];
if (!source) throw new Error("usage: npm run art -- <folder with cover-1..6.png>");

const outDir = path.join(process.cwd(), "public", "art");
await mkdir(outDir, { recursive: true });

// Coverage of a rounded square at each pixel, supersampled.
function cornerMask(size, radius) {
  const mask = new Uint8Array(size * size);
  const step = 1 / SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = x + (sx + 0.5) * step;
          const py = y + (sy + 0.5) * step;
          const cx = Math.min(Math.max(px, radius), size - radius);
          const cy = Math.min(Math.max(py, radius), size - radius);
          if ((px - cx) ** 2 + (py - cy) ** 2 <= radius * radius) inside++;
        }
      }
      mask[y * size + x] = Math.round((inside * 255) / (SUPERSAMPLE * SUPERSAMPLE));
    }
  }
  return mask;
}

// Ordered dither onto the RGB565 grid (5/6/5 bits).
function snap(value, bits, threshold) {
  const levels = (1 << bits) - 1;
  const scaled = (value / 255) * levels + (threshold - 0.5) * 0.9;
  const level = Math.max(0, Math.min(levels, Math.round(scaled)));
  return Math.round((level * 255) / levels);
}

async function writeCover(file, index, name, size, radius) {
  const { data } = await sharp(file)
    .resize(size, size, { kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = cornerMask(size, radius);
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const threshold = (BAYER[((Math.floor(i / size) & 3) << 2) | (i % size & 3)] + 0.5) / 16;
    out[i * 4] = snap(data[i * 3], 5, threshold);
    out[i * 4 + 1] = snap(data[i * 3 + 1], 6, threshold);
    out[i * 4 + 2] = snap(data[i * 3 + 2], 5, threshold);
    out[i * 4 + 3] = mask[i];
  }
  await sharp(out, { raw: { width: size, height: size, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, `${name}-${index}.png`));
}

// ---- Palette ----

function toHsl([r, g, b]) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  h /= 6;
  return [h, s, l];
}

function fromHsl([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

// k-means over a 48x48 thumbnail; clusters sorted by population.
function clusters(pixels, k) {
  let centres = [];
  for (let i = 0; i < k; i++) centres.push(pixels[Math.floor(((i + 0.5) * pixels.length) / k)].slice());
  let members = [];
  for (let round = 0; round < 12; round++) {
    members = centres.map(() => []);
    for (const p of pixels) {
      let best = 0;
      let bestDistance = Infinity;
      centres.forEach((c, i) => {
        const distance = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      members[best].push(p);
    }
    centres = members.map((group, i) =>
      group.length === 0 ? centres[i] : [0, 1, 2].map((ch) => group.reduce((sum, p) => sum + p[ch], 0) / group.length),
    );
  }
  return centres.map((colour, i) => ({ colour, share: members[i].length / pixels.length }));
}

function hex([r, g, b]) {
  const r5 = Math.max(0, Math.min(248, Math.round(r / 8) * 8));
  const g6 = Math.max(0, Math.min(252, Math.round(g / 4) * 4));
  const b5 = Math.max(0, Math.min(248, Math.round(b / 8) * 8));
  return `#${[r5, g6, b5].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function rgba(colour, alpha) {
  const value = Number.parseInt(colour.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function mix(a, b, t) {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
}

async function palette(file) {
  const { data } = await sharp(file).resize(48, 48).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = [];
  for (let i = 0; i < data.length; i += 3) pixels.push([data[i], data[i + 1], data[i + 2]]);
  const found = clusters(pixels, 6).sort((a, b) => b.share - a.share);

  // Background: the most present colourful hue (near-black clusters carry no
  // hue), deep and calm.
  const base = found
    .map((c) => ({ ...c, hsl: toHsl(c.colour) }))
    .filter((c) => c.hsl[2] > 0.1)
    .sort((a, b) => b.share * Math.sqrt(b.hsl[1]) - a.share * Math.sqrt(a.hsl[1]))[0];
  const baseSat = Math.max(0.35, Math.min(0.6, base.hsl[1]));
  const bg = fromHsl([base.hsl[0], baseSat, 0.09]);
  const halo = fromHsl([base.hsl[0], baseSat, 0.42]);

  // Accent: the most vivid well-populated colour, lifted to read on the tint.
  const vivid = found
    .filter((c) => c.share > 0.03)
    .map((c) => ({ ...c, hsl: toHsl(c.colour) }))
    .sort((a, b) => b.hsl[1] * (0.4 + b.hsl[2]) - a.hsl[1] * (0.4 + a.hsl[2]))[0];
  const accent = fromHsl([vivid.hsl[0], Math.max(0.6, Math.min(0.9, vivid.hsl[1])), 0.64]);

  return {
    bg: hex(bg),
    accent: hex(accent),
    accentSoft: hex(mix(bg, accent, 0.35)),
    halo: hex(halo),
  };
}

const palettes = [];
for (let index = 1; index <= COVERS; index++) {
  const file = path.join(source, `cover-${index}.png`);
  for (const [name, [size, radius]] of Object.entries(SIZES)) await writeCover(file, index, name, size, radius);
  palettes.push(await palette(file));
}

const halos = palettes.map(
  (p, i) => `.halo-${i + 1} {
  background:
    radial-gradient(ellipse 50% 50% at 50% 50%, ${rgba(p.halo, 0.7)}, ${rgba(p.halo, 0)} 100%),
    linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0));
}
`,
);
await writeFile(
  path.join(process.cwd(), "src", "styles", "halo.css"),
  `/* Generated by scripts/build-art.mjs from the album covers; do not edit.
 * The glow behind the art, in each cover's own hue. The engine draws a
 * radial layer only beside a linear one, hence the transparent linear. */

${halos.join("\n")}`,
);

const fields = Object.keys(palettes[0]).filter((f) => f !== "halo");
const lines = palettes.map((p) => `  {\n${fields.map((f) => `    ${f}: "${p[f]}",`).join("\n")}\n  },`);
await writeFile(
  path.join(process.cwd(), "src", "data", "palette.ts"),
  `// Generated by scripts/build-art.mjs from the album covers; do not edit.
// Per album: the background tint, the accent and shades pre-blended over the
// tint (a muted accent), all on the RGB565 grid.

export type Palette = {
${fields.map((f) => `  ${f}: string;`).join("\n")}
};

export const PALETTES: Palette[] = [
${lines.join("\n")}
];
`,
);
console.log(`wrote ${COVERS * Object.keys(SIZES).length} covers into public/art and src/data/palette.ts`);
