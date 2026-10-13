import { Store } from "@geastack/core";
import { ChaseCamera } from "../game/camera";
import { GESTURE_DOWN, GESTURE_LEFT, GESTURE_NONE, GESTURE_RIGHT, GESTURE_UP, Gesture } from "../game/gesture";
import { Stage } from "../game/stage";
import { EVENT_CRASH, EVENT_SHARD, World } from "../game/world";

export const TITLE = 0;
export const RUN = 1;
export const OVER = 2;

const BEST_KEY = "neon.best";
const ESCAPE_KEY = 27;
const SHARD_POINTS = 25;
const METRES_PER_POINT = 2;
// A tap this soon after a crash is still the tap that crashed.
const RETRY_GUARD_MS = 700;
const OVER_IDLE_MS = 20000;
const MAX_STEP_S = 0.05;
const FLASH_MS = 450;

// Runs the game: one simulation step and one gea3d frame per display frame,
// touch input, and the title / run / game-over flow the overlays show. Only
// the fields the overlays read are reactive state; the rest changes quietly.
class GameStore extends Store {
  phase = TITLE;
  score = 0;
  best = 0;
  newBest = false;
  flashing = false;
  // 0 until the first shard; then alternates 1 / 2 so the "+25" pop remounts.
  bonusTick = 0;
  // Layout variant, fixed at startup from the panel size: "" on landscape
  // (480x272), "-l" on the taller panels (480x480, 410x502). Class suffix.
  sz = window.innerHeight > 320 ? "-l" : "";

  private world = new World();
  private camera = new ChaseCamera();
  private gesture = new Gesture();
  private clockMs = 0;
  private lastFrameMs = 0;
  private phaseStartMs = 0;

  start() {
    this.best = Number(localStorage.getItem(BEST_KEY));
    requestAnimationFrame(() => this.run());
  }

  pointerDown(x: number, y: number) {
    this.gesture.down(x, y);
  }

  pointerMove(x: number, y: number) {
    this.act(this.gesture.move(x, y));
  }

  pointerUp(x: number, y: number) {
    this.act(this.gesture.up(x, y));
  }

  key(keyCode: number) {
    if (keyCode === ESCAPE_KEY && this.phase !== TITLE) this.toTitle();
  }

  private act(gesture: number) {
    if (gesture === GESTURE_NONE) return;

    if (this.phase === TITLE) {
      this.begin();
      return;
    }

    if (this.phase === OVER) {
      if (this.clockMs - this.phaseStartMs > RETRY_GUARD_MS) this.begin();
      return;
    }

    if (gesture === GESTURE_LEFT) this.world.steer(-1);
    else if (gesture === GESTURE_RIGHT) this.world.steer(1);
    else if (gesture === GESTURE_UP) this.world.jump();
    else if (gesture === GESTURE_DOWN) this.world.dive();
  }

  private enter(phase: number) {
    this.phase = phase;
    this.phaseStartMs = this.clockMs;
  }

  private begin() {
    this.world.reset();
    this.score = 0;
    this.bonusTick = 0;
    this.newBest = false;
    this.enter(RUN);
  }

  private toTitle() {
    this.world.reset();
    this.camera.swoop();
    this.enter(TITLE);
  }

  private crash() {
    if (this.phase === TITLE) {
      this.world.reset();
      return;
    }

    this.enter(OVER);
    this.flashing = true;
    setTimeout(() => (this.flashing = false), FLASH_MS);
    this.newBest = this.score > this.best;
    if (!this.newBest) return;

    this.best = this.score;
    localStorage.setItem(BEST_KEY, String(this.score));
  }

  // Builds the scene on the first frame, then steps and renders every frame.
  private run() {
    const stage = new Stage();
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
    if (this.phase === TITLE) world.autopilot();
    const event = world.step(dt);
    if (event === EVENT_CRASH) this.crash();
    if (event === EVENT_SHARD && this.phase === RUN) this.bonusTick = this.bonusTick === 1 ? 2 : 1;
    if (this.phase === RUN) this.updateScore();
    if (this.phase === OVER && this.clockMs - this.phaseStartMs > OVER_IDLE_MS) this.toTitle();

    const camera = this.camera;
    camera.follow(world, dt, this.phase === TITLE);
    stage.view(camera.x, camera.y, camera.z, camera.pitch);
    stage.place(world, world.renderY(), this.clockMs / 1000);
    stage.render();
  }

  private updateScore() {
    const score = Math.floor(this.world.distance / METRES_PER_POINT) + this.world.shards * SHARD_POINTS;
    if (score !== this.score) this.score = score;
  }
}

export const game = new GameStore();
