import type { CanvasRenderingContext2D, GeaCanvasElement, ImageData565 } from "@geastack/core";
import type { Ring } from "./ring";

const ATTACH_TRIES = 12;
const MIN_SWEEP_CHANGE = 0.05;
const MIN_GLOW_CHANGE = 6; // the inner glow repaints in small steps

// Shows a Ring in a JSX canvas while its screen is mounted. The canvas has
// no surface until it is laid out, so the context is taken on a following
// frame; until then (and while the ring's tables build) show() is a no-op.
export class RingView {
  private readonly ring: Ring;
  private readonly canvasId: string;
  private ctx: CanvasRenderingContext2D | null = null;
  private image: ImageData565 | null = null;
  private whole = true;
  private session = 0;
  private sweep = -1;
  private level = -1;

  constructor(ring: Ring, canvasId: string) {
    this.ring = ring;
    this.canvasId = canvasId;
  }

  attach() {
    this.session = this.session + 1;
    this.ctx = null;
    const session = this.session;
    requestAnimationFrame(() => this.find(session, 0));
  }

  /** Attached to a canvas whose ring is still building. */
  waiting(): boolean {
    return this.ctx !== null && !this.ring.ready();
  }

  detach() {
    this.session = this.session + 1;
    this.ctx = null;
  }

  // Draws the ring filled to `sweep` degrees with the inner glow at `level`
  // (0..256), blitting only the rows that changed.
  show(sweep: number, level: number) {
    const ctx = this.ctx;
    const image = this.image;
    if (!ctx || !image || !this.ring.ready()) return;

    const ring = this.ring;
    const pixels = image.data16;
    if (this.whole) {
      ring.paintAll(pixels, sweep, level);
      this.sweep = sweep;
      this.level = level;
      this.whole = false;
      ctx.beginBatch();
      ctx.putImageData(image, 0, 0);
      ctx.endBatch();
      return;
    }

    let top = ring.size;
    let bottom = -1;
    if (Math.abs(level - this.level) >= MIN_GLOW_CHANGE) {
      this.level = level;
      ring.glow(pixels, level);
      top = ring.top;
      bottom = ring.bottom;
    }

    if (Math.abs(sweep - this.sweep) >= MIN_SWEEP_CHANGE) {
      this.sweep = sweep;
      ring.draw(pixels, sweep);
      top = Math.min(top, ring.top);
      bottom = Math.max(bottom, ring.bottom);
    }

    if (bottom < top) return;

    ctx.beginBatch();
    ctx.putImageData(image, 0, 0, 0, top, ring.size, bottom - top + 1);
    ctx.endBatch();
  }

  private find(session: number, tries: number) {
    if (session !== this.session) return;

    const canvas = document.getElementById(this.canvasId) as unknown as GeaCanvasElement | null;
    if (!canvas) {
      if (tries < ATTACH_TRIES) requestAnimationFrame(() => this.find(session, tries + 1));
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!this.image) this.image = ctx.createImageData565(this.ring.size, this.ring.size);
    this.ctx = ctx;
    this.whole = true;
  }
}
