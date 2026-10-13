// Screen-derived layout. Everything follows from the panel's CSS size, read
// once at startup: 480x272 (landscape, the design size), 480x480 (square) or
// 410x502 (portrait). Landscape lays screens out in columns; square and
// portrait stack them. One set of formulas serves all three, so the layout
// that cannot be flashed (480x272) comes from the same code. Positions are
// applied inline from these numbers; the CSS holds the look.

export const W = window.innerWidth;
export const H = window.innerHeight;
export const LAND = W * 5 > H * 6; // wider than 1.2:1
export const PORT = !LAND && H * 10 > W * 11; // taller than 1.1:1
export const CX = Math.floor(W / 2);

function pick(land: number, square: number, port: number): number {
  return LAND ? land : PORT ? port : square;
}

/** Inset of corner controls (the round AMOLED corners need more air). */
export const PAD = pick(16, 16, 24);
export const CONTENT_W = W - 2 * PAD;

// ---- Heat arc (Preheat, Manual dial) and step timer ring ----
export const ARC_SIZE = pick(216, 232, 256);
export const TIMER_SIZE = pick(176, 200, 224);
export const ARC_X = Math.floor((W - ARC_SIZE) / 2);

// ---- Flow bar (close / title / demo chip) and the step segments ----
export const BAR_TITLE_X = PAD + 52;
export const DEMO_TOP = PAD + 4;
export const SEGMENTS_Y = pick(66, PAD + 50, PAD + 50);

// ---- Recipes ----
export const BAR_Y = pick(8, 14, 22);
export const CARD_W = pick(256, 320, 288);
export const CARD_H = pick(152, 190, 171);
export const CARD_SPACING = pick(236, 270, 250);
export const CARD_PARALLAX = pick(32, 40, 36);
export const STAGE_Y = pick(44, 108, 140);
export const LABEL_Y = STAGE_Y + CARD_H + pick(6, 28, 32);
export const DOTS_Y = LABEL_Y + pick(56, 66, 66);

// ---- Detail and Ready (the photo is 480x272) ----
export const HERO_X = pick(0, 0, W - 480);
export const HERO_Y = pick(0, 0, -20);
export const HERO_H = pick(272, 272, 232);
export const DETAIL_HEAD_Y = pick(64, 64, 246);
export const DETAIL_SPECS_Y = pick(118, 118, 304);
export const STEPS_Y = pick(146, 296, 340);
export const STEPS_W = LAND ? 260 : CONTENT_W;
export const STEP_PITCH = pick(24, 28, 28);
export const STEP_GAP = STEP_PITCH - 20;
export const START_Y = HERO_H - PAD - 40;
export const READY_BADGE_Y = pick(52, 88, 88);
export const GLOW_X = LAND ? 248 : CX - 96;
export const GLOW_Y = pick(40, 40, 24);
export const READY_COPY_Y = pick(116, HERO_H + 16, HERO_H + 16);

// ---- Manual ----
export const DIAL_Y = pick(44, 52, 58);
export const DIAL_CY = DIAL_Y + Math.floor(ARC_SIZE / 2);
export const MODES_X = LAND ? 344 : PAD;
export const MODES_Y = LAND ? 56 : DIAL_Y + ARC_SIZE - 4;
export const MODES_W = LAND ? 120 : CONTENT_W;
export const CHIP_W = LAND ? 120 : Math.floor((CONTENT_W - 8) / 2);
export const CHIP_H = LAND ? 34 : 40;
export const CHIP_GAP = LAND ? 6 : 8;
export const CHIP_COL_PITCH = CHIP_W + CHIP_GAP;
export const CHIP_ROW_PITCH = CHIP_H + CHIP_GAP;
export const MODES_H = LAND ? 154 : 2 * CHIP_H + CHIP_GAP;
export const MANUAL_END_Y = MODES_Y + MODES_H + 8;
export const BOTTOM_ROW_Y = H - PAD - 40; // stacked layouts' action row

// ---- Preheat ----
export const ARC_Y = pick(52, 76, 86);
export const ARC_CY = ARC_Y + Math.floor(ARC_SIZE / 2);
export const PREHEAT_FLOW_X = PAD;
export const PREHEAT_COL_Y = LAND ? 84 : ARC_Y + ARC_SIZE + 6;
export const PREHEAT_STATS_X = LAND ? 360 : CX + 16;

// ---- Cook ----
export const TIMER_Y = pick(84, 84, 96);
export const TIMER_X = LAND ? 288 : Math.floor((W - TIMER_SIZE) / 2);
export const STEP_COPY_Y = LAND ? 88 : TIMER_Y + TIMER_SIZE + 14;
export const STEP_CONTROLS_Y = LAND ? 208 : BOTTOM_ROW_Y;
export const PROMPT_ART_X = LAND ? 32 : Math.floor((W - 136) / 2);
export const PROMPT_ART_Y = pick(92, 136, 148);
export const PROMPT_COPY_X = LAND ? 192 : PAD;
export const PROMPT_COPY_Y = LAND ? 92 : PROMPT_ART_Y + 136 + 20;
export const PROMPT_COPY_W = LAND ? 272 : CONTENT_W;

// ---- Idle and boot ----
export const IDLE_GLOW_X = LAND ? 288 : CX - 96;
export const IDLE_GLOW_Y = pick(40, 54, 74);
export const IDLE_MARK_X = IDLE_GLOW_X + 72;
export const IDLE_MARK_Y = IDLE_GLOW_Y + 72;
export const IDLE_COPY_X = LAND ? 32 : 0;
export const IDLE_COPY_Y = LAND ? 64 : IDLE_GLOW_Y + 192 + 16;
export const IDLE_COPY_W = LAND ? 256 : W;
export const BOOT_X = Math.floor((W - 480) / 2);
export const BOOT_Y = Math.floor((H - 272) / 2);
