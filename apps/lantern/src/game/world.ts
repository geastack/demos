import { clamp, fastSin } from "./geometry";
import { HALF_WIDTH, River, ROWS } from "./river";
import { waveAt } from "./terrain";

// The journey itself: the boat on the river, the props that stream past
// (lanterns to catch, hazards to avoid, scenery on the banks), lanterns
// flying up to the sky or falling back, and ripples on the water. Props
// live in river coordinates: s along the river, u across it (+ right).

export const KIND_NONE = 0;
export const KIND_LANTERN = 1;
export const KIND_ROCK = 2;
export const KIND_LOG = 3;
export const KIND_WHIRL = 4;
export const KIND_REEDS = 5;
export const KIND_STONE = 6;
export const KIND_TORO = 7;
export const KIND_TORII = 8;
export const KIND_BRIDGE = 9;

// Bits of step()'s result.
export const EVENT_CATCH = 1;
export const EVENT_HIT = 2;
export const EVENT_SUNK = 4;
export const EVENT_RAPIDS = 8;

export const PROPS = 72;
export const FLIGHTS = 8;
export const RIPPLES = 10;
export const HULL = 3;
export const MAX_SKY = 72;

const BOAT_REACH = HALF_WIDTH - 0.75;
const DESPAWN_BEHIND = 9;
const SPAWN_MARGIN = 2;

const START_SPEED = 8;
const MAX_SPEED = 21;
const SPEED_GAIN = 0.011;
const TITLE_SPEED = 6.5;
const RAPIDS_BOOST = 0.45;
const STEER_RATE = 7;
const STOP_RATE = 0.9;

const HIT_GRACE = 1.8;
const HIT_SPIN = 13;
const HIT_KICK = 1.5;
const HIT_DROP = 3;
const WHIRL_PULL = 1.8;
const WHIRL_REACH = 3.4;

export const FLIGHT_RISE_S = 2.2;
export const FLIGHT_FALL_S = 1.4;
const RIPPLE_S = 1.6;
const HAZARD_RIPPLE_S = 1.3;
const WAKE_S = 0.8;
// A waterlogged boat settles this low.
const SINK_DEPTH = 0.16;

export class Prop {
  kind = KIND_NONE;
  s = 0;
  u = 0;
  size = 1;
  yaw = 0;
  phase = 0;
  // Where it sits in the world, and the river's heading and rapids there.
  x = 0;
  z = 0;
  heading = 0;
  rapids = 0;
}

// A lantern on its way to its sky slot (rising) or back down to the water.
export class Flight {
  active = false;
  rising = true;
  t = 0;
  slot = 0;
  // The water end of the trip, in world coordinates.
  x = 0;
  y = 0;
  z = 0;
}

export class Ripple {
  active = false;
  t = 0;
  duration = 1;
  x = 0;
  z = 0;
  radius = 1;
  strength = 1;
}

export class World {
  readonly river = new River();
  readonly props: Prop[] = [];
  readonly flights: Flight[] = [];
  readonly ripples: Ripple[] = [];

  // The boat, in river coordinates, and its pose.
  s = 0;
  u = 0;
  boatX = 0;
  boatY = 0;
  boatZ = 0;
  heading = 0;
  roll = 0;
  pitch = 0;
  spin = 0;
  speed = START_SPEED;
  hull = HULL;
  sinking = false;
  sinkDepth = 0;

  // Lanterns caught and kept, and how many have reached the sky.
  lanterns = 0;
  skyCount = 0;
  // Bumped whenever a prop appears or goes (the stage re-lays the still ones).
  layout = 0;
  startS = 0;
  clock = 0;
  rapids = 0;
  // Where each flight's water end is sampled from (a sample of the river).
  catchX = 0;
  catchZ = 0;

  private target = 0;
  private spinSpeed = 0;
  private grace = 0;
  private stopping = false;
  private attract = true;
  private lastRapids = 0;
  private nextLantern = 0;
  private nextHazard = 0;
  private nextReeds = 0;
  private nextStone = 0;
  private nextToro = 0;
  private nextTorii = 0;
  private nextBridge = 0;
  private reedsSide = 1;
  private hazardRipple = 0;
  private wake = 0;
  private hazardCursor = 0;

  constructor() {
    for (let i = 0; i < PROPS; i++) this.props.push(new Prop());
    for (let i = 0; i < FLIGHTS; i++) this.flights.push(new Flight());
    for (let i = 0; i < RIPPLES; i++) this.ripples.push(new Ripple());
    this.river.reset(0);
    this.restartCursors();
  }

  // A new run from here: empty sky, full hull; the river keeps flowing.
  begin() {
    this.attract = false;
    this.stopping = false;
    this.sinking = false;
    this.sinkDepth = 0;
    this.hull = HULL;
    this.lanterns = 0;
    this.skyCount = 0;
    this.startS = this.s;
    this.speed = START_SPEED;
    this.grace = 0;
    this.spinSpeed = 0;
    for (let i = 0; i < FLIGHTS; i++) this.flights[i].active = false;
    for (let i = 0; i < PROPS; i++) {
      const prop = this.props[i];
      if (isHazard(prop.kind) && prop.s < this.s + 40) prop.kind = KIND_NONE;
    }
    this.layout++;
    this.nextHazard = Math.max(this.nextHazard, this.s + 70);
  }

  // Back to attract mode (the title): the boat drifts on autopilot.
  toTitle() {
    this.attract = true;
    this.stopping = false;
    this.sinking = false;
    this.sinkDepth = 0;
    this.lanterns = 0;
    this.skyCount = 0;
    this.speed = TITLE_SPEED;
    for (let i = 0; i < FLIGHTS; i++) this.flights[i].active = false;
    for (let i = 0; i < PROPS; i++) {
      if (isHazard(this.props[i].kind)) this.props[i].kind = KIND_NONE;
    }
    this.layout++;
  }

  // The run is over: the boat drifts to a stop.
  stop() {
    this.stopping = true;
  }

  steer(du: number) {
    if (this.attract || this.stopping) return;

    this.target = clamp(this.target + du, -BOAT_REACH, BOAT_REACH);
  }

  distance(): number {
    return this.s - this.startS;
  }

  // Advances by dt seconds; returns EVENT_* bits.
  step(dt: number): number {
    this.clock += dt;
    this.updateSpeed(dt);
    this.s += this.speed * dt;
    const river = this.river;
    river.advanceTo(this.s);
    river.sample(this.s);
    this.rapids = river.sRapids;

    let events = 0;
    if (this.rapids > 0.5 && this.lastRapids <= 0.5 && !this.attract) events |= EVENT_RAPIDS;
    this.lastRapids = this.rapids;

    this.spawn();
    if (this.attract) this.autopilot();
    this.moveBoat(dt);
    events |= this.collide(dt);
    this.advanceFlights(dt);
    this.advanceRipples(dt);
    this.makeRipples(dt);
    this.despawn();
    return events;
  }

  // World position of river point (s, u) into catchX / catchZ.
  place(s: number, u: number) {
    const river = this.river;
    river.sample(s);
    this.catchX = river.sx + Math.cos(river.sHeading) * u;
    this.catchZ = river.sz + Math.sin(river.sHeading) * u;
  }

  private restartCursors() {
    this.nextLantern = this.s + 24;
    this.nextHazard = this.s + 70;
    this.nextReeds = this.s;
    this.nextStone = this.s + 6;
    this.nextToro = this.s + 20;
    this.nextTorii = this.s + 60;
    this.nextBridge = this.s + 190;
  }

  private updateSpeed(dt: number) {
    if (this.stopping) {
      this.speed = Math.max(0, this.speed - this.speed * STOP_RATE * dt - 0.4 * dt);
      return;
    }

    const cruise = this.attract ? TITLE_SPEED : Math.min(MAX_SPEED, START_SPEED + this.distance() * SPEED_GAIN);
    const wanted = cruise * (1 + RAPIDS_BOOST * this.rapids);
    this.speed += (wanted - this.speed) * Math.min(1, dt * 1.5);
  }

  private moveBoat(dt: number) {
    const before = this.u;
    this.u += (this.target - this.u) * Math.min(1, dt * STEER_RATE);
    const lateral = (this.u - before) / Math.max(dt, 0.001);

    const river = this.river;
    river.sample(this.s);
    const cos = Math.cos(river.sHeading);
    const sin = Math.sin(river.sHeading);
    this.boatX = river.sx + cos * this.u;
    this.boatZ = river.sz + sin * this.u;

    const t = this.clock;
    const rapids = this.rapids;
    if (this.sinking) this.sinkDepth = Math.min(SINK_DEPTH, this.sinkDepth + dt * 0.1);
    this.boatY = waveAt(this.s, this.u, t, rapids) + 0.02 - this.sinkDepth;
    const ahead = waveAt(this.s - 0.7, this.u, t, rapids);
    const behind = waveAt(this.s + 0.7, this.u, t, rapids);
    const left = waveAt(this.s, this.u - 0.4, t, rapids);
    const right = waveAt(this.s, this.u + 0.4, t, rapids);
    this.pitch = (ahead - behind) * 0.7 + 0.02 * fastSin(t * 1.3);
    this.roll = (left - right) * 1.1 - lateral * 0.05 + 0.035 * fastSin(t * 1.7 + 1);

    this.spin += this.spinSpeed * dt;
    this.spinSpeed *= Math.max(0, 1 - dt * 1.6);
    if (Math.abs(this.spinSpeed) < 0.3) this.spin *= Math.max(0, 1 - dt * 3);
    this.heading = river.sHeading + lateral * 0.04 + this.spin;
    this.grace = Math.max(0, this.grace - dt);
  }

  private collide(dt: number): number {
    let events = 0;
    for (let i = 0; i < PROPS; i++) {
      const prop = this.props[i];
      const kind = prop.kind;
      if (kind === KIND_NONE || kind >= KIND_REEDS) continue;

      const ds = prop.s - this.s;
      const du = prop.u - this.u;
      if (ds > 6 || ds < -3) continue;

      if (kind === KIND_LANTERN) {
        if (Math.abs(ds) < 0.9 && Math.abs(du) < 0.8) {
          this.catchLantern(prop);
          events |= EVENT_CATCH;
        }
        continue;
      }

      if (kind === KIND_WHIRL) {
        const d = Math.sqrt(ds * ds + du * du);
        if (d < WHIRL_REACH && !this.stopping)
          this.target += (du > 0 ? 1 : -1) * WHIRL_PULL * (1 - d / WHIRL_REACH) * dt;
        if (d < 1.1) events |= this.hit(prop);
        continue;
      }

      const reachS = kind === KIND_LOG ? 0.45 : 0.55 * prop.size + 0.5;
      const reachU = kind === KIND_LOG ? prop.size / 2 + 0.25 : 0.7 * prop.size + 0.28;
      if (Math.abs(ds) < reachS && Math.abs(du) < reachU) events |= this.hit(prop);
    }
    this.target = clamp(this.target, -BOAT_REACH, BOAT_REACH);
    return events;
  }

  private catchLantern(prop: Prop) {
    prop.kind = KIND_NONE;
    this.addRipple(prop.x, prop.z, 1.6, 0.9, RIPPLE_S);
    if (this.lanterns >= MAX_SKY) return;

    const free = this.freeFlight();
    this.lanterns++;
    if (free < 0) {
      this.skyCount = this.lanterns;
      return;
    }

    const flight = this.flights[free];
    flight.active = true;
    flight.rising = true;
    flight.t = 0;
    flight.slot = this.lanterns - 1;
    flight.x = prop.x;
    flight.y = 0.3;
    flight.z = prop.z;
  }

  private hit(prop: Prop): number {
    if (this.grace > 0 || this.attract || this.stopping) return 0;

    this.grace = HIT_GRACE;
    this.spinSpeed = prop.u > this.u ? -HIT_SPIN : HIT_SPIN;
    this.target = clamp(this.u + (this.u >= prop.u ? HIT_KICK : -HIT_KICK), -BOAT_REACH, BOAT_REACH);
    this.speed *= 0.5;
    this.addRipple(this.boatX, this.boatZ, 2.4, 1, RIPPLE_S);
    this.dropLanterns();
    this.hull--;
    if (this.hull > 0) return EVENT_HIT;

    this.sinking = true;
    return EVENT_HIT | EVENT_SUNK;
  }

  // The newest lanterns fall back to the water beside the boat.
  private dropLanterns() {
    const drop = Math.min(HIT_DROP, this.lanterns);
    for (let k = 0; k < drop; k++) {
      const slot = this.lanterns - 1;
      this.lanterns--;
      const rising = this.risingTo(slot);
      const index = rising >= 0 ? rising : this.freeFlight();
      this.skyCount = Math.min(this.skyCount, slot);
      if (index < 0) continue;

      const flight = this.flights[index];
      // A lantern still on its way up turns around where it is.
      flight.t = rising >= 0 ? FLIGHT_FALL_S * (1 - Math.min(1, flight.t / FLIGHT_RISE_S)) : 0;
      this.place(this.s + 1.5 + k, this.u + (k - 1) * 1.1);
      flight.active = true;
      flight.rising = false;
      flight.slot = slot;
      flight.x = this.catchX;
      flight.y = 0.2;
      flight.z = this.catchZ;
    }
  }

  private advanceFlights(dt: number) {
    for (let i = 0; i < FLIGHTS; i++) {
      const flight = this.flights[i];
      if (!flight.active) continue;

      flight.t += dt;
      if (flight.rising && flight.t >= FLIGHT_RISE_S) {
        flight.active = false;
        this.skyCount = Math.max(this.skyCount, flight.slot + 1);
        continue;
      }
      if (!flight.rising && flight.t >= FLIGHT_FALL_S) {
        flight.active = false;
        this.addRipple(flight.x, flight.z, 1.2, 0.8, RIPPLE_S);
      }
    }
    this.skyCount = Math.min(this.skyCount, this.lanterns);
  }

  // The flight rising to `slot`, or -1.
  private risingTo(slot: number): number {
    for (let i = 0; i < FLIGHTS; i++) {
      const flight = this.flights[i];
      if (flight.active && flight.rising && flight.slot === slot) return i;
    }
    return -1;
  }

  // An idle flight, or -1.
  private freeFlight(): number {
    for (let i = 0; i < FLIGHTS; i++) {
      if (!this.flights[i].active) return i;
    }
    return -1;
  }

  private addRipple(x: number, z: number, radius: number, strength: number, duration: number) {
    let pick = this.ripples[0];
    for (let i = 0; i < RIPPLES; i++) {
      const ripple = this.ripples[i];
      if (!ripple.active) {
        pick = ripple;
        break;
      }
      if (ripple.t / ripple.duration > pick.t / pick.duration) pick = ripple;
    }
    pick.active = true;
    pick.t = 0;
    pick.duration = duration;
    pick.x = x;
    pick.z = z;
    pick.radius = radius;
    pick.strength = strength;
  }

  private advanceRipples(dt: number) {
    for (let i = 0; i < RIPPLES; i++) {
      const ripple = this.ripples[i];
      if (!ripple.active) continue;

      ripple.t += dt;
      if (ripple.t >= ripple.duration) ripple.active = false;
    }
  }

  // Rings where things touch the water: behind the boat, and around the
  // hazards ahead in turn.
  private makeRipples(dt: number) {
    this.wake -= dt;
    if (this.wake <= 0 && this.speed > 1) {
      this.wake = WAKE_S;
      this.place(this.s + 0.9, this.u);
      this.addRipple(this.catchX, this.catchZ, 0.9, 0.45, RIPPLE_S);
    }

    this.hazardRipple -= dt;
    if (this.hazardRipple > 0) return;

    this.hazardRipple = HAZARD_RIPPLE_S / 3;
    for (let n = 0; n < PROPS; n++) {
      this.hazardCursor = (this.hazardCursor + 1) % PROPS;
      const prop = this.props[this.hazardCursor];
      if (prop.kind !== KIND_ROCK && prop.kind !== KIND_LOG && prop.kind !== KIND_LANTERN) continue;
      if (prop.s < this.s || prop.s > this.s + 45) continue;

      const radius = prop.kind === KIND_LOG ? prop.size * 0.7 : prop.kind === KIND_ROCK ? prop.size * 1.3 : 0.9;
      this.addRipple(prop.x, prop.z, radius, prop.kind === KIND_LANTERN ? 0.5 : 0.7, RIPPLE_S);
      return;
    }
  }

  // Steers toward the nearest lantern ahead, away from hazards.
  private autopilot() {
    let goal = this.target;
    let nearest = 60;
    for (let i = 0; i < PROPS; i++) {
      const prop = this.props[i];
      if (prop.kind !== KIND_LANTERN) continue;

      const ds = prop.s - this.s;
      if (ds < 1 || ds > nearest) continue;

      nearest = ds;
      goal = prop.u;
    }
    this.target += (clamp(goal, -BOAT_REACH, BOAT_REACH) - this.target) * 0.05;
  }

  private spawn() {
    const far = this.river.farEnd() - SPAWN_MARGIN;
    if (far >= this.nextLantern) this.spawnLanterns(far);
    if (far >= this.nextHazard) this.spawnHazard(far);
    if (far >= this.nextReeds) {
      this.reedsSide = -this.reedsSide;
      const u = this.reedsSide * (HALF_WIDTH + 0.1 + 0.6 * Math.random());
      this.add(KIND_REEDS, far, u, 0.7 + 0.6 * Math.random());
      this.nextReeds = far + 3 + 5 * Math.random();
    }
    if (far >= this.nextStone) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.add(KIND_STONE, far, side * (HALF_WIDTH + 0.9 + 2.5 * Math.random()), 0.3 + 0.3 * Math.random());
      this.nextStone = far + 9 + 12 * Math.random();
    }
    if (far >= this.nextToro) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.add(KIND_TORO, far, side * (HALF_WIDTH + 2.4), 1);
      this.nextToro = far + 34 + 30 * Math.random();
    }
    if (far >= this.nextTorii) {
      this.add(KIND_TORII, far, 0, 1);
      this.nextTorii = far + 150 + 90 * Math.random();
      this.nextBridge = Math.max(this.nextBridge, far + 50);
    }
    if (far >= this.nextBridge) {
      this.add(KIND_BRIDGE, far, 0, 1);
      this.nextBridge = far + 260 + 120 * Math.random();
      this.nextTorii = Math.max(this.nextTorii, far + 50);
    }
  }

  // A line or an arc of lanterns to sweep up.
  private spawnLanterns(far: number) {
    const count = 3 + Math.floor(Math.random() * 3);
    const centre = (Math.random() * 2 - 1) * (BOAT_REACH - 1);
    const swing = Math.random() < 0.5 ? 0 : 1.2 + Math.random();
    const phase = Math.random() * 6;
    for (let k = 0; k < count; k++) {
      const u = clamp(centre + swing * Math.sin(phase + k * 0.8), -BOAT_REACH, BOAT_REACH);
      this.add(KIND_LANTERN, far - k * 3.2, u, 1);
    }
    this.nextLantern = far + 18 + Math.random() * 16;
  }

  private spawnHazard(far: number) {
    const gap = Math.max(9, 22 - this.distance() * 0.006);
    const rapids = this.river.rapids[ROWS - 1] > 0;
    this.nextHazard = far + (rapids ? gap * 0.55 : gap) * (0.8 + 0.4 * Math.random());
    if (this.attract) return;

    const travelled = this.distance();
    const pick = Math.random();
    if (travelled > 300 && pick < 0.18) {
      this.addClear(KIND_WHIRL, far, (Math.random() * 2 - 1) * 2, 1);
      return;
    }
    if (travelled > 120 && pick < 0.42) {
      const length = 2.4 + Math.random();
      const side = Math.random() < 0.5 ? -1 : 1;
      this.addClear(KIND_LOG, far, side * (HALF_WIDTH - length / 2 + 0.3), length);
      return;
    }
    this.addClear(KIND_ROCK, far, (Math.random() * 2 - 1) * (HALF_WIDTH - 1), 0.55 + 0.45 * Math.random());
  }

  // Adds a hazard, moved across the river if it would sit on a lantern.
  private addClear(kind: number, s: number, u: number, size: number) {
    let placed = u;
    for (let i = 0; i < PROPS; i++) {
      const prop = this.props[i];
      if (prop.kind !== KIND_LANTERN || Math.abs(prop.s - s) > 4 || Math.abs(prop.u - placed) > 1.8) continue;

      placed = placed > 0 ? placed - 3.2 : placed + 3.2;
      break;
    }
    this.add(kind, s, placed, size);
  }

  private add(kind: number, s: number, u: number, size: number) {
    for (let i = 0; i < PROPS; i++) {
      const prop = this.props[i];
      if (prop.kind !== KIND_NONE) continue;

      prop.kind = kind;
      prop.s = s;
      prop.u = u;
      prop.size = size;
      prop.yaw = Math.random() * Math.PI * 2;
      prop.phase = Math.random() * Math.PI * 2;
      this.place(s, u);
      prop.x = this.catchX;
      prop.z = this.catchZ;
      prop.heading = this.river.sHeading;
      prop.rapids = this.river.sRapids;
      this.layout++;
      return;
    }
  }

  private despawn() {
    const behind = this.s - DESPAWN_BEHIND;
    for (let i = 0; i < PROPS; i++) {
      const prop = this.props[i];
      if (prop.kind === KIND_NONE || prop.s >= behind) continue;

      prop.kind = KIND_NONE;
      this.layout++;
    }
  }
}

function isHazard(kind: number): boolean {
  return kind === KIND_ROCK || kind === KIND_LOG || kind === KIND_WHIRL;
}
