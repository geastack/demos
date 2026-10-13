import { COL_X } from "./layout";
import { player, SCRUB_W } from "./stores/player";
import { volume } from "./stores/volume";

const SLOP = 10;
const CLICK_AFTER_MS = 300; // a click this soon after a handled gesture is its echo
export const SCRUB_X = COL_X; // the scrubber track's left edge on screen

// Now Playing's art: a tap opens the library, a vertical drag sets the
// volume (the overlay follows the finger).
class ArtGesture {
  private pressed = false;
  private dragging = false;
  private startY = 0;
  private handledAt = 0;

  down(y: number) {
    this.pressed = true;
    this.dragging = false;
    this.startY = y;
  }

  move(y: number) {
    if (!this.pressed) return;

    if (!this.dragging && Math.abs(y - this.startY) > SLOP) {
      this.dragging = true;
      volume.grab(this.startY);
    }

    if (this.dragging) volume.drag(y);
  }

  /** Ends a gesture; true when it was a tap. */
  up(): boolean {
    if (!this.pressed) return false;

    this.pressed = false;
    this.handledAt = Date.now();
    if (this.dragging) volume.release();
    return !this.dragging;
  }

  /** Fallback for a tap that arrives only as a click; ignores gesture echoes. */
  click(): boolean {
    if (Date.now() - this.handledAt < CLICK_AFTER_MS) return false;

    this.handledAt = Date.now();
    return true;
  }
}

// The scrubber: the knob follows the finger and playback jumps on release.
class ScrubGesture {
  private pressed = false;
  private fraction = 0;

  down(x: number) {
    this.pressed = true;
    this.fraction = (x - SCRUB_X) / SCRUB_W;
    player.scrubStart(this.fraction);
  }

  move(x: number) {
    if (!this.pressed) return;

    this.fraction = (x - SCRUB_X) / SCRUB_W;
    player.scrubTo(this.fraction);
  }

  up() {
    if (!this.pressed) return;

    this.pressed = false;
    player.scrubEnd(this.fraction);
  }
}

export const artGesture = new ArtGesture();
export const scrubGesture = new ScrubGesture();
