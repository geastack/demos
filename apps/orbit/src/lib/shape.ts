import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from "@geastack/gea3d/three";
import { bakeColors, SLOTS } from "./palette";

// Indexed mesh data, built once on the CPU. A vertex's colour is a weighted
// sum of the theme's palette slots (`weights`, SLOTS per vertex), so a theme
// change only re-bakes and re-uploads the colour buffer.
export class Shape {
  positions: number[] = [];
  indices: number[] = [];
  weights: number[] = [];

  vertexCount(): number {
    return this.positions.length / 3;
  }

  // Revolves a profile around the Y axis. `profile` holds (radius, y, offset)
  // triples from top to bottom: each becomes a ring of `segments` vertices,
  // turned by `offset` steps; radius 0 is a single apex vertex. Rings with
  // different offsets stitch into alternating triangles (gem facets), equal
  // offsets into quads. The result is scaled and centred at (x, y, z).
  lathe(profile: number[], segments: number, scale: number, x: number, y: number, z: number): void {
    const step = (Math.PI * 2) / segments;
    let previous = -1;
    let previousApex = false;
    let previousOffset = 0;

    for (let p = 0; p < profile.length; p += 3) {
      const radius = profile[p] * scale;
      const height = y + profile[p + 1] * scale;
      const offset = profile[p + 2];
      const start = this.vertexCount();
      const apex = radius === 0;

      if (apex) {
        this.positions.push(x, height, z);
      } else {
        for (let i = 0; i < segments; i++) {
          const angle = (i + offset) * step;
          this.positions.push(x + radius * Math.sin(angle), height, z + radius * Math.cos(angle));
        }
      }

      if (previous >= 0) this.stitch(previous, previousApex, previousOffset, start, apex, offset, segments);

      previous = start;
      previousApex = apex;
      previousOffset = offset;
    }
  }

  // Vertices coloured so far (see `weights`); the rest are the latest lathe's.
  coloredCount(): number {
    return this.weights.length / SLOTS;
  }

  // Height of each vertex from `from` on, 0 at the lowest to 1 at the highest.
  heights(from: number): Float32Array {
    const count = this.vertexCount();
    const heights = new Float32Array(count - from);
    let low = this.positions[from * 3 + 1];
    let high = low;
    for (let i = from; i < count; i++) {
      const y = this.positions[i * 3 + 1];
      if (y < low) low = y;
      if (y > high) high = y;
    }

    const span = high > low ? high - low : 1;
    for (let i = from; i < count; i++) heights[i - from] = (this.positions[i * 3 + 1] - low) / span;
    return heights;
  }

  // `mirrored` reverses the winding, for a reflection drawn through a
  // y-flipping matrix (which flips it back).
  geometry(theme: number, mirrored: boolean): BufferGeometry {
    const colors = new Float32Array(this.positions.length);
    bakeColors(this.weights, theme, colors);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setIndex(mirrored ? this.reversedIndices() : this.indices);
    return geometry;
  }

  // Re-bakes a geometry made by geometry() for `theme`; the renderer
  // re-uploads the colours on its next frame.
  recolor(geometry: BufferGeometry, theme: number): void {
    const color = geometry.attributes.color;
    bakeColors(this.weights, theme, color.array);
    color.needsUpdate = true;
  }

  private reversedIndices(): number[] {
    const reversed: number[] = [];
    for (let i = 0; i < this.indices.length; i += 3) {
      reversed.push(this.indices[i], this.indices[i + 2], this.indices[i + 1]);
    }
    return reversed;
  }

  // Triangles between ring a (above) and ring b; counter-clockwise from outside.
  private stitch(a: number, aApex: boolean, aOffset: number, b: number, bApex: boolean, bOffset: number, n: number) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a0 = aApex ? a : a + i;
      const a1 = aApex ? a : a + j;
      const b0 = bApex ? b : b + i;
      const b1 = bApex ? b : b + j;

      if (aApex) this.indices.push(a0, b0, b1);
      else if (bApex) this.indices.push(a0, b0, a1);
      else if (aOffset < bOffset) this.indices.push(a0, b0, a1, a1, b0, b1);
      else this.indices.push(a0, b0, b1, a0, b1, a1);
    }
  }
}
