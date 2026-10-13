import { BACK_SCALE } from "./screen";
import type { World } from "./world";

// One camera for every phase: low behind the boat while sailing, a wider
// establishing shot on the title, and at the end it drifts up to face the
// sky of lanterns. Distance, height, pitch and a heading offset ease toward
// the pose of the current mode; the position follows the boat directly.

export const POSE_TITLE = 0;
export const POSE_SAIL = 1;
export const POSE_SKY = 2;

// Distance behind the anchor, height, downward pitch (radians).
const TITLE_BACK = 6.4;
const TITLE_HEIGHT = 2.5;
const TITLE_PITCH = 0.1;
const SAIL_BACK = 4.6;
const SAIL_HEIGHT = 1.75;
const SAIL_PITCH = 0.12;
const SKY_BACK = 5.2;
const SKY_HEIGHT = 1.3;
const SKY_PITCH = -0.2;

// Boot: the camera starts looking up at the sky and settles on the river.
const BOOT_PITCH = -0.55;
const BOOT_HEIGHT = 4;

const LOOK_AHEAD = 7;
const FOLLOW_U = 0.7;
const TURN_RATE = 2.2;
const EASE_RATE = 1.6;

export class RiverCamera {
  x = 0;
  y = BOOT_HEIGHT;
  z = 0;
  yaw = 0;
  pitch = BOOT_PITCH;

  private back = TITLE_BACK;
  private height = BOOT_HEIGHT;

  boot() {
    this.pitch = BOOT_PITCH;
    this.height = BOOT_HEIGHT;
  }

  follow(world: World, pose: number, dt: number) {
    const river = world.river;
    river.sample(world.s + LOOK_AHEAD);
    // At the end the view turns toward the middle of the sky, where the
    // chain of lanterns hangs.
    const wantYaw = pose === POSE_SKY ? river.sHeading * 0.25 : river.sHeading;
    this.yaw += (wantYaw - this.yaw) * Math.min(1, dt * TURN_RATE);

    const ease = Math.min(1, dt * EASE_RATE);
    const back = pose === POSE_TITLE ? TITLE_BACK : pose === POSE_SAIL ? SAIL_BACK : SKY_BACK;
    const height = pose === POSE_TITLE ? TITLE_HEIGHT : pose === POSE_SAIL ? SAIL_HEIGHT : SKY_HEIGHT;
    const pitch = pose === POSE_TITLE ? TITLE_PITCH : pose === POSE_SAIL ? SAIL_PITCH : SKY_PITCH;
    this.back += (back * BACK_SCALE - this.back) * ease;
    this.height += (height - this.height) * ease;
    this.pitch += (pitch - this.pitch) * ease * 0.8;

    world.place(world.s, world.u * FOLLOW_U);
    this.x = world.catchX - Math.sin(this.yaw) * this.back;
    this.z = world.catchZ + Math.cos(this.yaw) * this.back;
    this.y = this.height;
  }
}
