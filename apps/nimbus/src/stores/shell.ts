// Panels over the Now screen.
export const NONE = 0;
export const WEEK = 1;
export const TODAY = 2;

// Buttons (for press feedback).
export const BUTTON_NONE = -1;
export const BUTTON_WEEK = 0;
export const BUTTON_TODAY = 1;
export const BUTTON_DEMO = 2;
export const BUTTON_CLOSE = 3;

// The app's flow state: the boot, the panel (with when it opened or began
// closing, for its slide), the demo cycle and the pressed button.
class ShellStore {
  booting = true;
  bootedAt = 0;
  panel = NONE;
  // The panel being drawn: stays set while a closing panel slides away.
  shownPanel = NONE;
  panelAt = 0;
  closing = false;
  demo = false;
  demoAt = 0;
  pressed = BUTTON_NONE;
  lastTouch = 0;

  poke() {
    this.lastTouch = Date.now();
  }

  quietFor(): number {
    return Date.now() - this.lastTouch;
  }
}

export const shell = new ShellStore();
