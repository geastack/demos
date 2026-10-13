// Renders an app's Phosphor icons into PNGs under <app>/public/icons, reading
// <app>/icons.config.json:
//
//   { "icons": [{ "name": "cup", "glyph": "coffee", "weight": "duotone", "size": 28, "color": "#d9a066" }] }
//
// The panel has no SVG renderer, so each icon is rasterized at 8x and
// downsampled for clean edges. Reference them with a literal
// <img src="icons/<name>.png" />. Run from the app folder: `npm run icons`.

import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const SUPERSAMPLE = 8;
const appDir = process.cwd();
const outDir = path.join(appDir, "public", "icons");

const config = JSON.parse(await readFile(path.join(appDir, "icons.config.json"), "utf8"));
await mkdir(outDir, { recursive: true });

for (const icon of config.icons) {
  const suffix = icon.weight === "regular" ? "" : `-${icon.weight}`;
  const file = require.resolve(`@phosphor-icons/core/assets/${icon.weight}/${icon.glyph}${suffix}.svg`);
  const pixels = icon.size * SUPERSAMPLE;
  const svg = (await readFile(file, "utf8"))
    .replace("<svg ", `<svg width="${pixels}" height="${pixels}" `)
    .replaceAll("currentColor", icon.color);
  await sharp(Buffer.from(svg))
    .resize(icon.size, icon.size)
    .png()
    .toFile(path.join(outDir, `${icon.name}.png`));
}
console.log(`rendered ${config.icons.length} icons into ${path.relative(appDir, outDir)}`);
