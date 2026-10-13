import { type Builder, CYAN, clamp01, fogAt, HAZE, hex, MAGENTA, mix, type Rgb } from "./geometry";

// The ground. Off the road it is the renderer's background gradient (see
// Stage.view), so the wide ground costs a flat fill per row. On it: the road
// mesh (glowing edges, the sun's reflection) and the grid lines along the
// road, fogged in their vertex colours; plus the lines across the road and
// the lane dashes, which scroll. Grid lines are one-pixel line segments; the
// road edges and lane dashes are quads.

export const ROAD_HALF_WIDTH = 3.2;
const LANE_DIVIDER = 1.05;
const CELL = 4;
const GRID_LINES = 20;
const DASH_PERIOD = 7;
const DASH_LENGTH = 3.2;
const NEAR_Z = 8;
const FAR_Z = -150;
const LINE_FAR_Z = -96;

// Fog is baked for a camera at this z (the chase camera's).
const EYE_Z = 5.2;

// Band edges along z, where the fog changes (the craft's glow sits in 3..-4).
const BANDS = [NEAR_Z, 3, -4, -15, -35, -55, -75, LINE_FAR_Z, FAR_Z];
const GRID_STEPS = [NEAR_Z, -20, -50, LINE_FAR_Z];

// Marks start where they come into view: no nearer than the screen's bottom
// edge, and for marks off to the side, where the view widens to reach them
// (with room for the camera's sideways follow).
const NEAREST_LINE = 1.2;
const VIEW_SLOPE = 0.96;
const FOLLOW_ROOM = 2;
// Half a road edge's width on screen, in pixels, its least half-width in
// world units, and the camera's focal length.
const HALF_LINE_PX = 0.65;
const EDGE_HALF = 0.1;
const FOCAL = 250;

export const GROUND_NEAR = hex(0x0e0626);
const ROAD_NEAR = hex(0x180a36);
const HORIZON_GLOW = hex(0xe8388c);
// The ground's colour at the horizon, where the background ramp starts: a
// dim violet, so the ground stays dark and its lines glow against it.
export const GROUND_HORIZON = hex(0x3a1058);
const EDGE = hex(0xb8f0ff);
const WARM = hex(0xff7a70);

// Column kinds across the road.
const EDGE_LINE = 1;
const ROAD = 2;
const REFLECTION = 3;

function depthOf(z: number): number {
  return Math.max(0, EYE_Z - z);
}

// A hot line where the ground meets the sky.
function horizonGlow(depth: number): number {
  return clamp01((depth - 100) / 60) * 0.55;
}

export function groundColor(depth: number): Rgb {
  return mix(mix(GROUND_NEAR, HAZE, fogAt(depth)), HORIZON_GLOW, horizonGlow(depth));
}

function roadColor(depth: number): Rgb {
  return mix(mix(ROAD_NEAR, HAZE, fogAt(depth)), HORIZON_GLOW, horizonGlow(depth));
}

function columnColor(kind: number, depth: number): Rgb {
  const fog = fogAt(depth);
  if (kind === EDGE_LINE) return mix(EDGE, HAZE, fog);
  if (kind === ROAD) return roadColor(depth);
  return mix(roadColor(depth), WARM, 0.12 + 0.4 * fog);
}

// Adds one row of vertices across the road at `z`; returns its first index.
// The reflection widens with depth: the sun is at infinity, so its streak
// keeps a constant width on screen (30 px either side).
function roadRow(builder: Builder, z: number): number {
  const depth = depthOf(z);
  const reflection = Math.min(2.7, (30 * Math.max(depth, 1)) / FOCAL);
  const xs = [-3.3, -3.05, -reflection, 0, reflection, 3.05, 3.3];
  const kinds = [EDGE_LINE, ROAD, ROAD, REFLECTION, ROAD, ROAD, EDGE_LINE];
  const first = builder.positions.length / 3;
  for (let i = 0; i < xs.length; i++) builder.vertex(xs[i], 0, z, columnColor(kinds[i], depth));
  return first;
}

const ROAD_COLUMNS = 7;

export function buildRoad(builder: Builder) {
  let previous = roadRow(builder, BANDS[0]);
  for (let b = 1; b < BANDS.length; b++) {
    const next = roadRow(builder, BANDS[b]);
    for (let c = 0; c + 1 < ROAD_COLUMNS; c++) builder.quad(previous + c, previous + c + 1, next + c + 1, next + c);
    previous = next;
  }
}

// The road edges: glowing quads following the road's bands (so each piece
// sorts with its band), fading out with depth.
export function buildRoadEdges(builder: Builder) {
  const start = EYE_Z - NEAREST_LINE;
  for (let side = -1; side <= 1; side += 2) {
    let near = start;
    for (let b = 1; b < BANDS.length && near > LINE_FAR_Z; b++) {
      if (BANDS[b] >= near) continue;

      // The far end stops just short of the band edge, so it sorts in front.
      const far = Math.max(BANDS[b] + 0.05, LINE_FAR_Z);
      // One flat colour per piece, faded for its middle.
      const depth = depthOf((near + far) / 2);
      const shade = mix(groundColor(depth), EDGE, 1 - fogAt(depth));
      const a = gridVertex(builder, side * ROAD_HALF_WIDTH, near, -1, shade);
      gridVertex(builder, side * ROAD_HALF_WIDTH, near, 1, shade);
      gridVertex(builder, side * ROAD_HALF_WIDTH, far, 1, shade);
      gridVertex(builder, side * ROAD_HALF_WIDTH, far, -1, shade);
      builder.quad(a, a + 1, a + 2, a + 3);
      near = BANDS[b];
    }
  }
}

// Grid lines along the road, off it: line segments from where each comes
// into view to the far end, broken where their fade needs it, one flat
// colour per piece (faded for its middle).
export function buildGridLines(builder: Builder) {
  for (let i = 1; i <= GRID_LINES; i++) {
    const offset = ROAD_HALF_WIDTH + i * CELL;
    const start = EYE_Z - Math.max(NEAREST_LINE, (offset - FOLLOW_ROOM) / VIEW_SLOPE);
    for (let side = -1; side <= 1; side += 2) {
      let near = start;
      for (let b = 1; b < GRID_STEPS.length && near > LINE_FAR_Z; b++) {
        if (GRID_STEPS[b] >= near) continue;

        const far = Math.max(GRID_STEPS[b], LINE_FAR_Z);
        const shade = gridColor((near + far) / 2);
        const a = builder.vertex(side * offset, 0, near, shade);
        builder.vertex(side * offset, 0, far, shade);
        builder.segment(a, a + 1);
        near = far;
      }
    }
  }
}

function gridColor(z: number): Rgb {
  const depth = depthOf(z);
  return mix(groundColor(depth), MAGENTA, 0.85 * (1 - fogAt(depth)));
}

// A corner of a road edge piece, the edge about a pixel wide at its depth
// but never thinner than EDGE_HALF.
function gridVertex(builder: Builder, x: number, z: number, side: number, color: Rgb): number {
  const half = Math.max(EDGE_HALF, (HALF_LINE_PX * depthOf(z)) / FOCAL);
  return builder.vertex(x + side * half, 0, z, color);
}

// The pool of cyan light under the craft: an octagon fading to the road.
export function buildGlow(builder: Builder) {
  const centre = builder.vertex(0, 0, 0, mix(ROAD_NEAR, CYAN, 0.32));
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    builder.vertex(1.2 * Math.cos(angle), 0, 1.8 * Math.sin(angle), ROAD_NEAR);
  }
  for (let i = 0; i < 8; i++) builder.triangle(centre, centre + 1 + i, centre + 1 + ((i + 1) % 8));
}

// Scrolling marks: lines across the road every CELL and the lane dashes,
// static geometry that the stage slides toward the camera by the distance
// travelled (modulo MARK_PERIOD, which both patterns repeat within).
export const MARK_PERIOD = 28;
const MARKS_NEAR_Z = NEAR_Z + MARK_PERIOD;
const DASH_HALF_WIDTH = 0.05;
const MARK_WIDE = 80;
// Lines across run as far as the lines along (the fog fades them out).
const MARKS_FAR_Z = LINE_FAR_Z;

// Lines across: one segment over the road and one either side of it (so
// each part sorts with what it lies on), magenta over the ground and a
// darker magenta over the road, so the grid reads square across both; the
// scene fog fades them with depth.
export function buildCrossLines(builder: Builder) {
  const onGround = mix(GROUND_NEAR, MAGENTA, 0.9);
  const onRoad = mix(ROAD_NEAR, MAGENTA, 0.55);
  for (let z = MARKS_NEAR_Z; z > MARKS_FAR_Z; z -= CELL) {
    const depth = Math.max(1, EYE_Z - z);
    // As wide as the view where the line is farthest: the marks slide toward
    // the camera from here, so it only ever narrows on screen.
    const reach = Math.min(MARK_WIDE, depth * VIEW_SLOPE + 2 * FOLLOW_ROOM + ROAD_HALF_WIDTH);
    crossSegment(builder, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, z, onRoad);
    if (reach <= ROAD_HALF_WIDTH) continue;

    crossSegment(builder, -reach, -ROAD_HALF_WIDTH, z, onGround);
    crossSegment(builder, ROAD_HALF_WIDTH, reach, z, onGround);
  }
}

// The lane dashes: quads, thicker near the camera.
export function buildDashes(builder: Builder) {
  const dash = mix(ROAD_NEAR, MAGENTA, 0.9);
  for (let z = MARKS_NEAR_Z; z > LINE_FAR_Z; z -= DASH_PERIOD) {
    const depth = Math.max(1, EYE_Z - z);
    const half = Math.max(DASH_HALF_WIDTH, (HALF_LINE_PX * depth) / FOCAL);
    flatQuad(builder, -LANE_DIVIDER - half, -LANE_DIVIDER + half, z, z - DASH_LENGTH, dash);
    flatQuad(builder, LANE_DIVIDER - half, LANE_DIVIDER + half, z, z - DASH_LENGTH, dash);
  }
}

function crossSegment(builder: Builder, x0: number, x1: number, z: number, color: Rgb) {
  const a = builder.vertex(x0, 0, z, color);
  builder.vertex(x1, 0, z, color);
  builder.segment(a, a + 1);
}

function flatQuad(builder: Builder, x0: number, x1: number, z0: number, z1: number, color: Rgb) {
  const a = builder.vertex(x0, 0, z0, color);
  builder.vertex(x1, 0, z0, color);
  builder.vertex(x1, 0, z1, color);
  builder.vertex(x0, 0, z1, color);
  builder.quad(a, a + 1, a + 2, a + 3);
}
