export const TAU = Math.PI * 2;
export const DEGREE = Math.PI / 180;

export function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

export function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

// Frame-rate independent exponential approach; `seconds` is the time constant.
export function approach(value: number, target: number, dt: number, seconds: number): number {
  return value + (target - value) * (1 - Math.exp(-dt / seconds));
}

export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

// Wraps an angle to -180..180 degrees.
export function wrapDegrees(degrees: number): number {
  const wrapped = (((degrees + 180) % 360) + 360) % 360;
  return wrapped - 180;
}
