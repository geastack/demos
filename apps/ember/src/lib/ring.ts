// Ember's heat arcs, rendered into an RGB565 image: a 270-degree track with
// round caps, the filled sweep in an ember-to-amber gradient with a soft glow,
// a cream tip dot, and a warm radial glow inside the ring whose strength can
// change every frame (the oven "breathing").
//
// The design follows velo's speed ring: every band pixel's static layers are
// built once (over a few frames, integer maths and lookup tables) and sorted
// by angle, so any arc is one contiguous run. A frame repaints only the arc
// between the old and the new tip:
//   - well behind the tip, the settled fill is one stored RGB565 word;
//   - well past it, the bare track is another;
//   - near the tip every layer is blended, with the round cap, its glow and
//     the dot looked up by the squared distance to the tip.
// The inner glow is a list of pixels with a radial weight and a dither value.

const DEG = Math.PI / 180;
const START_DEG = 135; // the sweep starts at the lower left, clockwise
export const SWEEP_DEG = 270;

// Colours (sRGB, snapped to the RGB565 grid).
const BG_R = 24;
const BG_G = 20;
const BG_B = 16;
const TRACK_R = 48;
const TRACK_G = 40;
const TRACK_B = 32;
const DOT_R = 248;
const DOT_G = 240;
const DOT_B = 232;
const INNER_R = 248;
const INNER_G = 96;
const INNER_B = 32;
const BG_565 = ((BG_R & 0xf8) << 8) | ((BG_G & 0xfc) << 3) | (BG_B >> 3);

// The fill's gradient along the sweep: deep ember, ember, amber.
const GRADIENT_MID = 0.55;
const FROM_R = 200;
const FROM_G = 56;
const FROM_B = 16;
const MID_R = 248;
const MID_G = 104;
const MID_B = 40;
const TO_R = 248;
const TO_G = 180;
const TO_B = 72;

const BAND_MIN_DEG = -12;
const BAND_MAX_DEG = SWEEP_DEG + 12;
const BUCKETS = BAND_MAX_DEG - BAND_MIN_DEG + 1;

// Squared tip distances in 1/64 px² (positions in 1/8 px), out to 16 px.
const SUB = 8;
const CAP_TABLE = 16384;
const ATAN_STEPS = 4096;
const BAYER = new Uint8Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

const CHUNK = 256;
const ROWS_PER_STEP = 1;
const STAGE_CAP = 0;
const STAGE_RADIAL = 1;
const STAGE_ATAN = 2;
const STAGE_ROWS = 3;
const STAGE_SORT = 4;
const STAGE_LAYERS = 5;
const STAGE_DONE = 6;
const BUCKETS_PER_STEP = 8;
// compiler workaround: integer / integer literal emits C++ integer division,
// so integer values are scaled by these reciprocals instead.
const PX_PER_256 = 0.00390625;
const ATAN_UNIT = 0.000244140625;

export type RingSpec = {
  size: number; // the image is size x size (even, at most 256)
  radius: number;
  halfWidth: number;
  glowWidth: number;
  glowStrength: number;
  dotRadius: number;
  innerRadius: number; // the warm inner glow
  innerStrength: number;
};

function coverage(distance: number): number {
  return Math.min(Math.max(0.5 - distance, 0), 1);
}

// 0..1 as a blend weight out of 256.
function weight(amount: number): number {
  return Math.round(amount * 256);
}

function mix(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount);
}

function bucketOf(deg: number): number {
  return Math.min(Math.max(Math.floor(deg - BAND_MIN_DEG), 0), BUCKETS - 1);
}

// Per band pixel, in angle order: position, angle (1/100 degree), centre in
// 1/8 px, the static blend weights (0..256), the fill colour, and the two
// settled words.
class Band {
  readonly pos: Uint16Array;
  readonly centiDeg: Int16Array;
  readonly subX: Int16Array;
  readonly subY: Int16Array;
  readonly track: Uint16Array;
  readonly fill: Uint16Array;
  readonly glow: Uint16Array;
  readonly red: Uint8Array;
  readonly green: Uint8Array;
  readonly blue: Uint8Array;
  readonly lit: Uint16Array;
  readonly bare: Uint16Array;

  constructor(count: number) {
    this.pos = new Uint16Array(count);
    this.centiDeg = new Int16Array(count);
    this.subX = new Int16Array(count);
    this.subY = new Int16Array(count);
    this.track = new Uint16Array(count);
    this.fill = new Uint16Array(count);
    this.glow = new Uint16Array(count);
    this.red = new Uint8Array(count);
    this.green = new Uint8Array(count);
    this.blue = new Uint8Array(count);
    this.lit = new Uint16Array(count);
    this.bare = new Uint16Array(count);
  }
}

export class Ring {
  readonly size: number;
  // The rows painted by the last draw or glow, for a dirty-rect blit.
  top = 0;
  bottom = 0;

  private readonly center: number;
  private readonly radius: number;
  private readonly halfWidth: number;
  private readonly glowWidth: number;
  private readonly glowStrength: number;
  private readonly dotRadius: number;
  private readonly innerRadius: number;
  private readonly innerStrength: number;
  private readonly tipReach: number;
  private readonly bandInnerQ: number;
  private readonly bandOuterQ: number;
  private readonly innerQ: number;
  private readonly radialSize: number;
  private readonly capacity: number;
  private readonly innerCapacity: number;

  private band = new Band(0);
  private readonly bucketStart = new Int32Array(BUCKETS + 1);
  private readonly bucketTop = new Uint8Array(BUCKETS);
  private readonly bucketBottom = new Uint8Array(BUCKETS);
  // The fill's gradient colour per bucket.
  private readonly bucketRed = new Uint8Array(BUCKETS);
  private readonly bucketGreen = new Uint8Array(BUCKETS);
  private readonly bucketBlue = new Uint8Array(BUCKETS);
  private readonly capFill = new Uint16Array(CAP_TABLE);
  private readonly capGlow = new Uint16Array(CAP_TABLE);
  private readonly capDot = new Uint16Array(CAP_TABLE);
  private innerPos = new Uint16Array(0);
  private innerWeight = new Uint8Array(0);
  private innerDither = new Uint8Array(0);
  private innerCount = 0;

  // Build state.
  private stage = STAGE_CAP;
  private cursor = 0;
  private root = 0;
  private count = 0;
  private readonly startX: number;
  private readonly startY: number;
  private readonly endX: number;
  private readonly endY: number;
  private radialCover = new Uint16Array(0);
  private radialGlow = new Uint16Array(0);
  private radialInner = new Uint8Array(0);
  private atanCenti = new Int16Array(0);
  private rawPos = new Uint16Array(0);
  private rawCenti = new Int16Array(0);
  private rawRadial = new Uint16Array(0);
  private rawBucket = new Uint16Array(0);
  private sortedRadial = new Uint16Array(0);
  private next = new Int32Array(0);

  private drawnSweep = -1;

  constructor(spec: RingSpec) {
    this.size = spec.size;
    this.center = spec.size / 2;
    this.radius = spec.radius;
    this.halfWidth = spec.halfWidth;
    this.glowWidth = spec.glowWidth;
    this.glowStrength = spec.glowStrength;
    this.dotRadius = spec.dotRadius;
    this.innerRadius = spec.innerRadius;
    this.innerStrength = spec.innerStrength;
    this.tipReach = Math.ceil((spec.halfWidth + spec.glowWidth) / (spec.radius * DEG)) + 1;

    // Radii are compared squared, in half pixels.
    const bandInner = spec.radius - spec.halfWidth - spec.glowWidth - 1;
    const bandOuter = spec.radius + spec.halfWidth + spec.glowWidth + 1;
    this.bandInnerQ = 4 * bandInner * bandInner;
    this.bandOuterQ = 4 * bandOuter * bandOuter;
    this.innerQ = 4 * spec.innerRadius * spec.innerRadius;
    // Squared radii of pixel centres (half pixels) are 2 mod 8: one table
    // entry per 8, from the centre out to the band's outer edge.
    this.radialSize = ((this.bandOuterQ - 2) >> 3) + 1;
    this.capacity = Math.ceil(Math.PI * (bandOuter * bandOuter - bandInner * bandInner)) + 512;
    this.innerCapacity = Math.ceil(Math.PI * spec.innerRadius * spec.innerRadius) + 256;

    this.startX = this.capX(0);
    this.startY = this.capY(0);
    this.endX = this.capX(SWEEP_DEG);
    this.endY = this.capY(SWEEP_DEG);
  }

  ready(): boolean {
    return this.stage === STAGE_DONE;
  }

  // Builds the tables for about `budgetMs`; true once they are complete.
  build(budgetMs: number): boolean {
    const deadline = Date.now() + budgetMs;
    while (this.stage !== STAGE_DONE && Date.now() < deadline) this.step();
    return this.stage === STAGE_DONE;
  }

  // Paints the whole image: background, the band at `sweep`, the inner glow.
  paintAll(pixels: Uint16Array, sweep: number, level: number) {
    pixels.fill(BG_565);
    this.drawnSweep = -1;
    this.draw(pixels, sweep);
    this.glow(pixels, level);
    this.top = 0;
    this.bottom = this.size - 1;
  }

  // Draws the ring filled to `sweep` degrees, repainting only the arc
  // between the previous tip and this one.
  draw(pixels: Uint16Array, sweep: number) {
    const reach = this.tipReach;
    const fresh = this.drawnSweep < 0;
    const from = fresh ? BAND_MIN_DEG : Math.min(this.drawnSweep, sweep) - reach;
    const to = fresh ? BAND_MAX_DEG : Math.max(this.drawnSweep, sweep) + reach;
    this.drawnSweep = sweep;

    const first = bucketOf(from);
    const last = bucketOf(to);
    const tipFirst = bucketOf(sweep - reach);
    const tipLast = bucketOf(sweep + reach);
    const starts = this.bucketStart;
    if (first < tipFirst) this.paintStored(pixels, starts[first], starts[Math.min(last, tipFirst - 1) + 1], true);
    if (last > tipLast) this.paintStored(pixels, starts[Math.max(first, tipLast + 1)], starts[last + 1], false);
    const tipFrom = Math.max(first, tipFirst);
    const tipTo = Math.min(last, tipLast);
    if (tipFrom <= tipTo) this.paintTip(pixels, starts[tipFrom], starts[tipTo + 1], sweep);

    let top = this.size - 1;
    let bottom = 0;
    for (let bucket = first; bucket <= last; bucket++) {
      top = Math.min(top, this.bucketTop[bucket]);
      bottom = Math.max(bottom, this.bucketBottom[bucket]);
    }
    this.top = top;
    this.bottom = Math.max(bottom, top);
  }

  // Repaints the inner glow at `level` (0..256) with an ordered dither.
  glow(pixels: Uint16Array, level: number) {
    const out = pixels;
    const pos = this.innerPos;
    const weights = this.innerWeight;
    const dither = this.innerDither;
    const count = this.innerCount;
    const strength = Math.round(level) | 0;
    for (let k = 0; k < count; k++) {
      const w = (weights[k] * strength) >> 8;
      const d = dither[k];
      const r = (BG_R + (((INNER_R - BG_R) * w) >> 8) + (d >> 1)) >> 3;
      const g = (BG_G + (((INNER_G - BG_G) * w) >> 8) + (d >> 2)) >> 2;
      const b = (BG_B + (((INNER_B - BG_B) * w) >> 8) + (d >> 1)) >> 3;
      out[pos[k] & 65535] = (Math.min(r, 31) << 11) | (Math.min(g, 63) << 5) | Math.min(b, 31);
    }
    this.top = Math.max(0, Math.floor(this.center - this.innerRadius));
    this.bottom = Math.min(this.size - 1, Math.ceil(this.center + this.innerRadius));
  }

  // A point on the stroke's centre line, `deg` past the sweep start, in 1/8
  // px from the image's top left.
  capX(deg: number): number {
    return Math.round((this.center + this.radius * Math.cos((START_DEG + deg) * DEG)) * SUB);
  }

  capY(deg: number): number {
    return Math.round((this.center + this.radius * Math.sin((START_DEG + deg) * DEG)) * SUB);
  }

  // Behind the tip the settled fill, past it the bare track: one word each.
  private paintStored(pixels: Uint16Array, first: number, end: number, lit: boolean) {
    const out = pixels;
    const pos = this.band.pos;
    const words = lit ? this.band.lit : this.band.bare;
    for (let k = first; k < end; k++) out[pos[k] & 65535] = words[k];
  }

  // Around the tip every layer is blended: track, glow, fill, dot. Past the
  // tip the stroke is its round cap, found by squared distance to the tip.
  private paintTip(pixels: Uint16Array, first: number, end: number, sweep: number) {
    const tipX = this.capX(sweep) & 4095;
    const tipY = this.capY(sweep) & 4095;
    const sweepCenti = Math.round(sweep * 100) | 0;

    const out = pixels;
    const band = this.band;
    const pos = band.pos;
    const centiDeg = band.centiDeg;
    const subX = band.subX;
    const subY = band.subY;
    const track = band.track;
    const fill = band.fill;
    const glow = band.glow;
    const red = band.red;
    const green = band.green;
    const blue = band.blue;
    const capFill = this.capFill;
    const capGlow = this.capGlow;
    const capDot = this.capDot;

    for (let k = first; k < end; k++) {
      const ex = subX[k] - tipX;
      const ey = subY[k] - tipY;
      const reach = ex * ex + ey * ey;
      const d2 = reach < 16384 ? reach : 16383;
      const past = centiDeg[k] > sweepCenti;
      const fillWeight = past ? capFill[d2 & 16383] : fill[k];
      const glowWeight = past ? capGlow[d2 & 16383] : glow[k];
      const dotWeight = capDot[d2 & 16383];
      const trackWeight = track[k];
      const fr = red[k];
      const fg = green[k];
      const fb = blue[k];

      const r0 = BG_R + (((TRACK_R - BG_R) * trackWeight) >> 8);
      const r1 = r0 + (((fr - r0) * glowWeight) >> 8);
      const r2 = r1 + (((fr - r1) * fillWeight) >> 8);
      const r = r2 + (((DOT_R - r2) * dotWeight) >> 8);

      const g0 = BG_G + (((TRACK_G - BG_G) * trackWeight) >> 8);
      const g1 = g0 + (((fg - g0) * glowWeight) >> 8);
      const g2 = g1 + (((fg - g1) * fillWeight) >> 8);
      const g = g2 + (((DOT_G - g2) * dotWeight) >> 8);

      const b0 = BG_B + (((TRACK_B - BG_B) * trackWeight) >> 8);
      const b1 = b0 + (((fb - b0) * glowWeight) >> 8);
      const b2 = b1 + (((fb - b1) * fillWeight) >> 8);
      const b = b2 + (((DOT_B - b2) * dotWeight) >> 8);

      out[pos[k] & 65535] = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
    }
  }

  // One unit of the build; a stage that completes hands over to the next.
  private step() {
    const done =
      this.stage === STAGE_CAP
        ? this.buildCap()
        : this.stage === STAGE_RADIAL
          ? this.buildRadial()
          : this.stage === STAGE_ATAN
            ? this.buildAtan()
            : this.stage === STAGE_ROWS
              ? this.scanRows()
              : this.stage === STAGE_SORT
                ? this.sort()
                : this.stage === STAGE_LAYERS && this.buildLayers();
    if (!done) return;

    this.stage++;
    this.cursor = 0;
  }

  private glowOf(fillDistance: number): number {
    if (fillDistance >= this.glowWidth) return 0;

    const falloff = 1 - Math.max(fillDistance, 0) / this.glowWidth;
    return this.glowStrength * falloff * falloff;
  }

  // The tip's round cap, glow and dot by squared distance (1/64 px²), as
  // blend weights. The distance is an integer square root in 1/256 px.
  private buildCap(): boolean {
    const capFill = this.capFill;
    const capGlow = this.capGlow;
    const capDot = this.capDot;
    const edge = this.halfWidth * 256;
    const reach = this.glowWidth * 256;
    const dot = this.dotRadius * 256;
    const from = this.cursor | 0;
    const end = Math.min(from + CHUNK, CAP_TABLE) | 0;
    let root = this.root | 0;
    for (let d2 = from; d2 < end; d2++) {
      while ((root + 1) * (root + 1) <= d2 * 1024) root++;
      const fill = root - edge;
      if (fill >= reach) {
        this.cursor = CAP_TABLE;
        return true;
      }

      capFill[d2] = Math.min(Math.max(128 - fill, 0), 256);
      capGlow[d2] = weight(this.glowOf(fill * PX_PER_256));
      capDot[d2] = Math.min(Math.max(128 - (root - dot), 0), 256);
    }
    this.root = root;
    this.cursor = end;
    return end === CAP_TABLE;
  }

  // Stroke coverage, glow and inner glow weight by squared radius.
  private buildRadial(): boolean {
    if (this.cursor === 0) {
      this.radialCover = new Uint16Array(this.radialSize);
      this.radialGlow = new Uint16Array(this.radialSize);
      this.radialInner = new Uint8Array(this.radialSize);
    }

    const from = this.cursor | 0;
    const end = Math.min(from + CHUNK, this.radialSize) | 0;
    for (let i = from; i < end; i++) {
      const radius = Math.sqrt((i << 3) + 2) * 0.5;
      const distance = Math.abs(radius - this.radius) - this.halfWidth;
      const falloff = Math.max(1 - radius / this.innerRadius, 0);
      this.radialCover[i] = weight(coverage(distance));
      this.radialGlow[i] = weight(this.glowOf(distance));
      this.radialInner[i] = Math.round(255 * this.innerStrength * falloff * falloff);
    }
    this.cursor = end;
    return end === this.radialSize;
  }

  // The arctangent table; then room for the scan and the gradient.
  private buildAtan(): boolean {
    if (this.cursor === 0) this.atanCenti = new Int16Array(ATAN_STEPS + 1);
    const from = this.cursor | 0;
    const end = Math.min(from + CHUNK, ATAN_STEPS + 1) | 0;
    for (let i = from; i < end; i++) this.atanCenti[i] = Math.round(Math.atan(i * ATAN_UNIT) * (18000 / Math.PI));
    this.cursor = end;
    if (end <= ATAN_STEPS) return false;

    this.rawPos = new Uint16Array(this.capacity);
    this.rawCenti = new Int16Array(this.capacity);
    this.rawRadial = new Uint16Array(this.capacity);
    this.rawBucket = new Uint16Array(this.capacity);
    this.innerPos = new Uint16Array(this.innerCapacity);
    this.innerWeight = new Uint8Array(this.innerCapacity);
    this.innerDither = new Uint8Array(this.innerCapacity);
    this.bucketStart.fill(0);
    this.bucketTop.fill(255);
    this.bucketBottom.fill(0);
    this.buildGradient();
    return true;
  }

  // Deep ember to ember to amber along the sweep, one colour per bucket.
  private buildGradient() {
    for (let bucket = 0; bucket < BUCKETS; bucket++) {
      const along = Math.min(Math.max((bucket + BAND_MIN_DEG + 0.5) / SWEEP_DEG, 0), 1);
      const late = along > GRADIENT_MID;
      const t = late ? (along - GRADIENT_MID) / (1 - GRADIENT_MID) : along / GRADIENT_MID;
      this.bucketRed[bucket] = late ? mix(MID_R, TO_R, t) : mix(FROM_R, MID_R, t);
      this.bucketGreen[bucket] = late ? mix(MID_G, TO_G, t) : mix(FROM_G, MID_G, t);
      this.bucketBlue[bucket] = late ? mix(MID_B, TO_B, t) : mix(FROM_B, MID_B, t);
    }
  }

  // Sorts a few rows of pixels into the inner glow and the band. A band
  // pixel's angle (1/100 degree from the sweep start) comes from its offset
  // (ox, oy) in half pixels: the arctangent of the octant, unfolded.
  // Integer maths in local arrays: this is the build's hot loop.
  private scanRows(): boolean {
    const size = this.size | 0;
    const innerQ = this.innerQ;
    const bandInnerQ = this.bandInnerQ;
    const bandOuterQ = this.bandOuterQ;
    const capacity = this.capacity;
    const innerCapacity = this.innerCapacity;
    const atan = this.atanCenti;
    const radialInner = this.radialInner;
    const innerPos = this.innerPos;
    const innerWeight = this.innerWeight;
    const innerDither = this.innerDither;
    const rawPos = this.rawPos;
    const rawCenti = this.rawCenti;
    const rawRadial = this.rawRadial;
    const rawBucket = this.rawBucket;
    const counts = this.bucketStart;
    const tops = this.bucketTop;
    const bottoms = this.bucketBottom;
    const bayer = BAYER;
    let count = this.count | 0;
    let innerCount = this.innerCount | 0;

    const from = this.cursor | 0;
    const end = Math.min(from + ROWS_PER_STEP, size) | 0;
    for (let y = from; y < end; y++) {
      const oy = 2 * y + 1 - size;
      const ay = oy < 0 ? -oy : oy;
      const rowDither = (y & 3) << 2;
      for (let x = 0; x < size; x++) {
        const ox = 2 * x + 1 - size;
        const q = ox * ox + oy * oy;
        if (q < innerQ) {
          if (innerCount < innerCapacity) {
            innerPos[innerCount] = y * size + x;
            innerWeight[innerCount] = radialInner[q >> 3];
            innerDither[innerCount] = bayer[rowDither | (x & 3)];
            innerCount++;
          }
          continue;
        }

        if (q < bandInnerQ || q > bandOuterQ || count >= capacity) continue;

        const ax = ox < 0 ? -ox : ox;
        const low = ax < ay ? ax : ay;
        const high = ax < ay ? ay : ax;
        const octant = atan[Math.min(Math.floor((low * ATAN_STEPS) / high), ATAN_STEPS) | 0];
        const half = ay > ax ? 9000 - octant : octant;
        const upper = ox < 0 ? 18000 - half : half;
        const turned = (oy < 0 ? -upper : upper) - START_DEG * 100;
        const centi = turned < -4500 ? turned + 36000 : turned;
        if (centi < BAND_MIN_DEG * 100 || centi > BAND_MAX_DEG * 100) continue;

        // x / 100 for 0 <= x <= 29400, exactly: (x * 5243) >> 19.
        const bucket = ((centi - BAND_MIN_DEG * 100) * 5243) >> 19;
        rawPos[count] = y * size + x;
        rawCenti[count] = centi;
        rawRadial[count] = q >> 3;
        rawBucket[count] = bucket;
        counts[bucket + 1]++;
        if (y < tops[bucket]) tops[bucket] = y;
        if (y > bottoms[bucket]) bottoms[bucket] = y;
        count++;
      }
    }
    this.count = count;
    this.innerCount = innerCount;
    this.cursor = end;
    return end === size;
  }

  // Counting sort by bucket, CHUNK pixels a step: each bucket keeps its
  // pixels in scan order. Only position, angle and radius move.
  private sort(): boolean {
    const count = this.count;
    if (this.cursor === 0) {
      const starts = this.bucketStart;
      for (let bucket = 0; bucket < BUCKETS; bucket++) starts[bucket + 1] += starts[bucket];
      this.next = starts.slice(0, BUCKETS);
      this.band = new Band(count);
      this.sortedRadial = new Uint16Array(count);
    }

    const next = this.next;
    const rawPos = this.rawPos;
    const rawCenti = this.rawCenti;
    const rawRadial = this.rawRadial;
    const rawBucket = this.rawBucket;
    const pos = this.band.pos;
    const centiDeg = this.band.centiDeg;
    const radial = this.sortedRadial;
    const from = this.cursor | 0;
    const end = Math.min(from + CHUNK, count) | 0;
    for (let i = from; i < end; i++) {
      const k = next[rawBucket[i]]++;
      pos[k] = rawPos[i];
      centiDeg[k] = rawCenti[i];
      radial[k] = rawRadial[i];
    }
    this.cursor = end;
    return end === count;
  }

  // Every band pixel's static layers, a few buckets a step: its centre in
  // 1/8 px, the track, fill and glow weights (radial along the sweep, round
  // caps past its ends), the bucket's gradient colour, and the two settled
  // words, lit (track, glow and fill) and bare (track only).
  private buildLayers(): boolean {
    const size = this.size | 0;
    const band = this.band;
    const pos = band.pos;
    const centiDeg = band.centiDeg;
    const subX = band.subX;
    const subY = band.subY;
    const track = band.track;
    const fill = band.fill;
    const glow = band.glow;
    const red = band.red;
    const green = band.green;
    const blue = band.blue;
    const lit = band.lit;
    const bare = band.bare;
    const radial = this.sortedRadial;
    const radialCover = this.radialCover;
    const radialGlow = this.radialGlow;
    const capFill = this.capFill;
    const capGlow = this.capGlow;
    const starts = this.bucketStart;
    const startX = this.startX;
    const startY = this.startY;
    const endX = this.endX;
    const endY = this.endY;

    const from = this.cursor | 0;
    const last = Math.min(from + BUCKETS_PER_STEP, BUCKETS) | 0;
    for (let bucket = from; bucket < last; bucket++) {
      const fr = this.bucketRed[bucket];
      const fg = this.bucketGreen[bucket];
      const fb = this.bucketBlue[bucket];
      const first = starts[bucket];
      const end = starts[bucket + 1];
      for (let k = first; k < end; k++) {
        const p = pos[k];
        const y = Math.floor(p / size);
        const sx = (2 * (p - y * size) + 1) * 4;
        const sy = (2 * y + 1) * 4;
        const centi = centiDeg[k];
        const cover = radialCover[radial[k]];
        const glowWeight = radialGlow[radial[k]];
        const capped = centi < 0 || centi > SWEEP_DEG * 100;
        const atStart = centi < 0;
        const ex = sx - (atStart ? startX : endX);
        const ey = sy - (atStart ? startY : endY);
        const d2 = Math.min(ex * ex + ey * ey, CAP_TABLE - 1);
        const tw = capped ? capFill[d2] : cover;
        const fw = capped && atStart ? capFill[d2] : cover;
        const gw = capped && atStart ? capGlow[d2] : glowWeight;
        subX[k] = sx;
        subY[k] = sy;
        track[k] = tw;
        fill[k] = fw;
        glow[k] = gw;
        red[k] = fr;
        green[k] = fg;
        blue[k] = fb;

        const r0 = BG_R + (((TRACK_R - BG_R) * tw) >> 8);
        const g0 = BG_G + (((TRACK_G - BG_G) * tw) >> 8);
        const b0 = BG_B + (((TRACK_B - BG_B) * tw) >> 8);
        bare[k] = ((r0 & 0xf8) << 8) | ((g0 & 0xfc) << 3) | (b0 >> 3);

        const r1 = r0 + (((fr - r0) * gw) >> 8);
        const g1 = g0 + (((fg - g0) * gw) >> 8);
        const b1 = b0 + (((fb - b0) * gw) >> 8);
        const r = r1 + (((fr - r1) * fw) >> 8);
        const g = g1 + (((fg - g1) * fw) >> 8);
        const b = b1 + (((fb - b1) * fw) >> 8);
        lit[k] = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
      }
    }
    this.cursor = last;
    if (last < BUCKETS) return false;

    this.rawPos = new Uint16Array(0);
    this.rawCenti = new Int16Array(0);
    this.rawRadial = new Uint16Array(0);
    this.rawBucket = new Uint16Array(0);
    this.sortedRadial = new Uint16Array(0);
    this.next = new Int32Array(0);
    this.atanCenti = new Int16Array(0);
    this.radialCover = new Uint16Array(0);
    this.radialGlow = new Uint16Array(0);
    this.radialInner = new Uint8Array(0);
    return true;
  }
}
