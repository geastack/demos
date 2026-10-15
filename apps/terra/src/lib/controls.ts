import { PANEL_H, PANEL_W } from "./layout";
import { clamp } from "./motion";

const STICK_RANGE_X = PANEL_W * 0.23; // px of drag for a full-rate turn (110 on 480)
const STICK_RANGE_Y = PANEL_H * 0.26; // px of drag for a full-rate climb (70 on 272)
const HOLD_MS = 450;
const HOLD_SLOP = 10; // px a held finger may wander
const MIN_THROTTLE = 0.35;
const MAX_THROTTLE = 3;

// Touch as a flight stick: one finger deflects from where it landed (turn
// and climb), holding it still boosts, two fingers pinch the throttle.
export class Controls {
  stickX = 0;
  stickY = 0;
  throttle = 1;
  active = false;
  releasedAt = -1e9;

  private first = -1;
  private second = -1;
  private startX = 0;
  private startY = 0;
  private firstX = 0;
  private firstY = 0;
  private secondX = 0;
  private secondY = 0;
  private downAt = 0;
  private wandered = false;
  private pinchSpan = 1;
  private pinchThrottle = 1;

  down(id: number, x: number, y: number, now: number) {
    if (this.first < 0) {
      this.first = id;
      this.active = true;
      this.downAt = now;
      this.wandered = false;
      this.anchor(x, y);
      return;
    }

    if (this.second >= 0 || id === this.first) return;

    this.second = id;
    this.secondX = x;
    this.secondY = y;
    this.pinchSpan = Math.max(1, this.span());
    this.pinchThrottle = this.throttle;
    this.stickX = 0;
    this.stickY = 0;
  }

  move(id: number, x: number, y: number) {
    if (id === this.first) {
      this.firstX = x;
      this.firstY = y;
      if (Math.abs(x - this.startX) + Math.abs(y - this.startY) > HOLD_SLOP) this.wandered = true;
    } else if (id === this.second) {
      this.secondX = x;
      this.secondY = y;
    } else {
      return;
    }

    if (this.second >= 0) {
      this.throttle = clamp((this.pinchThrottle * this.span()) / this.pinchSpan, MIN_THROTTLE, MAX_THROTTLE);
      return;
    }

    this.stickX = clamp((this.firstX - this.startX) / STICK_RANGE_X, -1, 1);
    this.stickY = clamp((this.firstY - this.startY) / STICK_RANGE_Y, -1, 1);
  }

  up(id: number, now: number) {
    if (id === this.second) {
      this.second = -1;
      this.anchor(this.firstX, this.firstY);
      return;
    }

    if (id !== this.first) return;

    if (this.second >= 0) {
      this.first = this.second;
      this.second = -1;
      this.wandered = true;
      this.anchor(this.secondX, this.secondY);
      return;
    }

    this.first = -1;
    this.active = false;
    this.releasedAt = now;
    this.stickX = 0;
    this.stickY = 0;
  }

  holding(now: number): boolean {
    return this.first >= 0 && this.second < 0 && !this.wandered && now - this.downAt > HOLD_MS;
  }

  resetThrottle() {
    this.throttle = 1;
  }

  // Re-centres the stick under a finger so a change of fingers never jerks.
  private anchor(x: number, y: number) {
    this.startX = x;
    this.startY = y;
    this.firstX = x;
    this.firstY = y;
    this.stickX = 0;
    this.stickY = 0;
  }

  private span(): number {
    const dx = this.secondX - this.firstX;
    const dy = this.secondY - this.firstY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
