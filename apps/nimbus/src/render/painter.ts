import type { CanvasRenderingContext2D, GeaEmbeddedImage, ImageData565 } from "@geastack/core";

// The one owner of the canvas context; every draw goes through these
// methods. The frame is drawn straight into the display's back buffer (no
// beginBatch) and presented by one flush:
//   - the compiler copies the context on every property write (fillStyle,
//     globalAlpha, font), and a batching context carries its recorded
//     commands (a vector that keeps its high-water size), so in a batch each
//     style change copied hundreds of commands;
//   - a context passed by value records into the copy, so no other code ever
//     holds it.
// Style writes skip repeats.
export class Painter {
  private readonly ctx: CanvasRenderingContext2D;
  private font = "";
  private fill = "";
  private alpha = -1;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Presents the frame drawn since the last flush. */
  present() {
    this.setAlpha(1);
    this.ctx.flush();
  }

  createImage(width: number, height: number): ImageData565 {
    return this.ctx.createImageData565(width, height);
  }

  rect(x: number, y: number, width: number, height: number, color: string, alpha: number) {
    if (alpha < 0.01) return;

    this.setAlpha(alpha);
    this.setFill(color);
    this.ctx.fillRect(x, y, width, height);
  }

  circle(x: number, y: number, radius: number, color: string, alpha: number) {
    if (alpha < 0.01) return;

    this.setAlpha(alpha);
    this.ctx.fillCircle(x, y, radius, color);
    this.fill = color; // a string colour becomes the fill style
  }

  image(image: GeaEmbeddedImage, x: number, y: number, alpha: number) {
    if (alpha < 0.01) return;

    this.setAlpha(alpha);
    this.ctx.drawImage(image, Math.round(x), Math.round(y));
  }

  /** Copies part of an RGB565 image (opaque, no blending) to (x + sx, y + sy). */
  put(image: ImageData565, x: number, y: number, sx: number, sy: number, width: number, height: number) {
    this.ctx.putImageData(image, x, y, sx, sy, width, height);
  }

  /** Text with its top-left at (x, y). */
  text(text: string, x: number, y: number, font: string, color: string, alpha: number) {
    if (alpha < 0.01 || text === "") return;

    this.setAlpha(alpha);
    this.setFont(font);
    this.setFill(color);
    this.ctx.fillText(text, Math.round(x), Math.round(y));
  }

  width(text: string, font: string): number {
    this.setFont(font);
    return this.ctx.measureText(text);
  }

  /** The offset from a text's top to the middle of its ink. */
  inkCenter(text: string, font: string): number {
    this.setFont(font);
    return this.ctx.measureTextInkCenter(text);
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
