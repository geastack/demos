import type { CanvasRenderingContext2D, ImageData565 } from "@geastack/core";
import {
  DOT_X,
  FIELD_H,
  FIELD_W,
  FIELD_X,
  FIELD_Y,
  HINT_CENTRE_Y,
  INSET,
  LARGE,
  MODE_NAMES,
  PANEL_H,
  PANEL_W,
  PILL_CENTRE_Y,
  PILL_HEIGHT,
  PILL_LEFT,
  PILL_TOP,
  PILL_WIDTH,
  SEGMENT,
  WORDMARK_X,
} from "./layout";

// Fonts: each (family, size) pair is baked by a rule in styles/app.css.
// The large class is for the 480x480 and 410x502 panels, the small one for 480x272.
const WORDMARK_FONT = LARGE ? "24px Sora SB" : "20px Sora SB";
const LABEL_FONT = LARGE ? "14px Space Grotesk M" : "12px Space Grotesk M";

const WHITE = "rgb(248,248,248)";
const MUTED = "rgb(160,164,176)";
const INK = "rgb(8,8,16)";
const PLATE = "rgb(8,8,16)";
const CHIP = "rgb(248,248,248)";
const DOT_RADIUS = 5;

const WORDMARK = "Ripple";
const HINT = "Touch with up to five fingers";

// Blits the fluid and paints the chrome over it in one canvas batch: the
// mode pill, the brand dot in the mode's accent, and the text.
//
// Every canvas call goes through the `ctx` field: generated code passes a
// context parameter by value, and a copy's recorded commands are lost. Style
// writes go through setters that skip repeats.
export class ChromePainter {
  private readonly ctx: CanvasRenderingContext2D;
  private font = "";
  private fill = "";
  private alpha = -1;
  private wordmarkCentre = 0;
  private labelCentre = 0;
  private hintWidth = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.measure();
  }

  paint(image: ImageData565, mode: number, accent: string, background: string, hintOpacity: number) {
    this.ctx.beginBatch();
    this.margins(background);
    this.ctx.putImageData(image, FIELD_X, FIELD_Y);

    this.capsule(PILL_LEFT, PILL_TOP, PILL_WIDTH, PILL_HEIGHT, PLATE);
    this.capsule(PILL_LEFT + INSET + SEGMENT * mode, PILL_TOP + INSET, SEGMENT, PILL_HEIGHT - 2 * INSET, CHIP);
    this.setFill(accent);
    this.ctx.fillCircle(DOT_X, PILL_CENTRE_Y, DOT_RADIUS, accent);

    this.setFont(WORDMARK_FONT);
    this.setFill(WHITE);
    this.text(WORDMARK, WORDMARK_X, PILL_CENTRE_Y, this.wordmarkCentre);

    this.setFont(LABEL_FONT);
    this.setFill(MUTED);
    for (let segment = 0; segment < MODE_NAMES.length; segment++) {
      if (segment !== mode) this.label(segment);
    }
    this.setFill(INK);
    this.label(mode);

    if (hintOpacity > 0) {
      this.setAlpha(hintOpacity);
      this.setFill(WHITE);
      this.text(HINT, (PANEL_W - this.hintWidth) / 2, HINT_CENTRE_Y, this.labelCentre);
      this.setAlpha(1);
    }
    this.ctx.endBatch();
  }

  // The field is a whole number of cells: where the panel is a few pixels
  // larger, the strip around it is painted in the mode's background.
  private margins(background: string) {
    const right = FIELD_X + FIELD_W;
    const bottom = FIELD_Y + FIELD_H;
    if (FIELD_X === 0 && FIELD_Y === 0 && right === PANEL_W && bottom === PANEL_H) return;

    this.setFill(background);
    this.ctx.fillRect(0, 0, PANEL_W, FIELD_Y);
    this.ctx.fillRect(0, bottom, PANEL_W, PANEL_H - bottom);
    this.ctx.fillRect(0, FIELD_Y, FIELD_X, FIELD_H);
    this.ctx.fillRect(right, FIELD_Y, PANEL_W - right, FIELD_H);
  }

  // Ink centres, taken once: fillText anchors the line box's top.
  private measure() {
    this.setAlpha(1);
    this.setFont(WORDMARK_FONT);
    this.wordmarkCentre = this.ctx.measureTextInkCenter("R");
    this.setFont(LABEL_FONT);
    this.labelCentre = this.ctx.measureTextInkCenter("A");
    this.hintWidth = this.ctx.measureText(HINT);
  }

  private label(segment: number) {
    const name = MODE_NAMES[segment];
    const centre = PILL_LEFT + INSET + SEGMENT * segment + SEGMENT / 2;
    this.text(name, centre - this.ctx.measureText(name) / 2, PILL_CENTRE_Y, this.labelCentre);
  }

  // Opaque, so the rectangle and the two end discs may overlap.
  private capsule(left: number, top: number, width: number, height: number, fill: string) {
    const radius = height / 2;
    this.setFill(fill);
    this.ctx.fillRect(left + radius, top, width - height, height);
    this.ctx.fillCircle(left + radius, top + radius, radius, fill);
    this.ctx.fillCircle(left + width - radius, top + radius, radius, fill);
  }

  private text(text: string, x: number, centreY: number, inkCentre: number) {
    this.ctx.fillText(text, Math.round(x), Math.round(centreY - inkCentre));
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
