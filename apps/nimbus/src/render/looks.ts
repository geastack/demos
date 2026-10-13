import {
  CLEAR,
  OVERCAST,
  PARTLY,
  RAIN,
  SCENE_CLOUDY,
  SCENE_DAY,
  SCENE_NIGHT,
  SCENE_RAIN,
  SCENE_SNOW,
  SCENE_SUNSET,
  SNOW,
} from "../data/weather";

// The animated layers over the illustration. Each has a level (0..1) that
// eases toward the look's target, so a change of weather blends layer by
// layer instead of switching.
export const SUN = 0;
export const MOON = 1;
export const STARS = 2;
export const GLOW = 3; // the low sun at golden hour
export const RAIN_LAYER = 4;
export const SNOW_LAYER = 5;
export const DUSK = 6; // a navy wash for rain and snow after dark
// Cloud tints, in the order of the sprite sets.
export const CLOUD_LIGHT = 7;
export const CLOUD_PALE = 8;
export const CLOUD_SLATE = 9;
export const CLOUD_NIGHT = 10;
export const CLOUD_PEACH = 11;
export const LAYER_COUNT = 12;
export const TINT_COUNT = 5;

/** Writes the target level of every layer for a scene into `targets`; returns how many clouds drift. */
export function lookOf(scene: number, condition: number, night: boolean, targets: Float32Array): number {
  for (let i = 0; i < LAYER_COUNT; i++) targets[i] = 0;

  if (scene === SCENE_DAY) {
    targets[SUN] = condition === CLEAR ? 1 : 0.75;
    targets[CLOUD_LIGHT] = 1;
    return condition === PARTLY ? 4 : 2;
  }

  if (scene === SCENE_SUNSET) {
    targets[GLOW] = 1;
    targets[CLOUD_PEACH] = 1;
    return condition === PARTLY ? 4 : 3;
  }

  if (scene === SCENE_NIGHT) {
    targets[STARS] = condition === CLEAR ? 1 : condition === OVERCAST ? 0.15 : 0.6;
    targets[MOON] = condition === OVERCAST ? 0.35 : 1;
    targets[CLOUD_NIGHT] = 1;
    if (condition === OVERCAST) return 6;

    return condition === PARTLY ? 3 : 1;
  }

  if (scene === SCENE_CLOUDY) {
    targets[CLOUD_PALE] = 1;
    return 6;
  }

  if (scene === SCENE_RAIN) {
    targets[RAIN_LAYER] = condition === RAIN ? 1 : 0;
    targets[CLOUD_SLATE] = 1;
    targets[DUSK] = night ? 1 : 0;
    return 6;
  }

  if (scene === SCENE_SNOW) {
    targets[SNOW_LAYER] = condition === SNOW ? 1 : 0;
    targets[CLOUD_PALE] = 1;
    targets[DUSK] = night ? 1 : 0;
    return 3;
  }

  return 0;
}
