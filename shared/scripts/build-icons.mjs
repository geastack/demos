// Renders an app's Phosphor icons into PNGs under <app>/public/icons, reading
// <app>/icons.config.json:
//
//   { "icons": [{ "name": "cup", "glyph": "coffee", "weight": "duotone", "size": 28, "color": "#d9a066" }] }
//
// An optional "variants" map renders the set again at other sizes, per base
// size, under a name suffix — e.g. { "-xl": { "20": 28 } } adds <name>-xl.png
// at 28 px for every 20 px icon (a denser panel's set).
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

async function render(icon, size, name) {
  const suffix = icon.weight === "regular" ? "" : `-${icon.weight}`;
  const file = require.resolve(`@phosphor-icons/core/assets/${icon.weight}/${icon.glyph}${suffix}.svg`);
  const pixels = size * SUPERSAMPLE;
  const svg = (await readFile(file, "utf8"))
    .replace("<svg ", `<svg width="${pixels}" height="${pixels}" `)
    .replaceAll("currentColor", icon.color);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, `${name}.png`));
}

let count = 0;
for (const icon of config.icons) {
  await render(icon, icon.size, icon.name);
  count++;
  for (const [suffix, sizes] of Object.entries(config.variants ?? {})) {
    const size = sizes[String(icon.size)];
    if (size === undefined) throw new Error(`variant ${suffix} has no size for ${icon.size} px (${icon.name})`);
    await render(icon, size, `${icon.name}${suffix}`);
    count++;
  }
}
console.log(`rendered ${count} icons into ${path.relative(appDir, outDir)}`);
