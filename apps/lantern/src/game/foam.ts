import type { BufferGeometry } from "@geastack/gea3d/three";
import { Builder, fastCos, fastSin, Rgb } from "./geometry";
import { FOAM } from "./palette";

// Every foam line on the water in one line mesh (drawn additively): the
// ripple rings and the whirlpools' spiral arms. Each frame writes the lines
// in use; the rest are parked far below the view.

const RING_SEGMENTS = 16;
const SPIRAL_STEPS = 12;
const SPIRAL_ARMS = 2;
const SPIRAL_VERTICES = SPIRAL_ARMS * (SPIRAL_STEPS + 1);
const PARK_DEPTH = -2000;
const RIPPLE = new Rgb(0.5, 0.72, 0.72);

export class Foam {
  readonly geometry: BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  // The spiral in its own frame (x, z pairs) and its brightness per vertex.
  private readonly spiralXZ = new Float32Array(SPIRAL_VERTICES * 2);
  private readonly spiralGlow = new Float32Array(SPIRAL_VERTICES);
  private readonly circle = new Float32Array(RING_SEGMENTS * 2);
  private readonly rings: number;
  private readonly spirals: number;
  private readonly spiralBase: number;

  constructor(rings: number, spirals: number) {
    this.rings = rings;
    this.spirals = spirals;
    this.spiralBase = rings * RING_SEGMENTS;
    const b = new Builder();
    const black = new Rgb(0, 0, 0);
    for (let r = 0; r < rings; r++) {
      const first = b.vertexCount();
      for (let i = 0; i < RING_SEGMENTS; i++) b.vertex(0, PARK_DEPTH, 0, black);
      for (let i = 0; i < RING_SEGMENTS; i++) b.segment(first + i, first + ((i + 1) % RING_SEGMENTS));
    }
    for (let w = 0; w < spirals; w++) {
      for (let arm = 0; arm < SPIRAL_ARMS; arm++) {
        const first = b.vertexCount();
        for (let i = 0; i <= SPIRAL_STEPS; i++) b.vertex(0, PARK_DEPTH, 0, black);
        for (let i = 0; i < SPIRAL_STEPS; i++) b.segment(first + i, first + i + 1);
      }
    }
    this.geometry = b.geometry();
    this.positions = this.geometry.attributes.position.array;
    this.colors = this.geometry.attributes.color.array;

    for (let i = 0; i < RING_SEGMENTS; i++) {
      const a = (i * Math.PI * 2) / RING_SEGMENTS;
      this.circle[i * 2] = Math.cos(a);
      this.circle[i * 2 + 1] = Math.sin(a);
    }
    for (let arm = 0; arm < SPIRAL_ARMS; arm++) {
      for (let i = 0; i <= SPIRAL_STEPS; i++) {
        const t = i / SPIRAL_STEPS;
        const a = arm * Math.PI + t * Math.PI * 3;
        const r = 0.25 + 1.4 * t;
        const v = arm * (SPIRAL_STEPS + 1) + i;
        this.spiralXZ[v * 2] = Math.cos(a) * r;
        this.spiralXZ[v * 2 + 1] = Math.sin(a) * r;
        this.spiralGlow[v] = 0.9 * (1 - t);
      }
    }
  }

  // Ripple `index` at (x, z): a ring of `radius`, as bright as `strength`.
  ring(index: number, x: number, z: number, radius: number, strength: number) {
    const p = this.positions;
    const c = this.colors;
    const circle = this.circle;
    const r = RIPPLE.r * strength;
    const g = RIPPLE.g * strength;
    const b = RIPPLE.b * strength;
    const first = index * RING_SEGMENTS;
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const o = (first + i) * 3;
      p[o] = x + circle[i * 2] * radius;
      p[o + 1] = 0.1;
      p[o + 2] = z + circle[i * 2 + 1] * radius;
      c[o] = r;
      c[o + 1] = g;
      c[o + 2] = b;
    }
  }

  // Whirlpool spiral `index` at (x, z), turned by `angle`.
  spiral(index: number, x: number, z: number, angle: number) {
    const p = this.positions;
    const c = this.colors;
    const xz = this.spiralXZ;
    const glow = this.spiralGlow;
    const cos = fastCos(angle);
    const sin = fastSin(angle);
    const first = this.spiralBase + index * SPIRAL_VERTICES;
    for (let i = 0; i < SPIRAL_VERTICES; i++) {
      const o = (first + i) * 3;
      const px = xz[i * 2];
      const pz = xz[i * 2 + 1];
      p[o] = x + px * cos - pz * sin;
      p[o + 1] = 0.07;
      p[o + 2] = z + px * sin + pz * cos;
      c[o] = FOAM.r * glow[i];
      c[o + 1] = FOAM.g * glow[i];
      c[o + 2] = FOAM.b * glow[i];
    }
  }

  // Parks the rings from `rings` on and the spirals from `spirals` on,
  // then marks the lines for upload.
  finish(rings: number, spirals: number) {
    for (let i = rings; i < this.rings; i++) this.park(i * RING_SEGMENTS, RING_SEGMENTS);
    for (let i = spirals; i < this.spirals; i++) this.park(this.spiralBase + i * SPIRAL_VERTICES, SPIRAL_VERTICES);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  private park(first: number, count: number) {
    const p = this.positions;
    for (let i = 0; i < count; i++) p[(first + i) * 3 + 1] = PARK_DEPTH;
  }
}
