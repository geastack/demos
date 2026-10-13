import type { World } from "./world";

// One camera path for every phase: the pose eases each frame toward the pose
// of the current mode. At boot (and on returning to the title) it starts high
// above the grid, looking down, so the approach is the swoop.
const SWOOP_Y = 30;
const SWOOP_Z = 26;
const SWOOP_PITCH = 1.0;

// Attract mode: low and looking slightly up, horizon at y ≈ 160, so the sun
// and ridges sit behind the wordmark with the road leading to them.
const TITLE_Y = 1.7;
const TITLE_Z = 5.6;
const TITLE_PITCH = -0.09;

// The run: higher, pitched down, horizon at y ≈ 100.
const CHASE_Y = 2.3;
const CHASE_Z = 5.2;
const CHASE_PITCH = 0.14;

// How much of the craft's sideways and vertical motion the camera follows.
const FOLLOW_X = 0.8;
const FOLLOW_Y = 0.4;
const FOLLOW_RATE = 6;
// Share of the remaining distance to the target pose covered per second, and
// at least per frame, so the camera arrives even if frames stall.
const EASE_RATE = 2.4;
const MIN_EASE = 0.03;

// The pose to draw with: position and downward pitch in radians.
export class ChaseCamera {
  x = 0;
  y = SWOOP_Y;
  z = SWOOP_Z;
  pitch = SWOOP_PITCH;

  swoop() {
    this.y = SWOOP_Y;
    this.z = SWOOP_Z;
    this.pitch = SWOOP_PITCH;
  }

  follow(world: World, dt: number, attract: boolean) {
    this.x += (world.shipX * FOLLOW_X - this.x) * Math.min(1, dt * FOLLOW_RATE);

    const ease = Math.max(MIN_EASE, Math.min(1, dt * EASE_RATE));
    const targetY = attract ? TITLE_Y : CHASE_Y + world.shipY * FOLLOW_Y;
    this.y += (targetY - this.y) * ease;
    this.z += ((attract ? TITLE_Z : CHASE_Z) - this.z) * ease;
    this.pitch += ((attract ? TITLE_PITCH : CHASE_PITCH) - this.pitch) * ease;
  }
}
