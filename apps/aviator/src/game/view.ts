// Where the camera sits and how the air fogs, shared by the stage and the
// parts that bake their fog in.

export const CAMERA_Z = 200;
// The camera's rest height: level with the plane's.
export const CAMERA_Y = 100;

// Linear fog: clear at FOG_NEAR, all haze at FOG_FAR.
export const FOG_NEAR = 100;
export const FOG_FAR = 950;

// How much of a surface's own colour survives at `distance` (1 = clear).
export function clearness(distance: number): number {
  return Math.min(1, Math.max(0, (FOG_FAR - distance) / (FOG_FAR - FOG_NEAR)));
}
