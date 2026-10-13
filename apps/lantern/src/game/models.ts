import { type Builder, hash, mix, Rgb, scale } from "./geometry";
import {
  AMBER,
  BARK,
  HEARTWOOD,
  LACQUER,
  LANTERN_HOT,
  MOSS_STONE,
  PAPER,
  PAPER_SHADE,
  REED,
  REED_TIP,
  STONE,
  VERMILION,
  WATER,
  WATER_DEEP,
  WHIRL_EYE,
} from "./palette";
import { HALF_WIDTH } from "./river";

// The low-poly models, built once. Lit ones (the boat, rocks, logs, reeds,
// the torii, the bridge, stone lanterns) are flat-shaded by the scene
// lights, so their faces only carry an albedo; the paper lanterns and the
// glows are unlit. Models face -z (downriver) with +x to the right.

// Lit faces this bright stay light under the dusk lights.
const PAPER_GLOW = 1.35;
const LIGHT_GLOW = 2.2;

// A folded paper boat: a hull with raised bow and stern, a deck and the
// centre sail, every fold its own facet.
export function buildBoat(b: Builder) {
  const paper = scale(PAPER, PAPER_GLOW);
  const fold = scale(PAPER_SHADE, PAPER_GLOW);
  const bow = [0, 0.3, -0.82];
  const stern = [0, 0.3, 0.82];
  const left = [-0.34, 0.2, 0];
  const right = [0.34, 0.2, 0];
  const b0 = [-0.17, 0, -0.42];
  const b1 = [0.17, 0, -0.42];
  const b2 = [0.17, 0, 0.42];
  const b3 = [-0.17, 0, 0.42];
  const cy = 0.15;
  hull(b, [bow, left, b0], paper, cy);
  hull(b, [left, b3, b0], fold, cy);
  hull(b, [left, stern, b3], paper, cy);
  hull(b, [bow, b1, right], paper, cy);
  hull(b, [right, b1, b2], fold, cy);
  hull(b, [right, b2, stern], paper, cy);
  hull(b, [bow, b0, b1], fold, cy);
  hull(b, [stern, b2, b3], fold, cy);
  hull(b, [bow, right, left], fold, 0);
  hull(b, [stern, left, right], fold, 0);

  const peak = [0, 0.74, 0.02];
  const fore = [0, 0.2, -0.44];
  const aft = [0, 0.2, 0.44];
  const port = [-0.1, 0.22, 0];
  const starboard = [0.1, 0.22, 0];
  const sy = 0.3;
  hull(b, [fore, port, peak], paper, sy);
  hull(b, [port, aft, peak], fold, sy);
  hull(b, [aft, starboard, peak], paper, sy);
  hull(b, [starboard, fore, peak], fold, sy);
}

function hull(b: Builder, corners: number[][], color: Rgb, cy: number) {
  const flat: number[] = [];
  for (let i = 0; i < corners.length; i++) flat.push(corners[i][0], corners[i][1], corners[i][2]);
  b.outward(flat, color, 0, cy, 0);
}

// A floating paper lantern: a glowing box, hot at the bottom, on a dark
// base, under a vermilion lid. Unlit.
export function buildLantern(b: Builder) {
  const half = 0.2;
  const low = 0.08;
  const high = 0.56;
  const hot = LANTERN_HOT;
  const warm = AMBER;
  const corners = [-half, -half, half, -half, half, half, -half, half];
  for (let i = 0; i < 4; i++) {
    const x0 = corners[i * 2];
    const z0 = corners[i * 2 + 1];
    const x1 = corners[((i + 1) % 4) * 2];
    const z1 = corners[((i + 1) % 4) * 2 + 1];
    const a = b.vertex(x0, low, z0, hot);
    b.vertex(x1, low, z1, hot);
    b.vertex(x1, high, z1, warm);
    b.vertex(x0, high, z0, warm);
    b.quad(a, a + 3, a + 2, a + 1);
  }
  b.box(-0.25, 0, -0.25, 0.25, low, 0.25, LACQUER);
  b.box(-0.24, high, -0.24, 0.24, high + 0.05, 0.24, VERMILION);
}

// A glow: a hexagon in the xy plane, `core` at the centre fading to black
// at radius 1 (drawn additively, so black adds nothing).
export function buildGlow(b: Builder, core: Rgb) {
  const black = new Rgb(0, 0, 0);
  const centre = b.vertex(0, 0, 0, core);
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    b.vertex(Math.cos(angle), Math.sin(angle), 0, black);
  }
  for (let i = 0; i < 6; i++) b.triangle(centre, centre + 1 + i, centre + 1 + ((i + 1) % 6));
}

// A boulder of radius ~1: a jittered ring, a smaller turned ring and a
// crown, mossy on top.
export function buildRock(b: Builder) {
  const base: number[] = [];
  const middle: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const r = 0.85 + 0.25 * hash(i + 3);
    base.push(Math.cos(a) * r, -0.2, Math.sin(a) * r);
    const m = a + Math.PI / 6;
    const rm = 0.6 + 0.2 * hash(i + 11);
    middle.push(Math.cos(m) * rm, 0.34 + 0.12 * hash(i + 17), Math.sin(m) * rm);
  }
  const crown = [0.08, 0.66, -0.05];
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    const tone = 0.85 + 0.3 * hash(i + 23);
    b.outward(
      [
        base[i * 3],
        base[i * 3 + 1],
        base[i * 3 + 2],
        base[j * 3],
        base[j * 3 + 1],
        base[j * 3 + 2],
        middle[i * 3],
        middle[i * 3 + 1],
        middle[i * 3 + 2],
      ],
      scale(STONE, tone),
      0,
      0.2,
      0,
    );
    const prev = (i + 5) % 6;
    b.outward(
      [
        base[i * 3],
        base[i * 3 + 1],
        base[i * 3 + 2],
        middle[i * 3],
        middle[i * 3 + 1],
        middle[i * 3 + 2],
        middle[prev * 3],
        middle[prev * 3 + 1],
        middle[prev * 3 + 2],
      ],
      scale(STONE, 1.1 - 0.2 * hash(i + 29)),
      0,
      0.2,
      0,
    );
    b.outward(
      [
        middle[i * 3],
        middle[i * 3 + 1],
        middle[i * 3 + 2],
        middle[j * 3],
        middle[j * 3 + 1],
        middle[j * 3 + 2],
        crown[0],
        crown[1],
        crown[2],
      ],
      scale(MOSS_STONE, tone),
      0,
      0.2,
      0,
    );
  }
}

// A log lying across the water: a hexagonal prism along x, length 1.
export function buildLog(b: Builder) {
  const radius = 0.2;
  for (let i = 0; i < 6; i++) {
    const a0 = (i * Math.PI) / 3;
    const a1 = ((i + 1) * Math.PI) / 3;
    const y0 = Math.sin(a0) * radius;
    const z0 = Math.cos(a0) * radius;
    const y1 = Math.sin(a1) * radius;
    const z1 = Math.cos(a1) * radius;
    b.outward([-0.5, y0, z0, 0.5, y0, z0, 0.5, y1, z1, -0.5, y1, z1], scale(BARK, 0.85 + 0.3 * hash(i + 41)), 0, 0, 0);
  }
  for (let end = -1; end <= 1; end += 2) {
    const ring: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ring.push(end * 0.5, Math.sin(a) * radius, Math.cos(a) * radius);
    }
    b.outward(ring, HEARTWOOD, 0, 0, 0);
  }
}

// A whirlpool's water: a disc darkening to its eye (lit like the water).
export function buildWhirl(b: Builder) {
  const eye = b.vertex(0, -0.02, 0, WHIRL_EYE);
  const inner: number[] = [];
  const outer: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    inner.push(b.vertex(Math.cos(a + 0.4) * 0.7, 0, Math.sin(a + 0.4) * 0.7, mix(WHIRL_EYE, WATER_DEEP, 0.7)));
    outer.push(b.vertex(Math.cos(a) * 1.7, 0.02, Math.sin(a) * 1.7, WATER));
  }
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    b.triangle(eye, inner[j], inner[i]);
    b.quad(inner[i], inner[j], outer[j], outer[i]);
  }
}

// A clump of reeds: five leaning blades (double-sided).
export function buildReeds(b: Builder) {
  for (let i = 0; i < 5; i++) {
    const x = (hash(i + 51) - 0.5) * 0.6;
    const z = (hash(i + 57) - 0.5) * 0.6;
    const height = 0.9 + 0.8 * hash(i + 61);
    const leanX = (hash(i + 67) - 0.5) * 0.5;
    const leanZ = (hash(i + 71) - 0.5) * 0.3;
    const color = mix(REED, REED_TIP, 0.25 + 0.5 * hash(i + 73));
    b.face([x - 0.06, 0, z, x + 0.06, 0, z, x + leanX, height, z + leanZ], color);
  }
}

// A vermilion torii spanning the river, pillars standing at its edges.
export function buildTorii(b: Builder) {
  const red = scale(VERMILION, 1.15);
  const span = HALF_WIDTH + 0.6;
  const pillar = 0.18;
  for (let side = -1; side <= 1; side += 2) {
    b.box(side * span - pillar, -0.6, -pillar, side * span + pillar, 3.2, pillar, red);
  }
  b.box(-span - 0.5, 2.5, -0.13, span + 0.5, 2.78, 0.13, red);
  b.box(-0.14, 2.78, -0.1, 0.14, 3.2, 0.1, red);
  b.box(-span - 0.8, 3.2, -0.16, span + 0.8, 3.42, 0.16, red);
  b.box(-span - 1.1, 3.42, -0.24, span + 1.1, 3.68, 0.24, LACQUER);
}

// A drum bridge arching over the river: a vermilion balustrade either side
// of a dark plank deck, the underside in shadow.
export function buildBridge(b: Builder) {
  const red = scale(VERMILION, 1.1);
  const under = scale(VERMILION, 0.55);
  const reach = HALF_WIDTH + 2.4;
  const segments = 7;
  const half = 0.9;
  for (let i = 0; i < segments; i++) {
    const x0 = -reach + (2 * reach * i) / segments;
    const x1 = -reach + (2 * reach * (i + 1)) / segments;
    const y0 = arch(x0, reach);
    const y1 = arch(x1, reach);
    b.face([x0, y0, -half, x0, y0, half, x1, y1, half, x1, y1, -half], BARK);
    b.face([x0, y0 - 0.3, half, x0, y0 - 0.3, -half, x1, y1 - 0.3, -half, x1, y1 - 0.3, half], under);
    b.face([x0, y0 - 0.3, half, x1, y1 - 0.3, half, x1, y1 + 0.5, half, x0, y0 + 0.5, half], red);
    b.face([x1, y1 - 0.3, -half, x0, y0 - 0.3, -half, x0, y0 + 0.5, -half, x1, y1 + 0.5, -half], red);
  }
}

function arch(x: number, reach: number): number {
  const t = x / reach;
  return 0.45 + 2.3 * (1 - t * t);
}

// A stone lantern for the bank: base, post, the lit fire box and a roof.
export function buildStoneLantern(b: Builder) {
  const stone = STONE;
  b.box(-0.28, 0, -0.28, 0.28, 0.16, 0.28, scale(stone, 0.9));
  b.box(-0.1, 0.16, -0.1, 0.1, 0.8, 0.1, stone);
  b.box(-0.24, 0.8, -0.24, 0.24, 0.86, 0.24, scale(stone, 1.1));
  b.box(-0.18, 0.86, -0.18, 0.18, 1.18, 0.18, scale(AMBER, LIGHT_GLOW));
  const roof = [-0.36, 1.18, -0.36, 0.36, 1.18, -0.36, 0.36, 1.18, 0.36, -0.36, 1.18, 0.36];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    b.outward(
      [roof[i * 3], roof[i * 3 + 1], roof[i * 3 + 2], roof[j * 3], roof[j * 3 + 1], roof[j * 3 + 2], 0, 1.5, 0],
      scale(stone, 1.15),
      0,
      1.2,
      0,
    );
  }
}
