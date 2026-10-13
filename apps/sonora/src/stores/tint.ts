import { Store } from "@geastack/core";
import { PALETTES } from "../data/palette";

const STEPS = 6; // a new tint arrives in a few whole-screen repaints, not a fade
const STEP_MS = 60;
const CHANNELS = 9; // bg, accent, accentSoft as r, g, b

const HEX = "0123456789abcdef";

function hexByte(hex: string, at: number): number {
  return HEX.indexOf(hex[at]) * 16 + HEX.indexOf(hex[at + 1]);
}

// Writes a "#rrggbb" colour's channels into `out` at `at`.
function unpack(hex: string, out: number[], at: number) {
  out[at] = hexByte(hex, 1);
  out[at + 1] = hexByte(hex, 3);
  out[at + 2] = hexByte(hex, 5);
}

// The colours every screen takes from the album on show: the background
// tint and the accent. Changing album steps them across.
class TintStore extends Store {
  album = 0;
  bg = PALETTES[0].bg;
  accent = PALETTES[0].accent;
  accentSoft = PALETTES[0].accentSoft;

  // Channels on show, where a fade starts, and where it ends.
  private shown: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  private from: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  private to: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  private run = 0;

  init() {
    this.read(0, this.to);
    this.apply(1);
  }

  /** Steps from the colours on show to an album's. */
  fade(album: number) {
    if (album === this.album) return;

    this.album = album;
    for (let i = 0; i < CHANNELS; i++) this.from[i] = this.shown[i];
    this.read(album, this.to);
    this.run = this.run + 1;
    const run = this.run;
    setTimeout(() => this.step(run, 1), STEP_MS);
  }

  private step(run: number, index: number) {
    if (run !== this.run) return;

    this.apply(index / STEPS);
    if (index < STEPS) setTimeout(() => this.step(run, index + 1), STEP_MS);
  }

  private read(album: number, out: number[]) {
    const palette = PALETTES[album];
    unpack(palette.bg, out, 0);
    unpack(palette.accent, out, 3);
    unpack(palette.accentSoft, out, 6);
  }

  // Blends the channels (snapped to the RGB565 grid) and publishes them.
  private apply(t: number) {
    for (let i = 0; i < CHANNELS; i++) {
      const grid = i % 3 === 1 ? 4 : 8;
      const value = Math.round((this.from[i] + (this.to[i] - this.from[i]) * t) / grid) * grid;
      this.shown[i] = Math.min(value, 256 - grid);
    }

    this.bg = this.colour(0);
    this.accent = this.colour(3);
    this.accentSoft = this.colour(6);
  }

  private colour(at: number): string {
    return `rgb(${this.shown[at]},${this.shown[at + 1]},${this.shown[at + 2]})`;
  }
}

export const tint = new TintStore();
