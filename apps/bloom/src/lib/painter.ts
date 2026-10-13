import type { CanvasRenderingContext2D, ImageData565 } from "@geastack/core";
import { FIELD_X, FIELD_Y, LARGE, PANEL_H, PANEL_W, PORTRAIT } from "./layout";
import { PATTERNS } from "./patterns";

// Fonts: each (family, size) pair is baked by a rule in styles/app.css. The
// large class is for the 480x480 and 410x502 panels, the small one for 480x272.
const WORDMARK_FONT = LARGE ? "32px Fraunces SB" : "24px Fraunces SB";
const HINT_FONT = LARGE ? "14px Manrope M" : "12px Manrope M";
const LABEL_FONT = LARGE ? "14px Manrope B" : "12px Manrope B";

const CREAM = "rgb(248,244,232)";
const PLATE = "rgb(8,8,16)";
const CHIP_ON = "rgb(48,44,48)";

const WORDMARK = "Bloom";
const HINT = "Touch to plant life";
// The amoled panel has rounded corners: keep text and controls clear of them.
const MARGIN = PORTRAIT ? 24 : 16;
const WORDMARK_TOP = MARGIN - 6;
const HINT_TOP = WORDMARK_TOP + (LARGE ? 46 : 32);

// Pattern bar: a plate holding one chip per pattern, bottom right (centred in
// portrait). Chips are 40 px tall, the touch minimum.
const BAR_INSET = PORTRAIT ? 24 : 12;
const BAR_PAD = 4;
const CHIP_GAP = 4;
const CHIP_PAD = LARGE ? 14 : 12;
const CHIP_HEIGHT = 40;
const BAR_HEIGHT = CHIP_HEIGHT + 2 * BAR_PAD;
const BAR_TOP = PANEL_H - BAR_INSET - BAR_HEIGHT;
const CHIP_TOP = BAR_TOP + BAR_PAD;
const CHIP_CENTRE_Y = CHIP_TOP + CHIP_HEIGHT / 2;

// Blits the field and paints the chrome over it in one canvas batch. Nothing
// retained sits over the canvas: that would cost a compositing copy per frame.
//
// Every canvas call goes through the `ctx` field: generated code passes a
// context parameter by value, and a copy's recorded commands are lost. Style
// writes go through setters that skip repeats.
export class Painter {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly chipLeft: number[] = [0, 0, 0, 0];
  private readonly chipWidth: number[] = [0, 0, 0, 0];
  private barLeft = 0;
  private barWidth = 0;
  private labelCentre = 0;
  private font = "";
  private fill = "";
  private alpha = -1;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.layout();
  }

  /** The pattern chip under a panel point, or -1. */
  chipAt(x: number, y: number): number {
    if (y < BAR_TOP || y > BAR_TOP + BAR_HEIGHT || x < this.barLeft) return -1;

    for (let i = 0; i < PATTERNS.length; i++) {
      if (x < this.chipLeft[i] + this.chipWidth[i] + CHIP_GAP / 2) return i;
    }
    return PATTERNS.length - 1;
  }

  paint(image: ImageData565, pattern: number, hintOpacity: number) {
    this.ctx.beginBatch();
    this.ctx.putImageData(image, FIELD_X, FIELD_Y);

    this.setFont(WORDMARK_FONT);
    this.setFill(CREAM);
    this.ctx.fillText(WORDMARK, MARGIN, WORDMARK_TOP);

    if (hintOpacity > 0) {
      this.setAlpha(hintOpacity);
      this.setFont(HINT_FONT);
      this.ctx.fillText(HINT, MARGIN, HINT_TOP);
      this.setAlpha(1);
    }

    this.capsule(this.barLeft, BAR_TOP, this.barWidth, BAR_HEIGHT, PLATE);
    this.capsule(this.chipLeft[pattern], CHIP_TOP, this.chipWidth[pattern], CHIP_HEIGHT, CHIP_ON);

    this.setFont(LABEL_FONT);
    this.setFill(CREAM);
    for (let i = 0; i < PATTERNS.length; i++) {
      this.ctx.fillText(PATTERNS[i].name, this.chipLeft[i] + CHIP_PAD, Math.round(CHIP_CENTRE_Y - this.labelCentre));
    }
    this.ctx.endBatch();
  }

  // Chip widths follow their labels; the bar hugs them from the right.
  private layout() {
    this.setAlpha(1);
    this.setFont(LABEL_FONT);
    this.labelCentre = this.ctx.measureTextInkCenter("A");

    let width = 2 * BAR_PAD - CHIP_GAP;
    for (let i = 0; i < PATTERNS.length; i++) {
      this.chipWidth[i] = Math.round(this.ctx.measureText(PATTERNS[i].name)) + 2 * CHIP_PAD;
      width += this.chipWidth[i] + CHIP_GAP;
    }
    this.barWidth = width;
    this.barLeft = PORTRAIT ? Math.round((PANEL_W - width) / 2) : PANEL_W - BAR_INSET - width;

    let left = this.barLeft + BAR_PAD;
    for (let i = 0; i < PATTERNS.length; i++) {
      this.chipLeft[i] = left;
      left += this.chipWidth[i] + CHIP_GAP;
    }
  }

  // Opaque, so the rectangle and the two end discs may overlap.
  private capsule(left: number, top: number, width: number, height: number, fill: string) {
    const radius = height / 2;
    this.setFill(fill);
    this.ctx.fillRect(left + radius, top, width - height, height);
    this.ctx.fillCircle(left + radius, top + radius, radius, fill);
    this.ctx.fillCircle(left + width - radius, top + radius, radius, fill);
  }

  private setFont(font: string) {
    if (font === this.font) return;

    this.font = font;
    this.ctx.font = font;
  }

  private setFill(fill: string) {
    if (fill === this.fill) return;

    this.fill = fill;
    this.ctx.fillStyle = fill;
  }

  private setAlpha(alpha: number) {
    if (alpha === this.alpha) return;

    this.alpha = alpha;
    this.ctx.globalAlpha = alpha;
  }
}
