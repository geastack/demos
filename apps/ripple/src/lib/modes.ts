// The three looks. Colours are 0..1 RGB. Ink: neon on ink. Smoke: warm whites
// on black, rising. Aurora: green / teal / violet on a night sky. Backgrounds
// sit exactly on RGB565 steps so they stay flat.
export type Mode = {
  palette: number[][]; // five dye colours, one per finger slot
  background: number[];
  vorticity: number; // curl confinement strength
  velocityDecay: number; // per second
  dyeDecay: number; // per second
  buoyancy: number; // upward push per unit of dye
  dyeAmount: number; // dye per stroke at the finger's centre
};

export const PALETTE_SIZE = 5;

export const MODES: Mode[] = [
  {
    palette: [
      [1.0, 0.18, 0.533],
      [0.098, 0.827, 1.0],
      [0.482, 0.361, 1.0],
      [1.0, 0.69, 0.125],
      [0.239, 1.0, 0.69],
    ],
    background: [0, 0, 8 / 248],
    vorticity: 24,
    velocityDecay: 0.25,
    dyeDecay: 0.8,
    buoyancy: 0,
    dyeAmount: 1.1,
  },
  {
    palette: [
      [1.0, 0.894, 0.784],
      [1.0, 0.784, 0.565],
      [0.949, 0.863, 0.784],
      [1.0, 0.722, 0.47],
      [0.91, 0.867, 0.824],
    ],
    background: [8 / 248, 4 / 252, 0],
    vorticity: 14,
    velocityDecay: 0.35,
    dyeDecay: 0.7,
    buoyancy: 4,
    dyeAmount: 0.8,
  },
  {
    palette: [
      [0.239, 1.0, 0.612],
      [0.098, 0.878, 0.784],
      [0.482, 0.361, 1.0],
      [0.18, 0.627, 1.0],
      [0.769, 0.361, 1.0],
    ],
    background: [0, 4 / 252, 16 / 248],
    vorticity: 30,
    velocityDecay: 0.2,
    dyeDecay: 0.75,
    buoyancy: 0,
    dyeAmount: 1.1,
  },
];

/** A palette colour by finger slot, wrapping in both directions. */
export function colorOf(mode: Mode, slot: number): number[] {
  return mode.palette[((slot % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE];
}
