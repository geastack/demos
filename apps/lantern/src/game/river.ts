// The river's course: a centre line through the xz plane, sampled in rows
// every ROW_GAP along its length (s). The rows form a window that slides
// with the boat: row 0 sits a little behind the camera, the last one far in
// the fog. Its heading meanders around -z (two slow sines), so the sky
// straight ahead stays ahead however the river turns.

export const ROW_GAP = 4.4;
export const ROWS = 20;
export const HALF_WIDTH = 4.2;
// Row 0 stays at least this far behind the boat (the camera sits behind it).
const BEHIND = 9;

const BEND_A = 0.5;
const BEND_A_RATE = (Math.PI * 2) / 230;
const BEND_B = 0.3;
const BEND_B_RATE = (Math.PI * 2) / 96;

// Rapids: every RAPIDS_EVERY (plus up to RAPIDS_JITTER), RAPIDS_LENGTH of
// quick water that ramps in and out over RAPIDS_RAMP.
const RAPIDS_FIRST = 420;
const RAPIDS_EVERY = 380;
const RAPIDS_JITTER = 200;
const RAPIDS_LENGTH = 90;
const RAPIDS_RAMP = 14;

export class River {
  // Per row, nearest first: centre, heading (0 = toward -z, positive
  // turns right) and rapids strength 0..1.
  readonly x = new Float32Array(ROWS);
  readonly z = new Float32Array(ROWS);
  readonly heading = new Float32Array(ROWS);
  readonly rapids = new Float32Array(ROWS);
  // Row index of row 0 (its s is firstRow * ROW_GAP).
  firstRow = 0;

  // A sample (see sample()): centre, heading and rapids at some s.
  sx = 0;
  sz = 0;
  sHeading = 0;
  sRapids = 0;

  private phaseA = 0;
  private phaseB = 0;
  private nextX = 0;
  private nextZ = 0;
  private rapidsAt = RAPIDS_FIRST;

  // A fresh river whose row 0 is at s = start - BEHIND or so.
  reset(start: number) {
    this.phaseA = Math.random() * Math.PI * 2;
    this.phaseB = Math.random() * Math.PI * 2;
    this.rapidsAt = start + RAPIDS_FIRST;
    this.firstRow = Math.floor((start - BEHIND) / ROW_GAP) - 1;
    this.nextX = 0;
    this.nextZ = 0;
    for (let i = 0; i < ROWS; i++) this.generate(i, this.firstRow + i);
  }

  // Slides the window so row 0 stays just behind s; returns how many rows
  // were added at the far end.
  advanceTo(s: number): number {
    let added = 0;
    while ((this.firstRow + 1) * ROW_GAP < s - BEHIND) {
      for (let i = 0; i + 1 < ROWS; i++) {
        this.x[i] = this.x[i + 1];
        this.z[i] = this.z[i + 1];
        this.heading[i] = this.heading[i + 1];
        this.rapids[i] = this.rapids[i + 1];
      }
      this.firstRow++;
      this.generate(ROWS - 1, this.firstRow + ROWS - 1);
      added++;
    }
    return added;
  }

  // Samples the centre line at s (within the window) into sx, sz, sHeading
  // and sRapids.
  sample(s: number) {
    const at = Math.max(0, Math.min(ROWS - 1.001, s / ROW_GAP - this.firstRow));
    const i = Math.floor(at);
    const t = at - i;
    this.sx = this.x[i] + (this.x[i + 1] - this.x[i]) * t;
    this.sz = this.z[i] + (this.z[i + 1] - this.z[i]) * t;
    this.sHeading = this.heading[i] + (this.heading[i + 1] - this.heading[i]) * t;
    this.sRapids = this.rapids[i] + (this.rapids[i + 1] - this.rapids[i]) * t;
  }

  // s of the far end of the window.
  farEnd(): number {
    return (this.firstRow + ROWS - 1) * ROW_GAP;
  }

  // Rapids strength at s (0..1), scheduling the next stretch once passed;
  // s only grows from call to call.
  private rapidsAtS(s: number): number {
    if (s > this.rapidsAt + RAPIDS_LENGTH) this.rapidsAt += RAPIDS_EVERY + Math.random() * RAPIDS_JITTER;

    const into = s - this.rapidsAt;
    if (into < 0 || into > RAPIDS_LENGTH) return 0;

    return Math.min(1, Math.min(into, RAPIDS_LENGTH - into) / RAPIDS_RAMP);
  }

  // Row `slot` for row index k: stepped on from the previous row's position.
  private generate(slot: number, k: number) {
    const s = k * ROW_GAP;
    const heading = this.headingAt(s);
    if (slot > 0) {
      const mid = this.headingAt(s - ROW_GAP / 2);
      this.nextX = this.x[slot - 1] + Math.sin(mid) * ROW_GAP;
      this.nextZ = this.z[slot - 1] - Math.cos(mid) * ROW_GAP;
    }
    this.x[slot] = this.nextX;
    this.z[slot] = this.nextZ;
    this.heading[slot] = heading;
    this.rapids[slot] = this.rapidsAtS(s);
  }

  private headingAt(s: number): number {
    return BEND_A * Math.sin(s * BEND_A_RATE + this.phaseA) + BEND_B * Math.sin(s * BEND_B_RATE + this.phaseB);
  }
}
