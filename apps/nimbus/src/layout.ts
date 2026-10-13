// The panel's shape, read once at startup. Everything on screen derives from
// these numbers: the same code lays out the 480x272 landscape panel (the
// STM32F746G-Discovery), the 480x480 square (Mosaico) and the 410x502
// portrait with rounded corners (the AMOLED).

export const W = window.innerWidth;
export const H = window.innerHeight;

export const WIDE = W * 10 > H * 12; // landscape
export const PORTRAIT = H * 10 > W * 11;
export const SQUARE = !WIDE && !PORTRAIT;
// A narrow panel stacks what the wider ones put side by side.
export const STACKED = W < 440;
// Extra clearance from the rounded corners of the AMOLED panel.
export const EDGE = PORTRAIT ? 14 : 0;
export const MARGIN = PORTRAIT ? 20 : 16;

// ---- Illustrations: one 480x502 image per scene ----
// The 480x272 scene sits at the bottom of the image with a synthetic sky
// above it; the panel shows the image's bottom H rows, and its middle W
// columns when narrower than 480. SCENE_X / SCENE_Y are where the original
// 480x272 scene lands on the panel, which is what the sun, moon, glow and the
// cloud rows are positioned against.
export const ART_H = 502;
export const ART_TOP = H - ART_H;
export const SCENE_X = W >= 480 ? Math.floor((W - 480) / 2) : -Math.min(70, 480 - W);
export const SCENE_Y = H - 272;

// ---- Now ----
export const BUTTON_Y = 26 + EDGE;
export const BUTTON_X = [W - 122, W - 78, W - 34];
export const CLOCK_Y = 8 + EDGE;
export const HERO_X = WIDE ? 12 : MARGIN - 4;
export const HERO_Y = WIDE ? 24 : 40 + EDGE;
// The hero numeral's line box: 94 px at 80 px type, 132 px at 112.
export const HERO_LINE = WIDE ? 94 : 132;
export const CONDITION_Y = HERO_Y + HERO_LINE;
export const DETAILS_Y = CONDITION_Y + 28;
export const CHIPS_Y = DETAILS_Y + 24;
export const HERO_FONT = WIDE ? "80px Outfit XL" : "112px Outfit XL";

// ---- The hourly strip ----
export const STRIP_H = 68;
// Clear of the panel's rounded bottom corners.
export const STRIP_PAD = PORTRAIT ? 14 : 0;
export const STRIP_TOP = H - STRIP_H - STRIP_PAD;
export const STRIP_LEFT = PORTRAIT ? 16 : 8; // the focus slot's left edge

// ---- Panels ----
export const ROW_H = WIDE ? 24 : 32;
export const ROWS_DY = 50;
export const WEEK_H = ROWS_DY + 7 * ROW_H + (WIDE ? 2 : 16);
// Today: the sun arc and this device's readings, side by side or stacked.
export const TODAY_H = STACKED ? 424 : WIDE ? 220 : 236;
export const CLOSE_X = W - 32;
export const CLOSE_DY = 26;

// Week track.
export const TRACK_W = W - 296;
export const TRACK_X = 208;
export const HIGH_RIGHT = W - 40;

// ---- Boot ----
export const BOOT_DY = Math.floor((H - 272) / 2);
