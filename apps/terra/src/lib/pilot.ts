import type { Controls } from "./controls";
import { PANEL_H } from "./layout";
import { approach, clamp, mix, TAU } from "./motion";

const MAP_SIZE = 512;
const CRUISE_SPEED = 34; // texels per second
const HOLD_BOOST = 2.2;
const MAX_TURN_RATE = 0.9; // rad/s at full stick
const MAX_CLIMB_RATE = 50; // height units per second at full stick
const AUTO_CLIMB = 46;
const AUTO_DESCENT = 24;
const MAX_BANK = 0.5; // rad
const BANK_PER_TURN = 0.6; // rad of bank per rad/s of turn
const CLEARANCE = 30; // autopilot height over the terrain ahead
const CLEARANCE_SWELL = 14;
const LOOK_AHEAD_SECONDS = 2.5;
const MIN_CLEARANCE = 6;
const CEILING = 300;
const HORIZON_ROW = Math.round(PANEL_H * 0.382); // level-flight horizon, px from the top (104 of 272)
const PITCH_SCALE = PANEL_H / 272; // the pitch constants were tuned on 272 rows
const PITCH_PER_CLIMB = 0.8 * PITCH_SCALE; // px of horizon shift per unit/s of climb
const MAX_PITCH = 48 * PITCH_SCALE;
const RETURN_DELAY_MS = 3000; // hands-off time before the autopilot takes over again

function wrapMap(value: number): number {
  return ((value % MAP_SIZE) + MAP_SIZE) % MAP_SIZE;
}

// The camera: an autopilot wandering over the terrain, blended with the
// touch stick while a finger is down and for a few seconds after.
export class Pilot {
  x = 0;
  y = 0;
  heading = 0;
  altitude = 0;
  bank = 0;
  pitch = 0;
  speed = CRUISE_SPEED;

  private manual = 0; // 0 autopilot .. 1 hands on
  private time = 0;

  // Starts low in a valley: the autopilot's climb is the boot moment.
  spawn(x: number, y: number, heading: number) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.altitude = terraGround(x, y) + MIN_CLEARANCE;
    this.bank = 0;
    this.pitch = 0;
  }

  horizon(): number {
    return HORIZON_ROW + this.pitch;
  }

  fly(dt: number, now: number, controls: Controls) {
    this.time += dt;
    const engaged = controls.active || now - controls.releasedAt < RETURN_DELAY_MS;
    this.manual = approach(this.manual, engaged ? 1 : 0, dt, engaged ? 0.12 : 1.2);
    if (!engaged && this.manual < 0.01) controls.resetThrottle();

    this.steer(dt, controls);
    this.climb(dt, controls);
    this.advance(dt, now, controls);
  }

  private steer(dt: number, controls: Controls) {
    const t = this.time;
    const wander = 0.16 * Math.sin(t * 0.11) + 0.1 * Math.sin(t * 0.047 + 1.3);
    const turn = mix(wander, controls.stickX * MAX_TURN_RATE, this.manual);
    this.heading = (((this.heading + turn * dt) % TAU) + TAU) % TAU;
    this.bank = approach(this.bank, clamp(turn * BANK_PER_TURN, -MAX_BANK, MAX_BANK), dt, 0.3);
  }

  // Climbing lowers the horizon (nose up); the ground is a hard floor.
  private climb(dt: number, controls: Controls) {
    const ground = terraGround(this.x, this.y);
    const ahead = terraGroundAhead(this.x, this.y, this.heading, 40 + this.speed * LOOK_AHEAD_SECONDS);
    const cruise = Math.max(ahead, ground) + CLEARANCE + CLEARANCE_SWELL * Math.sin(this.time * 0.07);
    const auto = clamp((cruise - this.altitude) * 1.1, -AUTO_DESCENT, AUTO_CLIMB);
    const rate = mix(auto, -controls.stickY * MAX_CLIMB_RATE, this.manual);
    this.altitude = clamp(this.altitude + rate * dt, ground + MIN_CLEARANCE, CEILING);
    this.pitch = approach(this.pitch, clamp(rate * PITCH_PER_CLIMB, -MAX_PITCH, MAX_PITCH), dt, 0.35);
  }

  private advance(dt: number, now: number, controls: Controls) {
    const boost = controls.holding(now) ? HOLD_BOOST : 1;
    const target = CRUISE_SPEED * mix(1, controls.throttle * boost, this.manual);
    this.speed = approach(this.speed, target, dt, 0.6);
    this.x = wrapMap(this.x + Math.sin(this.heading) * this.speed * dt);
    this.y = wrapMap(this.y - Math.cos(this.heading) * this.speed * dt);
  }
}
