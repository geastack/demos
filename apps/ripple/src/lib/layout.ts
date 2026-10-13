// Panel geometry and chrome layout, all derived from the screen size read once
// at startup (CSS px = panel px: `cssDevicePixelRatio` is 1).
//
//   board              panel     dye grid (8 px)  velocity grid (16 px + ring)  field px   chrome
//   mosaico            480x480   60x60            32x32                         480x480    large
//   amoled             410x502   51x62            28x33                         408x496    large
//   STM32F746G-Disc.   480x272   60x34            32x19                         480x272    small
//
// The fluid field is a whole number of dye cells, so on the amoled it is a few
// pixels smaller than the panel and sits centred; the margin is painted in the
// mode's background.
export const PANEL_W = Math.floor(window.innerWidth);
export const PANEL_H = Math.floor(window.innerHeight);

export const DYE_CELL = 8;
export const DYE_W = Math.floor(PANEL_W / DYE_CELL);
export const DYE_H = Math.floor(PANEL_H / DYE_CELL);
export const FIELD_W = DYE_W * DYE_CELL;
export const FIELD_H = DYE_H * DYE_CELL;
export const FIELD_X = (PANEL_W - FIELD_W) >> 1;
export const FIELD_Y = (PANEL_H - FIELD_H) >> 1;

// Velocity: 16 px cells covering the field, plus a ring of wall cells.
export const VEL_CELL = 16;
export const VEL_W = Math.ceil(FIELD_W / VEL_CELL) + 2;
export const VEL_H = Math.ceil(FIELD_H / VEL_CELL) + 2;

export const LARGE = Math.min(PANEL_W, PANEL_H) >= 400;
export const PORTRAIT = PANEL_H > PANEL_W * 1.1;
// The amoled panel has rounded corners: keep chrome clear of them.
export const MARGIN = PORTRAIT ? 24 : 12;

export const INK = 0;
export const SMOKE = 1;
export const AURORA = 2;
export const MODE_NAMES = ["Ink", "Smoke", "Aurora"];

// Mode pill, top right: three segments, the active chip inset inside. 40 px
// tall: the touch minimum.
export const SEGMENT = LARGE ? 64 : 56;
export const INSET = 4;
export const PILL_HEIGHT = 40;
export const PILL_WIDTH = SEGMENT * MODE_NAMES.length + 2 * INSET;
export const PILL_TOP = PORTRAIT ? 20 : 10;
export const PILL_LEFT = PANEL_W - MARGIN - PILL_WIDTH;
export const PILL_CENTRE_Y = PILL_TOP + PILL_HEIGHT / 2;

// Brand, top left: a dot in the mode's accent, then the wordmark.
export const DOT_X = MARGIN + 9;
export const WORDMARK_X = MARGIN + 20;

export const HINT_CENTRE_Y = PANEL_H - (PORTRAIT ? 32 : 20);
