import { Memory } from "@geastack/core";
import { HEIGHT, rgb565, WIDTH, wordsOf } from "../lib/frame";
import { CROSSFADE, IRIS, SCENE_COUNT, TITLE, WIPE } from "../lib/timeline";
import { Fire } from "./fire";
import { Horizon } from "./horizon";
import { Metaballs } from "./metaballs";
import { Rotozoom } from "./rotozoom";
import { Tunnel } from "./tunnel";
import { Vortex } from "./vortex";

const TUNNEL = 1;
const ROTOZOOM = 2;
const VORTEX = 3;
const FIRE = 4;
const METABALLS = 5;
const BAND_ROWS = 16; // rows of the outgoing scene rendered at a time, even
const EDGE = 2; // half-width of the bright seam of iris and wipe
const CENTRE_X = WIDTH / 2;
const CENTRE_Y = HEIGHT / 2;
// The iris must clear the corners; the wipe's edge leans back at the top by
// WIPE_LEAN px per row, so its run starts and ends that far outside.
const IRIS_REACH = Math.sqrt(CENTRE_X * CENTRE_X + CENTRE_Y * CENTRE_Y) + 14;
const WIPE_LEAN = 0.4;
const WIPE_MARGIN = Math.round(WIPE_LEAN * CENTRE_Y) + 24;
const SEAM = rgb565(255, 240, 220);
const HOT_BYTES = 65536;

// The reel's effects in running order (lib/timeline.ts), their bakes, and
// the transitions between them. A scene whose tables are not baked yet
// shows the title's horizon.
export class Scenes {
  private readonly horizon = new Horizon();
  private readonly tunnel = new Tunnel();
  private readonly rotozoom = new Rotozoom();
  private readonly vortex = new Vortex();
  private readonly fire = new Fire();
  private readonly metaballs = new Metaballs();
  private readonly ready = new Uint8Array(SCENE_COUNT);
  // The outgoing scene during a transition, a band of rows at a time: a whole
  // frame lives in PSRAM, and writing it and reading it back for the blend
  // doubled the transition's PSRAM traffic.
  private band = new Uint16Array(0);
  private bandWords: Uint32Array = new Uint32Array(0);
  // The focused scene's 64 KB texture, copied into on-chip RAM: the tunnel,
  // rotozoom and fire read theirs at random every pixel, and from PSRAM those
  // reads cost several times the rest of the frame.
  private hot = new Uint8Array(0);
  private hotScene = TITLE;

  // Bakes what the title needs.
  init() {
    Memory.beginInternal(HOT_BYTES);
    this.hot = new Uint8Array(HOT_BYTES);
    Memory.endInternal();
    // Not on-chip: rgb_panel needs what is left there for its own strips
    // (taking it switched off its text raster). A band is written and read
    // straight back, so it stays in the PSRAM cache.
    this.band = new Uint16Array(BAND_ROWS * WIDTH);
    this.bandWords = wordsOf(this.band);
    this.horizon.bake();
    this.ready[TITLE] = 1;
  }

  // Bakes the next scenes' tables for up to `budgetMs`; true once all are ready.
  prepare(budgetMs: number): boolean {
    const started = Date.now();
    for (let scene = 0; scene < SCENE_COUNT; scene++) {
      while (this.ready[scene] === 0) {
        if (Date.now() - started >= budgetMs) return false;
        if (this.bakeStep(scene)) this.ready[scene] = 1;
      }
    }
    return true;
  }

  render(scene: number, pixels: Uint16Array, words: Uint32Array, t: number) {
    this.focus(this.ready[scene] === 1 ? scene : TITLE);
    this.draw(scene, pixels, words, t);
  }

  // Moves the fast copy to `scene`; the scene it leaves reads its own again.
  // A scene with no texture leaves it where it is: during its entrance the
  // outgoing scene still renders, and from PSRAM a rotozoom takes several
  // times as long (the rotozoom-to-vortex crossfade fell to 3 fps).
  private focus(scene: number) {
    if (scene === this.hotScene || (scene !== TUNNEL && scene !== ROTOZOOM && scene !== FIRE)) return;

    if (this.hotScene === TUNNEL) this.tunnel.texture = this.tunnel.baked;
    else if (this.hotScene === ROTOZOOM) this.rotozoom.texture = this.rotozoom.baked;
    else if (this.hotScene === FIRE) this.fire.noise = this.fire.baked;
    this.hotScene = scene;
    const hot = this.hot;
    if (hot.length !== HOT_BYTES) return;

    if (scene === TUNNEL) {
      hot.set(this.tunnel.baked);
      this.tunnel.texture = hot;
    } else if (scene === ROTOZOOM) {
      hot.set(this.rotozoom.baked);
      this.rotozoom.texture = hot;
    } else if (scene === FIRE) {
      hot.set(this.fire.baked);
      this.fire.noise = hot;
    }
  }

  private draw(scene: number, pixels: Uint16Array, words: Uint32Array, t: number) {
    const shown = this.ready[scene] === 1 ? scene : TITLE;
    if (shown === TUNNEL) this.tunnel.render(words, t);
    else if (shown === ROTOZOOM) this.rotozoom.render(words, t);
    else if (shown === VORTEX) this.vortex.render(words, t);
    else if (shown === FIRE) this.fire.render(words, t);
    else if (shown === METABALLS) this.metaballs.render(words, t);
    else this.horizon.render(pixels, t);
  }

  // Renders the outgoing `scene` band by band and composites the incoming
  // frame already in `pixels` over it; `mix` runs 0 (all outgoing) to 1.
  // A scene still showing the horizon (not baked) has no bands: the incoming
  // frame shows alone.
  transition(scene: number, t: number, mix: number, kind: number, pixels: Uint16Array, words: Uint32Array) {
    const shown = this.ready[scene] === 1 ? scene : TITLE;
    if (shown === TITLE) return;

    if (shown === TUNNEL) this.tunnel.prepare(t);
    else if (shown === ROTOZOOM) this.rotozoom.prepare(t);
    else if (shown === VORTEX) this.vortex.prepare(t);
    else if (shown === FIRE) this.fire.prepare(t);
    else this.metaballs.prepare(t);
    const band = this.bandWords;
    const height = HEIGHT | 0;
    for (let first = 0; first < height; first += BAND_ROWS) {
      const count = Math.min(BAND_ROWS, height - first);
      if (shown === TUNNEL) this.tunnel.rows(band, first, count);
      else if (shown === ROTOZOOM) this.rotozoom.rows(band, first, count);
      else if (shown === VORTEX) this.vortex.rows(band, first, count);
      else if (shown === FIRE) this.fire.rows(band, first, count);
      else this.metaballs.rows(band, first, count);
      if (kind === IRIS) this.iris(pixels, mix, first, count);
      else if (kind === WIPE) this.wipe(pixels, mix, first, count);
      else if (kind === CROSSFADE) this.crossfade(words, mix, first, count);
    }
  }

  private bakeStep(scene: number): boolean {
    if (scene === TUNNEL) return this.tunnel.bake();
    if (scene === ROTOZOOM) return this.rotozoom.bake();
    if (scene === VORTEX) return this.vortex.bake();
    if (scene === FIRE) return this.fire.bake();
    if (scene === METABALLS) return this.metaballs.bake();
    return true;
  }

  // A circle opening from the centre.
  private iris(pixels: Uint16Array, mix: number, first: number, count: number) {
    const radius = mix * IRIS_REACH;
    const width = WIDTH | 0;
    for (let y = first; y < first + count; y++) {
      const dy = y - CENTRE_Y + 0.5;
      const inner = chord(radius - EDGE, dy);
      const outer = chord(radius + EDGE, dy);
      this.composeRow(
        pixels,
        y * width,
        (y - first) * width,
        CENTRE_X - inner,
        CENTRE_X + inner,
        CENTRE_X - outer,
        CENTRE_X + outer,
      );
    }
  }

  // A diagonal edge sweeping left to right, leaning back at the top.
  private wipe(pixels: Uint16Array, mix: number, first: number, count: number) {
    const width = WIDTH | 0;
    const front = -WIPE_MARGIN + mix * (width + 2 * WIPE_MARGIN);
    for (let y = first; y < first + count; y++) {
      const edge = (front + (y - CENTRE_Y) * WIPE_LEAN) | 0;
      this.composeRow(pixels, y * width, (y - first) * width, 0, edge - EDGE, 0, edge + EDGE);
    }
  }

  // One row of a shaped transition: the incoming frame stays inside
  // [innerLeft, innerRight), the seam fills the rest of [outerLeft,
  // outerRight), and the outgoing frame (the band's row `bandRow`) shows
  // everywhere else.
  private composeRow(
    pixels: Uint16Array,
    row: number,
    bandRow: number,
    innerLeft: number,
    innerRight: number,
    outerLeft: number,
    outerRight: number,
  ) {
    const band = this.band;
    const seam: i32 = SEAM | 0;
    const start: i32 = row | 0;
    const from: i32 = bandRow | 0;
    const width: i32 = WIDTH | 0;
    const left: i32 = Math.max(0, Math.min(width, outerLeft | 0)) | 0;
    const right: i32 = Math.max(0, Math.min(width, outerRight | 0)) | 0;
    const insideLeft: i32 = Math.max(left, Math.min(right, innerLeft | 0)) | 0;
    const insideRight: i32 = Math.max(insideLeft, Math.min(right, innerRight | 0)) | 0;
    for (let x: i32 = 0; x < left; x++) pixels[start + x] = band[from + x];
    for (let x: i32 = left; x < insideLeft; x++) pixels[start + x] = seam;
    for (let x: i32 = insideRight; x < right; x++) pixels[start + x] = seam;
    for (let x: i32 = right; x < width; x++) pixels[start + x] = band[from + x];
  }

  // Blends two pixels per step. A pair word holds six 5-6 bit channels; the
  // two masks each pick three of them with room above each to multiply by
  // a 0..32 weight without spilling into the next.
  private crossfade(words: Uint32Array, mix: number, first: number, rows: number) {
    const outgoing = this.bandWords;
    const alpha: i32 = (mix * 32) | 0;
    const keep: i32 = 32 - alpha;
    const count: i32 = ((rows * WIDTH) >> 1) | 0;
    const base: i32 = ((first * WIDTH) >> 1) | 0;
    // Shifted right before masking, so arithmetic shifts lose nothing a mask keeps.
    for (let i: i32 = 0; i < count; i++) {
      const a: i32 = outgoing[i];
      const b: i32 = words[base + i];
      const low: i32 = (((a & 0x07e0f81f) * keep + (b & 0x07e0f81f) * alpha) >> 5) & 0x07e0f81f;
      const high: i32 = ((((a >> 5) & 0x07c0f83f) * keep + ((b >> 5) & 0x07c0f83f) * alpha) >> 5) & 0x07c0f83f;
      words[base + i] = low | (high << 5);
    }
  }
}

// Half-width of a circle's chord `dy` from its centre; -1 past its edge.
function chord(radius: number, dy: number): number {
  if (radius <= 0) return -1;

  const d = radius * radius - dy * dy;
  return d > 0 ? Math.sqrt(d) | 0 : -1;
}
