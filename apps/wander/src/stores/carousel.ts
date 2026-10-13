import { Store } from "@geastack/core";
import { PLACES } from "../data/places";
import { W } from "../layout";
import { destination } from "./destination";
import { DISCOVER, shell } from "./shell";

const WIDTH = W;
const COUNT = PLACES.length;
const ADVANCE_MS = 7000; // idle attract: the next destination slides in
const TICK_MS = 200;
const SLIDE_MS = 560; // a full one-destination slide; shorter for the rest of a drag
const MIN_SLIDE_MS = 200;
const TAP_SLOP = 10;
const FLING_MS = 160; // how far a release velocity carries the strip
const CLICK_AFTER_MS = 300; // a click this soon after a handled gesture is its echo

function wrap(index: number): number {
  return ((index % COUNT) + COUNT) % COUNT;
}

// The hero strip. `position` is the fractional destination index at the
// screen's left edge and wraps around; dragging, flinging, snapping and the
// attract advance all move that one number. Two slots show the destination
// under the left edge and the next one, translated side by side.
class CarouselStore extends Store {
  leftPlace = 0;
  rightPlace = 1;
  leftX = 0;
  rightX = WIDTH;
  rightShown = false;
  // The strip is at rest. While it moves, only the posters and dots draw
  // (overlays repainting over moving posters cost frames); the copy, chips
  // and badge remount with their entrances when it lands.
  settled = true;
  // The attract countdown runs (its progress bar mounts, so it restarts).
  counting = false;

  private position = 0;
  private pressed = false;
  private dragging = false;
  private moving = false;
  private startX = 0;
  private startPosition = 0;
  private lastX = 0;
  private lastTime = 0;
  private velocity = 0; // px per ms
  private handledAt = 0;
  private dueAt = 0;
  private from = 0;
  private to = 0;
  private startedAt = 0;
  private duration = 0;
  private loop = 0; // bumps to cancel a running slide

  init() {
    setInterval(() => this.tick(), TICK_MS);
  }

  enter() {
    this.loop = this.loop + 1;
    this.moving = false;
    this.settled = true;
    this.position = destination.index;
    this.layout();
    this.restartCountdown();
  }

  down(x: number) {
    this.loop = this.loop + 1;
    this.moving = false;
    this.pressed = true;
    this.counting = false;
    this.startX = x;
    this.startPosition = this.position;
    this.lastX = x;
    this.lastTime = Date.now();
    this.velocity = 0;
  }

  move(x: number) {
    if (!this.pressed) return;

    const now = Date.now();
    const sample = (x - this.lastX) / Math.max(1, now - this.lastTime);
    this.velocity = 0.6 * this.velocity + 0.4 * sample;
    this.lastX = x;
    this.lastTime = now;
    if (!this.dragging && Math.abs(x - this.startX) > TAP_SLOP) {
      this.dragging = true;
      this.settled = false;
    }

    if (!this.dragging) return;

    this.position = this.startPosition - (x - this.startX) / WIDTH;
    this.layout();
  }

  /** Ends a gesture; true when it was a tap on a resting hero (open it). */
  up(): boolean {
    if (!this.pressed) return false;

    this.pressed = false;
    this.handledAt = Date.now();
    if (!this.dragging) return this.tap();

    this.dragging = false;
    const home = Math.round(this.startPosition);
    const flung = Math.round(this.position - (this.velocity * FLING_MS) / WIDTH);
    this.slideTo(Math.max(home - 1, Math.min(home + 1, flung)));
    return false;
  }

  /** Fallback for a tap that arrives only as a click; ignores gesture echoes. */
  click(): boolean {
    if (Date.now() - this.handledAt < CLICK_AFTER_MS) return false;

    this.handledAt = Date.now();
    return this.tap();
  }

  // A tap on a resting hero opens it; one caught mid-slide just lands it.
  private tap(): boolean {
    const nearest = Math.round(this.position);
    if (Math.abs(this.position - nearest) < 0.01) return true;

    this.slideTo(nearest);
    return false;
  }

  private tick() {
    if (shell.screen !== DISCOVER || this.pressed || this.moving) return;
    if (Date.now() < this.dueAt) return;

    this.slideTo(Math.round(this.position) + 1);
  }

  private restartCountdown() {
    this.dueAt = Date.now() + ADVANCE_MS;
    this.counting = true;
  }

  // Eases (cubic out) from where the strip is to a whole index, scaled to
  // the distance left.
  private slideTo(target: number) {
    this.loop = this.loop + 1;
    this.moving = true;
    this.settled = false;
    this.counting = false;
    this.from = this.position;
    this.to = target;
    this.startedAt = Date.now();
    this.duration = Math.max(MIN_SLIDE_MS, Math.abs(target - this.position) * SLIDE_MS);
    destination.select(wrap(target));
    const loop = this.loop;
    requestAnimationFrame(() => this.step(loop));
  }

  private step(loop: number) {
    if (loop !== this.loop) return;

    const t = Math.min(1, (Date.now() - this.startedAt) / this.duration);
    const eased = 1 - (1 - t) * (1 - t) * (1 - t);
    this.position = this.from + (this.to - this.from) * eased;
    if (t < 1) {
      this.layout();
      requestAnimationFrame(() => this.step(loop));
      return;
    }

    this.position = wrap(this.to);
    this.moving = false;
    this.settled = true;
    this.layout();
    this.restartCountdown();
  }

  // Fields are written only when they change.
  private layout() {
    const base = Math.floor(this.position);
    const leftX = -Math.round((this.position - base) * WIDTH);
    const leftPlace = wrap(base);
    const rightPlace = wrap(base + 1);
    const rightShown = leftX < 0;
    if (leftPlace !== this.leftPlace) this.leftPlace = leftPlace;
    if (rightPlace !== this.rightPlace) this.rightPlace = rightPlace;
    if (leftX !== this.leftX) this.leftX = leftX;
    if (leftX + WIDTH !== this.rightX) this.rightX = leftX + WIDTH;
    if (rightShown !== this.rightShown) this.rightShown = rightShown;
  }
}

export const carousel = new CarouselStore();
