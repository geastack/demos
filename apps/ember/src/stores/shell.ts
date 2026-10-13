import { Store } from "@geastack/core";

// Screen ids.
export const BOOT = 0;
export const RECIPES = 1;
export const DETAIL = 2;
export const MANUAL = 3;
export const PREHEAT = 4;
export const COOK = 5;
export const READY = 6;
export const IDLE = 7;

// Kept outside the store on purpose: every touch writes it, and a store write
// would re-render the App template (and the screen under the finger) mid-tap.
let lastTouch = 0;

// Which screen is open, and which one was open before it (some entrances
// depend on where they come from).
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
