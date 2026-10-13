import { BufferAttribute, BufferGeometry } from "@geastack/gea3d/three";

// Colours, fog and an indexed geometry builder shared by the scene parts.

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

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

// The palette.
export const NIGHT = hex(0x080420);
export const MAGENTA = hex(0xf82c88);
export const CYAN = hex(0x18d0f8);
export const SUN = hex(0xf8b020);
// What the ground and far objects fade into.
export const HAZE_HEX = 0x4a1266;
export const HAZE = hex(HAZE_HEX);

// Fog runs from clear to full haze between these view depths.
export const FOG_NEAR = 20;
export const FOG_FAR = 92;

// Smoothed fog amount at a view depth (the scene fog is linear; the baked
// parts use this softer curve).
export function fogAt(depth: number): number {
  const t = clamp01((depth - FOG_NEAR) / (FOG_FAR - FOG_NEAR));
  return t * t * (3 - 2 * t);
}

// Indexed triangles (or line segments) with one colour per vertex.
export class Builder {
  positions: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

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

  geometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(floats(this.positions), 3));
    geometry.setAttribute("color", new BufferAttribute(floats(this.colors), 3));
    geometry.setIndex(this.indices);
    return geometry;
  }
}

function floats(values: number[]): Float32Array {
  const array = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) array[i] = values[i];
  return array;
}
