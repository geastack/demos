import type { GeaCanvasElement, ImageData565 } from "@geastack/core";
import { CELL_SIZE, FIELD_X, FIELD_Y, IMAGE_H, IMAGE_W, PANEL_H, PANEL_W } from "./layout";
import { Painter } from "./painter";
import { buildPalette, PATTERNS } from "./patterns";
import { Reaction } from "./reaction";
import { Upscaler } from "./upscale";

export const CANVAS_ID = "bloom-field";

const STEPS_PER_FRAME = 2;
const ATTACH_TRIES = 10;

// Boot: a ring of seeds that blooms outward from the centre.
const RING_SEEDS = 12;
const RING_RADIUS = Math.floor(Math.min(PANEL_W, PANEL_H) / 7.5); // 36 px at 272

// Attract: nobody touched for a while, so seeds keep landing on their own.
const IDLE_MS = 6000;
const ATTRACT_EVERY_MS = 1400;
const ATTRACT_MARGIN = 24;

// Hint: fades in on boot, out after HINT_MS or the first touch.
const HINT_OPACITY = 0.64;
const HINT_MS = 4000;
const HINT_IN_MS = 600;
const HINT_OUT_MS = 360;

// Drives the field: one frame = reaction steps, shading, upscale, one canvas
// batch. Touch seeds growth, the chips switch patterns.
class Bloom {
  private readonly reaction = new Reaction();
  private readonly upscaler = new Upscaler();
  private readonly palette = new Uint16Array(256);
  private painter: Painter | null = null;
  private image: ImageData565 | null = null;
  private pattern = 0;
  private startMs = 0;
  private firstTouchMs = 0;
  private lastTouchMs = 0;
  private lastSeedMs = 0;

  start() {
    this.pick(0);
    this.plantRing();
    this.startMs = Date.now();
    this.lastTouchMs = this.startMs - IDLE_MS;
    requestAnimationFrame(() => this.attach(0));
  }

  down(x: number, y: number) {
    const chip = this.painter ? this.painter.chipAt(x, y) : -1;
    if (chip >= 0) {
      this.pick(chip);
      return;
    }

    this.touch(x, y);
  }

  move(x: number, y: number) {
    if (this.painter && this.painter.chipAt(x, y) >= 0) return;

    this.touch(x, y);
  }

  private touch(x: number, y: number) {
    this.lastTouchMs = Date.now();
    if (this.firstTouchMs === 0) this.firstTouchMs = this.lastTouchMs;
    this.seedAt(x, y);
  }

  private pick(index: number) {
    const pattern = PATTERNS[index];
    this.pattern = index;
    this.reaction.setRates(pattern.feed, pattern.kill);
    buildPalette(pattern, this.palette);
  }

  // The canvas has no surface until the app is laid out, so it is looked up
  // on a following frame.
  private attach(tries: number) {
    const canvas = document.getElementById(CANVAS_ID) as unknown as GeaCanvasElement | null;
    if (!canvas) {
      if (tries < ATTACH_TRIES) requestAnimationFrame(() => this.attach(tries + 1));
      return;
    }

    const ctx = canvas.getContext("2d");
    this.image = ctx.createImageData565(IMAGE_W, IMAGE_H);
    this.painter = new Painter(ctx);
    requestAnimationFrame(() => this.frame());
  }

  private frame() {
    const image = this.image;
    const painter = this.painter;
    if (!image || !painter) return;

    const now = Date.now();
    this.attract(now);
    for (let i = 0; i < STEPS_PER_FRAME; i++) this.reaction.step();
    this.reaction.shade();
    this.upscaler.draw(this.reaction.tone, this.palette, image.data16);
    painter.paint(image, this.pattern, this.hintOpacity(now));
    requestAnimationFrame(() => this.frame());
  }

  private seedAt(x: number, y: number) {
    this.reaction.seed(Math.floor((x - FIELD_X) / CELL_SIZE), Math.floor((y - FIELD_Y) / CELL_SIZE));
  }

  private plantRing() {
    for (let i = 0; i < RING_SEEDS; i++) {
      const angle = (i * 2 * Math.PI) / RING_SEEDS;
      this.seedAt(PANEL_W / 2 + Math.cos(angle) * RING_RADIUS, PANEL_H / 2 + Math.sin(angle) * RING_RADIUS);
    }
  }

  private attract(now: number) {
    if (now - this.lastTouchMs < IDLE_MS || now - this.lastSeedMs < ATTRACT_EVERY_MS) return;

    this.lastSeedMs = now;
    this.seedAt(
      ATTRACT_MARGIN + Math.random() * (PANEL_W - 2 * ATTRACT_MARGIN),
      ATTRACT_MARGIN + Math.random() * (PANEL_H - 2 * ATTRACT_MARGIN),
    );
  }

  private hintOpacity(now: number): number {
    const shownMs = now - this.startMs;
    const hideMs = this.firstTouchMs > 0 ? Math.min(this.firstTouchMs - this.startMs, HINT_MS) : HINT_MS;
    const fadeIn = Math.min(1, shownMs / HINT_IN_MS);
    const fadeOut = 1 - Math.max(0, (shownMs - hideMs) / HINT_OUT_MS);
    return HINT_OPACITY * Math.max(0, Math.min(fadeIn, fadeOut));
  }
}

export const bloom = new Bloom();
