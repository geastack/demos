// Screen-derived layout. Everything below follows from the panel's CSS size,
// read once at startup: 480x272 (landscape, the design size), 480x480
// (square) or 410x502 (portrait). Landscape puts the art beside the controls;
// square and portrait stack them. One set of formulas serves all three, so
// the layout that cannot be flashed (480x272) comes from the same code.

export const W = window.innerWidth;
export const H = window.innerHeight;
export const LAND = W * 5 > H * 6; // wider than 1.2:1
export const PORT = !LAND && H * 10 > W * 11; // taller than 1.1:1

function pick(land: number, square: number, port: number): number {
  return LAND ? land : PORT ? port : square;
}

// Inset of corner controls (the round AMOLED corners need more air).
export const PAD = pick(16, 16, 24);

// ---- Now Playing ----
export const ART = 192;
export const ART_X = LAND ? 24 : Math.floor((W - ART) / 2);
export const ART_Y = pick(40, 62, 74);
export const COL_W = pick(208, 312, 338);
export const COL_X = LAND ? 248 : Math.floor((W - COL_W) / 2);
export const TOP_X = LAND ? 248 : 24;
export const TOP_W = LAND ? 208 : W - 48;
export const TOP_Y = pick(16, 16, 26);
export const META_Y = pick(62, 266, 280);
export const SPEC_Y = pick(124, 328, 344);
export const SCRUB_Y = pick(172, 374, 392);
export const CTRL_Y = pick(210, 414, 432);
export const HALO_W = pick(256, 340, 340);
export const HALO_H = pick(320, 340, 340);
export const HALO_X = ART_X + ART / 2 - HALO_W / 2;
export const HALO_Y = ART_Y + ART / 2 - HALO_H / 2;
export const TOAST_X = ART_X + 8;
export const TOAST_Y = ART_Y + 152;

// ---- Library (cover flow) ----
export const FLOW_CX = Math.floor(W / 2);
export const FLOW_CY = pick(114, 210, 232);
export const FLOW_BIG = pick(144, 192, 192);
export const FLOW_SMALL = pick(96, 128, 104);
export const FLOW_FAR = pick(72, 96, 88);
export const FLOW_NEAR_GAP = pick(128, 168, 150);
export const FLOW_FAR_GAP = pick(92, 100, 84);
export const FLOW_COPY_Y = FLOW_CY + FLOW_BIG / 2 + pick(10, 24, 24);
export const FLOW_DOTS_Y = FLOW_COPY_Y + pick(58, 64, 64);
export const FLOW_TOUCH_Y = pick(40, FLOW_CY - FLOW_BIG / 2 - 24, FLOW_CY - FLOW_BIG / 2 - 24);
export const FLOW_TOUCH_H = pick(152, FLOW_BIG + 48, FLOW_BIG + 48);
export const HEAD_X = PAD + 50;
export const HEAD_Y = PAD + 11;

// ---- Queue ----
export const ROW_H = pick(42, 48, 52);
export const LIST_W = LAND ? 288 : W - 48;
export const LIST_X = LAND ? 176 : 24;
export const LIST_Y = pick(56, 208, 220);
export const LIST_H = ROW_H * 5;
export const ROW_TEXT_W = LIST_W - 116;
export const QUEUE_ART = LAND ? 144 : 96;
export const QUEUE_ART_X = LAND ? 16 : 24;
export const QUEUE_ART_Y = pick(64, 64, 76);
export const QUEUE_NOW_X = LAND ? 16 : 132;
export const QUEUE_NOW_Y = LAND ? 216 : QUEUE_ART_Y + 14;
export const QUEUE_NOW_W = LAND ? 144 : W - 156;
export const QUEUE_HEAD_X = LIST_X;
export const QUEUE_HEAD_Y = pick(16, 176, 190);

// ---- Volume overlay (a panel over the right side) ----
export const VOL_W = 248;
export const VOL_X = W - VOL_W;
export const PILL_H = pick(192, 256, 280);
export const PILL_Y = Math.floor((H - PILL_H) / 2);

// ---- Sheets ----
export const SHEET_ROOMS_Y = H - pick(192, 192, 192);
export const SHEET_SLEEP_Y = H - (LAND ? 132 : 188);
export const ROOM_W = Math.floor((W - 72) / 3);
export const SHEET_PAD = 24;

// ---- Ambient ----
export const AMB_ART = pick(144, 192, 192);
export const AMB_ART_X = LAND ? 48 : Math.floor((W - AMB_ART) / 2);
export const AMB_ART_Y = pick(64, 56, 70);
export const AMB_COPY_X = LAND ? 224 : 0;
export const AMB_COPY_Y = LAND ? 48 : AMB_ART_Y + AMB_ART + 14;
export const AMB_COPY_W = LAND ? 256 : W;
export const AMB_LINE_X = LAND ? 224 : Math.floor((W - 208) / 2);
export const AMB_LINE_Y = AMB_COPY_Y + pick(156, 160, 160);

// ---- Boot (the 480x272 stage, centred) ----
export const BOOT_X = Math.floor((W - 480) / 2);
export const BOOT_Y = Math.floor((H - 272) / 2);
