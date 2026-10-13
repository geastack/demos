import type { CanvasRenderingContext2D, ImageData565 } from "@geastack/core";
import {
  CARDS,
  FONTS,
  INK_SAMPLES,
  LEFT,
  MARGIN,
  NAME,
  NAME_SMALL,
  NAME_SMALLER,
  RIGHT,
  RULE_COLOURS,
  RULE_DELAY,
  RULE_WIDTH,
  RULE_Y,
  SCRIM_ROWS,
} from "./captions";
import { clamp01, FRAME_ROWS, HEIGHT, WIDTH, wordsOf } from "./frame";

const RISE_S = 0.42; // entrance: fade in while rising
const RISE_PX = 14;
const LEAVE_S = 0.32; // exit: fade out while sinking
const LEAVE_PX = 8;
const SCRIM_STEPS = 16;

const SCRIM = "rgb(8,6,24)";
const FLASH = "rgb(255,244,232)";
const BLACK = "rgb(0,0,0)";
const WHITE = "rgb(255,255,255)";

// Decelerating ease (cubic out).
function easeOut(e: number): number {
  const i = 1 - clamp01(e);
  return 1 - i * i * i;
}

// Owns the frame the effects render into and puts it on the canvas, with
// the caption cards, washes and progress bar drawn over it in one batch.
//
// Every canvas call goes through the `ctx` field: generated code passes a
// context parameter by value, and a copy's recorded commands are lost.
// Style writes skip repeats: each one also copies the context.
export class Presenter {
  readonly pixels: Uint16Array;
  readonly words: Uint32Array;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData565;
  private readonly inkCentres = new Float64Array(FONTS.length);
  private font = "";
  private fill = "";
  private alpha = -1;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.image = ctx.createImageData565(WIDTH, FRAME_ROWS);
    this.pixels = this.image.data16;
    this.words = wordsOf(this.pixels);
    for (let f = 0; f < FONTS.length; f++) {
      this.setFont(FONTS[f]);
      this.inkCentres[f] = this.ctx.measureTextInkCenter(INK_SAMPLES[f]);
    }
  }

  // `card` -1 for none, shown `time` seconds, `remaining` seconds left;
  // `flash` and `fade` wash towards warm white and black, 0..1.
  present(card: number, time: number, remaining: number, flash: number, fade: number, progress: number) {
    this.ctx.beginBatch();
    this.ctx.putImageData(this.image, 0, 0);
    if (card >= 0) this.caption(card, time, remaining);
    if (flash > 0) this.wash(FLASH, flash);
    if (fade > 0) this.wash(BLACK, fade);
    this.progress(progress);
    this.setAlpha(1);
    this.ctx.endBatch();
  }

  private caption(card: number, time: number, remaining: number) {
    const leave = clamp01(remaining / LEAVE_S);
    const sink = (1 - leave) * LEAVE_PX;
    if (card > 0) this.scrim(clamp01(time / RISE_S) * leave);

    const lines = CARDS[card];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const rise = easeOut((time - line.delay) / RISE_S);
      const opacity = rise * leave;
      if (opacity <= 0 || line.text === "") continue;

      // A name wider than the room between the margins steps down a size.
      let font = line.font;
      this.setFont(FONTS[font]);
      let width = this.ctx.measureText(line.text);
      if (font === NAME && width > WIDTH - 2 * MARGIN) {
        font = NAME_SMALL;
        this.setFont(FONTS[font]);
        width = this.ctx.measureText(line.text);
        if (width > WIDTH - 2 * MARGIN) {
          font = NAME_SMALLER;
          this.setFont(FONTS[font]);
          width = this.ctx.measureText(line.text);
        }
      }
      this.setFill(line.colour);
      this.setAlpha(opacity);
      const x = line.align === LEFT ? MARGIN : line.align === RIGHT ? WIDTH - MARGIN - width : (WIDTH - width) / 2;
      const y = line.centreY + (1 - rise) * RISE_PX + sink - this.inkCentres[font];
      this.ctx.fillText(line.text, Math.round(x), Math.round(y));
    }

    if (card > 0) this.rule(time, leave, sink);
  }

  // Darkens the bottom rows towards the reel's indigo so labels read over
  // bright scenes: sixteen bands, the lowest the darkest.
  private scrim(strength: number) {
    this.setFill(SCRIM);
    for (let step = 1; step < SCRIM_STEPS; step++) {
      const top = Math.ceil((step * SCRIM_ROWS) / SCRIM_STEPS);
      const bottom = Math.ceil(((step + 1) * SCRIM_ROWS) / SCRIM_STEPS);
      this.setAlpha((step / 32) * strength);
      this.ctx.fillRect(0, HEIGHT - SCRIM_ROWS + top, WIDTH, bottom - top);
    }
  }

  // The gradient rule above a label's name grows from its left end.
  private rule(time: number, leave: number, sink: number) {
    const width = (easeOut((time - RULE_DELAY) / RISE_S) * RULE_WIDTH) | 0;
    const y = RULE_Y + (sink | 0);
    this.setAlpha(leave);
    for (let x = 0; x < width; x += 2) {
      this.setFill(RULE_COLOURS[x >> 1]);
      this.ctx.fillRect(MARGIN + x, y, Math.min(2, width - x), 2);
    }
  }

  private wash(colour: string, amount: number) {
    this.setFill(colour);
    this.setAlpha(Math.min(1, amount));
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  private progress(fraction: number) {
    const fill = (clamp01(fraction) * WIDTH) | 0;
    this.setFill(WHITE);
    this.setAlpha(26 / 32);
    this.ctx.fillRect(0, HEIGHT - 2, fill, 2);
    this.setAlpha(6 / 32);
    this.ctx.fillRect(fill, HEIGHT - 2, WIDTH - fill, 2);
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
