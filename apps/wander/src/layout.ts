// The panel's shape, read once at startup. Everything on screen derives from
// these numbers: the same code lays out the 480x272 landscape panel (the
// STM32F746G-Discovery), the 480x480 square (Mosaico) and the 410x502
// portrait with rounded corners (the AMOLED).

export const W = window.innerWidth;
export const H = window.innerHeight;

export const WIDE = W * 10 > H * 12; // landscape
export const PORTRAIT = H * 10 > W * 11;
export const SQUARE = !WIDE && !PORTRAIT;
// Extra clearance from the rounded corners of the AMOLED panel.
export const EDGE = PORTRAIT ? 14 : 0;

export function px(value: number): `${number}px` {
  return `${value}px`;
}

// ---- Artwork: one 480x502 image per destination ----
// The poster (480x272) sits at the bottom of the image, a synthetic sky
// continues above it. The panel shows the image's bottom H rows (the landscape
// panel exactly the poster), its middle W columns when narrower than 480.
export const ART_W = 480;
export const ART_H = 502;
export const ART_TOP = H - ART_H;
// Left edge of the art crop per destination (the subject stays in view).
const FOCUS = [70, 70, 40, 70, 50];

export function artLeft(place: number): number {
  return W >= ART_W ? Math.floor((W - ART_W) / 2) : -Math.min(FOCUS[place], ART_W - W);
}

// ---- Discover ----
export const BOTTOM_PAD = PORTRAIT ? 28 : 16;
export const PILL_H = 28;
// Narrow panels put the page dots on their own row under the chips.
export const STACKED = W < 440;
export const CHIPS_TOP = H - BOTTOM_PAD - PILL_H - (STACKED ? PILL_H + 12 : 0);
export const DOTS_TOP = H - BOTTOM_PAD - PILL_H;
export const COPY_TOP = 12 + EDGE;
export const SAVED_TOP = 16 + EDGE;

// ---- Detail ----
// How far the poster shifts up to become the band above the sheet, and where
// the sheet starts. The band shows the part of the poster worth seeing.
export const BAND_SHIFT = WIDE ? 64 : SQUARE ? 208 : 290;
export const SHEET_TOP = WIDE ? 96 : SQUARE ? H - 208 : H - 412;
export const SHEET_HEIGHT = H - SHEET_TOP + 24; // the corners below the panel are off screen
export const BODY_DY = SQUARE ? 16 : 0; // the sheet's content, below its handle
export const BACK_TOP = 16 + EDGE;

// ---- Boot ----
export const BOOT_DY = Math.floor((H - 272) / 2);

// Size and animation classes, chosen once (a rule per shape, since keyframe
// distances are fixed pixels).
export const HERO_FONT = WIDE ? "t-hero copy-title" : "t-hero-l copy-title";
export const BAND_CLASS = WIDE ? "band band-l" : SQUARE ? "band band-s" : "band band-p";
export const RETURN_CLASS = WIDE ? "stage stage-return-l" : SQUARE ? "stage stage-return-s" : "stage stage-return-p";
