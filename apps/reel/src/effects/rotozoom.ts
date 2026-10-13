import { buildRamp, cosTurns, HALF_W, HEIGHT, hash, sinTurns } from "../lib/frame";
import { touch } from "../lib/touch";

// A Truchet texture rotated and zoomed: a 16.16 fixed-point walk across the
// texture per row, two pixels per 32-bit store.

const TILE = 32;
const ARC_RADIUS = 16;
const ARC_WIDTH = 3.2;
const BAKE_ROWS = 16; // texture rows per bake step

// Midnight violet to hot magenta to sunset orange and a cream highlight.
const RAMP = [0, 20, 8, 48, 0.25, 56, 16, 96, 0.55, 200, 36, 132, 0.8, 255, 112, 72, 1, 255, 228, 176];

// Coverage of a Truchet tile's two quarter-circle arcs at the centre of
// texel (x, y) of the tile, 0..256.
function truchet(x: number, y: number): number {
  const px = x + 0.5;
  const py = y + 0.5;
  const d0 = Math.abs(Math.sqrt(px * px + py * py) - ARC_RADIUS);
  const dx = TILE - px;
  const dy = TILE - py;
  const d1 = Math.abs(Math.sqrt(dx * dx + dy * dy) - ARC_RADIUS);
  const cover = ARC_WIDTH - Math.min(d0, d1);
  return Math.round((cover < 0 ? 0 : cover > 1 ? 1 : cover) * 256);
}

export class Rotozoom {
  private readonly texture = new Uint8Array(65536);
  private readonly palette = new Uint16Array(256);
  private readonly cover = new Uint16Array(TILE * TILE); // one tile's arc coverage, Q8
  private angle = 0;
  private zoom = 0;
  private bakedRows = 0;

  // A slice of the texture per call; true once done.
  bake(): boolean {
    if (this.bakedRows === 0) {
      buildRamp(this.palette, 0, 256, RAMP);
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) this.cover[y * TILE + x] = truchet(x, y);
      }
    }

    const end = Math.min(256, this.bakedRows + BAKE_ROWS);
    for (let v = this.bakedRows; v < end; v++) this.bakeRow(v);
    this.bakedRows = end;
    return end === 256;
  }

  render(words: Uint32Array, t: number) {
    // Dragging turns the texture (x) and zooms it (y) on top of the script.
    this.angle += touch.dragX * 0.006;
    this.zoom += touch.dragY * 0.004;
    touch.consumeDrag();

    const angle = t * 0.06 + sinTurns(t * 0.035) * 0.12 + this.angle;
    const zoom = Math.max(0.4, Math.min(2.4, 1.25 + sinTurns(t * 0.07) * 0.7 + this.zoom));

    // Texture step per screen pixel along x (a row down is it turned a
    // quarter), and the top-left pixel's texel, so the centre stays put.
    const c = cosTurns(angle) * zoom;
    const s = sinTurns(angle) * zoom;
    const du = (c * 65536) | 0;
    const dv = (s * 65536) | 0;
    const panU = t * 22;
    const panV = t * 9;
    let rowU = ((panU - c * HALF_W + s * (HEIGHT / 2)) * 65536) | 0;
    let rowV = ((panV - s * HALF_W - c * (HEIGHT / 2)) * 65536) | 0;
    const texture = this.texture;
    const palette = this.palette;
    const halfW = HALF_W | 0;
    const height = HEIGHT | 0;

    for (let y = 0; y < height; y++) {
      let u = rowU;
      let v = rowV;
      const line = y * halfW;
      for (let x = 0; x < halfW; x++) {
        const first = palette[texture[(((v >>> 8) & 0xff00) | ((u >>> 16) & 0xff)) & 0xffff] & 255];
        u = (u + du) | 0;
        v = (v + dv) | 0;
        const second = palette[texture[(((v >>> 8) & 0xff00) | ((u >>> 16) & 0xff)) & 0xffff] & 255];
        u = (u + du) | 0;
        v = (v + dv) | 0;
        words[line + x] = first | (second << 16);
      }
      rowU = (rowU - dv) | 0;
      rowV = (rowV + du) | 0;
    }
  }

  // Arcs of a random Truchet tiling over a diagonal backdrop gradient; the
  // arcs' palette index shifts across the texture so they change colour. A
  // flipped tile mirrors the arcs so they join the other corners.
  private bakeRow(v: number) {
    const texture = this.texture;
    const cover = this.cover;
    const tileRow = (v >> 5) * 8;
    const coverRow = (v & 31) * TILE;
    for (let u = 0; u < 256; u++) {
      const flip = (hash(tileRow + (u >> 5) + 101) & 1) !== 0;
      const column = flip ? 31 - (u & 31) : u & 31;
      const diagonal = sinTurns((u + v) / 256) * 0.5 + 0.5;
      const backdrop = 18 + diagonal * 40;
      const arc = 150 + diagonal * 105;
      texture[v * 256 + u] = backdrop + ((arc - backdrop) * cover[coverRow + column]) / 256;
    }
  }
}
