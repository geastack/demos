import {
  addLight,
  CYAN_SPREAD,
  clamp01,
  cosTurns,
  ease,
  HALF_WIDTH,
  HEIGHT,
  hash,
  INDIGO_SPREAD,
  MAGENTA_SPREAD,
  PIXEL_MASK,
  SPREAD,
  sinTurns,
  WHITE_SPREAD,
  WIDTH,
  WORD_MASK,
} from "./frame";
import { STAR_X, STAR_Y } from "./logo";
import { BLOOM_S, BURST_S, SPARK, SPARK_FLASH_S } from "./timeline";

// The star's light: a cyan glow close in, magenta wider and a white flash at
// the spark, added over the surface in 2x2 blocks inside this box
// (STAR_X/Y +- 80 px, clipped to the panel's top; 94, 0 and 68 rows at 480x272).
const BLOOM_LEFT = (STAR_X - 80) | 0;
const BLOOM_TOP = Math.max(0, STAR_Y - 80) & ~1;
const BLOOM_COLUMNS = 80; // blocks
const BLOOM_ROWS = (STAR_Y + 80 - BLOOM_TOP) >> 1;
const CYAN_REST = 64; // the brand's rgba(45,226,255,.22), a touch up for the panel
const MAGENTA_REST = 58; // rgba(233,75,255,.20)
const CYAN_RADIUS = 38;
const MAGENTA_RADIUS = 66;
const SURFACE_LEVEL = 8; // the surface's channels as RGB565 stores them

const FLARE_S = 0.45; // the spark's cross of light
const FLARE_REACH = 96;
const BURST_COUNT = 44;
// White, cyan, magenta and indigo sparks, as spread colours (see SPREAD).
const BURST_SPREADS = new Int32Array([
  WHITE_SPREAD,
  CYAN_SPREAD,
  MAGENTA_SPREAD,
  CYAN_SPREAD,
  INDIGO_SPREAD,
  MAGENTA_SPREAD,
  WHITE_SPREAD,
  CYAN_SPREAD,
]);

export class Spark {
  private readonly pixels: Uint16Array;
  private readonly words: Uint32Array;
  // Radial falloffs 0..255 indexed by squared distance / radius^2 (x 256):
  // a soft glow, and a sharp one for the flash.
  private readonly soft = new Uint8Array(257);
  private readonly sharp = new Uint8Array(257);
  private readonly bayer = new Uint8Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

  constructor(pixels: Uint16Array, words: Uint32Array) {
    this.pixels = pixels;
    this.words = words;
    for (let i = 0; i < 256; i++) {
      const soft = 1 - i / 256;
      const sharp = 1 - Math.sqrt(i / 256);
      this.soft[i] = Math.round(255 * soft * soft);
      this.sharp[i] = Math.round(255 * sharp * sharp);
    }
  }

  // The bloom swells at the spark and settles to the brand's glow, which
  // breathes with the star's `twinkle` (0..1).
  bloom(time: number, twinkle: number) {
    const since = time - SPARK;
    if (since < 0) return;

    const size = ease(since / 0.3);
    const swell = 1 - ease(since / BLOOM_S);
    const cyan = (CYAN_REST + (255 - CYAN_REST) * swell) * (0.88 + 0.24 * twinkle) * size;
    const magenta = (MAGENTA_REST + (200 - MAGENTA_REST) * swell) * (0.9 + 0.2 * twinkle) * size;
    const cyanRadius = 10 + (CYAN_RADIUS - 10) * size + 30 * swell * size;
    const magentaRadius = 14 + (MAGENTA_RADIUS - 14) * size + 12 * swell * size;
    const flash = clamp01(1 - since / SPARK_FLASH_S);
    const flashRadius = 6 + 34 * ease(since / 0.2);
    this.field(
      cyan | 0,
      ((255 * 256) / (cyanRadius * cyanRadius)) | 0,
      magenta | 0,
      ((255 * 256) / (magentaRadius * magentaRadius)) | 0,
      (255 * flash * flash) | 0,
      ((255 * 256) / (flashRadius * flashRadius)) | 0,
    );
  }

  // Adds the three falloffs per 2x2 block, ordered-dithered to hide RGB565
  // banding. Each `scale` maps a squared distance to the falloff tables.
  private field(
    cyan: number,
    cyanScale: number,
    magenta: number,
    magentaScale: number,
    white: number,
    whiteScale: number,
  ) {
    const words = this.words;
    const soft = this.soft;
    const sharp = this.sharp;
    const bayer = this.bayer;
    // The box's geometry comes from the panel size, which the compiler only
    // knows as int32; bounded here (the box is 80 blocks of a panel under 2048
    // px) so the per-block distances and products stay integer, not doubles.
    const rows = BLOOM_ROWS & 0x3ff;
    const rowStep = WIDTH & 0x7ff;
    const firstRow = (BLOOM_TOP >> 1) & 0x3ff;
    const firstWord = (BLOOM_LEFT >> 1) & 0x3ff;
    const halfWidth = HALF_WIDTH & 0x3ff;
    // BLOOM_TOP + 1 - STAR_Y lies in [-79, 1].
    const dyStart = ((BLOOM_TOP + 1 - STAR_Y + 128) & 255) - 128;
    const cyanLevel = cyan & 0x1ff;
    const magentaLevel = magenta & 0x1ff;
    const whiteLevel = white & 0x1ff;
    const cyanStep = cyanScale & 0xffff;
    const magentaStep = magentaScale & 0xffff;
    const whiteStep = whiteScale & 0xffff;
    for (let by = 0; by < rows; by++) {
      const dy = dyStart + by * 2;
      const dy2 = dy * dy;
      const rowWord = (firstRow + by) * rowStep + firstWord;
      const pattern = (by & 3) << 2;
      for (let bx = 0; bx < BLOOM_COLUMNS; bx++) {
        const dx = bx * 2 - 79; // BLOOM_LEFT + bx * 2 + 1 - STAR_X
        const d2 = dx * dx + dy2;
        const c = (soft[Math.min(256, (d2 * cyanStep) >> 8)] * cyanLevel) >> 8;
        const m = (soft[Math.min(256, (d2 * magentaStep) >> 8)] * magentaLevel) >> 8;
        const w = (sharp[Math.min(256, (d2 * whiteStep) >> 8)] * whiteLevel) >> 8;
        if ((c | m | w) === 0) continue;

        const threshold = bayer[pattern | (bx & 3)];
        const r = Math.min(31, (SURFACE_LEVEL * 256 + 45 * c + 233 * m + 255 * w + threshold * 128) >> 11);
        const g = Math.min(63, (SURFACE_LEVEL * 256 + 226 * c + 75 * m + 255 * w + threshold * 64) >> 10);
        const b = Math.min(31, (SURFACE_LEVEL * 256 + 255 * c + 255 * m + 255 * w + threshold * 128) >> 11);
        const colour = (r << 11) | (g << 5) | b;
        const pair = colour | (colour << 16);
        words[(rowWord + bx) & WORD_MASK] = pair;
        words[(rowWord + bx + halfWidth) & WORD_MASK] = pair;
      }
    }
  }

  // At the spark a cross of light shoots out along the star's rays: white at
  // the core, cyan further out, thinning as it fades.
  flare(time: number) {
    const since = time - SPARK;
    if (since < 0 || since > FLARE_S) return;

    const pixels = this.pixels;
    const fade = 1 - since / FLARE_S;
    const reach = 12 + (FLARE_REACH - 12) * ease(since / 0.18);
    const peak = fade * fade * 32;
    const centre = STAR_Y * WIDTH + STAR_X;
    for (let d = -FLARE_REACH; d <= FLARE_REACH; d++) {
      const along = 1 - Math.abs(d) / reach;
      if (along <= 0) continue;

      const alpha = (peak * along * along) | 0;
      const spread = Math.abs(d) < reach * 0.3 ? WHITE_SPREAD : CYAN_SPREAD;
      const light = (Math.imul(spread, alpha) >>> 5) & SPREAD;
      const halfLight = (Math.imul(spread, alpha >> 1) >>> 5) & SPREAD;
      const across = centre + d;
      addLight(pixels, across & PIXEL_MASK, light);
      addLight(pixels, (across - WIDTH) & PIXEL_MASK, halfLight);
      if (STAR_Y + d < 0) continue;

      const down = centre + d * WIDTH;
      addLight(pixels, down & PIXEL_MASK, light);
      addLight(pixels, (down - 1) & PIXEL_MASK, halfLight);
    }
  }

  // Pixel sparks thrown from the star, slowing as they fade.
  burst(time: number) {
    const since = time - SPARK - 0.02;
    if (since < 0 || since > BURST_S) return;

    const pixels = this.pixels;
    const flicker = (time * 24) | 0;
    for (let i = 0; i < BURST_COUNT; i++) {
      const seed = hash(i + 17);
      const life = 0.55 + (((seed >>> 14) & 255) / 255) * 0.55;
      const progress = since / life;
      if (progress >= 1) continue;

      const turns = (i + ((seed & 255) / 256) * 0.8) / BURST_COUNT;
      const reach = (34 + ((seed >>> 8) & 63)) * ease(progress);
      const x = (STAR_X + cosTurns(turns) * reach) | 0;
      const y = (STAR_Y + sinTurns(turns) * reach) | 0;
      if (x < 0 || y < 0 || x >= WIDTH - 1 || y >= HEIGHT - 1) continue;

      let alpha = ((1 - progress * progress) * 32) | 0;
      if ((hash(i * 7 + flicker) & 3) === 0) alpha >>= 1;
      const light = (Math.imul(BURST_SPREADS[(seed >>> 29) & 7], alpha) >>> 5) & SPREAD;
      const at = y * WIDTH + x;
      addLight(pixels, at & PIXEL_MASK, light);
      addLight(pixels, (at + 1) & PIXEL_MASK, light);
      addLight(pixels, (at + WIDTH) & PIXEL_MASK, light);
      addLight(pixels, (at + WIDTH + 1) & PIXEL_MASK, light);
    }
  }
}
