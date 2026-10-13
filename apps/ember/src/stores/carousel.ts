import { Store } from "@geastack/core";
import { RECIPES } from "../data/recipes";
import { CARD_H, CARD_PARALLAX, CARD_SPACING, CARD_W, CX } from "../layout";
import { recipe } from "./recipe";

const SIDE = 0.72; // side cards' size relative to the centre card
const SPACING = CARD_SPACING; // px between neighbouring card centres
const CENTER_X = CX;
const CENTER_Y = CARD_H / 2; // stage px
const PARALLAX = CARD_PARALLAX; // photo shift inside a card one place from the centre
const DIM = 0.5; // the veil over a side card
const PRESS = 0.97; // the centre card under a finger
const TAP_SLOP = 10;
const CLICK_AFTER_MS = 300; // a click this soon after a handled gesture is its echo
/** The press reads before the screen changes. */
export const OPEN_DELAY_MS = 130;
const FLING_MS = 220; // how far a release velocity carries the strip
const RUBBER = 0.3; // drag resistance past either end
// The snap is a spring, slightly under-damped so a card settles with a
// small overshoot; it carries the release velocity.
const STIFFNESS = 170;
const DAMPING = 21;
const SPRING_STEP_S = 1 / 120;
const LAST = RECIPES.length - 1;
const ENTER_FROM = 0.45; // where the entrance glide starts, in cards

// One of the three mounted cards: the centre recipe and its neighbours.
// The card is a clipping window placed and sized by layout; the photo inside
// is placed by left/top (never a transform, which the clip would not hold).
type Slot = {
  offset: number;
  dish: number;
  shown: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  photoLeft: number;
  photoTop: number;
  dim: number;
};

function clampIndex(index: number): number {
  return Math.max(0, Math.min(LAST, index));
}

function rubberBand(position: number): number {
  if (position < 0) return position * RUBBER;
  if (position > LAST) return LAST + (position - LAST) * RUBBER;
  return position;
}

// The recipe carousel. `position` is the fractional recipe index at the
// centre; the drag, the fling and the spring all move that one number.
class CarouselStore extends Store {
  // The centre slot is last so it draws over its neighbours.
  slots: Slot[] = [
    { offset: -1, dish: 0, shown: false, left: 0, top: 0, width: 0, height: 0, photoLeft: 0, photoTop: 0, dim: 0 },
    { offset: 1, dish: 0, shown: false, left: 0, top: 0, width: 0, height: 0, photoLeft: 0, photoTop: 0, dim: 0 },
    { offset: 0, dish: 0, shown: false, left: 0, top: 0, width: 0, height: 0, photoLeft: 0, photoTop: 0, dim: 0 },
  ];
  // Flips on every change of recipe so the label's entrance restarts.
  flip = false;

  private position = 0;
  private velocity = 0; // recipes per second, for the spring
  private target = 0;
  private dragging = false;
  private pressed = false;
  private startX = 0;
  private startPosition = 0;
  private lastX = 0;
  private lastTime = 0;
  private dragVelocity = 0; // px per ms
  private handledAt = 0;
  private lastFrame = 0;
  private loop = 0; // bumps to cancel a running spring

  // The cards glide in from the right and settle on the spring.
  enter() {
    this.pressed = false;
    this.dragging = false;
    this.position = recipe.index + ENTER_FROM;
    this.velocity = 0;
    this.layout();
    this.settle(recipe.index);
  }

  down(x: number) {
    this.loop = this.loop + 1;
    this.dragging = true;
    this.startX = x;
    this.startPosition = this.position;
    this.lastX = x;
    this.lastTime = Date.now();
    this.dragVelocity = 0;
    this.pressed = Math.abs(x - CENTER_X) <= CARD_W / 2 && Math.abs(this.position - recipe.index) < 0.02;
    this.layout();
  }

  move(x: number) {
    if (!this.dragging) return;

    const now = Date.now();
    const sample = (x - this.lastX) / Math.max(1, now - this.lastTime);
    this.dragVelocity = 0.6 * this.dragVelocity + 0.4 * sample;
    this.lastX = x;
    this.lastTime = now;
    if (Math.abs(x - this.startX) > TAP_SLOP) this.pressed = false;
    this.position = rubberBand(this.startPosition - (x - this.startX) / SPACING);
    this.layout();
  }

  /**
   * Ends a gesture; true when it was a tap on the centred card (open it).
   * A release with travel hands over to the spring, with its velocity.
   */
  up(): boolean {
    if (!this.dragging) return false;

    this.dragging = false;
    this.handledAt = Date.now();
    if (Math.abs(this.lastX - this.startX) < TAP_SLOP) return this.tap(this.startX);

    const flung = this.position - (this.dragVelocity * FLING_MS) / SPACING;
    this.velocity = (-this.dragVelocity * 1000) / SPACING;
    this.settle(clampIndex(Math.round(flung)));
    return false;
  }

  // Fallback for a tap that arrives only as a click; ignores gesture echoes.
  click(): boolean {
    if (Date.now() - this.handledAt < CLICK_AFTER_MS) return false;

    this.handledAt = Date.now();
    return this.tap(this.startX);
  }

  // The centred card opens the recipe; a side card slides to the centre.
  private tap(x: number): boolean {
    const offset = x - CENTER_X;
    if (Math.abs(offset) > CARD_W / 2) {
      this.pressed = false;
      this.velocity = 0;
      this.settle(clampIndex(recipe.index + (offset < 0 ? -1 : 1)));
      return false;
    }

    this.pressed = true;
    this.layout();
    return true;
  }

  private settle(target: number) {
    this.target = target;
    this.loop = this.loop + 1;
    this.lastFrame = Date.now();
    const loop = this.loop;
    requestAnimationFrame(() => this.step(loop));
  }

  private step(loop: number) {
    if (loop !== this.loop) return;

    const now = Date.now();
    const dt = Math.min(48, now - this.lastFrame) * 0.001;
    this.lastFrame = now;
    for (let t = 0; t < dt; t += SPRING_STEP_S) {
      const h = Math.min(SPRING_STEP_S, dt - t);
      this.velocity += (STIFFNESS * (this.target - this.position) - DAMPING * this.velocity) * h;
      this.position += this.velocity * h;
    }

    const done = Math.abs(this.target - this.position) < 0.002 && Math.abs(this.velocity) < 0.02;
    if (done) {
      this.position = this.target;
      this.velocity = 0;
    }

    this.layout();
    if (!done) requestAnimationFrame(() => this.step(loop));
  }

  // Centre card full size, neighbours smaller and veiled; each photo drifts
  // against its card's travel. Fields are written only when they change.
  private layout() {
    const base = clampIndex(Math.round(this.position));
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const dish = base + slot.offset;
      const shown = dish >= 0 && dish <= LAST;
      if (shown !== slot.shown) slot.shown = shown;
      if (!shown) continue;

      const offset = dish - this.position;
      const near = Math.min(1, Math.abs(offset));
      const press = this.pressed && slot.offset === 0 ? PRESS : 1;
      const size = (1 - (1 - SIDE) * near) * press;
      const width = Math.round(CARD_W * size);
      const height = Math.round(CARD_H * size);
      const left = Math.round(CENTER_X + offset * SPACING - width / 2);
      const top = Math.round(CENTER_Y - height / 2);
      const drift = Math.max(-1, Math.min(1, offset)) * PARALLAX;
      const photoLeft = Math.round((width - CARD_W) / 2 - drift);
      const photoTop = Math.round((height - CARD_H) / 2);
      const dim = Math.round(DIM * near * 50) * 0.02;
      if (dish !== slot.dish) slot.dish = dish;
      if (width !== slot.width) slot.width = width;
      if (height !== slot.height) slot.height = height;
      if (left !== slot.left) slot.left = left;
      if (top !== slot.top) slot.top = top;
      if (photoLeft !== slot.photoLeft) slot.photoLeft = photoLeft;
      if (photoTop !== slot.photoTop) slot.photoTop = photoTop;
      if (dim !== slot.dim) slot.dim = dim;
    }

    if (base !== recipe.index) {
      recipe.select(base);
      this.flip = !this.flip;
    }
  }
}

export const carousel = new CarouselStore();
