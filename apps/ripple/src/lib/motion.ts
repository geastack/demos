import { Fluid } from "./fluid";
import { FIELD_H, FIELD_W } from "./layout";
import { colorOf, MODES, type Mode } from "./modes";

const TAU = Math.PI * 2;
// Positions are in field pixels (the fluid field origin), scaled to the screen.
const CENTER_X = FIELD_W / 2;
const CENTER_Y = FIELD_H / 2;
const SMALL_SIDE = Math.min(FIELD_W, FIELD_H);

// Fingers.
const MAX_SPEED = 2400; // px/s
const VELOCITY_RADIUS = 26;
const DYE_RADIUS = 11; // thin, bright core; the velocity push is wider
const FULL_DYE_STROKE = 8; // px moved for the full dye amount
const MIN_DYE_SHARE = 0.25;

// Splash: a ring of short outward pushes where a finger lands.
const SPLASH_RAYS = 6;
const SPLASH_SPEED = 520;
const SPLASH_RADIUS = 24;
const SPLASH_DYE_RADIUS = 15;
const SPLASH_DYE = 1.4;

// Boot bloom: arms spiralling out of the centre.
const BLOOM_ARMS = 5;
const BLOOM_SECONDS = 1.4;
const BLOOM_START = 28; // px: the first frame already shows a ring
const BLOOM_REACH = Math.floor(SMALL_SIDE * 0.44); // 120 px at 272
const BLOOM_SPIN = 1.3; // rad/s
const BLOOM_FORCE = 1.6;
const BLOOM_DYE = 0.6;

// Attract: ghost fingers tracing slow Lissajous curves.
const GHOST_COUNT = 2;
const GHOST_FADE_IN = 2; // s
const GHOST_FORCE = 2;
const GHOST_DYE = 0.6;
const GHOST_COLOR_PERIOD = 7; // s per palette step
const GHOST_REACH_X = Math.floor(FIELD_W * 0.375); // 180 px at 480
const GHOST_REACH_Y = Math.floor(FIELD_H * 0.34); // 92 px at 272
const GHOST_FREQ_X = [0.53, 0.41];
const GHOST_FREQ_Y = [0.71, 0.89];
const GHOST_PHASE_X = [0.0, 3.1];
const GHOST_PHASE_Y = [1.3, 0.2];

// Frame steps are clamped so a stall never turns into one huge, unstable step.
const MIN_DT = 1 / 240;
const MAX_DT = 1 / 30;

// Everything that moves the fluid: finger strokes and splashes, the boot bloom
// and the ghost fingers, and the per-frame step.
export class Motion {
  readonly fluid = new Fluid();
  private mode: Mode = MODES[0];
  private lastMs = -1;
  private dt = MAX_DT;
  private bloomTime = 0;
  private readonly bloomX = [0, 0, 0, 0, 0];
  private readonly bloomY = [0, 0, 0, 0, 0];
  private ghostTime = 0;
  private ghostLevel = 0;
  private readonly ghostX = [0, 0];
  private readonly ghostY = [0, 0];

  /** Switches the look and replays the bloom in its palette. */
  setMode(mode: Mode) {
    this.mode = mode;
    this.restartBloom();
  }

  /** A finger moved from (x0, y0) to (x1, y1) with palette colour `color`. */
  stroke(x0: number, y0: number, x1: number, y1: number, color: number) {
    // A resting, jittering finger lays less dye than a moving one.
    const length = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
    const share = Math.min(1, Math.max(MIN_DYE_SHARE, length / FULL_DYE_STROKE));
    this.paint(x0, y0, x1, y1, color, 1, this.mode.dyeAmount * share);
  }

  /** A finger landed at (x, y): a burst of colour pushed outward. */
  splash(x: number, y: number, color: number) {
    const rgb = colorOf(this.mode, color);
    this.fluid.addDye(x, y, x, y, rgb[0] * SPLASH_DYE, rgb[1] * SPLASH_DYE, rgb[2] * SPLASH_DYE, SPLASH_DYE_RADIUS);
    for (let ray = 0; ray < SPLASH_RAYS; ray++) {
      const angle = (TAU * ray) / SPLASH_RAYS + color;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      this.fluid.addVelocity(
        x + dx * 6,
        y + dy * 6,
        x + dx * 14,
        y + dy * 14,
        dx * SPLASH_SPEED,
        dy * SPLASH_SPEED,
        SPLASH_RADIUS * 0.6,
      );
    }
  }

  /** Steps the fluid; `attract` lets the ghost fingers draw. */
  frame(timeMs: number, attract: boolean) {
    const elapsed = this.lastMs < 0 ? MAX_DT * 1000 : timeMs - this.lastMs;
    this.lastMs = timeMs;
    this.dt = Math.min(MAX_DT, Math.max(MIN_DT, elapsed * 0.001));

    if (this.bloomTime < BLOOM_SECONDS) this.bloom();
    this.ghosts(attract);
    this.fluid.step(this.dt, this.mode);
  }

  // Drags fluid from (x0, y0) to (x1, y1) this frame and lays dye along the way.
  private paint(x0: number, y0: number, x1: number, y1: number, color: number, force: number, dye: number) {
    let vx = ((x1 - x0) / this.dt) * force;
    let vy = ((y1 - y0) / this.dt) * force;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > MAX_SPEED) {
      vx *= MAX_SPEED / speed;
      vy *= MAX_SPEED / speed;
    }
    this.fluid.addVelocity(x0, y0, x1, y1, vx, vy, VELOCITY_RADIUS);

    const rgb = colorOf(this.mode, color);
    this.fluid.addDye(x0, y0, x1, y1, rgb[0] * dye, rgb[1] * dye, rgb[2] * dye, DYE_RADIUS);
  }

  // Starts the arms on a ring around the centre, each with a burst of colour.
  private restartBloom() {
    this.bloomTime = 0;
    const dye = BLOOM_DYE * 2;
    for (let arm = 0; arm < BLOOM_ARMS; arm++) {
      const angle = (TAU * arm) / BLOOM_ARMS;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle) * 0.8;
      const x = CENTER_X + BLOOM_START * dx;
      const y = CENTER_Y + BLOOM_START * dy;
      const rgb = colorOf(this.mode, arm);
      this.fluid.addDye(CENTER_X, CENTER_Y, x, y, rgb[0] * dye, rgb[1] * dye, rgb[2] * dye, SPLASH_RADIUS);
      this.fluid.addVelocity(CENTER_X, CENTER_Y, x, y, dx * SPLASH_SPEED, dy * SPLASH_SPEED, SPLASH_RADIUS);
      this.bloomX[arm] = x;
      this.bloomY[arm] = y;
    }
  }

  private bloom() {
    this.bloomTime = Math.min(BLOOM_SECONDS, this.bloomTime + this.dt);
    const progress = this.bloomTime / BLOOM_SECONDS;
    const rest = 1 - progress;
    const eased = 1 - rest * rest * rest;
    const radius = BLOOM_START + (BLOOM_REACH - BLOOM_START) * eased;
    const dye = BLOOM_DYE * (1.4 - progress);
    for (let arm = 0; arm < BLOOM_ARMS; arm++) {
      const angle = (TAU * arm) / BLOOM_ARMS + BLOOM_SPIN * this.bloomTime;
      const x = CENTER_X + radius * Math.cos(angle);
      const y = CENTER_Y + radius * 0.8 * Math.sin(angle);
      this.paint(this.bloomX[arm], this.bloomY[arm], x, y, arm, BLOOM_FORCE, dye);
      this.bloomX[arm] = x;
      this.bloomY[arm] = y;
    }
  }

  private ghosts(attract: boolean) {
    if (!attract) {
      this.ghostLevel = 0;
      return;
    }

    // Waking up: start each ghost where it is, so no stroke jumps across.
    if (this.ghostLevel === 0) {
      for (let ghost = 0; ghost < GHOST_COUNT; ghost++) {
        this.ghostX[ghost] = this.ghostPathX(ghost);
        this.ghostY[ghost] = this.ghostPathY(ghost);
      }
    }
    this.ghostLevel = Math.min(1, this.ghostLevel + this.dt / GHOST_FADE_IN);
    this.ghostTime += this.dt;

    const shift = Math.floor(this.ghostTime / GHOST_COLOR_PERIOD);
    for (let ghost = 0; ghost < GHOST_COUNT; ghost++) {
      const x = this.ghostPathX(ghost);
      const y = this.ghostPathY(ghost);
      const level = this.ghostLevel;
      this.paint(
        this.ghostX[ghost],
        this.ghostY[ghost],
        x,
        y,
        ghost * 2 + shift,
        GHOST_FORCE * level,
        GHOST_DYE * level,
      );
      this.ghostX[ghost] = x;
      this.ghostY[ghost] = y;
    }
  }

  private ghostPathX(ghost: number): number {
    return CENTER_X + GHOST_REACH_X * Math.sin(this.ghostTime * GHOST_FREQ_X[ghost] + GHOST_PHASE_X[ghost]);
  }

  private ghostPathY(ghost: number): number {
    return CENTER_Y + GHOST_REACH_Y * Math.sin(this.ghostTime * GHOST_FREQ_Y[ghost] + GHOST_PHASE_Y[ghost]);
  }
}
