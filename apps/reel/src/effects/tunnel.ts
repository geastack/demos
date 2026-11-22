import { blend565, buildRamp, HALF_H, HALF_W, HEIGHT, hash, rgb565, sinTurns, WIDTH } from "../lib/frame";
import { touch } from "../lib/touch";

// A textured tunnel flight through angle/depth lookup tables, rendered at
// half resolution in 2x2 blocks. The tables cover a margin around the
// half-res frame: sliding the frame's window over them moves the vanishing
// point.

const MARGIN_X = 48;
const MARGIN_Y = 32;
const LUT_W = HALF_W + 2 * MARGIN_X;
const LUT_H = HALF_H + 2 * MARGIN_Y;
const LUT_CELLS = LUT_W * LUT_H;
const SHADES = 16;
const BAKE_ROWS = 12; // table rows per bake step
const QUARTER_TURN = Math.PI / 2;
const HALF_TURN = Math.PI;
const ANGLE_SCALE = 256 / Math.PI; // radians to texture columns, two wraps per turn
// Depth and shade were tuned on a 136-row half-res frame; they scale with
// its smaller side so a bigger screen shows the same tunnel, bigger.
const SIZE = Math.min(HALF_W, HALF_H) / 136;
const DEPTH_SCALE = 3600 * SIZE; // texture rows per unit of 1/radius
const SHADE_SCALE = (SHADES - 1) / (136 * 0.62 * SIZE);

// Indigo to cyan to white, fading into a deep-violet fog with distance.
const RAMP = [0, 10, 12, 40, 0.35, 30, 40, 120, 0.7, 40, 170, 230, 0.9, 150, 240, 255, 1, 255, 255, 255];

export class Tunnel {
  private readonly coords = new Uint16Array(LUT_CELLS); // (depth << 8) | angle
  private readonly shade = new Uint8Array(LUT_CELLS); // 0 (far, dark) .. SHADES - 1 (near)
  readonly baked = new Uint8Array(65536);
  texture: Uint8Array = this.baked; // what render reads: `baked`, or a copy in fast RAM
  private readonly palette = new Uint16Array(SHADES * 256);
  private centerX = 0;
  private centerY = 0;
  private bakedRows = -1; // -1: texture and palette not baked yet

  // One slice of the tables per call; true once done.
  bake(): boolean {
    if (this.bakedRows < 0) {
      this.bakeTexture();
      this.bakePalette();
      this.bakedRows = 0;
      return false;
    }

    const lutH = LUT_H | 0;
    const end = Math.min(lutH, this.bakedRows + BAKE_ROWS);
    for (let y = this.bakedRows; y < end; y++) this.bakeRow(y);
    this.bakedRows = end;
    return end === lutH;
  }

  private offsetX = 0;
  private offsetY = 0;
  private spin = 0;
  private travel = 0;

  render(words: Uint32Array, t: number) {
    this.prepare(t);
    this.rows(words, 0, HEIGHT);
  }

  // The frame's state at `t`; `rows` then draws any band of it.
  prepare(t: number) {
    // The vanishing point wanders on a Lissajous path; a finger steers it.
    let targetX = sinTurns(t * 0.09) * 0.8;
    let targetY = sinTurns(t * 0.13 + 0.1) * 0.8;
    if (touch.down) {
      targetX = (touch.x - HALF_W) / HALF_W;
      targetY = (touch.y - HALF_H) / HALF_H;
    }
    this.centerX += (targetX - this.centerX) * 0.08;
    this.centerY += (targetY - this.centerY) * 0.08;

    // Moving the window left moves the vanishing point right.
    this.offsetX = (MARGIN_X - ((this.centerX * MARGIN_X) | 0)) | 0;
    this.offsetY = (MARGIN_Y - ((this.centerY * MARGIN_Y) | 0)) | 0;
    this.spin = ((t * 24) | 0) & 255;
    this.travel = (((t * 150) | 0) & 255) << 8;
  }

  // Frame rows [first, first + count) into `words`, whose row 0 is frame row
  // `first`; both even (each LUT row fills two).
  rows(words: Uint32Array, first: number, count: number) {
    const offsetX: i32 = this.offsetX | 0;
    const offsetY: i32 = this.offsetY | 0;
    const spin: i32 = this.spin | 0;
    const travel: i32 = this.travel | 0;
    const coords = this.coords;
    const shade = this.shade;
    const texture = this.texture;
    const palette = this.palette;
    const halfW: i32 = HALF_W | 0;
    const halfH: i32 = HALF_H | 0;
    const lutW: i32 = LUT_W | 0;
    const width: i32 = WIDTH | 0;

    const top: i32 = (first >> 1) | 0;
    const end: i32 = Math.min(halfH, (first + count) >> 1) | 0;
    for (let y: i32 = top; y < end; y++) {
      const row: i32 = (y + offsetY) * lutW + offsetX;
      const even: i32 = (y - top) * width;
      const odd: i32 = even + halfW;
      for (let x: i32 = 0; x < halfW; x++) {
        const c: i32 = coords[row + x];
        const texel: i32 = ((c + travel) & 0xff00) | ((c + spin) & 0xff);
        const colour: i32 = palette[((shade[row + x] << 8) | texture[texel & 0xffff]) & 4095];
        const pair: i32 = colour * 0x10001;
        words[even + x] = pair;
        words[odd + x] = pair;
      }
    }
  }

  // Panels with bevelled seams, a few lit windows, and a thin light ring
  // every quarter of the texture's depth.
  private bakeTexture() {
    const texture = this.baked;
    for (let v = 0; v < 256; v++) {
      for (let u = 0; u < 256; u++) {
        const cu = u & 31;
        const cv = v & 31;
        const cell = hash((v >> 5) * 8 + (u >> 5) + 11);
        let value = 70 + (cell & 63);
        if (cu < 2 || cv < 2) value += 70;
        if (cu > 29 || cv > 29) value -= 50;
        if ((cell >>> 8) % 5 === 0 && cu > 9 && cu < 22 && cv > 11 && cv < 20) value = 230;
        if ((v & 63) < 2) value = 220;
        texture[v * 256 + u] = Math.max(0, Math.min(255, value));
      }
    }
  }

  private bakePalette() {
    const palette = this.palette;
    const ramp = new Uint16Array(256);
    buildRamp(ramp, 0, 256, RAMP);
    const fog = rgb565(8, 6, 24);
    for (let s = 0; s < SHADES; s++) {
      const alpha = ((s * 32) / (SHADES - 1)) | 0;
      for (let i = 0; i < 256; i++) palette[s * 256 + i] = blend565(fog, ramp[i], alpha);
    }
  }

  // One table row, in float32: the radius from the centre gives depth and
  // shade, the angle (an atan2 good to ~0.3 degrees) the texture column.
  private bakeRow(y: number) {
    const coords = this.coords;
    const shade = this.shade;
    const lutW = LUT_W | 0;
    const depthScale = Math.fround(DEPTH_SCALE);
    const shadeScale = Math.fround(SHADE_SCALE);
    const iy = y - (LUT_H >> 1);
    const dy = Math.fround(iy + 0.5);
    const ay = Math.fround(iy >= 0 ? iy + 0.5 : -0.5 - iy);
    const dy2 = Math.fround(dy * dy);
    for (let x = 0; x < lutW; x++) {
      const ix = x - (lutW >> 1);
      const dx = Math.fround(ix + 0.5);
      const ax = Math.fround(ix >= 0 ? ix + 0.5 : -0.5 - ix);
      const radius = Math.fround(Math.sqrt(Math.fround(Math.fround(dx * dx) + dy2)));

      const steep = ay > ax;
      const ratio = steep ? Math.fround(ax / ay) : Math.fround(ay / ax);
      const r2 = Math.fround(ratio * ratio);
      const poly = Math.fround(Math.fround(Math.fround(-0.0464964749 * r2) + 0.15931422) * r2);
      const octant = Math.fround(Math.fround(Math.fround(Math.fround(poly - 0.327622764) * r2) * ratio) + ratio);
      const quadrant = steep ? Math.fround(QUARTER_TURN - octant) : octant;
      const half = ix < 0 ? Math.fround(HALF_TURN - quadrant) : quadrant;
      const theta = iy < 0 ? -half : half;

      // The texture wraps twice around the tunnel.
      const angle = Math.fround(Math.fround(theta * ANGLE_SCALE) + 256) & 255;
      const depth = Math.fround(depthScale / radius) & 255;
      const near = Math.min(SHADES - 1, Math.fround(radius * shadeScale) | 0);
      const i = y * lutW + x;
      coords[i] = (depth << 8) | angle;
      shade[i] = near;
    }
  }
}
