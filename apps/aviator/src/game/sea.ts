import { BufferAttribute, BufferGeometry } from "@geastack/gea3d/three";
import { BLUE, FOG } from "./palette";
import { CAMERA_Y, CAMERA_Z, clearness } from "./view";
import { SEA_RADIUS } from "./world";

// The sea: a long cylinder lying along z, 40 segments round, turning under
// the plane. Its rings are 80 apart like the original's, from just in front
// of the camera (nearer ones are never in view) to the far horizon. Every vertex circles its rest point (its
// own radius, speed and phase), so the flat-shaded faces roll like waves.
//
// Only its top can ever be seen, so only that arc is a mesh: its columns
// stay put while the cylinder's segments (and their waves) turn through
// them, which draws the same surface as turning the whole cylinder.
//
// The fog is baked into the vertex colours, ring by ring (the top is about
// as far from the camera all along a ring), so each face keeps one colour
// and fills flat: the renderer's per-vertex fog would shade every face.

// Literal integers: the compiler folds only literal module constants.
const SEGMENTS = 40;
const RINGS = 8;
const NEAR_Z = 160;
const RING_GAP = 80;
// The cylinder's vertices, each with its own wave.
const WAVES = 320;
// The arc: seven segments either side of the top covers the view at any
// camera height.
const COLUMNS = 15;
const HALF_ARC = 7;
const VERTICES = 120;
const MIN_AMPLITUDE = 5;
const MAX_AMPLITUDE = 20;
// Wave speeds in radians per ms.
const MIN_SPEED = 0.001;
const MAX_SPEED = 0.003;

const TABLE = 1024;
const QUARTER = 256;
// Wave phases are 16.16 fixed-point table steps, so the loop stays integer.
const PHASE_SHIFT = 16;
const PHASE_MASK = 67108863;
// Table steps per segment.
const SEGMENT_STEPS = 25.6;

export class Sea {
  readonly geometry = new BufferGeometry();
  private readonly positions = new Float32Array(VERTICES * 3);
  private readonly colors = new Float32Array(VERTICES * 3);
  private readonly phase = new Int32Array(WAVES);
  private readonly rate = new Int32Array(WAVES);
  private readonly amplitude = new Float32Array(WAVES);
  // sin over one turn and a quarter (so cos reads it too), plus one entry
  // to interpolate towards.
  private readonly sine = new Float32Array(TABLE + QUARTER + 1);
  private readonly position: BufferAttribute;

  constructor() {
    for (let i = 0; i <= TABLE + QUARTER; i++) this.sine[i] = Math.sin((i * Math.PI * 2) / TABLE);

    const turn = (TABLE << PHASE_SHIFT) / (Math.PI * 2);
    for (let i = 0; i < WAVES; i++) {
      this.phase[i] = Math.floor(Math.random() * (TABLE << PHASE_SHIFT));
      this.rate[i] = Math.round((MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)) * turn);
      this.amplitude[i] = MIN_AMPLITUDE + Math.random() * (MAX_AMPLITUDE - MIN_AMPLITUDE);
    }

    for (let ring = 0; ring < RINGS; ring++) {
      const z = NEAR_Z - ring * RING_GAP;
      const clear = clearness(Math.sqrt((CAMERA_Z - z) * (CAMERA_Z - z) + CAMERA_Y * CAMERA_Y));
      for (let column = 0; column < COLUMNS; column++) {
        const i = ring * COLUMNS + column;
        this.positions[i * 3 + 2] = z;
        for (let k = 0; k < 3; k++) this.colors[i * 3 + k] = mix(channel(FOG, k), channel(BLUE, k), clear);
      }
    }

    // Quads between neighbouring rings, facing out.
    const indices: number[] = [];
    for (let ring = 0; ring + 1 < RINGS; ring++) {
      for (let column = 0; column + 1 < COLUMNS; column++) {
        const a = ring * COLUMNS + column;
        const b = a + 1;
        const c = a + COLUMNS;
        const d = b + COLUMNS;
        indices.push(a, d, b, a, c, d);
      }
    }
    this.position = new BufferAttribute(this.positions, 3);
    this.geometry.setAttribute("position", this.position);
    this.geometry.setAttribute("color", new BufferAttribute(this.colors, 3));
    this.geometry.setIndex(indices);
    this.move(0, 0);
  }

  // Advances the waves by dt ms and lays the arc over the cylinder turned
  // by `angle` radians. Integers and Math.fround keep the loop in integer
  // and float32 maths.
  move(dt: number, angle: number) {
    const positions = this.positions;
    const phase = this.phase;
    const rate = this.rate;
    const amplitude = this.amplitude;
    const sine = this.sine;
    // Whole ms, masked so the compiler knows the product fits an integer
    // (frames are capped at 50 ms).
    const step = Math.round(dt) & 63;
    // Segment s of the turned cylinder sits at s + angle (in segments). The
    // arc's first column shows the first segment past the top less HALF_ARC,
    // `turned` segments beyond its own column.
    const at = ((Math.PI / 2 - angle) * SEGMENTS) / (Math.PI * 2) - HALF_ARC;
    const first = Math.ceil(at) | 0;
    const turned = Math.fround(first - at);
    const start = (first + SEGMENTS * 8) % SEGMENTS;
    for (let column = 0; column < COLUMNS; column++) {
      const segment = (start + column) % SEGMENTS;
      // The column's angle in table steps (from the top, a quarter turn).
      const slot = Math.fround((column - HALF_ARC + turned) * SEGMENT_STEPS + QUARTER + TABLE);
      const whole = slot | 0;
      const part = Math.fround(slot - whole);
      const sin = whole % TABLE;
      const cos = (whole + QUARTER) % TABLE;
      const restY = Math.fround((sine[sin] + Math.fround((sine[sin + 1] - sine[sin]) * part)) * SEA_RADIUS);
      const restX = Math.fround((sine[cos] + Math.fround((sine[cos + 1] - sine[cos]) * part)) * SEA_RADIUS);
      for (let ring = 0; ring < RINGS; ring++) {
        const wave = ring * SEGMENTS + segment;
        const next = (phase[wave] + rate[wave] * step) & PHASE_MASK;
        phase[wave] = next;
        const k = next >> PHASE_SHIFT;
        const i = (ring * COLUMNS + column) * 3;
        positions[i] = Math.fround(restX + Math.fround(sine[k + QUARTER] * amplitude[wave]));
        positions[i + 1] = Math.fround(restY + Math.fround(sine[k] * amplitude[wave]));
      }
    }
    this.position.needsUpdate = true;
  }
}

// Channel k (0 red, 1 green, 2 blue) of a hex colour, 0..1.
function channel(color: number, k: number): number {
  return ((color >> (16 - k * 8)) & 255) / 255;
}

function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
