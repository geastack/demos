import { Store } from "@geastack/core";
import { POSE_SAIL, POSE_SKY, POSE_TITLE, RiverCamera } from "../game/camera";
import { STEER_SCALE } from "../game/screen";
import { Stage } from "../game/stage";
import { EVENT_CATCH, EVENT_HIT, EVENT_RAPIDS, EVENT_SUNK, World } from "../game/world";

export const TITLE = 0;
export const RUN = 1;
export const OVER = 2;

const BEST_KEY = "lantern.best";
const ESCAPE_KEY = 27;
const MAX_STEP_S = 0.07;
// Steering: river units per pixel dragged.
const STEER_GAIN = 0.028;
// A tap this soon after the end is still part of the run.
const RETRY_GUARD_MS = 1600;
const OVER_IDLE_MS = 45000;
// Lanterns at which the scene is about two-thirds of the way to lit.
const LIGHT_LANTERNS = 24;
const LIGHT_RATE = 0.8;

// Runs the journey: one simulation step and one gea3d frame per display
// frame, drag steering, and the title / run / end flow the overlays show.
// Only the fields the overlays read are reactive; the rest changes quietly.
class GameStore extends Store {
  phase = TITLE;
  lanterns = 0;
  meters = 0;
  hull = 3;
  best = 0;
  newBest = false;
  distanceText = "";
  // Alternate 1 / 2 so the pop and the banner remount (and replay).
  catchTick = 0;
  rapidsTick = 0;

  private world = new World();
  private camera = new RiverCamera();
  private clockMs = 0;
  private lastFrameMs = 0;
  private phaseStartMs = 0;
  private dragX = 0;
  private dragging = false;
  private light = 0;

  start() {
    this.best = Number(localStorage.getItem(BEST_KEY));
    requestAnimationFrame(() => this.run());
  }

  pointerDown(x: number) {
    this.dragX = x;
    this.dragging = true;
  }

  pointerMove(x: number) {
    if (!this.dragging) return;

    if (this.phase === RUN) this.world.steer((x - this.dragX) * STEER_GAIN * STEER_SCALE);
    this.dragX = x;
  }

  pointerUp() {
    this.dragging = false;
    if (this.phase === TITLE) {
      this.begin();
      return;
    }

    if (this.phase === OVER && this.clockMs - this.phaseStartMs > RETRY_GUARD_MS) this.begin();
  }

  key(keyCode: number) {
    if (keyCode === ESCAPE_KEY && this.phase !== TITLE) this.toTitle();
  }

  private enter(phase: number) {
    this.phase = phase;
    this.phaseStartMs = this.clockMs;
  }

  private begin() {
    this.world.begin();
    this.lanterns = 0;
    this.meters = 0;
    this.hull = this.world.hull;
    this.catchTick = 0;
    this.rapidsTick = 0;
    this.newBest = false;
    this.enter(RUN);
  }

  private toTitle() {
    this.world.toTitle();
    this.enter(TITLE);
  }

  private finish() {
    this.world.stop();
    this.distanceText = distanceText(this.meters);
    this.enter(OVER);
    this.newBest = this.lanterns > this.best;
    if (!this.newBest) return;

    this.best = this.lanterns;
    localStorage.setItem(BEST_KEY, String(this.lanterns));
  }

  // Builds the scene on the first frame, then steps and renders every frame.
  private run() {
    const stage = new Stage();
    this.camera.boot();
    // Frame time comes from requestAnimationFrame: Date.now() is too coarse here.
    const frame = (timeMs: number) => {
      this.tick(timeMs, stage);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private tick(timeMs: number, stage: Stage) {
    const dt = this.lastFrameMs > 0 ? Math.max(0, Math.min((timeMs - this.lastFrameMs) / 1000, MAX_STEP_S)) : 0;
    this.lastFrameMs = timeMs;
    this.clockMs += dt * 1000;

    const world = this.world;
    const events = world.step(dt);
    if (this.phase === RUN) this.react(events);
    if (this.phase === OVER && this.clockMs - this.phaseStartMs > OVER_IDLE_MS) this.toTitle();

    const pose = this.phase === TITLE ? POSE_TITLE : this.phase === RUN ? POSE_SAIL : POSE_SKY;
    this.camera.follow(world, pose, dt);

    const wanted = 1 - Math.exp(-world.skyCount / LIGHT_LANTERNS);
    this.light += (wanted - this.light) * Math.min(1, dt * LIGHT_RATE);
    stage.setLight(this.light);
    stage.update(world, this.camera, this.clockMs / 1000);
    stage.draw();
  }

  private react(events: number) {
    const world = this.world;
    if ((events & EVENT_CATCH) !== 0) this.catchTick = this.catchTick === 1 ? 2 : 1;
    if ((events & EVENT_HIT) !== 0) this.hull = world.hull;
    if ((events & EVENT_RAPIDS) !== 0) this.rapidsTick = this.rapidsTick === 1 ? 2 : 1;
    if (world.lanterns !== this.lanterns) this.lanterns = world.lanterns;
    const meters = Math.floor(world.distance());
    if (meters !== this.meters) this.meters = meters;
    if ((events & EVENT_SUNK) !== 0) this.finish();
  }
}

// "740 m downriver", or "1.4 km downriver" from a kilometre on.
function distanceText(meters: number): string {
  if (meters < 1000) return `${meters} m downriver`;

  const tenths = Math.floor(meters / 100);
  return `${Math.floor(tenths / 10)}.${tenths % 10} km downriver`;
}

export const game = new GameStore();
