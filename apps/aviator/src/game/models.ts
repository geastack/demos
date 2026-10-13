import { Block, type Builder } from "./builder";
import { BROWN, BROWN_DARK, PINK, RED, WHITE } from "./palette";

// The Aviator's models, in the original's units (the plane is drawn scaled
// down). Everything but the propeller and the hair is one mesh.

// Where the propeller turns, in plane units.
export const PROPELLER_X = 60;

// The pilot's hair: a 4 x 3 grid of tufts on top of the head.
export const HAIR_COUNT = 12;
const HEAD_X = -10;
const HEAD_Y = 27;

export function hairX(tuft: number): number {
  return HEAD_X - 5 - 4 + Math.floor(tuft / 3) * 4;
}

export function hairY(): number {
  return HEAD_Y + 5;
}

export function hairZ(tuft: number): number {
  return -4 + (tuft % 3) * 4;
}

// The fuselage, engine, tail, wings, landing gear and the pilot.
export function buildPlane(builder: Builder) {
  // The cabin tapers towards the tail.
  const cabin = new Block(80, 50, 50);
  cabin.nudge(4, 0, -10, 20);
  cabin.nudge(5, 0, -10, -20);
  cabin.nudge(6, 0, 30, 20);
  cabin.nudge(7, 0, 30, -20);
  builder.block(cabin, RED);
  builder.block(new Block(20, 50, 50).translate(50, 0, 0), WHITE);
  builder.block(new Block(15, 20, 5).translate(-40, 20, 0), RED);

  // The wing as two halves that start at the tapered cabin's sides: the
  // middle is hidden anyway, and halves outside the cabin always sort
  // correctly against it (no depth buffer: faces are drawn far to near).
  const near = new Block(30, 5, 40).translate(0, 15, 40);
  near.nudge(1, 0, 0, -1.5);
  near.nudge(3, 0, 0, -1.5);
  near.nudge(4, 0, 0, -9);
  near.nudge(6, 0, 0, -9);
  builder.block(near, RED);
  const far = new Block(30, 5, 40).translate(0, 15, -40);
  far.nudge(0, 0, 0, 1.5);
  far.nudge(2, 0, 0, 1.5);
  far.nudge(5, 0, 0, 9);
  far.nudge(7, 0, 0, 9);
  builder.block(far, RED);
  builder.block(new Block(3, 15, 20).translate(5, 27, 0), WHITE);

  // Landing gear: guards, tyres with hubs, and the tail wheel on its strut.
  for (let side = -1; side <= 1; side += 2) {
    builder.block(new Block(30, 15, 10).translate(25, -20, 25 * side), RED);
    builder.block(new Block(24, 24, 4).translate(25, -28, 25 * side), BROWN_DARK);
    builder.block(new Block(10, 10, 6).translate(25, -28, 25 * side), BROWN);
  }
  builder.block(new Block(24, 24, 4).scale(0.5).translate(-35, -5, 0), BROWN_DARK);
  builder.block(new Block(4, 20, 4).translate(0, 10, 0).rotateZ(-0.3).translate(-35, -5, 0), RED);

  buildPilot(builder);
}

// The pilot, minus the hair tufts (see buildHair): body, face, the fixed
// hair at the sides and back, goggles and ears.
function buildPilot(builder: Builder) {
  const x = HEAD_X;
  const y = HEAD_Y;
  builder.block(new Block(15, 15, 15).translate(x + 2, y - 12, 0), BROWN);
  builder.block(new Block(10, 10, 10).translate(x, y, 0), PINK);

  const hairX = x - 5;
  const hairY = y + 5;
  builder.block(new Block(12, 4, 2).translate(hairX + 2, hairY - 2, 6), BROWN);
  builder.block(new Block(12, 4, 2).translate(hairX + 2, hairY - 2, -6), BROWN);
  builder.block(new Block(2, 8, 10).translate(hairX - 1, hairY - 4, 0), BROWN);

  builder.block(new Block(5, 5, 5).translate(x + 6, y, 3), BROWN);
  builder.block(new Block(5, 5, 5).translate(x + 6, y, -3), BROWN);
  builder.block(new Block(11, 1, 11).translate(x, y, 0), BROWN);
  builder.block(new Block(2, 3, 2).translate(x, y, -6), PINK);
  builder.block(new Block(2, 3, 2).translate(x, y, 6), PINK);
}

// The hub (a pyramid pointing back) and two crossed blades, about the
// propeller's axis (x).
export function buildPropeller(builder: Builder) {
  const hub = new Block(20, 10, 10);
  hub.nudge(4, 0, -5, 5);
  hub.nudge(5, 0, -5, -5);
  hub.nudge(6, 0, 5, 5);
  hub.nudge(7, 0, 5, -5);
  builder.block(hub, BROWN);
  builder.block(new Block(1, 80, 10).translate(8, 0, 0), BROWN_DARK);
  // The crossed blade in two halves, so each sorts on its own side.
  builder.block(new Block(1, 10, 40).translate(8, 0, 20), BROWN_DARK);
  builder.block(new Block(1, 10, 40).translate(8, 0, -20), BROWN_DARK);
}

// One hair tuft, standing on its base so it scales upward.
export function buildHair(builder: Builder) {
  builder.block(new Block(4, 4, 4).translate(0, 2, 0), BROWN);
}

// One cloud block (clouds are several, scaled and turned).
export function buildCloudBlock(builder: Builder) {
  builder.block(new Block(20, 20, 20), WHITE);
}
