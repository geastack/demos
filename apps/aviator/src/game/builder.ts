import { BufferAttribute, BufferGeometry } from "@geastack/gea3d/three";

// Corner signs of a box, in the order of the original three.js BoxGeometry
// (0-3 on +x, 4-7 on -x), so the Aviator's vertex tweaks read the same.
const SIGN_X = [1, 1, 1, 1, -1, -1, -1, -1];
const SIGN_Y = [1, 1, -1, -1, 1, 1, -1, -1];
const SIGN_Z = [1, -1, 1, -1, -1, 1, -1, 1];

// The six faces as corner cycles (any winding: Builder.block turns each outward).
const FACES = [0, 2, 3, 1, 4, 6, 7, 5, 0, 1, 4, 5, 2, 3, 6, 7, 0, 2, 7, 5, 1, 3, 6, 4];

// A box's eight corners, moved and shaped before it joins a Builder.
export class Block {
  readonly corners: number[] = [];

  constructor(width: number, height: number, depth: number) {
    for (let i = 0; i < 8; i++) {
      this.corners.push((SIGN_X[i] * width) / 2, (SIGN_Y[i] * height) / 2, (SIGN_Z[i] * depth) / 2);
    }
  }

  // Moves one corner (the Aviator tapers its cabin and propeller this way).
  nudge(corner: number, dx: number, dy: number, dz: number): Block {
    this.corners[corner * 3] += dx;
    this.corners[corner * 3 + 1] += dy;
    this.corners[corner * 3 + 2] += dz;
    return this;
  }

  translate(x: number, y: number, z: number): Block {
    for (let i = 0; i < 8; i++) this.nudge(i, x, y, z);
    return this;
  }

  scale(factor: number): Block {
    for (let i = 0; i < 24; i++) this.corners[i] *= factor;
    return this;
  }

  // Turns the block about the x axis through the origin.
  rotateX(angle: number): Block {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let i = 0; i < 8; i++) {
      const y = this.corners[i * 3 + 1];
      const z = this.corners[i * 3 + 2];
      this.corners[i * 3 + 1] = y * c - z * s;
      this.corners[i * 3 + 2] = y * s + z * c;
    }
    return this;
  }

  // Turns the block about the y axis through the origin.
  rotateY(angle: number): Block {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let i = 0; i < 8; i++) {
      const x = this.corners[i * 3];
      const z = this.corners[i * 3 + 2];
      this.corners[i * 3] = x * c + z * s;
      this.corners[i * 3 + 2] = z * c - x * s;
    }
    return this;
  }

  // Turns the block about the z axis through the origin.
  rotateZ(angle: number): Block {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let i = 0; i < 8; i++) {
      const x = this.corners[i * 3];
      const y = this.corners[i * 3 + 1];
      this.corners[i * 3] = x * c - y * s;
      this.corners[i * 3 + 1] = x * s + y * c;
    }
    return this;
  }
}

// Indexed triangles with one colour per vertex. Lit materials shade each face
// flat from its own normal, so solids share their corners.
export class Builder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly indices: number[] = [];

  vertexCount(): number {
    return this.positions.length / 3;
  }

  vertex(x: number, y: number, z: number, color: number): number {
    this.positions.push(x, y, z);
    this.colors.push(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255);
    return this.vertexCount() - 1;
  }

  // Adds a triangle wound so that its front faces away from (cx, cy, cz).
  outward(a: number, b: number, c: number, cx: number, cy: number, cz: number) {
    const p = this.positions;
    const ux = p[b * 3] - p[a * 3];
    const uy = p[b * 3 + 1] - p[a * 3 + 1];
    const uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3];
    const vy = p[c * 3 + 1] - p[a * 3 + 1];
    const vz = p[c * 3 + 2] - p[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const out = nx * (p[a * 3] - cx) + ny * (p[a * 3 + 1] - cy) + nz * (p[a * 3 + 2] - cz);
    if (out >= 0) this.indices.push(a, b, c);
    else this.indices.push(a, c, b);
  }

  // A box (or a tapered one) in one colour; collapsed faces are dropped.
  block(block: Block, color: number) {
    const k = block.corners;
    const first = this.vertexCount();
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < 8; i++) {
      this.vertex(k[i * 3], k[i * 3 + 1], k[i * 3 + 2], color);
      cx += k[i * 3] / 8;
      cy += k[i * 3 + 1] / 8;
      cz += k[i * 3 + 2] / 8;
    }

    for (let f = 0; f < FACES.length; f += 4) {
      const a = first + FACES[f];
      const b = first + FACES[f + 1];
      const c = first + FACES[f + 2];
      const d = first + FACES[f + 3];
      if (this.area(a, b, c) > 0) this.outward(a, b, c, cx, cy, cz);
      if (this.area(a, c, d) > 0) this.outward(a, c, d, cx, cy, cz);
    }
  }

  // A regular tetrahedron of `radius`, each face split into (detail + 1)^2
  // triangles pushed out onto the sphere (three.js TetrahedronGeometry).
  tetrahedron(radius: number, detail: number, color: number) {
    const s = radius / Math.sqrt(3);
    const corners = [s, s, s, -s, -s, s, -s, s, -s, s, -s, -s];
    const faces = [2, 1, 0, 0, 3, 2, 1, 3, 0, 2, 3, 1];
    const rows = detail + 1;
    for (let f = 0; f < faces.length; f += 3) {
      const a = faces[f] * 3;
      const b = faces[f + 1] * 3;
      const c = faces[f + 2] * 3;
      // Grid point (i, j) of the face: a + (b - a) i / rows + (c - a) j / rows.
      const grid: number[] = [];
      for (let i = 0; i <= rows; i++) {
        for (let j = 0; j <= rows - i; j++) {
          let x = corners[a] + ((corners[b] - corners[a]) * i + (corners[c] - corners[a]) * j) / rows;
          let y =
            corners[a + 1] + ((corners[b + 1] - corners[a + 1]) * i + (corners[c + 1] - corners[a + 1]) * j) / rows;
          let z =
            corners[a + 2] + ((corners[b + 2] - corners[a + 2]) * i + (corners[c + 2] - corners[a + 2]) * j) / rows;
          if (detail > 0) {
            const length = Math.sqrt(x * x + y * y + z * z);
            x = (x * radius) / length;
            y = (y * radius) / length;
            z = (z * radius) / length;
          }
          grid.push(this.vertex(x, y, z, color));
        }
      }
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < rows - i; j++) {
          const p = gridIndex(i, j, rows);
          const q = gridIndex(i + 1, j, rows);
          const r = gridIndex(i, j + 1, rows);
          this.outward(grid[p], grid[q], grid[r], 0, 0, 0);
          if (j + 1 < rows - i) this.outward(grid[q], grid[gridIndex(i + 1, j + 1, rows)], grid[r], 0, 0, 0);
        }
      }
    }
  }

  geometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(floats(this.positions), 3));
    geometry.setAttribute("color", new BufferAttribute(floats(this.colors), 3));
    geometry.setIndex(this.indices);
    return geometry;
  }

  // Twice the area of a triangle, squared (0 when it is degenerate).
  private area(a: number, b: number, c: number): number {
    const p = this.positions;
    const ux = p[b * 3] - p[a * 3];
    const uy = p[b * 3 + 1] - p[a * 3 + 1];
    const uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3];
    const vy = p[c * 3 + 1] - p[a * 3 + 1];
    const vz = p[c * 3 + 2] - p[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    return nx * nx + ny * ny + nz * nz;
  }
}

// Index of grid point (i, j) in a triangular grid with `rows` rows.
function gridIndex(i: number, j: number, rows: number): number {
  return i * (rows + 1) - (i * (i - 1)) / 2 + j;
}

export function floats(values: number[]): Float32Array {
  const array = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) array[i] = values[i];
  return array;
}
