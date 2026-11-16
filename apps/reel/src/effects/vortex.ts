import { buildRamp, HALF_H, HALF_W, HEIGHT, hash, PIXELS, SINE_Q14, sinTurns, upscaleRows, WIDTH } from "../lib/frame";
import { touch } from "../lib/touch";

// Thousands of particles spiralling towards the camera, drawn as short
// perspective streaks into a glow buffer that fades a little every frame.
// The glow is half resolution, upscaled like fire and metaballs: a quarter of
// the cells to fade and expand, and half the particles cover the same area.
//
// Particle state is a function of time (scrubbing stays exact), all in
// fixed point: turns and depth phases as 16-bit fractions, positions in
// 1/16 px, time in 1/4096 s.

// Particles per pixel were tuned at 3072 on 130560 pixels.
const PARTICLES = Math.round((3072 * PIXELS) / 130560 / 2);
const NEAR = 0.12;
const FAR = 4;
const FOCAL = (130 * Math.max(WIDTH, HEIGHT)) / 480;
const TRAIL = 0.035; // seconds of motion each streak covers
const MAX_STREAK = 10; // glow cells (two px each)
const THICK_PHASE = 52428; // 0.8: nearer particles draw two rows
const TWIST = 22938; // 0.35 of a turn per unit of depth phase, Q16
// Two spare rows below the field take the thick streaks' second row; the size is a whole number of words.
const GLOW_BYTES = (HALF_W * (HALF_H + 2) + 3) & ~3;
const GLOW_USED_WORDS = GLOW_BYTES >> 2;

// Deep indigo through electric violet and lavender to white.
const RAMP = [0, 8, 6, 26, 0.04, 8, 6, 26, 0.3, 56, 28, 150, 0.62, 164, 88, 255, 0.85, 240, 180, 255, 1, 255, 255, 255];

export class Vortex {
  private readonly angle = new Uint16Array(PARTICLES); // start turn, Q16
  private readonly radius = new Uint16Array(PARTICLES); // from the axis, Q8
  private readonly phase = new Uint16Array(PARTICLES); // start depth phase, Q16
  private readonly speed = new Uint16Array(PARTICLES); // depth phase per second, Q16
  private readonly orbit = new Uint16Array(PARTICLES); // turns per second, Q16
  private readonly scale = new Uint16Array(1024); // px per unit at a depth phase, Q4
  private readonly reciprocal = new Uint16Array(MAX_STREAK + 1); // 4096 / steps
  private readonly glowBuffer = new ArrayBuffer(GLOW_BYTES);
  private readonly glow = new Uint8Array(this.glowBuffer); // intensity per pixel
  private readonly glowWords = new Uint32Array(this.glowBuffer);
  private readonly palette = new Uint16Array(256);
  private centerX = WIDTH / 2;
  private centerY = HEIGHT / 2;

  bake(): boolean {
    for (let i = 0; i < PARTICLES; i++) {
      const seed = i * 4;
      const radius = 0.25 + ((hash(seed + 1) & 0xffff) / 65535) * 1.1;
      this.angle[i] = hash(seed) & 0xffff;
      this.radius[i] = Math.round(radius * 256);
      this.phase[i] = hash(seed + 2) & 0xffff;
      this.speed[i] = Math.round((0.12 + ((hash(seed + 3) & 0xffff) / 65535) * 0.1) * 65536);
      // Inner particles orbit faster.
      this.orbit[i] = Math.round((0.05 + 0.06 / radius) * 65536);
    }
    for (let i = 0; i < 1024; i++) {
      const z = FAR - ((i + 0.5) / 1024) * (FAR - NEAR);
      this.scale[i] = Math.round((FOCAL / z) * 16);
    }
    for (let steps = 1; steps <= MAX_STREAK; steps++) this.reciprocal[steps] = Math.round(4096 / steps);
    buildRamp(this.palette, 0, 256, RAMP);
    return true;
  }

  render(words: Uint32Array, t: number) {
    this.prepare(t);
    this.rows(words, 0, HEIGHT);
  }

  // The frame's state at `t`; `rows` then draws any band of it.
  prepare(t: number) {
    let targetX = WIDTH / 2 + sinTurns(t * 0.05) * WIDTH * 0.146;
    let targetY = HEIGHT / 2 + sinTurns(t * 0.08) * HEIGHT * 0.132;
    if (touch.down) {
      targetX = touch.x;
      targetY = touch.y;
    }
    this.centerX += (targetX - this.centerX) * 0.06;
    this.centerY += (targetY - this.centerY) * 0.06;

    this.fade();
    this.streaks((this.centerX * 16) | 0, (this.centerY * 16) | 0, (t * 4096) | 0, ((t - TRAIL) * 4096) | 0);
  }

  rows(words: Uint32Array, first: number, count: number) {
    upscaleRows(this.glow, this.palette, words, first, count);
  }

  // Trails: every byte loses an eighth of its intensity (values under 8
  // stay; the palette keeps them at the background colour).
  private fade() {
    const glow = this.glowWords;
    const used: i32 = GLOW_USED_WORDS | 0;
    for (let i: i32 = 0; i < used; i++) {
      const w: i32 = glow[i];
      glow[i] = w - ((w >> 3) & 0x1f1f1f1f);
    }
  }

  // Each particle's streak from where it was TRAIL seconds ago to where it
  // is now; `cx`, `cy` in 1/16 px, times in 1/4096 s. Positions stay in
  // 1/16 px; a glow cell is 2 px, so they land at `>> 5`.
  //
  // Products may wrap: every one is shifted and masked down to bits that
  // wrapping 32-bit arithmetic keeps exactly.
  private streaks(cx: i32, cy: i32, now: i32, before: i32) {
    const angle = this.angle;
    const radius = this.radius;
    const phase = this.phase;
    const speed = this.speed;
    const orbit = this.orbit;
    const scale = this.scale;
    const reciprocal = this.reciprocal;
    const sine = SINE_Q14;
    const glow = this.glow;
    const width: i32 = HALF_W | 0;
    const height: i32 = HALF_H | 0;
    const particles: i32 = PARTICLES | 0;

    for (let i: i32 = 0; i < particles; i++) {
      const a0: i32 = angle[i];
      const r: i32 = radius[i];
      const p0: i32 = phase[i];
      const dp: i32 = speed[i];
      const da: i32 = orbit[i];

      // Now: depth phase (0 far .. 1 near), turn, screen position.
      const pn: i32 = (p0 + ((now * dp) >> 12)) & 0xffff;
      const tn: i32 = (a0 + ((now * da) >> 12) + ((pn * TWIST) >> 16)) & 0xffff;
      const sn: i32 = scale[(pn >> 6) & 1023];
      const xn: i32 = cx + ((((sine[((tn >> 6) + 256) & 1023] * r) >> 10) * sn) >> 12);
      const yn: i32 = cy + ((((sine[(tn >> 6) & 1023] * r) >> 10) * sn) >> 12);

      // Before: a particle that just wrapped from near to far has no trail.
      const pb: i32 = (p0 + ((before * dp) >> 12)) & 0xffff;
      if (pb > pn) continue;

      const tb: i32 = (a0 + ((before * da) >> 12) + ((pb * TWIST) >> 16)) & 0xffff;
      const sb: i32 = scale[(pb >> 6) & 1023];
      const xb: i32 = cx + ((((sine[((tb >> 6) + 256) & 1023] * r) >> 10) * sb) >> 12);
      const yb: i32 = cy + ((((sine[(tb >> 6) & 1023] * r) >> 10) * sb) >> 12);

      const nearness: i32 = (((pn >> 1) * (pn >> 1)) >> 14) * 150 >> 16; // depth phase squared, 0..150
      const value: i32 = 24 + nearness;
      const thick = pn > THICK_PHASE;

      const dx: i32 = xn - xb;
      const dy: i32 = yn - yb;
      const ax: i32 = dx < 0 ? -dx : dx;
      const ay: i32 = dy < 0 ? -dy : dy;
      const span: i32 = ((ax > ay ? ax : ay) >> 5) + 1;
      const steps: i32 = span < MAX_STREAK ? span : MAX_STREAK;
      const sx: i32 = (dx * reciprocal[steps & 31]) >> 12;
      const sy: i32 = (dy * reciprocal[steps & 31]) >> 12;
      for (let s: i32 = 0; s <= steps; s++) {
        const x: i32 = (xb + sx * s) >> 5;
        const y: i32 = (yb + sy * s) >> 5;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        // A thick streak's second row may land in the spare row past the
        // frame, which is never shown.
        const at: i32 = y * width + x;
        const lit: i32 = glow[at] + value;
        glow[at] = lit < 255 ? lit : 255;
        if (thick) {
          const below: i32 = glow[at + width] + value;
          glow[at + width] = below < 255 ? below : 255;
        }
      }
    }
  }
}
