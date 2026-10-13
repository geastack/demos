import { DYE_CELL, DYE_H, DYE_W, VEL_CELL, VEL_H, VEL_W } from "./layout";

// A stable-fluids solver (Stam) with vorticity confinement and advected dye,
// in integer fixed point. Velocity lives on a coarse grid, dye on a finer one;
// both span the panel, and every splat is given in panel pixels.
//
// Hot-loop conventions (they are what the compiler turns into tight code):
// - Each sweep is one flat loop over a whole field; wall cells are skipped
//   through the `interior` mask and set afterwards by the wall passes.
// - Reads at data-dependent positions (the advection gathers) are masked with
//   the field's power-of-two size: a masked index needs no range proof.
// - Grid constants are literals: only a literal module const is a
//   compile-time integer.
// - Products stay below 2^31 before every shift, as JavaScript's `>>` wraps
//   its operand to 32 bits.

// Velocity: VEL_CELL px cells plus a ring of wall cells just outside the field,
// in Q8 velocity cells per second. Dye: DYE_CELL px cells, cell i centred on
// pixel 8i + 4, 16-bit fixed point per channel (DYE_UNIT is 1.0). The grid
// sizes come from the screen (layout.ts); the tables below are sized for the
// largest panel (480x480).
const VEL_SIZE = 1024; // power of two >= VEL_W * VEL_H
const VEL_UNITS_PER_PX = 16; // Q8 velocity cells per px: 256 / VEL_CELL
const VEL_MIN = 128; // advection keeps sample points half a cell inside the ring

export const DYE_SIZE = 4096; // power of two >= DYE_W * DYE_H
export const DYE_UNIT = 16000;
const DYE_CENTRE = 4;
const DYE_LIMIT = 64000;

const PRESSURE_ITERATIONS = 10;
const PRESSURE_CARRY = 205; // of 256: warm start from the last frame's pressure
const CAPSULE_CAPACITY = 1024;

// Neighbour offsets on the velocity grid; up and down are one row (VEL_W).
const LEFT = -1;
const RIGHT = 1;

// Bounds the compiler can see. A `number` parameter or a full-range Int32Array
// element has no magnitude it can prove, so a product of two of them may pass
// 2^62 and is computed in soft-float doubles on the S31 -- most of a frame.
// The masks change nothing at run time: dt <= 1/30 s keeps `reach` under
// 2200, `fade` is at most 4096, vorticity * dt * 4096 stays far below 2^16,
// and the sample weights are 0..255 by construction.
const REACH_MASK = 0x3fff;
const FADE_MASK = 0x1fff;
const SCALE_MASK = 0xffff;
const WEIGHT_MASK = 255;

export type FluidParams = {
  vorticity: number;
  velocityDecay: number;
  dyeDecay: number;
  buoyancy: number;
};

export class Fluid {
  // Grid sizes, from the screen: loops copy what they need into locals.
  private readonly velW = VEL_W;
  private readonly velH = VEL_H;
  private readonly velCells = VEL_W * VEL_H;
  private readonly lastVelRow = (VEL_H - 1) * VEL_W;
  private readonly aboveLastVelRow = (VEL_H - 2) * VEL_W;
  // Advection keeps sample points half a cell inside the wall ring.
  private readonly velMaxX = ((VEL_W - 1.5) * 256) | 0;
  private readonly velMaxY = ((VEL_H - 1.5) * 256) | 0;
  private readonly dyeW = DYE_W;
  private readonly dyeH = DYE_H;
  private readonly dyeCells = DYE_W * DYE_H;
  private readonly dyeMaxX = (DYE_W - 1) * 256 - 1;
  private readonly dyeMaxY = (DYE_H - 1) * 256 - 1;

  // Dye channels, read by the renderer.
  red = new Uint16Array(DYE_SIZE);
  green = new Uint16Array(DYE_SIZE);
  blue = new Uint16Array(DYE_SIZE);

  private nextRed = new Uint16Array(DYE_SIZE);
  private nextGreen = new Uint16Array(DYE_SIZE);
  private nextBlue = new Uint16Array(DYE_SIZE);
  private u = new Int32Array(VEL_SIZE);
  private v = new Int32Array(VEL_SIZE);
  private nextU = new Int32Array(VEL_SIZE);
  private nextV = new Int32Array(VEL_SIZE);
  private readonly pressure = new Int32Array(VEL_SIZE);
  private readonly divergence = new Int32Array(VEL_SIZE);
  private readonly curl = new Int32Array(VEL_SIZE);
  private readonly spin = new Int32Array(VEL_SIZE); // |curl|

  // Per velocity cell: inside the wall ring, two cells in (where confinement
  // applies), its own grid position (Q8), and the dye cell under it.
  private readonly interior = new Uint8Array(VEL_SIZE);
  private readonly core = new Uint8Array(VEL_SIZE);
  private readonly velX = new Int32Array(VEL_SIZE);
  private readonly velY = new Int32Array(VEL_SIZE);
  private readonly dyeUnder = new Int32Array(VEL_SIZE);

  // Per dye cell: its own grid position (Q8), and where it samples the
  // velocity grid (top-left cell of the bilinear 2x2, Q8 weights).
  private readonly dyeX = new Int32Array(DYE_SIZE);
  private readonly dyeY = new Int32Array(DYE_SIZE);
  private readonly sampleCell = new Int32Array(DYE_SIZE);
  private readonly sampleX = new Int32Array(DYE_SIZE);
  private readonly sampleY = new Int32Array(DYE_SIZE);

  // 65536 / k: normalises the confinement direction without a division.
  private readonly reciprocal = new Int32Array(1024);

  // One splat's cells and weights (see capsule()).
  private readonly capsuleCells = new Int32Array(CAPSULE_CAPACITY);
  private readonly capsuleWeights = new Float32Array(CAPSULE_CAPACITY);

  constructor() {
    this.buildTables();
  }

  reset() {
    this.u.fill(0);
    this.v.fill(0);
    this.pressure.fill(0);
    this.red.fill(0);
    this.green.fill(0);
    this.blue.fill(0);
  }

  /** Adds velocity (px/s) inside a capsule from (ax, ay) to (bx, by). */
  addVelocity(ax: number, ay: number, bx: number, by: number, vx: number, vy: number, radius: number) {
    const velW = this.velW | 0;
    const velH = this.velH | 0;
    const count = this.capsule(
      velW,
      velH,
      1,
      ax / VEL_CELL + 0.5,
      ay / VEL_CELL + 0.5,
      bx / VEL_CELL + 0.5,
      by / VEL_CELL + 0.5,
      radius / VEL_CELL,
    );
    const pushX = vx * VEL_UNITS_PER_PX;
    const pushY = vy * VEL_UNITS_PER_PX;
    for (let i = 0; i < count; i++) {
      const cell = this.capsuleCells[i];
      const weight = this.capsuleWeights[i];
      this.u[cell] += Math.round(pushX * weight);
      this.v[cell] += Math.round(pushY * weight);
    }
  }

  /** Adds dye (0..1 per channel, may exceed 1) inside a capsule from (ax, ay) to (bx, by). */
  addDye(ax: number, ay: number, bx: number, by: number, r: number, g: number, b: number, radius: number) {
    const dyeW = this.dyeW | 0;
    const dyeH = this.dyeH | 0;
    const count = this.capsule(
      dyeW,
      dyeH,
      0,
      (ax - DYE_CENTRE) / DYE_CELL,
      (ay - DYE_CENTRE) / DYE_CELL,
      (bx - DYE_CENTRE) / DYE_CELL,
      (by - DYE_CENTRE) / DYE_CELL,
      radius / DYE_CELL,
    );
    for (let i = 0; i < count; i++) {
      const cell = this.capsuleCells[i];
      const weight = this.capsuleWeights[i] * DYE_UNIT;
      this.red[cell] = Math.min(DYE_LIMIT, this.red[cell] + Math.round(r * weight));
      this.green[cell] = Math.min(DYE_LIMIT, this.green[cell] + Math.round(g * weight));
      this.blue[cell] = Math.min(DYE_LIMIT, this.blue[cell] + Math.round(b * weight));
    }
  }

  /** Advances the simulation by dt seconds. */
  step(dt: number, params: FluidParams) {
    const reach = Math.round(dt * 65536); // Q16 seconds
    this.confineVorticity(Math.round(params.vorticity * dt * 4096));
    if (params.buoyancy > 0) this.applyBuoyancy(Math.round(((params.buoyancy * dt * 256) / DYE_UNIT) * 65536));
    this.project();
    this.advectVelocity(reach, Math.round(Math.exp(-params.velocityDecay * dt) * 4096));
    this.advectDye(reach, Math.round(Math.exp(-params.dyeDecay * dt) * 4096));
  }

  // Vorticity confinement: pushes along the gradient of |curl| so small
  // eddies keep spinning instead of being smoothed away by the coarse grid.
  // `scale` is strength * dt in Q12.
  private confineVorticity(vorticityScale: number) {
    const scale = vorticityScale & SCALE_MASK;
    const velW = this.velW | 0;
    const lastVelRow = this.lastVelRow | 0;
    const up = -velW;
    const down = velW;
    const u = this.u;
    const v = this.v;
    const curl = this.curl;
    const spin = this.spin;
    const interior = this.interior;
    const core = this.core;
    const reciprocal = this.reciprocal;

    for (let c = velW; c < lastVelRow; c++) {
      if (interior[c] === 0) continue;

      const w = (v[c + RIGHT] - v[c + LEFT] - (u[c + down] - u[c + up])) >> 1;
      curl[c] = w;
      spin[c] = Math.abs(w);
    }

    for (let c = velW; c < lastVelRow; c++) {
      if (core[c] === 0) continue;

      const gx = spin[c + RIGHT] - spin[c + LEFT];
      const gy = spin[c + down] - spin[c + up];
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      // |g| within 7 %: the larger side plus 3/8 of the smaller.
      const length = Math.max(ax, ay) + ((Math.min(ax, ay) * 3) >> 3);
      if (length === 0) continue;

      // Scale |g| into the reciprocal table's range; gx / |g| keeps its ratio.
      const shift = Math.max(0, 22 - Math.clz32(length));
      const inverse = reciprocal[(length >> shift) & 1023];
      const nx = ((gx >> shift) * inverse) >> 8; // Q8 unit vector
      const ny = ((gy >> shift) * inverse) >> 8;
      const push = (curl[c] * scale) >> 12;
      u[c] += (ny * push) >> 8;
      v[c] -= (nx * push) >> 8;
    }

    this.wallVelocity(u, v);
  }

  // Warm dye rises: each velocity cell is pushed up by the dye under it.
  private applyBuoyancy(buoyancyScale: number) {
    const scale = buoyancyScale & SCALE_MASK;
    const velW = this.velW | 0;
    const lastVelRow = this.lastVelRow | 0;
    const v = this.v;
    const red = this.red;
    const green = this.green;
    const blue = this.blue;
    const interior = this.interior;
    const dyeUnder = this.dyeUnder;

    for (let c = velW; c < lastVelRow; c++) {
      if (interior[c] === 0) continue;

      const d = dyeUnder[c];
      v[c] -= (scale * (red[d & 4095] + green[d & 4095] + blue[d & 4095])) >> 16;
    }
  }

  // Makes the velocity divergence-free: solve for pressure (Gauss-Seidel,
  // warm-started), then subtract its gradient.
  private project() {
    const velW = this.velW | 0;
    const lastVelRow = this.lastVelRow | 0;
    const velCells = this.velCells | 0;
    const up = -velW;
    const down = velW;
    const u = this.u;
    const v = this.v;
    const pressure = this.pressure;
    const divergence = this.divergence;
    const interior = this.interior;

    for (let c = velW; c < lastVelRow; c++) {
      if (interior[c] === 0) continue;

      divergence[c] = (u[c + RIGHT] - u[c + LEFT] + v[c + down] - v[c + up]) >> 1;
    }

    for (let c = 0; c < velCells; c++) {
      pressure[c] = (pressure[c] * PRESSURE_CARRY) >> 8;
    }

    for (let iteration = 0; iteration < PRESSURE_ITERATIONS; iteration++) {
      for (let c = velW; c < lastVelRow; c++) {
        if (interior[c] === 0) continue;

        const around = pressure[c + LEFT] + pressure[c + RIGHT] + pressure[c + up] + pressure[c + down];
        pressure[c] = (around - divergence[c]) >> 2;
      }
      this.wallPressure();
    }

    for (let c = velW; c < lastVelRow; c++) {
      if (interior[c] === 0) continue;

      u[c] -= (pressure[c + RIGHT] - pressure[c + LEFT]) >> 1;
      v[c] -= (pressure[c + down] - pressure[c + up]) >> 1;
    }

    this.wallVelocity(u, v);
  }

  // Semi-Lagrangian self-advection: each cell takes the velocity found where
  // its fluid was dt ago, faded by `fade` (Q12).
  private advectVelocity(stepReach: number, stepFade: number) {
    const reach = stepReach & REACH_MASK;
    const fade = stepFade & FADE_MASK;
    const velW = this.velW | 0;
    const lastVelRow = this.lastVelRow | 0;
    const velMaxX = this.velMaxX | 0;
    const velMaxY = this.velMaxY | 0;
    const down = velW;
    const u = this.u;
    const v = this.v;
    const nextU = this.nextU;
    const nextV = this.nextV;
    const interior = this.interior;
    const velX = this.velX;
    const velY = this.velY;

    for (let c = velW; c < lastVelRow; c++) {
      if (interior[c] === 0) continue;

      const x = Math.min(velMaxX, Math.max(VEL_MIN, velX[c] - ((u[c] * reach) >> 16)));
      const y = Math.min(velMaxY, Math.max(VEL_MIN, velY[c] - ((v[c] * reach) >> 16)));
      const at = (y >> 8) * velW + (x >> 8);
      const fx = x & 255;
      const fy = y & 255;

      const u00 = u[at & 1023];
      const u01 = u[(at + RIGHT) & 1023];
      const u10 = u[(at + down) & 1023];
      const u11 = u[(at + down + RIGHT) & 1023];
      const uTop = u00 + (((u01 - u00) * fx) >> 8);
      const uBottom = u10 + (((u11 - u10) * fx) >> 8);
      nextU[c] = ((uTop + (((uBottom - uTop) * fy) >> 8)) * fade) >> 12;

      const v00 = v[at & 1023];
      const v01 = v[(at + RIGHT) & 1023];
      const v10 = v[(at + down) & 1023];
      const v11 = v[(at + down + RIGHT) & 1023];
      const vTop = v00 + (((v01 - v00) * fx) >> 8);
      const vBottom = v10 + (((v11 - v10) * fx) >> 8);
      nextV[c] = ((vTop + (((vBottom - vTop) * fy) >> 8)) * fade) >> 12;
    }

    this.wallVelocity(nextU, nextV);
    this.u = nextU;
    this.v = nextV;
    this.nextU = u;
    this.nextV = v;
  }

  // Carries the dye along the velocity field, faded by `fade` (Q12). A dye
  // cell is half a velocity cell, so the reach doubles.
  private advectDye(stepReach: number, stepFade: number) {
    const reach = stepReach & REACH_MASK;
    const fade = stepFade & FADE_MASK;
    const velW = this.velW | 0;
    const dyeW = this.dyeW | 0;
    const dyeCells = this.dyeCells | 0;
    const dyeMaxX = this.dyeMaxX | 0;
    const dyeMaxY = this.dyeMaxY | 0;
    const down = velW;
    const u = this.u;
    const v = this.v;
    const red = this.red;
    const green = this.green;
    const blue = this.blue;
    const nextRed = this.nextRed;
    const nextGreen = this.nextGreen;
    const nextBlue = this.nextBlue;
    const dyeX = this.dyeX;
    const dyeY = this.dyeY;
    const sampleCell = this.sampleCell;
    const sampleX = this.sampleX;
    const sampleY = this.sampleY;
    const dyeRight = 1;
    const dyeDown = dyeW;

    for (let c = 0; c < dyeCells; c++) {
      const at = sampleCell[c];
      const wx = sampleX[c] & WEIGHT_MASK;
      const wy = sampleY[c] & WEIGHT_MASK;

      const u00 = u[at & 1023];
      const u01 = u[(at + RIGHT) & 1023];
      const u10 = u[(at + down) & 1023];
      const u11 = u[(at + down + RIGHT) & 1023];
      const uTop = u00 + (((u01 - u00) * wx) >> 8);
      const uBottom = u10 + (((u11 - u10) * wx) >> 8);
      const flowX = uTop + (((uBottom - uTop) * wy) >> 8);

      const v00 = v[at & 1023];
      const v01 = v[(at + RIGHT) & 1023];
      const v10 = v[(at + down) & 1023];
      const v11 = v[(at + down + RIGHT) & 1023];
      const vTop = v00 + (((v01 - v00) * wx) >> 8);
      const vBottom = v10 + (((v11 - v10) * wx) >> 8);
      const flowY = vTop + (((vBottom - vTop) * wy) >> 8);

      const x = Math.min(dyeMaxX, Math.max(0, dyeX[c] - ((flowX * reach) >> 15)));
      const y = Math.min(dyeMaxY, Math.max(0, dyeY[c] - ((flowY * reach) >> 15)));
      const from = (y >> 8) * dyeW + (x >> 8);
      const fx = x & 255;
      const fy = y & 255;

      const r00 = red[from & 4095];
      const r01 = red[(from + dyeRight) & 4095];
      const r10 = red[(from + dyeDown) & 4095];
      const r11 = red[(from + dyeDown + dyeRight) & 4095];
      const rTop = r00 + (((r01 - r00) * fx) >> 8);
      const rBottom = r10 + (((r11 - r10) * fx) >> 8);
      nextRed[c] = ((rTop + (((rBottom - rTop) * fy) >> 8)) * fade) >> 12;

      const g00 = green[from & 4095];
      const g01 = green[(from + dyeRight) & 4095];
      const g10 = green[(from + dyeDown) & 4095];
      const g11 = green[(from + dyeDown + dyeRight) & 4095];
      const gTop = g00 + (((g01 - g00) * fx) >> 8);
      const gBottom = g10 + (((g11 - g10) * fx) >> 8);
      nextGreen[c] = ((gTop + (((gBottom - gTop) * fy) >> 8)) * fade) >> 12;

      const b00 = blue[from & 4095];
      const b01 = blue[(from + dyeRight) & 4095];
      const b10 = blue[(from + dyeDown) & 4095];
      const b11 = blue[(from + dyeDown + dyeRight) & 4095];
      const bTop = b00 + (((b01 - b00) * fx) >> 8);
      const bBottom = b10 + (((b11 - b10) * fx) >> 8);
      nextBlue[c] = ((bTop + (((bBottom - bTop) * fy) >> 8)) * fade) >> 12;
    }

    this.red = nextRed;
    this.green = nextGreen;
    this.blue = nextBlue;
    this.nextRed = red;
    this.nextGreen = green;
    this.nextBlue = blue;
  }

  // Walls on the panel edge: the ring cells flip the normal velocity
  // component and copy the tangential one.
  private wallVelocity(u: Int32Array, v: Int32Array) {
    const velW = this.velW | 0;
    const lastVelRow = this.lastVelRow | 0;
    const aboveLastVelRow = this.aboveLastVelRow | 0;
    const down = velW;
    const rightWall = (velW - 1) | 0;
    const rightInner = (velW - 2) | 0;
    for (let row = 0; row <= lastVelRow; row += velW) {
      u[row] = -u[row + RIGHT];
      v[row] = v[row + RIGHT];
      u[row + rightWall] = -u[row + rightInner];
      v[row + rightWall] = v[row + rightInner];
    }

    for (let x = 0; x < velW; x++) {
      u[x] = u[down + x];
      v[x] = -v[down + x];
      u[lastVelRow + x] = u[aboveLastVelRow + x];
      v[lastVelRow + x] = -v[aboveLastVelRow + x];
    }
  }

  // Zero pressure gradient across the walls.
  private wallPressure() {
    const velW = this.velW | 0;
    const lastVelRow = this.lastVelRow | 0;
    const aboveLastVelRow = this.aboveLastVelRow | 0;
    const down = velW;
    const rightWall = (velW - 1) | 0;
    const rightInner = (velW - 2) | 0;
    const pressure = this.pressure;

    for (let row = 0; row <= lastVelRow; row += velW) {
      pressure[row] = pressure[row + RIGHT];
      pressure[row + rightWall] = pressure[row + rightInner];
    }

    for (let x = 0; x < velW; x++) {
      pressure[x] = pressure[down + x];
      pressure[lastVelRow + x] = pressure[aboveLastVelRow + x];
    }
  }

  /**
   * Collects the cells of a width x height grid (less `margin` cells per side)
   * within `radius` of the segment a-b, all in grid units, with weight
   * (1 - d^2 / r^2)^2. Returns how many it stored.
   */
  private capsule(
    width: number,
    height: number,
    margin: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    radius: number,
  ): number {
    const abx = bx - ax;
    const aby = by - ay;
    const lengthSq = abx * abx + aby * aby;
    const invLengthSq = lengthSq > 1e-6 ? 1 / lengthSq : 0;
    const invRadiusSq = 1 / (radius * radius);
    const x0 = Math.max(margin, Math.floor(Math.min(ax, bx) - radius));
    const x1 = Math.min(width - 1 - margin, Math.floor(Math.max(ax, bx) + radius) + 1);
    const y0 = Math.max(margin, Math.floor(Math.min(ay, by) - radius));
    const y1 = Math.min(height - 1 - margin, Math.floor(Math.max(ay, by) + radius) + 1);
    let count = 0;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x - ax;
        const py = y - ay;
        const t = Math.min(1, Math.max(0, (px * abx + py * aby) * invLengthSq));
        const dx = px - t * abx;
        const dy = py - t * aby;
        const d = (dx * dx + dy * dy) * invRadiusSq;
        if (d >= 1 || count === CAPSULE_CAPACITY) continue;

        const k = 1 - d;
        this.capsuleCells[count] = y * width + x;
        this.capsuleWeights[count] = k * k;
        count++;
      }
    }
    return count;
  }

  private buildTables() {
    const velW = this.velW | 0;
    const velH = this.velH | 0;
    const dyeW = this.dyeW | 0;
    const dyeH = this.dyeH | 0;
    for (let j = 0; j < velH; j++) {
      for (let i = 0; i < velW; i++) {
        const c = j * velW + i;
        this.interior[c] = i > 0 && i < velW - 1 && j > 0 && j < velH - 1 ? 1 : 0;
        this.core[c] = i > 1 && i < velW - 2 && j > 1 && j < velH - 2 ? 1 : 0;
        this.velX[c] = i * 256;
        this.velY[c] = j * 256;
        // The cell's centre, pixel 16i - 8, is dye coordinate 2i - 1.5.
        const dyeCol = Math.min(dyeW - 1, Math.max(0, 2 * i - 1));
        const dyeRow = Math.min(dyeH - 1, Math.max(0, 2 * j - 1));
        this.dyeUnder[c] = dyeRow * dyeW + dyeCol;
      }
    }

    for (let j = 0; j < dyeH; j++) {
      for (let i = 0; i < dyeW; i++) {
        const c = j * dyeW + i;
        this.dyeX[c] = i * 256;
        this.dyeY[c] = j * 256;
        // The cell's centre, pixel 8i + 4, is velocity coordinate
        // (8i + 4) / 16 + 0.5 = i / 2 + 0.75: 128i + 192 in Q8.
        const x = 128 * i + 192;
        const y = 128 * j + 192;
        this.sampleCell[c] = (y >> 8) * velW + (x >> 8);
        this.sampleX[c] = x & 255;
        this.sampleY[c] = y & 255;
      }
    }

    for (let k = 1; k < 1024; k++) this.reciprocal[k] = Math.round(65536 / k);
  }
}
