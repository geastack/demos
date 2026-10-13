import { STRIP_LEFT, STRIP_TOP } from "../layout";
import { forecast } from "./forecast";

export { STRIP_LEFT, STRIP_TOP };

export const CELL_W = 52;
const LAST = 23; // the furthest hour the focus can reach
const MAX_OFFSET = LAST * CELL_W;
const TAP_SLOP = 8;
const GLIDE_MS = 320; // how far a release velocity carries the strip
const MIN_SLIDE_MS = 200;
const SLIDE_MS_PER_CELL = 70;
const MAX_SLIDE_MS = 900;
const RUBBER = 0.35; // drag resistance past either end

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

// The hourly strip: one scroll offset (px) slides a row of 30 cells under a
// fixed focus slot at the left, and the hour in the slot is the reading the
// whole screen shows. Drag to scrub (it follows the finger, rubber-banding
// past the ends), fling to glide, tap a cell to bring it into focus.
class StripStore {
  offset = 0;

  private pressed = false;
  private dragging = false;
  private sliding = false;
  private startX = 0;
  private startOffset = 0;
  private lastX = 0;
  private lastTime = 0;
  private velocity = 0; // px per ms, positive when the finger moves left
  private from = 0;
  private to = 0;
  private startedAt = 0;
  private duration = 0;

  down(x: number) {
    this.pressed = true;
    this.dragging = false;
    this.sliding = false;
    this.startX = x;
    this.startOffset = this.offset;
    this.lastX = x;
    this.lastTime = Date.now();
    this.velocity = 0;
  }

  move(x: number) {
    if (!this.pressed) return;

    const now = Date.now();
    const sample = (this.lastX - x) / Math.max(1, now - this.lastTime);
    this.velocity = 0.6 * this.velocity + 0.4 * sample;
    this.lastX = x;
    this.lastTime = now;
    if (!this.dragging && Math.abs(x - this.startX) > TAP_SLOP) this.dragging = true;

    if (!this.dragging) return;

    const raw = this.startOffset + (this.startX - x);
    const over = raw < 0 ? raw : raw > MAX_OFFSET ? raw - MAX_OFFSET : 0;
    this.place(raw - over + over * RUBBER);
  }

  up(x: number) {
    if (!this.pressed) return;

    this.pressed = false;
    if (!this.dragging) {
      this.slideTo(clamp(Math.floor((x - STRIP_LEFT + this.offset) / CELL_W), 0, LAST));
      return;
    }

    this.dragging = false;
    const projected = this.offset + this.velocity * GLIDE_MS;
    this.slideTo(clamp(Math.round(projected / CELL_W), 0, LAST));
  }

  /** Glides back to "now". */
  home() {
    this.slideTo(0);
  }

  /** Jumps to "now" without motion (a new moment loads). */
  reset() {
    this.pressed = false;
    this.dragging = false;
    this.sliding = false;
    this.offset = 0;
  }

  /** Advances a glide; called once per frame. */
  update(now: number) {
    if (!this.sliding) return;

    const t = Math.min(1, (now - this.startedAt) / this.duration);
    const u = 1 - t;
    this.place(this.from + (this.to - this.from) * (1 - u * u * u));
    if (t >= 1) this.sliding = false;
  }

  // Eases (cubic out) to a cell, slower over longer distances.
  private slideTo(index: number) {
    this.from = this.offset;
    this.to = index * CELL_W;
    this.startedAt = Date.now();
    const cells = Math.abs(this.to - this.from) / CELL_W;
    this.duration = clamp(cells * SLIDE_MS_PER_CELL + MIN_SLIDE_MS, MIN_SLIDE_MS, MAX_SLIDE_MS);
    this.sliding = true;
  }

  // Moves the row and selects the hour in the focus slot.
  private place(offset: number) {
    this.offset = offset;
    forecast.select(clamp(Math.round(offset / CELL_W), 0, LAST));
  }
}

export const strip = new StripStore();
