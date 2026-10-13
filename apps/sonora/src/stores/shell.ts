import { Store } from "@geastack/core";

// Screen ids.
export const BOOT = 0;
export const NOW = 1;
export const BROWSE = 2;
export const QUEUE = 3;
export const AMBIENT = 4;

// Overlays on Now Playing.
export const NONE = 0;
export const VOLUME = 1;
export const ROOMS = 2;
export const SLEEP = 3;

const DISMISS_MS = 240; // an overlay's exit animation

// Kept outside the store on purpose: every touch writes it, and a store write
// would re-render the App template mid-tap.
let lastTouch = 0;

// Which screen and overlay are open, and the screen before (entrances play
// the shared-element move that matches where they came from).
class ShellStore extends Store {
  screen = BOOT;
  previous = BOOT;
  overlay = NONE;
  // The overlay is playing its exit; it unmounts when that ends.
  closing = false;

  private dismissRun = 0;

  open(screen: number) {
    this.dismissRun = this.dismissRun + 1;
    this.closing = false;
    this.overlay = NONE;
    this.previous = this.screen;
    this.screen = screen;
    this.poke();
  }

  show(overlay: number) {
    this.dismissRun = this.dismissRun + 1;
    this.closing = false;
    this.overlay = overlay;
  }

  /** Plays the open overlay's exit, then unmounts it. */
  dismiss() {
    if (this.overlay === NONE || this.closing) return;

    this.closing = true;
    this.dismissRun = this.dismissRun + 1;
    const run = this.dismissRun;
    setTimeout(() => {
      if (run !== this.dismissRun) return;

      this.closing = false;
      this.overlay = NONE;
    }, DISMISS_MS);
  }

  poke() {
    lastTouch = Date.now();
  }

  /** Milliseconds since the panel was last touched. */
  quietFor(): number {
    return Date.now() - lastTouch;
  }
}

export const shell = new ShellStore();
