// The frame the intro renders into, and the colour, easing and table helpers
// the painters share. Pixels are RGB565 words, `y * WIDTH + x`.

// The frame is the whole panel, read once at startup (CSS px = panel px:
// `cssDevicePixelRatio` is 1). The composition itself was drawn for 480x272
// (the "stage"): it is centred on the panel, and the board's grid, traces,
// dust and glow run to the panel's own edges.
//
//   board              panel     stage origin (OX, OY)   logo x   font/lockup
//   mosaico            480x480   (0, 104)                94       stage as drawn
//   amoled             410x502   (-36, 115)              58       stage as drawn
//   STM32F746G-Disc.   480x272   (0, 0)                  94       stage as drawn
export const WIDTH = Math.floor(window.innerWidth) | 0;
export const HEIGHT = Math.floor(window.innerHeight) | 0;
export const HALF_WIDTH = WIDTH >> 1; // 32-bit words per row
export const STAGE_W = 480;
export const STAGE_H = 272;
export const OX = ((WIDTH - STAGE_W) >> 1) & ~1; // even: a cell's pixel pair is one word
export const OY = (HEIGHT - STAGE_H) >> 1;

// An index masked with 0x3ffff (or a word index masked with 0x1ffff) is a
// literal mask the compiler recognises; the largest panel (480x480) has
// 230400 pixels.
export const PIXEL_MASK = 0x3ffff;
export const WORD_MASK = 0x1ffff;

// The STM32 firmware's fps overlay (LTDC layer 2) covers the bottom-right
// corner; the grid and dust keep clear of it so it can be masked when filming.
export const OVERLAY_LEFT = WIDTH - 56;
export const OVERLAY_TOP = HEIGHT - 22;

export function rgb565(r: number, g: number, b: number): number {
  return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | ((b & 0xf8) >> 3);
}

// The brand palette (website/css/tokens.css) in RGB565, as literals so the
// generated code keeps them integer: surface #08080a, cyan #2de2ff, mint
// #2fe3b6, text #f5f5f7, secondary #d6d6de, tertiary #8a8a94. Indigo #6e7bf2
// and magenta #e94bff appear in spread form below.
export const SURFACE = 0x0841;
export const CYAN = 0x2f1f;
export const MINT = 0x2f16;
export const TEXT = 0xf7be;
export const TEXT_SECONDARY = 0xd6bb;
export const TEXT_TERTIARY = 0x8c52;

// An RGB565 colour's channels spread apart in one word, `(c | c << 16) &
// SPREAD`, so a single multiply weighs all three. Hot loops blend inline in
// this form.
export const SPREAD = 0x07e0f81f;
export const SURFACE_SPREAD = 0x00400801;
export const CYAN_SPREAD = 0x0700281f;
export const INDIGO_SPREAD = 0x03c0681e;
export const MAGENTA_SPREAD = 0x0240e81f;
export const WHITE_SPREAD = 0x07e0f81f;

// Adds `light`, a spread colour already scaled by its alpha, onto the pixel
// at `at`, each channel saturating.
export function addLight(pixels: Uint16Array, at: number, light: number) {
  const under = pixels[at];
  const sum = ((under | (under << 16)) & SPREAD) + light;
  // A channel that overflowed set the spare bit above it: fill it to full.
  const over = sum & 0x08010020;
  const lit = (sum | (over - (over >>> 5)) | ((over >>> 6) & 0x00200000)) & SPREAD;
  pixels[at] = lit | (lit >>> 16);
}

// Integer hash (lowbias32), for particle seeds and scatter.
export function hash(value: number): number {
  let x = value | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

// The sine of 1024 steps per turn.
export const SINE = new Float32Array(1024);
for (let i = 0; i < 1024; i++) SINE[i] = Math.sin((i * Math.PI) / 512);

export function sinTurns(turns: number): number {
  return SINE[((turns * 1024) | 0) & 1023];
}

export function cosTurns(turns: number): number {
  return SINE[((turns * 1024 + 256) | 0) & 1023];
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

// The brand's motion curve, cubic-bezier(0.22, 1, 0.36, 1), tabulated.
const EASE_STEPS = 256;
const EASE = new Float32Array(EASE_STEPS + 1);
{
  const bezier = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  let s = 0;
  for (let i = 0; i <= EASE_STEPS; i++) {
    const x = i / EASE_STEPS;
    while (s < 1 && bezier(0.22, 0.36, s) < x) s += 1 / 4096;
    EASE[i] = bezier(1, 1, s);
  }
}

export function ease(progress: number): number {
  return EASE[(clamp01(progress) * EASE_STEPS + 0.5) | 0];
}

// The signature gradient, 118° cyan → indigo (52%) → magenta, as 256 steps.
export const BRAND_RAMP = new Uint16Array(256);
// Its palindrome (cyan → indigo → magenta → indigo → cyan) for flowing lines.
export const FLOW_RAMP = new Uint16Array(256);
{
  const stops = [45, 226, 255, 110, 123, 242, 233, 75, 255];
  const mix = (at: number, channel: number) => {
    const low = at < 0.52;
    const f = low ? at / 0.52 : (at - 0.52) / 0.48;
    const from = stops[(low ? 0 : 3) + channel];
    const to = stops[(low ? 3 : 6) + channel];
    return from + (to - from) * f;
  };
  for (let i = 0; i < 256; i++) {
    const at = i / 255;
    BRAND_RAMP[i] = rgb565(mix(at, 0), mix(at, 1), mix(at, 2));
    const fold = at < 0.5 ? at * 2 : 2 - at * 2;
    FLOW_RAMP[i] = rgb565(mix(fold, 0), mix(fold, 1), mix(fold, 2));
  }
}

// The brand gradient's position 0..255 at a screen pixel: the 118° line
// across the panel, split into per-column and per-row terms.
export const GRADIENT_X = new Uint8Array(WIDTH);
export const GRADIENT_Y = new Uint8Array(HEIGHT);
{
  const dx = Math.sin((118 * Math.PI) / 180);
  const dy = -Math.cos((118 * Math.PI) / 180);
  const span = WIDTH * dx + HEIGHT * dy;
  for (let x = 0; x < WIDTH; x++) GRADIENT_X[x] = Math.floor(((x * dx) / span) * 255);
  for (let y = 0; y < HEIGHT; y++) GRADIENT_Y[y] = Math.floor(((y * dy) / span) * 255);
}
