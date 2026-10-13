// Turns touches into moves: swipes left/right/up/down fire as soon as they
// travel far enough; a tap steers toward the side of the screen it lands on.

export const GESTURE_NONE = 0;
export const GESTURE_LEFT = 1;
export const GESTURE_RIGHT = 2;
export const GESTURE_UP = 3;
export const GESTURE_DOWN = 4;

const SWIPE_PX = 28;

export class Gesture {
  private startX = 0;
  private startY = 0;
  private tracking = false;
  private fired = false;
  private readonly middle = window.innerWidth / 2;

  down(x: number, y: number) {
    this.startX = x;
    this.startY = y;
    this.tracking = true;
    this.fired = false;
  }

  move(x: number, y: number): number {
    if (!this.tracking || this.fired) return GESTURE_NONE;

    const swipe = this.swipe(x, y);
    if (swipe !== GESTURE_NONE) this.fired = true;
    return swipe;
  }

  up(x: number, y: number): number {
    if (!this.tracking) return GESTURE_NONE;

    this.tracking = false;
    if (this.fired) return GESTURE_NONE;

    const swipe = this.swipe(x, y);
    if (swipe !== GESTURE_NONE) return swipe;

    return x < this.middle ? GESTURE_LEFT : GESTURE_RIGHT;
  }

  private swipe(x: number, y: number): number {
    const dx = x - this.startX;
    const dy = y - this.startY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return GESTURE_NONE;

    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? GESTURE_LEFT : GESTURE_RIGHT;

    return dy < 0 ? GESTURE_UP : GESTURE_DOWN;
  }
}
