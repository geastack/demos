import { FRAME_LENGTH, HEIGHT, PIXELS, rgb565, WIDTH, wordsOf } from "../lib/frame";
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
const WORDS = PIXELS / 2; // two pixels per word
const EDGE = 2; // half-width of the bright seam of iris and wipe
const CENTRE_X = WIDTH / 2;
const CENTRE_Y = HEIGHT / 2;
// The iris must clear the corners; the wipe's edge leans back at the top by
// WIPE_LEAN px per row, so its run starts and ends that far outside.
const IRIS_REACH = Math.sqrt(CENTRE_X * CENTRE_X + CENTRE_Y * CENTRE_Y) + 14;
const WIPE_LEAN = 0.4;
const WIPE_MARGIN = Math.round(WIPE_LEAN * CENTRE_Y) + 24;
const SEAM = rgb565(255, 240, 220);

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
  private readonly scratch = new Uint16Array(FRAME_LENGTH); // the outgoing scene during a transition
  private readonly scratchWords = wordsOf(this.scratch);

  // Bakes what the title needs.
  init() {
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
    const shown = this.ready[scene] === 1 ? scene : TITLE;
    if (shown === TUNNEL) this.tunnel.render(words, t);
    else if (shown === ROTOZOOM) this.rotozoom.render(words, t);
    else if (shown === VORTEX) this.vortex.render(words, t);
    else if (shown === FIRE) this.fire.render(words, t);
    else if (shown === METABALLS) this.metaballs.render(words, t);
    else this.horizon.render(pixels, t);
  }

  // Renders the outgoing `scene` and composites the incoming frame already
  // in `pixels` over it; `mix` runs 0 (all outgoing) to 1.
  transition(scene: number, t: number, mix: number, kind: number, pixels: Uint16Array, words: Uint32Array) {
    this.render(scene, this.scratch, this.scratchWords, t);
    if (kind === IRIS) this.iris(pixels, mix);
    else if (kind === WIPE) this.wipe(pixels, mix);
    else if (kind === CROSSFADE) this.crossfade(words, mix);
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
  private iris(pixels: Uint16Array, mix: number) {
    const radius = mix * IRIS_REACH;
    const height = HEIGHT | 0;
    const width = WIDTH | 0;
    for (let y = 0; y < height; y++) {
      const dy = y - CENTRE_Y + 0.5;
      const inner = chord(radius - EDGE, dy);
      const outer = chord(radius + EDGE, dy);
      this.composeRow(pixels, y * width, CENTRE_X - inner, CENTRE_X + inner, CENTRE_X - outer, CENTRE_X + outer);
    }
  }

  // A diagonal edge sweeping left to right, leaning back at the top.
  private wipe(pixels: Uint16Array, mix: number) {
    const width = WIDTH | 0;
    const height = HEIGHT | 0;
    const front = -WIPE_MARGIN + mix * (width + 2 * WIPE_MARGIN);
    for (let y = 0; y < height; y++) {
      const edge = (front + (y - CENTRE_Y) * WIPE_LEAN) | 0;
      this.composeRow(pixels, y * width, 0, edge - EDGE, 0, edge + EDGE);
    }
  }

  // One row of a shaped transition: the incoming frame stays inside
  // [innerLeft, innerRight), the seam fills the rest of [outerLeft,
  // outerRight), and the outgoing frame shows everywhere else.
  private composeRow(
    pixels: Uint16Array,
    row: number,
    innerLeft: number,
    innerRight: number,
    outerLeft: number,
    outerRight: number,
  ) {
    const scratch = this.scratch;
    const start = row | 0;
    const width = WIDTH | 0;
    const left = Math.max(0, Math.min(width, outerLeft | 0));
    const right = Math.max(0, Math.min(width, outerRight | 0));
    const insideLeft = Math.max(left, Math.min(right, innerLeft | 0));
    const insideRight = Math.max(insideLeft, Math.min(right, innerRight | 0));
    for (let x = 0; x < left; x++) pixels[start + x] = scratch[start + x];
    for (let x = left; x < insideLeft; x++) pixels[start + x] = SEAM;
    for (let x = insideRight; x < right; x++) pixels[start + x] = SEAM;
    for (let x = right; x < width; x++) pixels[start + x] = scratch[start + x];
  }

  // Blends two pixels per step. A pair word holds six 5-6 bit channels; the
  // two masks each pick three of them with room above each to multiply by
  // a 0..32 weight without spilling into the next.
  private crossfade(words: Uint32Array, mix: number) {
    const outgoing = this.scratchWords;
    const alpha = (mix * 32) | 0;
    const keep = 32 - alpha;
    const count = WORDS | 0;
    for (let i = 0; i < count; i++) {
      const a = outgoing[i];
      const b = words[i];
      const low = ((Math.imul(a & 0x07e0f81f, keep) + Math.imul(b & 0x07e0f81f, alpha)) >>> 5) & 0x07e0f81f;
      const high =
        ((Math.imul((a >>> 5) & 0x07c0f83f, keep) + Math.imul((b >>> 5) & 0x07c0f83f, alpha)) >>> 5) & 0x07c0f83f;
      words[i] = low | (high << 5);
    }
  }
}

// Half-width of a circle's chord `dy` from its centre; -1 past its edge.
function chord(radius: number, dy: number): number {
  if (radius <= 0) return -1;

  const d = radius * radius - dy * dy;
  return d > 0 ? Math.sqrt(d) | 0 : -1;
}
