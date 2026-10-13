import { BufferAttribute, BufferGeometry } from "@geastack/gea3d/three";

// Colours, a sine table and an indexed geometry builder shared by the scene.

export class Rgb {
  r: number;
  g: number;
  b: number;

  constructor(r: number, g: number, b: number) {
    this.r = r;
    this.g = g;
    this.b = b;
  }
}

export function hex(value: number): Rgb {
  return new Rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

export function mix(from: Rgb, to: Rgb, t: number): Rgb {
  return new Rgb(from.r + (to.r - from.r) * t, from.g + (to.g - from.g) * t, from.b + (to.b - from.b) * t);
}

export function scale(color: Rgb, factor: number): Rgb {
  return new Rgb(color.r * factor, color.g * factor, color.b * factor);
}

export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

// A deterministic 0..1 value per integer (row jitter, prop variety).
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// sin(x) from a 1024-entry table: for per-vertex and per-prop animation.
const SINE_SIZE = 1024;
const SINE_SCALE = SINE_SIZE / (Math.PI * 2);
const SINE = new Float32Array(SINE_SIZE);
for (let i = 0; i < SINE_SIZE; i++) SINE[i] = Math.sin((i * Math.PI * 2) / SINE_SIZE);

export function fastSin(x: number): number {
  return SINE[Math.floor(x * SINE_SCALE) & (SINE_SIZE - 1)];
}

export function fastCos(x: number): number {
  return SINE[(Math.floor(x * SINE_SCALE) + SINE_SIZE / 4) & (SINE_SIZE - 1)];
}

// Indexed triangles (or line segments) with one colour per vertex.
export class Builder {
  positions: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  vertexCount(): number {
    return this.positions.length / 3;
  }

  vertex(x: number, y: number, z: number, color: Rgb): number {
    this.positions.push(x, y, z);
    this.colors.push(color.r, color.g, color.b);
    return this.positions.length / 3 - 1;
  }

  triangle(a: number, b: number, c: number) {
    this.indices.push(a, b, c);
  }

  quad(a: number, b: number, c: number, d: number) {
    this.indices.push(a, b, c, a, c, d);
  }

  segment(a: number, b: number) {
    this.indices.push(a, b);
  }

  // A flat face of 3 or 4 corners with its own vertices (one colour).
  face(corners: number[], color: Rgb) {
    const first = this.vertexCount();
    for (let i = 0; i < corners.length; i += 3) this.vertex(corners[i], corners[i + 1], corners[i + 2], color);
    const count = corners.length / 3;
    for (let i = 1; i + 1 < count; i++) this.triangle(first, first + i, first + i + 1);
  }

  // A face of a solid around (cx, cy, cz): wound so it faces away from it.
  outward(corners: number[], color: Rgb, cx: number, cy: number, cz: number) {
    const ux = corners[3] - corners[0];
    const uy = corners[4] - corners[1];
    const uz = corners[5] - corners[2];
    const vx = corners[6] - corners[0];
    const vy = corners[7] - corners[1];
    const vz = corners[8] - corners[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const away = nx * (corners[0] - cx) + ny * (corners[1] - cy) + nz * (corners[2] - cz);
    if (away >= 0) {
      this.face(corners, color);
      return;
    }

    const reversed: number[] = [];
    for (let i = corners.length - 3; i >= 0; i -= 3) reversed.push(corners[i], corners[i + 1], corners[i + 2]);
    this.face(reversed, color);
  }

  // An axis-aligned box from (x0, y0, z0) to (x1, y1, z1), faces wound outward.
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Rgb) {
    this.face([x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0], color);
    this.face([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], color);
    this.face([x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], color);
    this.face([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], color);
    this.face([x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], color);
    this.face([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], color);
  }

  geometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(floats(this.positions), 3));
    geometry.setAttribute("color", new BufferAttribute(floats(this.colors), 3));
    geometry.setIndex(this.indices);
    return geometry;
  }
}

export function floats(values: number[]): Float32Array {
  const array = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) array[i] = values[i];
  return array;
}
