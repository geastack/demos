// Karl Sims' parameter map: coral growth, dividing cells, fingerprints, waves.
// Each pattern has feed/kill rates and five palette stops from the background
// (tone 0) to the highlight (tone 255).
export type Pattern = { name: string; feed: number; kill: number; stops: number[] };

export const PATTERNS: Pattern[] = [
  { name: "Coral", feed: 0.0545, kill: 0.062, stops: [0x0b0a1a, 0x3a1450, 0xe0456b, 0xffb38a, 0xfff4e6] },
  { name: "Cells", feed: 0.0367, kill: 0.0649, stops: [0x04121a, 0x0a3d5c, 0x13a3b8, 0x7ff0e0, 0xf0fffb] },
  { name: "Prints", feed: 0.029, kill: 0.057, stops: [0x0e0a06, 0x3b2410, 0xc97a1e, 0xffd27a, 0xfff8e7] },
  { name: "Waves", feed: 0.014, kill: 0.047, stops: [0x0a0714, 0x2a1260, 0x7b5cff, 0xd59bff, 0xfff0ff] },
];

const SEGMENT = 64; // palette entries between two stops

function mix(from: number, to: number, shift: number, t: number): number {
  const a = (from >> shift) & 255;
  const b = (to >> shift) & 255;
  return a + Math.trunc(((b - a) * t) / SEGMENT);
}

/** Fills a 256-entry RGB565 palette with the pattern's gradient. */
export function buildPalette(pattern: Pattern, palette: Uint16Array) {
  for (let i = 0; i < 256; i++) {
    const segment = Math.min(Math.floor(i / SEGMENT), 3);
    const t = i - segment * SEGMENT;
    const from = pattern.stops[segment];
    const to = pattern.stops[segment + 1];
    const r = mix(from, to, 16, t);
    const g = mix(from, to, 8, t);
    const b = mix(from, to, 0, t);
    palette[i] = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
  }
}
