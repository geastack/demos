import { type Builder, CYAN, hex, MAGENTA, type Rgb, SUN, scale } from "./geometry";

// Convex low-poly models, flat-shaded at build time (dark faces, glowing
// accents): the craft, the barrier, the pylon and the energy shard. Faces
// get their own vertices so each keeps one colour.

// Toward the light: high, from the camera's left.
const LIGHT_X = -0.36;
const LIGHT_Y = 0.84;
const LIGHT_Z = 0.41;
const AMBIENT = 0.34;
const DIFFUSE = 0.66;
// Accent frames sit this far off their face, toward the viewer.
const FRAME_LIFT = 0.012;

// A convex solid: its vertices (xyz triples), faces added one by one.
class Solid {
  private readonly vertices: number[];
  private readonly cx: number;
  private readonly cy: number;
  private readonly cz: number;

  constructor(vertices: number[]) {
    this.vertices = vertices;
    let x = 0;
    let y = 0;
    let z = 0;
    const count = vertices.length / 3;
    for (let i = 0; i < count; i++) {
      x += vertices[i * 3];
      y += vertices[i * 3 + 1];
      z += vertices[i * 3 + 2];
    }
    this.cx = x / count;
    this.cy = y / count;
    this.cz = z / count;
  }

  // A flat face through corners (3 or 4, in order), wound outward, lit by
  // the fixed light; `glow` 0..1 makes it self-lit.
  face(builder: Builder, corners: number[], color: Rgb, glow: number) {
    const normal = this.normal(corners);
    const lambert = Math.max(0, normal[0] * LIGHT_X + normal[1] * LIGHT_Y + normal[2] * LIGHT_Z);
    const lit = AMBIENT + DIFFUSE * lambert;
    const shade = scale(color, lit + (1.25 - lit) * glow);
    const ordered = normal[3] < 0 ? reversed(corners) : corners;
    const first = builder.positions.length / 3;
    for (let i = 0; i < ordered.length; i++) {
      const v = ordered[i] * 3;
      builder.vertex(this.vertices[v], this.vertices[v + 1], this.vertices[v + 2], shade);
    }
    for (let i = 1; i + 1 < ordered.length; i++) builder.triangle(first, first + i, first + i + 1);
  }

  // A glowing frame `width` wide just inside a face's outline.
  frame(builder: Builder, corners: number[], width: number, color: Rgb) {
    const normal = this.normal(corners);
    const count = corners.length;
    const lift = FRAME_LIFT * (normal[3] < 0 ? -1 : 1);
    const outer: number[] = [];
    const inner: number[] = [];
    for (let i = 0; i < count; i++) {
      const p = corners[i] * 3;
      const prev = corners[(i + count - 1) % count] * 3;
      const next = corners[(i + 1) % count] * 3;
      const v = this.vertices;
      const toPrev = unit(v[prev] - v[p], v[prev + 1] - v[p + 1], v[prev + 2] - v[p + 2]);
      const toNext = unit(v[next] - v[p], v[next + 1] - v[p + 1], v[next + 2] - v[p + 2]);
      const x = v[p] + normal[0] * lift;
      const y = v[p + 1] + normal[1] * lift;
      const z = v[p + 2] + normal[2] * lift;
      outer.push(builder.vertex(x, y, z, color));
      inner.push(
        builder.vertex(
          x + (toPrev[0] + toNext[0]) * width,
          y + (toPrev[1] + toNext[1]) * width,
          z + (toPrev[2] + toNext[2]) * width,
          color,
        ),
      );
    }
    // Wound like the face (outward), so the frame is culled with it.
    const inward = normal[3] < 0;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      if (inward) builder.quad(outer[i], inner[i], inner[j], outer[j]);
      else builder.quad(outer[i], outer[j], inner[j], inner[i]);
    }
  }

  // Unit outward normal of a face; [3] is -1 when the corners run inward.
  private normal(corners: number[]): number[] {
    const v = this.vertices;
    const a = corners[0] * 3;
    const b = corners[1] * 3;
    const c = corners[2] * 3;
    const ux = v[b] - v[a];
    const uy = v[b + 1] - v[a + 1];
    const uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a];
    const wy = v[c + 1] - v[a + 1];
    const wz = v[c + 2] - v[a + 2];
    const n = unit(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx);
    const outward = n[0] * (v[a] - this.cx) + n[1] * (v[a + 1] - this.cy) + n[2] * (v[a + 2] - this.cz);
    const sign = outward < 0 ? -1 : 1;
    return [n[0] * sign, n[1] * sign, n[2] * sign, sign];
  }
}

function unit(x: number, y: number, z: number): number[] {
  const length = Math.sqrt(x * x + y * y + z * z);
  return length > 0 ? [x / length, y / length, z / length] : [0, 0, 0];
}

function reversed(corners: number[]): number[] {
  const out: number[] = [];
  for (let i = corners.length - 1; i >= 0; i--) out.push(corners[i]);
  return out;
}

// The craft: a flat delta with swept wings, a raised canopy and a glowing
// engine between its tail fins.
const SHIP = [
  0,
  0.24,
  -1.8, // 0 nose
  -1.15,
  0.1,
  0.75, // 1 left wing tip
  1.15,
  0.1,
  0.75, // 2 right wing tip
  0,
  0.52,
  -0.1, // 3 canopy crown
  -0.36,
  0.36,
  0.6, // 4 tail, left
  0.36,
  0.36,
  0.6, // 5 tail, right
  0,
  0.06,
  0.55, // 6 belly, rear
];
// Outline edges seen from the chase camera (the belly's are hidden).
export const SHIP_EDGES = [0, 1, 0, 2, 0, 3, 3, 4, 3, 5, 4, 5, 1, 4, 2, 5, 1, 6, 2, 6, 4, 6, 5, 6];

export function buildShip(builder: Builder) {
  const solid = new Solid(SHIP);
  const hull = hex(0x44348c);
  const canopy = hex(0x1060a0);
  const rear = hex(0x3a1856);
  const belly = hex(0x120c2a);
  solid.face(builder, [0, 1, 4], hull, 0);
  solid.face(builder, [0, 4, 3], canopy, 0.3);
  solid.face(builder, [0, 3, 5], canopy, 0.3);
  solid.face(builder, [0, 5, 2], hull, 0);
  solid.face(builder, [3, 4, 5], hull, 0);
  solid.face(builder, [4, 1, 6], rear, 0.25);
  solid.face(builder, [5, 6, 2], rear, 0.25);
  solid.face(builder, [4, 6, 5], MAGENTA, 1);
  solid.face(builder, [0, 6, 1], belly, 0);
  solid.face(builder, [0, 2, 6], belly, 0);
}

export function buildShipEdges(builder: Builder) {
  const edge = hex(0xc8f8ff);
  for (let i = 0; i < SHIP.length / 3; i++) builder.vertex(SHIP[i * 3], SHIP[i * 3 + 1], SHIP[i * 3 + 2], edge);
  for (let i = 0; i < SHIP_EDGES.length; i += 2) builder.segment(SHIP_EDGES[i], SHIP_EDGES[i + 1]);
}

// Box corners: bit 0 = +x, bit 1 = top, bit 2 = +z (toward the camera).
function boxCorners(
  halfBottom: number,
  halfTop: number,
  height: number,
  halfDepthBottom: number,
  halfDepthTop: number,
): number[] {
  const corners: number[] = [];
  for (let i = 0; i < 8; i++) {
    const top = (i & 2) !== 0;
    const half = top ? halfTop : halfBottom;
    const depth = top ? halfDepthTop : halfDepthBottom;
    corners.push((i & 1) !== 0 ? half : -half, top ? height : 0, (i & 4) !== 0 ? depth : -depth);
  }
  return corners;
}

const TOP = [2, 3, 7, 6];
const FRONT = [4, 5, 7, 6];
const BACK = [0, 1, 3, 2];
const LEFT = [0, 2, 6, 4];
const RIGHT = [1, 3, 7, 5];

// A low wall across one lane: jump it or dodge it. Glowing top, framed front.
export function buildBarrier(builder: Builder) {
  const solid = new Solid(boxCorners(0.9, 0.9, 0.75, 0.25, 0.25));
  const side = hex(0x3a0a30);
  solid.face(builder, TOP, hex(0x9a1c68), 0.35);
  solid.face(builder, FRONT, side, 0);
  solid.face(builder, BACK, side, 0);
  solid.face(builder, LEFT, side, 0);
  solid.face(builder, RIGHT, side, 0);
  const neon = hex(0xff8cc4);
  solid.frame(builder, FRONT, 0.06, neon);
  solid.frame(builder, TOP, 0.05, neon);
}

// A tall tapered pylon with a glowing cap: dodge only.
export function buildPylon(builder: Builder) {
  const solid = new Solid(boxCorners(0.65, 0.24, 2.4, 0.65, 0.24));
  const side = hex(0x40200c);
  solid.face(builder, TOP, SUN, 0.7);
  solid.face(builder, FRONT, side, 0);
  solid.face(builder, BACK, side, 0);
  solid.face(builder, LEFT, side, 0);
  solid.face(builder, RIGHT, side, 0);
  const neon = hex(0xffd890);
  solid.frame(builder, FRONT, 0.06, neon);
  solid.frame(builder, LEFT, 0.05, neon);
  solid.frame(builder, RIGHT, 0.05, neon);
}

// An energy shard: a tall octahedron that glows by itself.
export function buildShard(builder: Builder) {
  const solid = new Solid([0, 0.55, 0, 0, -0.55, 0, 0.38, 0, 0, 0, 0, 0.38, -0.38, 0, 0, 0, 0, -0.38]);
  for (let i = 0; i < 4; i++) {
    const a = 2 + i;
    const b = 2 + ((i + 1) % 4);
    solid.face(builder, [0, a, b], CYAN, 0.55);
    solid.face(builder, [1, a, b], CYAN, 0.55);
  }
}
