import type { CanvasRenderingContext2D, ImageData565 } from "@geastack/core";
import { HEIGHT, WIDTH } from "./frame";

// Owns the frame the painter renders into and puts it on the canvas, one
// straight copy per frame: the canvas is the only drawing node, so it
// presents to the display with no compositing.
export class Presenter {
  readonly pixels: Uint16Array;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData565;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.image = ctx.createImageData565(WIDTH, HEIGHT);
    this.pixels = this.image.data16;
  }

  present() {
    this.ctx.beginBatch();
    this.ctx.putImageData(this.image, 0, 0);
    this.ctx.endBatch();
  }
}
