// Palette slots, per theme.
export const BACKGROUND = 0;
export const GLOW = 1; // the pool of light on the floor
export const HALO = 2; // the thin ring on the floor, and the orbit rings' tint
export const GEM_LOW = 3; // culet
export const GEM_HIGH = 4; // table
export const ACCENT = 5; // moons
export const SLOTS = 6;

// Sapphire, Lagoon, Ember. RGB565-snapped (R and B multiples of 8, G of 4).
// biome-ignore format: one theme per row
const PALETTES = [
  0x100c30, 0x302c78, 0x6860d0, 0x1838c8, 0x9850f0, 0xf0c880,
  0x082420, 0x105850, 0x40c0a0, 0x089060, 0x80f0c8, 0xf8a088,
  0x200c1c, 0x582038, 0xe05870, 0xb00838, 0xf88048, 0x98d0f8,
];

export const THEME_COUNT = PALETTES.length / SLOTS;

export function paletteColor(theme: number, slot: number): number {
  return PALETTES[theme * SLOTS + slot];
}

// Writes each vertex's colour for `theme`: the sum of its palette-slot
// weights (SLOTS per vertex) times the slot colours. The native side
// multiplies by 255 and truncates, so +0.5 rounds instead (floor edges then
// match the background exactly).
export function bakeColors(weights: number[], theme: number, colors: Float32Array): void {
  const rgb = new Float32Array(SLOTS * 3);
  for (let s = 0; s < SLOTS; s++) {
    const hex = paletteColor(theme, s);
    rgb[s * 3] = (hex >> 16) & 255;
    rgb[s * 3 + 1] = (hex >> 8) & 255;
    rgb[s * 3 + 2] = hex & 255;
  }

  const count = colors.length / 3;
  for (let i = 0; i < count; i++) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let s = 0; s < SLOTS; s++) {
      const weight = weights[i * SLOTS + s];
      if (weight === 0) continue;

      r += weight * rgb[s * 3];
      g += weight * rgb[s * 3 + 1];
      b += weight * rgb[s * 3 + 2];
    }
    colors[i * 3] = (Math.min(255, r) + 0.5) / 255;
    colors[i * 3 + 1] = (Math.min(255, g) + 0.5) / 255;
    colors[i * 3 + 2] = (Math.min(255, b) + 0.5) / 255;
  }
}
