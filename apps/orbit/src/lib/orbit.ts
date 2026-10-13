import { THEME_COUNT } from "./palette";
import { GEM, ORBIT_A, ORBIT_B, Stage } from "./stage";

const BOOT_S = 1.5;

// Gem: floats at GEM_Y, spins at IDLE_SPIN, rests tipped towards the viewer.
const GEM_Y = 1.3;
const GEM_SCALE = 0.95;
const IDLE_SPIN = 0.55;
const REST_TILT = 0.22;
const MAX_TILT = 0.75;
const MAX_FLING = 12;

// Camera: a slow drift around the scene; pinch zoom between the limits.
const DRIFT = 0.08;
const ELEVATION = 0.22;
const ZOOM = 7.6;
const MIN_ZOOM = 4.6;
const MAX_ZOOM = 10;
// Squarer and portrait screens are not height-limited like 480x272, so the
// camera starts closer and the subject fills more of them.
const TALL_FIT = 0.8;
const TALL_ASPECT = 1.3;

// Touch.
const DRAG_GAIN = 0.011; // radians per pixel
const TAP_MS = 280;
const TAP_SLOP = 10;
const STILL_MS = 80; // a finger held this long before release does not fling
const FINGERS = 2;

// Theme change: a spin kick and a brief swell.
const POP_S = 0.45;
const POP_SPIN = 6;

// Drives the scene: touch gestures, motion (with inertia and easing back to
// idle) and one gea3d render per frame. Per-frame state lives in plain
// fields; nothing here is reactive.
class Orbit {
  private theme = 0;
  private shownTheme = 0;
  private startMs = 0;
  private lastMs = 0;
  private popS = -1;

  private yaw = 0;
  private yawSpeed = IDLE_SPIN;
  private tilt = REST_TILT;
  private tiltSpeed = 0;
  private fit = window.innerWidth < window.innerHeight * TALL_ASPECT ? TALL_FIT : 1;
  private zoom = ZOOM * this.fit;
  private distance = ZOOM * this.fit * 2;

  // Tracked fingers: pointer id (0 = free slot) and last position.
  private ids = new Int32Array(FINGERS);
  private xs = new Float32Array(FINGERS);
  private ys = new Float32Array(FINGERS);
  private pinchSpan = 0;
  private pinchZoom = ZOOM * this.fit;
  private tapMs = 0;
  private tapX = 0;
  private tapY = 0;
  private tapping = false;
  private lastMoveMs = 0;

  start() {
    requestAnimationFrame(() => this.run());
  }

  down(id: number, x: number, y: number) {
    const slot = this.slotOf(0);
    if (slot < 0) return;

    this.ids[slot] = id;
    this.xs[slot] = x;
    this.ys[slot] = y;

    if (this.fingers() === 1) {
      this.tapping = true;
      this.tapMs = Date.now();
      this.tapX = x;
      this.tapY = y;
      this.yawSpeed = 0;
      this.tiltSpeed = 0;
      return;
    }

    this.tapping = false;
    this.pinchSpan = this.span();
    this.pinchZoom = this.zoom;
  }

  move(id: number, x: number, y: number) {
    const slot = this.slotOf(id);
    if (slot < 0) return;

    const dx = x - this.xs[slot];
    const dy = y - this.ys[slot];
    this.xs[slot] = x;
    this.ys[slot] = y;

    if (this.fingers() > 1) {
      const span = this.span();
      if (this.pinchSpan > 0 && span > 0) {
        this.zoom = clamp((this.pinchZoom * this.pinchSpan) / span, MIN_ZOOM * this.fit, MAX_ZOOM * this.fit);
      }
      return;
    }

    if (Math.abs(x - this.tapX) + Math.abs(y - this.tapY) > TAP_SLOP) this.tapping = false;

    const now = Date.now();
    const dt = Math.max(8, now - this.lastMoveMs) / 1000;
    this.lastMoveMs = now;
    this.yaw += dx * DRAG_GAIN;
    this.tilt = clamp(this.tilt + dy * DRAG_GAIN, -MAX_TILT, MAX_TILT);
    this.yawSpeed = clamp((this.yawSpeed + (dx * DRAG_GAIN) / dt) / 2, -MAX_FLING, MAX_FLING);
    this.tiltSpeed = clamp((this.tiltSpeed + (dy * DRAG_GAIN) / dt) / 2, -MAX_FLING, MAX_FLING);
  }

  up(id: number) {
    const slot = this.slotOf(id);
    if (slot < 0) return;

    this.ids[slot] = 0;
    const now = Date.now();
    if (now - this.lastMoveMs > STILL_MS) {
      this.yawSpeed = 0;
      this.tiltSpeed = 0;
    }

    if (this.tapping && now - this.tapMs < TAP_MS) this.nextTheme(now);
    this.tapping = false;
  }

  private nextTheme(now: number) {
    this.theme = (this.theme + 1) % THEME_COUNT;
    this.popS = (now - this.startMs) / 1000;
    this.yawSpeed += POP_SPIN;
  }

  // Builds the gem on the first frame, then renders every frame.
  private run() {
    const stage = new Stage();
    this.startMs = Date.now();
    this.lastMs = this.startMs;

    const frame = () => {
      this.advance(stage);
      stage.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private advance(stage: Stage) {
    const now = Date.now();
    const dt = Math.min(0.05, (now - this.lastMs) / 1000);
    const t = (now - this.startMs) / 1000;
    this.lastMs = now;

    // The first frame shows the gem alone; the rest of the scene is built
    // one mesh per frame behind it.
    if (!stage.complete()) stage.buildNext();

    if (this.shownTheme !== this.theme) {
      stage.setTheme(this.theme);
      this.shownTheme = this.theme;
    }

    if (this.fingers() === 0) this.coast(dt);

    // Boot: the camera swoops in while the pieces grow into place, staggered.
    const boot = easeOut(clamp(t / BOOT_S, 0, 1));
    const target = this.zoom * (1 + 1.1 * (1 - boot));
    this.distance += (target - this.distance) * Math.min(1, dt * 8);
    const azimuth = 0.6 + DRIFT * t + 0.9 * (1 - boot);
    stage.view(azimuth, ELEVATION + 0.06 * Math.sin(t * 0.21), this.distance);

    const gemY = GEM_Y + 0.08 * Math.sin(t * 1.3) - 0.5 * (1 - boot);
    const gemScale = GEM_SCALE * backOut(clamp(t / 1.1, 0, 1)) * this.pop(t);
    // Heading = the camera azimuth, so the tilt always tips towards the viewer.
    stage.place(GEM, azimuth, this.tilt, this.yaw, gemScale, gemY);
    // Each orbit precesses slowly (heading) at a fixed tilt while its moons
    // run along it (spin); they grow in after the gem, staggered.
    stage.place(ORBIT_A, 0.4 + 0.05 * t, 0.38, 0.55 * t, backOut(clamp((t - 0.3) / 1, 0, 1)), gemY);
    stage.place(ORBIT_B, 2.3 - 0.04 * t, -0.3, -0.38 * t, backOut(clamp((t - 0.45) / 1, 0, 1)), gemY);
  }

  // No finger down: the spin eases back to idle and the tilt springs back to
  // rest (slightly under-damped, so it settles softly).
  private coast(dt: number) {
    this.yawSpeed += (IDLE_SPIN - this.yawSpeed) * Math.min(1, dt * 1.1);
    this.yaw += this.yawSpeed * dt;
    this.tiltSpeed += ((REST_TILT - this.tilt) * 30 - this.tiltSpeed * 8) * dt;
    this.tilt += this.tiltSpeed * dt;
  }

  // The theme-change swell: 1, up to ~1.1, back to 1.
  private pop(t: number): number {
    const u = (t - this.popS) / POP_S;
    if (this.popS < 0 || u >= 1) return 1;

    return 1 + 0.14 * Math.sin(Math.PI * u) * (1 - u);
  }

  private fingers(): number {
    let count = 0;
    for (let slot = 0; slot < FINGERS; slot++) {
      if (this.ids[slot] !== 0) count++;
    }
    return count;
  }

  // Distance between the two tracked fingers.
  private span(): number {
    const dx = this.xs[0] - this.xs[1];
    const dy = this.ys[0] - this.ys[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // The slot holding pointer `id`; id 0 finds a free slot.
  private slotOf(id: number): number {
    for (let slot = 0; slot < FINGERS; slot++) {
      if (this.ids[slot] === id) return slot;
    }
    return -1;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeOut(u: number): number {
  const v = 1 - u;
  return 1 - v * v * v;
}

// Ease-out with a slight overshoot.
function backOut(u: number): number {
  const v = u - 1;
  return 1 + v * v * (2.7 * v + 1.7);
}

export const orbit = new Orbit();
