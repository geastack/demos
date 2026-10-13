import type { GeaCanvasElement } from "@geastack/core";
import {
  FIELD_H,
  FIELD_W,
  FIELD_X,
  FIELD_Y,
  INK,
  INSET,
  MODE_NAMES,
  PILL_HEIGHT,
  PILL_LEFT,
  PILL_TOP,
  SEGMENT,
} from "./layout";
import { MODES, PALETTE_SIZE } from "./modes";
import { Motion } from "./motion";
import { ChromePainter } from "./painter";
import { Renderer } from "./render";

export const CANVAS_ID = "ripple-fluid";

const MAX_FINGERS = 5;
const IDLE_MS = 5000;
const ATTACH_TRIES = 10;
const PILL_SLOP = 6; // extra touch margin around the pill

// Hint: fades in after the boot bloom, out after the first touch.
const HINT_OPACITY = 0.64;
const HINT_DELAY_MS = 900;
const HINT_IN_MS = 600;
const HINT_OUT_MS = 360;

// The mode's accent for the brand dot: its first palette colour on RGB565 steps.
function accentOf(mode: number): string {
  const rgb = MODES[mode].palette[0];
  const r = Math.round(rgb[0] * 31) * 8;
  const g = Math.round(rgb[1] * 63) * 4;
  const b = Math.round(rgb[2] * 31) * 8;
  return `rgb(${r},${g},${b})`;
}

// The mode's background on RGB565 steps, for the margin around the field.
function backgroundOf(mode: number): string {
  const rgb = MODES[mode].background;
  const r = Math.round(rgb[0] * 31) * 8;
  const g = Math.round(rgb[1] * 63) * 4;
  const b = Math.round(rgb[2] * 31) * 8;
  return `rgb(${r},${g},${b})`;
}

// Drives the fluid: finger tracking, the mode pill, one step and one canvas
// batch per frame, and the idle hand-off to the ghost fingers.
class Ripple {
  private readonly motion = new Motion();
  private readonly renderer = new Renderer();
  private mode = INK;
  private accent = accentOf(INK);
  private background = backgroundOf(INK);
  // Per finger slot: its pointer id (0 = free), last position and colour.
  private pointer = new Int32Array(MAX_FINGERS);
  private lastX = new Float32Array(MAX_FINGERS);
  private lastY = new Float32Array(MAX_FINGERS);
  private color = new Int32Array(MAX_FINGERS);
  private nextColor = 0;
  private startMs = 0;
  private lastTouchMs = 0;
  private firstTouchMs = 0;

  start() {
    this.motion.setMode(MODES[INK]);
    this.renderer.setMode(MODES[INK]);
    this.startMs = Date.now();
    this.lastTouchMs = this.startMs;
    requestAnimationFrame(() => this.attach(0));
  }

  down(id: number, x: number, y: number) {
    if (this.onPill(x, y)) {
      this.pick(Math.min(MODE_NAMES.length - 1, Math.max(0, Math.floor((x - PILL_LEFT - INSET) / SEGMENT))));
      return;
    }

    const slot = this.slotOf(0);
    if (slot < 0) return;

    // Fluid coordinates: panel pixels less the field's margin.
    const fx = x - FIELD_X;
    const fy = y - FIELD_Y;
    this.pointer[slot] = id;
    this.lastX[slot] = fx;
    this.lastY[slot] = fy;
    this.color[slot] = this.nextColor;
    this.nextColor = (this.nextColor + 1) % PALETTE_SIZE;
    this.motion.splash(fx, fy, this.color[slot]);
    this.lastTouchMs = Date.now();
    if (this.firstTouchMs === 0) this.firstTouchMs = this.lastTouchMs;
  }

  move(id: number, x: number, y: number) {
    const slot = this.slotOf(id);
    if (slot < 0) return;

    const fx = x - FIELD_X;
    const fy = y - FIELD_Y;
    this.motion.stroke(this.lastX[slot], this.lastY[slot], fx, fy, this.color[slot]);
    this.lastX[slot] = fx;
    this.lastY[slot] = fy;
    this.lastTouchMs = Date.now();
  }

  up(id: number) {
    const slot = this.slotOf(id);
    if (slot >= 0) this.pointer[slot] = 0;
    this.lastTouchMs = Date.now();
  }

  private pick(mode: number) {
    if (mode === this.mode) return;

    this.mode = mode;
    this.accent = accentOf(mode);
    this.background = backgroundOf(mode);
    this.motion.setMode(MODES[mode]);
    this.renderer.setMode(MODES[mode]);
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
    const image = ctx.createImageData565(FIELD_W, FIELD_H);
    const painter = new ChromePainter(ctx);
    const frame = (timeMs: number) => {
      const now = Date.now();
      this.motion.frame(timeMs, this.idle(now));
      this.renderer.tone(this.motion.fluid);
      this.renderer.draw(image.data16);
      painter.paint(image, this.mode, this.accent, this.background, this.hintOpacity(now));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private hintOpacity(now: number): number {
    if (this.firstTouchMs > 0) return HINT_OPACITY * Math.max(0, 1 - (now - this.firstTouchMs) / HINT_OUT_MS);

    return HINT_OPACITY * Math.min(1, Math.max(0, (now - this.startMs - HINT_DELAY_MS) / HINT_IN_MS));
  }

  private onPill(x: number, y: number): boolean {
    return x >= PILL_LEFT - PILL_SLOP && y <= PILL_TOP + PILL_HEIGHT + PILL_SLOP;
  }

  // Nobody has touched for a while: the ghost fingers take over.
  private idle(now: number): boolean {
    for (let slot = 0; slot < MAX_FINGERS; slot++) {
      if (this.pointer[slot] !== 0) return false;
    }

    return now - this.lastTouchMs > IDLE_MS;
  }

  // The slot holding pointer `id`; id 0 finds a free slot.
  private slotOf(id: number): number {
    for (let slot = 0; slot < MAX_FINGERS; slot++) {
      if (this.pointer[slot] === id) return slot;
    }
    return -1;
  }
}

export const ripple = new Ripple();
