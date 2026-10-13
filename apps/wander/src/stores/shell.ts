import { Store } from "@geastack/core";

// Screen ids.
export const BOOT = 0;
export const DISCOVER = 1;
export const DETAIL = 2;

// Kept outside the store on purpose: every touch writes it, and a store write
// would re-render the App template mid-tap.
let lastTouch = 0;

// Which screen is open, and which one was open before it (Discover plays a
// return entrance when it comes back from Detail).
class ShellStore extends Store {
  screen = BOOT;
  previous = BOOT;

  open(screen: number) {
    this.previous = this.screen;
    this.screen = screen;
    this.poke();
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
