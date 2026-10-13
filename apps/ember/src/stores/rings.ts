import { ARC_SIZE, TIMER_SIZE } from "../layout";
import { Ring, SWEEP_DEG } from "../lib/ring";
import { RingView } from "../lib/ring-view";
import { shell } from "./shell";

export { ARC_SIZE, SWEEP_DEG, TIMER_SIZE };

export const ARC_ID = "arc";
export const TIMER_ID = "timer-ring";

// The tables build in the background: a few ms a frame, paused while the
// panel is being touched (a swipe keeps its frame rate), and rushed when a
// screen needs a ring before it is ready.
const BUILD_BUDGET_MS = 6;
const RUSH_BUDGET_MS = 24;
const TOUCH_PAUSE_MS = 1200;

// The rings scale with their canvas: the specs below are the 216 px arc and
// 176 px timer of the 480x272 design, multiplied by the canvas / design size
// (reciprocals, so the integer sizes never meet an integer division).
const ARC_SCALE = ARC_SIZE * 0.004629629629629629;
const TIMER_SCALE = TIMER_SIZE * 0.005681818181818182;

/** The arc's radius, px (the manual dial's knob rides it). */
export const ARC_RADIUS = Math.floor(96 * ARC_SCALE);

// The big heat arc (Preheat and the Manual dial) and the step timer ring.
const arc = new Ring({
  size: ARC_SIZE,
  radius: ARC_RADIUS,
  halfWidth: Math.round(6 * ARC_SCALE),
  glowWidth: Math.round(9 * ARC_SCALE),
  glowStrength: 0.34,
  dotRadius: 3 * ARC_SCALE,
  innerRadius: Math.floor(78 * ARC_SCALE),
  innerStrength: 0.32,
});

const timer = new Ring({
  size: TIMER_SIZE,
  radius: Math.floor(78 * TIMER_SCALE),
  halfWidth: Math.round(5 * TIMER_SCALE),
  glowWidth: Math.round(8 * TIMER_SCALE),
  glowStrength: 0.3,
  dotRadius: 2.5 * TIMER_SCALE,
  innerRadius: Math.floor(62 * TIMER_SCALE),
  innerStrength: 0.26,
});

export const arcView = new RingView(arc, ARC_ID);
export const timerView = new RingView(timer, TIMER_ID);

/** Builds both rings' tables over the first frames (from the boot screen on). */
export function buildRings() {
  const rush = arcView.waiting() || timerView.waiting();
  const touched = shell.quietFor() < TOUCH_PAUSE_MS;
  const budget = rush ? RUSH_BUDGET_MS : touched ? 0 : BUILD_BUDGET_MS;
  const done = budget === 0 ? false : arc.build(budget) && timer.build(budget);
  if (!done) requestAnimationFrame(() => buildRings());
}
