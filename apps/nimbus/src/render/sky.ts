import type { GeaEmbeddedImage } from "@geastack/core";
import { loadAssetImage } from "@geastack/core";
import { SCENE_COUNT, SCENE_DAY } from "../data/weather";
import { ART_TOP, H, SCENE_X, SCENE_Y, W } from "../layout";
import { easeInOut } from "../motion";
import {
  CLOUD_LIGHT,
  DUSK,
  GLOW,
  LAYER_COUNT,
  lookOf,
  MOON,
  RAIN_LAYER,
  SNOW_LAYER,
  STARS,
  SUN,
  TINT_COUNT,
} from "./looks";
import type { Painter } from "./painter";
import { NIGHT_BLUE } from "./palette";

const FADE_MS = 700; // scene cross-fade
const REVEAL_MS = 900; // the boot reveal from night blue
const LEVEL_RATE = 2.2; // layer levels ease at this rate per second

// Where the moon sits in the night illustration; the day sun shares the spot.
const ORB_X = SCENE_X + 99;
const ORB_Y = SCENE_Y + 23;
// The low sun's glow over the bay at golden hour.
const GLOW_X = SCENE_X + 200;
const GLOW_Y = SCENE_Y + 126;

const MOON_HALO = "rgb(248,236,200)";
const SUN_HALO = "rgb(248,248,216)";
const SUN_CORE = "rgb(248,252,232)";
const GLOW_COLOR = "rgb(248,224,136)";
const STAR_COLOR = "rgb(248,244,216)";
const FAR_RAIN = "rgb(176,208,216)";
const NEAR_RAIN = "rgb(216,236,240)";
const SNOW_COLOR = "rgb(248,252,248)";
const DUSK_COLOR = "rgb(8,16,40)";

const STAR_COUNT = 44;
const RAIN_COUNT = 110;
const SNOW_COUNT = 96;
const CLOUD_COUNT = 6;
const SHAPE_COUNT = 3;
const SHAPE_W = [96, 72, 128];
// Cloud rows over the original scene's sky; taller panels spread them over the extended sky too.
const CLOUD_ROWS = [-4, 24, 8, 42, -8, 30];
const CLOUD_SPREAD = SCENE_Y > 0 ? Math.floor(SCENE_Y / 3) : 0;
const SHOOT_EVERY_MS = 9000;
const SHOOT_MS = 800;

// A 256-step sine table: the particle loops never call Math.sin.
const SINE = new Float32Array(256);
for (let i = 0; i < 256; i++) SINE[i] = Math.sin((i * Math.PI) / 128);

const TINTS = ["light", "pale", "slate", "night", "peach"];
const SHAPES = ["a", "b", "c"];
const SCENES = ["clear-day", "sunset", "clear-night", "cloudy", "rain", "snow"];

// Division by a constant is written as a multiply: an integer over an integer
// literal would lower to integer division.
const INV_MODULUS = 0.0000330370015527; // 1 / 30269
const PER_MS = 0.001;
let seed = 7;

// Deterministic particle seeding (Wichmann-Hill: small enough to stay exact as an int).
function random(): number {
  seed = (seed * 171) % 30269;
  return seed * INV_MODULUS;
}

// The living backdrop: the scene illustration redrawn every frame, with the
// weather drawn over it: drifting paper-cut clouds, rain, snow, twinkling
// stars and a shooting star, the sun or moon breathing a soft glow. A new
// scene cross-fades in while every layer eases toward its new level.
class Sky {
  private readonly scenes: GeaEmbeddedImage[] = [];
  private readonly clouds: GeaEmbeddedImage[] = [];

  private from = SCENE_DAY;
  private to = SCENE_DAY;
  private fadeStart = 0;
  private revealStart = 0;
  private revealing = false;
  private last = 0;
  private time = 0; // seconds of animation

  private readonly levels = new Float32Array(LAYER_COUNT);
  private readonly targets = new Float32Array(LAYER_COUNT);
  private cloudTarget = 0;

  private readonly starX = new Float32Array(STAR_COUNT);
  private readonly starY = new Float32Array(STAR_COUNT);
  private readonly starPhase = new Float32Array(STAR_COUNT);
  private readonly starSpeed = new Float32Array(STAR_COUNT);
  private shootAt = 0;
  private shootX = 0;
  private shootY = 0;

  private readonly rainX = new Float32Array(RAIN_COUNT);
  private readonly rainY = new Float32Array(RAIN_COUNT);
  private readonly rainSpeed = new Float32Array(RAIN_COUNT);
  private readonly rainLength = new Float32Array(RAIN_COUNT);

  private readonly snowX = new Float32Array(SNOW_COUNT);
  private readonly snowY = new Float32Array(SNOW_COUNT);
  private readonly snowSpeed = new Float32Array(SNOW_COUNT);
  private readonly snowPhase = new Float32Array(SNOW_COUNT);

  private readonly cloudX = new Float32Array(CLOUD_COUNT);
  private readonly cloudY = new Float32Array(CLOUD_COUNT);
  private readonly cloudSpeed = new Float32Array(CLOUD_COUNT);
  private readonly cloudShape = new Int32Array(CLOUD_COUNT);
  private readonly cloudLevel = new Float32Array(CLOUD_COUNT);

  init() {
    this.seedParticles();
    this.last = Date.now();
  }

  /** Loads the illustrations and cloud sprites (once the display is up). */
  load() {
    for (let i = 0; i < SCENE_COUNT; i++) this.scenes.push(loadAssetImage(`art/${SCENES[i]}.png`));
    for (let t = 0; t < TINT_COUNT; t++) {
      for (let s = 0; s < SHAPE_COUNT; s++) this.clouds.push(loadAssetImage(`sky/${SHAPES[s]}-${TINTS[t]}.png`));
    }
  }

  /** Fades the scene in from night blue (the end of the boot). */
  reveal() {
    this.revealing = true;
    this.revealStart = Date.now();
  }

  /** Shows the weather of a scene: cross-fades the illustration and eases the layers. */
  show(scene: number, condition: number, night: boolean) {
    if (scene !== this.to) {
      // Retargeted mid-fade: continue from whichever scene dominates now.
      if (this.fadeProgress(Date.now()) >= 0.5) this.from = this.to;
      this.to = scene;
      this.fadeStart = Date.now();
    }

    this.cloudTarget = lookOf(scene, condition, night, this.targets);
  }

  /** Jumps straight to a scene (boot). */
  set(scene: number, condition: number, night: boolean) {
    this.from = scene;
    this.to = scene;
    this.cloudTarget = lookOf(scene, condition, night, this.targets);
    for (let i = 0; i < LAYER_COUNT; i++) this.levels[i] = this.targets[i];
    for (let i = 0; i < CLOUD_COUNT; i++) this.cloudLevel[i] = i < this.cloudTarget ? 1 : 0;
  }

  /** Advances the particles and eases the layers to `now`. */
  step(now: number) {
    const dt = Math.min(0.05, (now - this.last) * PER_MS);
    this.last = now;
    this.time += dt;
    const ease = Math.min(1, dt * LEVEL_RATE);
    for (let i = 0; i < LAYER_COUNT; i++) {
      this.levels[i] = this.levels[i] + (this.targets[i] - this.levels[i]) * ease;
    }

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const target = i < this.cloudTarget ? 1 : 0;
      this.cloudLevel[i] = this.cloudLevel[i] + (target - this.cloudLevel[i]) * ease;
      this.cloudX[i] = this.cloudX[i] + this.cloudSpeed[i] * dt;
      if (this.cloudX[i] > W) this.cloudX[i] = -SHAPE_W[this.cloudShape[i]];
    }

    if (this.levels[RAIN_LAYER] > 0.01) {
      for (let i = 0; i < RAIN_COUNT; i++) {
        const fall = this.rainSpeed[i] * dt;
        this.rainY[i] = this.rainY[i] + fall;
        this.rainX[i] = this.rainX[i] - fall * 0.2;
        if (this.rainY[i] > H) {
          this.rainY[i] = -this.rainLength[i] - random() * 40;
          this.rainX[i] = random() * (W + 60);
        }
      }
    }

    if (this.levels[SNOW_LAYER] > 0.01) {
      for (let i = 0; i < SNOW_COUNT; i++) {
        this.snowY[i] = this.snowY[i] + this.snowSpeed[i] * dt;
        if (this.snowY[i] > H) {
          this.snowY[i] = -4;
          this.snowX[i] = random() * W;
        }
      }
    }
  }

  paint(p: Painter, now: number) {
    // The illustration, cross-fading to the next one.
    p.image(this.scenes[this.from], SCENE_X, ART_TOP, 1);
    const fade = this.fadeProgress(now);
    if (fade < 1) p.image(this.scenes[this.to], SCENE_X, ART_TOP, easeInOut(fade));
    else this.from = this.to;

    const levels = this.levels;
    p.rect(0, 0, W, H, DUSK_COLOR, levels[DUSK] * 0.4);
    this.paintStars(p, now);
    this.paintOrbs(p);
    this.paintClouds(p);
    this.paintRain(p);
    this.paintSnow(p);

    // The boot reveal: night blue lifting off the scene.
    const reveal = this.revealing ? Math.min(1, (now - this.revealStart) / REVEAL_MS) : 0;
    if (reveal < 1) p.rect(0, 0, W, H, NIGHT_BLUE, 1 - easeInOut(reveal));
  }

  private fadeProgress(now: number): number {
    if (this.from === this.to) return 1;

    return Math.min(1, (now - this.fadeStart) / FADE_MS);
  }

  private seedParticles() {
    for (let i = 0; i < STAR_COUNT; i++) {
      this.starX[i] = 8 + random() * (W - 16);
      this.starY[i] = 4 + random() * (SCENE_Y + 104);
      this.starPhase[i] = random() * 256;
      this.starSpeed[i] = 40 + random() * 90;
    }

    for (let i = 0; i < RAIN_COUNT; i++) {
      const near = i % 2;
      this.rainX[i] = random() * (W + 60);
      this.rainY[i] = random() * H;
      this.rainSpeed[i] = near ? 520 + random() * 120 : 360 + random() * 80;
      this.rainLength[i] = near ? 12 + random() * 6 : 7 + random() * 4;
    }

    for (let i = 0; i < SNOW_COUNT; i++) {
      this.snowX[i] = random() * W;
      this.snowY[i] = random() * H;
      this.snowSpeed[i] = 14 + (i % 3) * 12 + random() * 10;
      this.snowPhase[i] = random() * 256;
    }

    for (let i = 0; i < CLOUD_COUNT; i++) {
      this.cloudShape[i] = i % SHAPE_COUNT;
      this.cloudX[i] = -60 + i * 92 + random() * 40;
      this.cloudY[i] = SCENE_Y + CLOUD_ROWS[i] - CLOUD_SPREAD * (i % 3);
      this.cloudSpeed[i] = 5 + this.cloudShape[i] * 2 + random() * 4;
    }

    this.shootAt = Date.now() + 3000;
  }

  // Stars twinkle on a sine of their own phase and speed; every few seconds
  // a shooting star crosses with a fading tail.
  private paintStars(p: Painter, now: number) {
    const stars = this.levels[STARS];
    if (stars < 0.02) return;

    const t = this.time;
    for (let i = 0; i < STAR_COUNT; i++) {
      const s = SINE[Math.floor(this.starPhase[i] + t * this.starSpeed[i]) & 255];
      const size = i % 5 === 0 ? 2 : 1;
      p.rect(this.starX[i], this.starY[i], size, size, STAR_COLOR, stars * (0.55 + 0.45 * s));
    }

    if (now > this.shootAt + SHOOT_MS) {
      this.shootAt = now + SHOOT_EVERY_MS + random() * 4000;
      this.shootX = W * 0.4 + random() * W * 0.5;
      this.shootY = 6 + random() * (SCENE_Y * 0.5 + 30);
      return;
    }

    if (now < this.shootAt) return;

    const progress = (now - this.shootAt) / SHOOT_MS;
    const headX = this.shootX - progress * 150;
    const headY = this.shootY + progress * 60;
    for (let k = 0; k < 8; k++) {
      p.rect(headX + k * 5, headY - k * 2, 3, 1, STAR_COLOR, stars * (1 - progress) * (1 - k * 0.125));
    }
  }

  // The moon's halo, the day sun and the golden-hour glow: stacked
  // translucent discs that breathe.
  private paintOrbs(p: Painter) {
    const t = this.time;
    const moon = this.levels[MOON];
    if (moon > 0.02) {
      const breathe = 2 * SINE[Math.floor(t * 20) & 255];
      p.circle(ORB_X, ORB_Y, 58 + breathe, MOON_HALO, moon * 0.05);
      p.circle(ORB_X, ORB_Y, 42 + breathe, MOON_HALO, moon * 0.07);
      p.circle(ORB_X, ORB_Y, 31, MOON_HALO, moon * 0.09);
    }

    const sun = this.levels[SUN];
    if (sun > 0.02) {
      const breathe = 3 * SINE[Math.floor(t * 24) & 255];
      p.circle(ORB_X, ORB_Y, 64 + breathe, SUN_HALO, sun * 0.1);
      p.circle(ORB_X, ORB_Y, 44 + breathe, SUN_HALO, sun * 0.14);
      p.circle(ORB_X, ORB_Y, 28 + breathe * 0.5, SUN_HALO, sun * 0.22);
      p.circle(ORB_X, ORB_Y, 15, SUN_CORE, sun);
    }

    const glow = this.levels[GLOW];
    if (glow > 0.02) {
      const breathe = 4 * SINE[Math.floor(t * 18) & 255];
      p.circle(GLOW_X, GLOW_Y, 96 + breathe, GLOW_COLOR, glow * 0.08);
      p.circle(GLOW_X, GLOW_Y, 64 + breathe, GLOW_COLOR, glow * 0.1);
      p.circle(GLOW_X, GLOW_Y, 38 + breathe * 0.5, GLOW_COLOR, glow * 0.14);
    }
  }

  // Each cloud slot drawn in every tint that is showing.
  private paintClouds(p: Painter) {
    for (let tint = 0; tint < TINT_COUNT; tint++) {
      const level = this.levels[CLOUD_LIGHT + tint];
      if (level < 0.02) continue;

      for (let i = 0; i < CLOUD_COUNT; i++) {
        const sprite = this.clouds[tint * SHAPE_COUNT + this.cloudShape[i]];
        p.image(sprite, this.cloudX[i], this.cloudY[i], level * this.cloudLevel[i] * 0.9);
      }
    }
  }

  // Far streaks dim and short, near ones brighter; each leans with the wind.
  private paintRain(p: Painter) {
    const rain = this.levels[RAIN_LAYER];
    if (rain < 0.02) return;

    const count = Math.round(RAIN_COUNT * rain);
    const far = rain * 0.3;
    for (let i = 0; i < count; i += 2) {
      const half = this.rainLength[i] * 0.5;
      p.rect(this.rainX[i], this.rainY[i], 1, half, FAR_RAIN, far);
      p.rect(this.rainX[i] - 1, this.rainY[i] + half, 1, half, FAR_RAIN, far);
    }

    const near = rain * 0.5;
    for (let i = 1; i < count; i += 2) {
      const third = this.rainLength[i] * 0.34;
      p.rect(this.rainX[i] + 1, this.rainY[i], 1, third, NEAR_RAIN, near);
      p.rect(this.rainX[i], this.rainY[i] + third, 1, third, NEAR_RAIN, near);
      p.rect(this.rainX[i] - 1, this.rainY[i] + third * 2, 1, third, NEAR_RAIN, near);
    }
  }

  // Snow in three depths, each flake swaying on its own phase.
  private paintSnow(p: Painter) {
    const snow = this.levels[SNOW_LAYER];
    if (snow < 0.02) return;

    const t = this.time;
    const count = Math.round(SNOW_COUNT * snow);
    for (let i = 0; i < count; i++) {
      const layer = i % 3;
      const sway = SINE[Math.floor(this.snowPhase[i] + t * (30 + layer * 10)) & 255] * (3 + layer * 3);
      const x = this.snowX[i] + sway;
      if (layer === 0) p.rect(x, this.snowY[i], 2, 2, SNOW_COLOR, snow * 0.6);
      else p.circle(x, this.snowY[i], layer === 1 ? 1.5 : 2.5, SNOW_COLOR, snow * (layer === 1 ? 0.8 : 0.95));
    }
  }
}

export const sky = new Sky();
