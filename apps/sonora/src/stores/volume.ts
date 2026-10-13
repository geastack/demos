import { Store } from "@geastack/core";
import { PILL_H } from "../layout";
import { shell, VOLUME } from "./shell";

const FILL_MIN = 56; // an empty fill is still the circle that holds the icon
const STORAGE_KEY = "sonora.volume";
const DRAG_SPAN = Math.floor((PILL_H * 15) / 16); // px of finger travel for the full range (180 for the 192 px pill)
const SETTLE_MS = 70; // time constant the shown level chases the target with
const CLOSE_AFTER_MS = 2200;

export const ICON_MUTE = 0;
export const ICON_LOW = 1;
export const ICON_HIGH = 2;

// The volume (0-100) and its overlay. The finger sets a target; the shown
// level chases it every frame, so the fill glides and the numeral rolls
// through the values in between. The overlay closes itself shortly after the
// last touch.
class VolumeStore extends Store {
  shown = 0; // the numeral
  fill = FILL_MIN; // fill height, px
  icon = ICON_LOW;

  private target = 40;
  private level = 40; // float, chases target
  private startY = 0;
  private startLevel = 0;
  private lastFrame = 0;
  private animating = false;
  private closeTimer = 0;

  init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) this.target = Number(saved);

    this.level = this.target;
    this.publish();
  }

  /** Opens the overlay without changing the level (the volume button). */
  open() {
    shell.show(VOLUME);
    this.scheduleClose();
  }

  /** A vertical drag begins at screen y (on the art or the overlay). */
  grab(y: number) {
    if (shell.overlay !== VOLUME || shell.closing) shell.show(VOLUME);

    this.startY = y;
    this.startLevel = this.target;
    this.cancelClose();
  }

  drag(y: number) {
    const level = this.startLevel + ((this.startY - y) * 100) / DRAG_SPAN;
    this.setTarget(Math.round(Math.max(0, Math.min(100, level))));
  }

  release() {
    localStorage.setItem(STORAGE_KEY, String(this.target));
    this.scheduleClose();
  }

  private setTarget(target: number) {
    if (target === this.target) return;

    this.target = target;
    if (this.animating) return;

    this.animating = true;
    this.lastFrame = Date.now();
    requestAnimationFrame(() => this.step());
  }

  private step() {
    const now = Date.now();
    const dt = Math.min(48, now - this.lastFrame);
    this.lastFrame = now;
    const delta = this.target - this.level;
    const done = Math.abs(delta) < 0.3;
    this.level = done ? this.target : this.level + delta * (1 - Math.exp(-dt / SETTLE_MS));
    this.publish();
    if (done) {
      this.animating = false;
      return;
    }

    requestAnimationFrame(() => this.step());
  }

  private publish() {
    const shown = Math.round(this.level);
    const fill = Math.round(FILL_MIN + (this.level * (PILL_H - FILL_MIN)) / 100);
    const icon = shown === 0 ? ICON_MUTE : shown < 50 ? ICON_LOW : ICON_HIGH;
    if (shown !== this.shown) this.shown = shown;
    if (fill !== this.fill) this.fill = fill;
    if (icon !== this.icon) this.icon = icon;
  }

  private scheduleClose() {
    this.cancelClose();
    this.closeTimer = setTimeout(() => {
      if (shell.overlay === VOLUME) shell.dismiss();
    }, CLOSE_AFTER_MS);
  }

  private cancelClose() {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = 0;
  }
}

export const volume = new VolumeStore();
