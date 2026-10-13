// The frame every effect renders into, and the colour and table helpers
// they share. Pixels are RGB565 words, `y * WIDTH + x`.
//
// Every size derives from the panel, read once at startup (CSS px = panel px,
// `cssDevicePixelRatio` is 1):
//
//   board              panel     half-res field   frame words   caption class
//   mosaico            480x480   240x240          115200        large
//   amoled             410x502   205x251          102910        large
//   STM32F746G-Disc.   480x272   240x136          65280         small
//
// Hot loops copy these into locals before looping.

// Both sides are rounded down to even: a row is a whole number of 32-bit
// words (two pixels per store) and the half-resolution fields cover the
// frame exactly. (The panels here are all even.)
export const WIDTH = (Math.floor(window.innerWidth / 2) * 2) | 0;
export const HEIGHT = (Math.floor(window.innerHeight / 2) * 2) | 0;
export const PIXELS = (WIDTH * HEIGHT) | 0;
export const PORTRAIT = HEIGHT > WIDTH * 1.1;
export const LARGE = Math.min(WIDTH, HEIGHT) >= 400;

// Half-resolution fields (tunnel, fire, metaballs) are upscaled 2x.
export const HALF_W = (WIDTH >> 1) | 0;
export const HALF_H = (HEIGHT >> 1) | 0;
export const HALF_CELLS = (HALF_W * HALF_H) | 0;

export const FRAME_ROWS = HEIGHT;
export const FRAME_LENGTH = PIXELS;

// The sine of 1024 steps per turn, as float and as Q14 integers.
export const SINE = new Float32Array(1024);
export const SINE_Q14 = new Int16Array(1024);

for (let i = 0; i < 1024; i++) {
  const value = Math.sin((i * Math.PI) / 512);
  SINE[i] = value;
  SINE_Q14[i] = Math.round(value * 16384);
}

export function sinTurns(turns: number): number {
  return SINE[((turns * 1024) | 0) & 1023];
}

export function cosTurns(turns: number): number {
  return SINE[((turns * 1024 + 256) | 0) & 1023];
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function rgb565(r: number, g: number, b: number): number {
  return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | ((b & 0xf8) >> 3);
}

// Mixes two RGB565 colours; alpha 0 keeps `a`, 32 gives `b`. The channels
// are spread apart in one word so a single multiply weighs all three.
export function blend565(a: number, b: number, alpha: number): number {
  const x = (a | (a << 16)) & 0x07e0f81f;
  const y = (b | (b << 16)) & 0x07e0f81f;
  const mixed = ((Math.imul(x, 32 - alpha) + Math.imul(y, alpha)) >>> 5) & 0x07e0f81f;
  return mixed | (mixed >>> 16);
}

// Integer hash (lowbias32) for textures and particle seeds.
export function hash(value: number): number {
  let x = value | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

let randomState = 0x9e3779b9 | 0;

// xorshift32, for flicker.
export function random32(): number {
  let x = randomState;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  randomState = x;
  return x >>> 0;
}

// Fills `size` palette entries from `offset` with the gradient through
// `stops`, given flat as [at, r, g, b, at, r, g, b, ...] sorted by `at`.
export function buildRamp(out: Uint16Array, offset: number, size: number, stops: readonly number[]) {
  const count = stops.length / 4;
  let stop = 0;
  for (let i = 0; i < size; i++) {
    const at = i / (size - 1);
    while (stop < count - 2 && at > stops[(stop + 1) * 4]) stop++;

    const a = stop * 4;
    const b = a + 4;
    const f = clamp01((at - stops[a]) / (stops[b] - stops[a]));
    const r = stops[a + 1] + (stops[b + 1] - stops[a + 1]) * f;
    const g = stops[a + 2] + (stops[b + 2] - stops[a + 2]) * f;
    const blue = stops[a + 3] + (stops[b + 3] - stops[a + 3]) * f;
    out[offset + i] = rgb565(r | 0, g | 0, blue | 0);
  }
}

// A 32-bit view of a frame, for writing two pixels per store.
export function wordsOf(pixels: Uint16Array): Uint32Array {
  const buffer: ArrayBuffer = pixels.buffer as ArrayBuffer;
  return new Uint32Array(buffer);
}

// 2x bilinear upscale of a half-resolution byte field through a 256-entry
// palette: even pixels take a field sample, odd ones the mean of their
// neighbours, the last row and column repeat the edge.
export function upscale(field: Uint8Array, palette: Uint16Array, words: Uint32Array) {
  const halfW = HALF_W | 0;
  const halfH = HALF_H | 0;
  const width = WIDTH | 0;
  const last = halfW - 1;
  for (let y = 0; y < halfH; y++) {
    const above = y * halfW;
    const below = y < halfH - 1 ? above + halfW : above;
    const aboveNext = above + 1;
    const belowNext = below + 1;
    const even = y * width;
    const odd = even + halfW;
    for (let x = 0; x < last; x++) {
      const a = field[above + x];
      const b = field[aboveNext + x];
      const c = field[below + x];
      const d = field[belowNext + x];
      words[even + x] = palette[a & 255] | (palette[((a + b) >> 1) & 255] << 16);
      words[odd + x] = palette[((a + c) >> 1) & 255] | (palette[((a + b + c + d) >> 2) & 255] << 16);
    }

    const a = field[above + last];
    const c = field[below + last];
    const edge = palette[((a + c) >> 1) & 255];
    words[even + last] = palette[a & 255] * 0x10001;
    words[odd + last] = edge * 0x10001;
  }
}
