// Easing and timing helpers for the hand-drawn motion.

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** Decelerating (cubic out). */
export function easeOut(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

export function easeInOut(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 2 * c * c : 1 - (2 - 2 * c) * (2 - 2 * c) * 0.5;
}

/** Progress (0..1) of an animation `delay` ms after `start` lasting `duration` ms. */
export function progress(now: number, start: number, delay: number, duration: number): number {
  return clamp01((now - start - delay) / duration);
}
