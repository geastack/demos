import type { CanvasRenderingContext2D, GeaCanvasElement } from "@geastack/core";
import { ALBUMS } from "../data/albums";
import { COL_W } from "../layout";
import { player } from "../stores/player";
import { tint } from "../stores/tint";

export const SPECTRUM_ID = "spectrum";
const BARS = 26;
const PITCH = Math.floor(COL_W / BARS); // bar + gap: 8 px in the 208 px column
const BAR_W = PITCH - 2;
export const SPECTRUM_W = BARS * PITCH;
export const SPECTRUM_H = 36;
const FLOOR = 2; // a resting bar is a 2 px dot
const CAP = "rgb(248,248,248)";
const TABLE = 1024;
const ATTACK = 0.55; // share of the gap a rising bar closes per frame
const RELEASE_S = 0.14; // falling time constant
const PEAK_FALL = 0.7; // peak caps fall this much of the height per second
const MAX_DT = 0.05;

// A 1024-entry sine table: per-bar wobble without Math.sin in the loop.
const SINE = new Float32Array(TABLE);
for (let i = 0; i < TABLE; i++) SINE[i] = Math.sin((i / TABLE) * Math.PI * 2);

function sine(turns: number): number {
  return SINE[Math.floor(turns * TABLE) & (TABLE - 1)];
}

// The equaliser under the title: a synthetic spectrum, not audio. Each bar is
// a band whose level follows a spectral tilt, two slow wobbles, and the
// album's beat (kick in the lows on every beat, a snare in the mids on 2 and
// 4, hats in the highs on the off-beats), scaled by the album's energy. Bars
// rise fast and fall slowly; a white peak cap lingers above each one. When
// playback pauses every target drops to zero, so the bars sink to dots, and
// once they rest the canvas stops drawing.
class Spectrum {
  private ctx: CanvasRenderingContext2D | null = null;
  private level = new Float32Array(BARS);
  private peak = new Float32Array(BARS);
  private rates = new Float32Array(BARS);
  private run = 0;
  private lastFrame = 0;
  private clock = 0; // seconds of playback the bars have danced to
  private resting = false;
  private drawnBg = "";

  constructor() {
    for (let i = 0; i < BARS; i++) this.rates[i] = 0.31 + ((i * 37) % 23) / 29;
  }

  // The canvas exists only once its screen has mounted, which can be a frame
  // or two after attach(): frame() keeps looking for it until it is there.
  attach() {
    this.run = this.run + 1;
    const run = this.run;
    requestAnimationFrame(() => {
      this.ctx = null;
      this.resting = false;
      this.drawnBg = "";
      this.lastFrame = Date.now();
      this.frame(run);
    });
  }

  private find() {
    const canvas = document.getElementById(SPECTRUM_ID) as unknown as GeaCanvasElement | null;
    if (canvas) {
      this.ctx = canvas.getContext("2d");
      this.resting = false;
      this.drawnBg = "";
    }
  }

  detach() {
    this.run = this.run + 1;
    this.ctx = null;
  }

  private frame(run: number) {
    if (run !== this.run) return;

    if (!this.ctx) this.find();

    const now = Date.now();
    const dt = Math.min(MAX_DT, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (player.playing) this.clock = this.clock + dt;
    this.update(dt, player.playing);
    this.draw();
    requestAnimationFrame(() => this.frame(run));
  }

  private update(dt: number, playing: boolean) {
    const album = ALBUMS[player.album];
    const beat = (this.clock * album.bpm) / 60;
    const kick = Math.exp(-(beat - Math.floor(beat)) * 5);
    const half = (beat + 1) / 2;
    const snare = Math.exp(-(half - Math.floor(half)) * 7);
    const off = beat * 2;
    const hat = Math.exp(-(off - Math.floor(off)) * 9);
    const release = 1 - Math.exp(-dt / RELEASE_S);
    const level = this.level;
    const peak = this.peak;
    let moving = false;

    for (let i = 0; i < BARS; i++) {
      let target = 0;
      if (playing) {
        const band = i / (BARS - 1);
        const tilt = 0.5 - 0.22 * band;
        const wobble = 0.18 * sine(this.clock * this.rates[i]) + 0.12 * sine(this.clock * (this.rates[i] * 2.7) + band);
        const lows = kick * Math.max(0, 1 - band * 4) * 0.55;
        const mids = snare * Math.max(0, 1 - Math.abs(band - 0.45) * 4) * 0.4;
        const highs = hat * Math.max(0, band * 1.6 - 0.6) * 0.35;
        target = Math.max(0, Math.min(1, album.energy * (tilt + wobble + lows + mids + highs)));
      }

      const current = level[i];
      level[i] = current + (target - current) * (target > current ? ATTACK : release);
      peak[i] = level[i] > peak[i] ? level[i] : Math.max(0, peak[i] - PEAK_FALL * dt);
      if (level[i] > 0.004 || peak[i] > 0.004) moving = true;
    }

    this.resting = !moving;
  }

  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;

    const bg = tint.bg;
    if (this.resting && bg === this.drawnBg) return;

    this.drawnBg = bg;
    const span = SPECTRUM_H - FLOOR - 3;
    ctx.beginBatch();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SPECTRUM_W, SPECTRUM_H);
    ctx.fillStyle = tint.accent;
    for (let i = 0; i < BARS; i++) {
      const height = FLOOR + Math.round(this.level[i] * span);
      ctx.fillRect(i * PITCH, SPECTRUM_H - height, BAR_W, height);
    }

    ctx.fillStyle = CAP;
    for (let i = 0; i < BARS; i++) {
      if (this.peak[i] < 0.03) continue;

      const top = SPECTRUM_H - FLOOR - Math.round(this.peak[i] * span) - 3;
      ctx.fillRect(i * PITCH, top, BAR_W, 2);
    }

    ctx.endBatch();
  }
}

export const spectrum = new Spectrum();
