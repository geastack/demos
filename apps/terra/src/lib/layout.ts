// Where the instruments sit, derived from the panel size read once at startup
// (CSS px = panel px: `cssDevicePixelRatio` is 1). One code path serves every
// panel; only the sizes, the margins and the one-row-or-two bottom arrangement
// follow from the numbers.
//
//   panel     class   margin  bottom         compass  telemetry  chips       title
//   480x480   large   16      one row        240x56   152x64     4 x 64x40   248x84
//   410x502   large   28      two rows       240x56   152x64     4 x 85x40   248x84
//   480x272   small   16      one row        216x50   136x56     4 x 60x40   208x68
//
// The bottom is one row (telemetry left, chips right) when both fit between
// the margins, else the telemetry sits centred above a full-width chip row.
// The 480x272 numbers: 16 + 136 + 12 + (4 x 60 + 3 x 4 = 252) + 16 = 432
// <= 480, so one row, chips 40 px tall ending 16 px above the bottom.
export type Box = { x: number; y: number; width: number; height: number; radius: number };

// The panel size, rounded down to even (the renderer paints rays two pixels wide).
export const PANEL_W = Math.floor(window.innerWidth / 2) * 2;
export const PANEL_H = Math.floor(window.innerHeight / 2) * 2;
export const LARGE = Math.min(PANEL_W, PANEL_H) >= 400;
export const PORTRAIT = PANEL_H > PANEL_W * 1.1;

const MARGIN = PORTRAIT ? 28 : 16;
const BOTTOM = PORTRAIT ? 28 : 16;
const GAP = 12;

export const CHIP_HEIGHT = 40;
export const CHIP_GAP = 4;
const CHIPS = 4;
const SINGLE_ROW_CHIP = LARGE ? 64 : 60;

const TELEMETRY_WIDTH = LARGE ? 152 : 136;
const TELEMETRY_HEIGHT = LARGE ? 64 : 56;
const STACKED = MARGIN + TELEMETRY_WIDTH + GAP + (CHIPS * SINGLE_ROW_CHIP + (CHIPS - 1) * CHIP_GAP) + MARGIN > PANEL_W;

export const CHIP_WIDTH = STACKED
  ? Math.floor((PANEL_W - 2 * MARGIN - (CHIPS - 1) * CHIP_GAP) / CHIPS)
  : SINGLE_ROW_CHIP;
export const CHIP_LEFT = STACKED ? MARGIN : PANEL_W - MARGIN - (CHIPS * CHIP_WIDTH + (CHIPS - 1) * CHIP_GAP);
export const CHIP_TOP = PANEL_H - BOTTOM - CHIP_HEIGHT;

export function chipLeft(chip: number): number {
  return CHIP_LEFT + chip * (CHIP_WIDTH + CHIP_GAP);
}

export const TELEMETRY: Box = {
  x: STACKED ? Math.floor((PANEL_W - TELEMETRY_WIDTH) / 2) : MARGIN,
  y: STACKED ? CHIP_TOP - 8 - TELEMETRY_HEIGHT : PANEL_H - BOTTOM - TELEMETRY_HEIGHT,
  width: TELEMETRY_WIDTH,
  height: TELEMETRY_HEIGHT,
  radius: 12,
};
// Rows of the two readouts inside the plate, and the unit column's width.
export const TELEMETRY_ROW_ALT = Math.round(TELEMETRY_HEIGHT * 0.3);
export const TELEMETRY_ROW_SPEED = Math.round(TELEMETRY_HEIGHT * 0.7);
export const TELEMETRY_UNITS = LARGE ? 52 : 46;

const COMPASS_WIDTH = LARGE ? 240 : 216;
const COMPASS_HEIGHT = LARGE ? 56 : 50;
export const COMPASS: Box = {
  x: Math.floor((PANEL_W - COMPASS_WIDTH) / 2),
  y: PORTRAIT ? 16 : LARGE ? 12 : 6,
  width: COMPASS_WIDTH,
  height: COMPASS_HEIGHT,
  radius: 12,
};
export const COMPASS_READOUT_Y = COMPASS.y + (LARGE ? 13 : 11);
export const COMPASS_LETTERS_Y = COMPASS.y + (LARGE ? 44 : 39);

const TITLE_WIDTH = LARGE ? 248 : 208;
const TITLE_HEIGHT = LARGE ? 84 : 68;
export const TITLE: Box = {
  x: Math.floor((PANEL_W - TITLE_WIDTH) / 2),
  y: Math.round(PANEL_H * 0.4 - TITLE_HEIGHT / 2),
  width: TITLE_WIDTH,
  height: TITLE_HEIGHT,
  radius: 12,
};
export const TITLE_ROW_NAME = Math.round(TITLE_HEIGHT * 0.38);
export const TITLE_ROW_COORDINATES = Math.round(TITLE_HEIGHT * 0.735);

// The heading tape: ticks at TAPE_TOP, letters below, readout above.
export const TAPE_CENTER = Math.floor(PANEL_W / 2);
export const TAPE_TOP = COMPASS.y + (LARGE ? 27 : 24);
export const PX_PER_DEGREE = 2;
export const TAPE_HALF_SPAN = Math.floor((COMPASS_WIDTH / 2 - 8) / PX_PER_DEGREE); // degrees either side of the heading
