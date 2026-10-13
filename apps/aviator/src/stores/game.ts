import { Store } from "@geastack/core";
import { HEIGHT, WIDTH } from "../game/screen";
import { Stage } from "../game/stage";
import { EVENT_DOWN, World } from "../game/world";

export const TITLE = 0;
export const RUN = 1;
export const OVER = 2;

const BEST_KEY = "disco-aviator.distance";
const ESCAPE_KEY = 27;
const MAX_STEP_MS = 50;
// The HUD refreshes at most this often (each refresh relayouts the tree).
const HUD_MS = 100;
// A tap this soon after the plane went down is not yet a replay.
const REPLAY_GUARD_MS = 600;
const OVER_IDLE_MS = 30000;
const LEVEL_BAR_PX = 64;
const LOW_ENERGY = 30;
// On boot the plane flies in from off the left edge.
const ENTRY_X = -320;

// Runs the game: one simulation step and one gea3d frame per display frame,
// touch steering, and the title / flight / game-over flow the overlays show.
// Only the fields the overlays read are reactive; the rest changes quietly.
class GameStore extends Store {
  phase = TITLE;
  distance = 0;
  level = 1;
  levelProgress = 0;
  energy = 100;
  energyLow = false;
  best = 0;
  newBest = false;

  private world = new World();
  private clockMs = 0;
  private lastFrameMs = 0;
  private phaseStartMs = 0;
  private hudMs = 0;
  // The phase the current touch began in.
  private pressed = TITLE;

  start() {
    this.best = Number(localStorage.getItem(BEST_KEY));
    this.world.planeX = ENTRY_X;
    requestAnimationFrame(() => this.run());
  }

  pointerDown(x: number, y: number) {
    this.pressed = this.phase;
    if (this.phase === RUN) this.aim(x, y);
  }

  pointerMove(x: number, y: number) {
    if (this.phase === RUN) this.aim(x, y);
  }

  pointerUp(x: number, y: number) {
    if (this.phase === TITLE) {
      this.begin(x, y);
      return;
    }

    // Only a touch that began on the game-over card replays: a finger still
    // down from the flight lifts without starting another.
    const fresh = this.pressed === OVER;
    if (this.phase === OVER && fresh && this.clockMs - this.phaseStartMs > REPLAY_GUARD_MS) this.begin(x, y);
  }

  key(keyCode: number) {
    if (keyCode === ESCAPE_KEY && this.phase !== TITLE) this.toTitle();
  }

  // The touch point steers: its height sets the plane's, and further right
  // flies a little ahead and faster.
  private aim(x: number, y: number) {
    this.world.aimX = clamp((x - WIDTH / 2) / (WIDTH * 0.42), -1, 1);
    this.world.aimY = clamp((HEIGHT / 2 - y) / (HEIGHT * 0.4), -1, 1);
  }

  private enter(phase: number) {
    this.phase = phase;
    this.phaseStartMs = this.clockMs;
  }

  private begin(x: number, y: number) {
    this.world.reset();
    this.aim(x, y);
    this.newBest = false;
    this.refreshHud();
    this.enter(RUN);
  }

  private toTitle() {
    this.world.reset();
    this.enter(TITLE);
  }

  private down() {
    this.enter(OVER);
    this.newBest = this.distance > this.best;
    if (!this.newBest) return;

    this.best = this.distance;
    localStorage.setItem(BEST_KEY, String(this.distance));
  }

  // Builds the scene on the first frame, then steps and renders every frame.
  private run() {
    const stage = new Stage();
    const frame = (timeMs: number) => {
      this.tick(timeMs, stage);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private tick(timeMs: number, stage: Stage) {
    const dt = this.lastFrameMs > 0 ? clamp(timeMs - this.lastFrameMs, 0, MAX_STEP_MS) : 0;
    this.lastFrameMs = timeMs;
    this.clockMs += dt;

    const world = this.world;
    if (this.phase === TITLE) this.autopilot();
    const event = world.step(dt, this.phase === RUN);
    if (event === EVENT_DOWN && this.phase === RUN) this.down();
    if (this.phase === RUN && this.clockMs - this.hudMs >= HUD_MS) this.refreshHud();
    if (this.phase === OVER && this.clockMs - this.phaseStartMs > OVER_IDLE_MS) this.toTitle();

    stage.follow(world, dt);
    stage.place(world, dt);
    stage.render();
  }

  // Attract mode: the plane swoops gently up and down on its own.
  private autopilot() {
    const t = this.clockMs / 1000;
    this.world.aimX = 0.25 * Math.sin(t * 0.4);
    this.world.aimY = 0.3 * Math.sin(t * 0.9) + 0.15;
  }

  private refreshHud() {
    this.hudMs = this.clockMs;
    const world = this.world;
    const distance = Math.floor(world.distance);
    const energy = Math.ceil(world.energy);
    const progress = Math.floor(world.levelProgress() * LEVEL_BAR_PX);
    if (distance !== this.distance) this.distance = distance;
    if (world.level !== this.level) this.level = world.level;
    if (progress !== this.levelProgress) this.levelProgress = progress;
    if (energy !== this.energy) this.energy = energy;
    const low = energy < LOW_ENERGY;
    if (low !== this.energyLow) this.energyLow = low;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const game = new GameStore();
