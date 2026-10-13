// The run itself: the craft, a pool of props streaming toward it, spawning,
// collisions and the attract-mode autopilot. World units: x right, y up, the
// road runs toward -z and the craft sits at z = 0.

export const PROP_NONE = 0;
export const PROP_BARRIER = 1;
export const PROP_PYLON = 2;
export const PROP_SHARD = 3;

export const EVENT_NONE = 0;
export const EVENT_SHARD = 1;
export const EVENT_CRASH = 2;

const POOL_SIZE = 16;
const LANE_WIDTH = 2.1;
const SPAWN_Z = -96;
const DESPAWN_Z = 8;
// A reset clears props nearer than this, so a new run never opens on a wall;
// farther ones stay, already fogged, so the road does not visibly empty.
const CLEAR_AHEAD_Z = -40;

const BASE_SPEED = 20;
const MAX_SPEED = 46;
const SPEED_PER_UNIT = 0.011;
const FIRST_ROW_AT = 36;

const GRAVITY = 30;
const JUMP_SPEED = 10.5;
const DIVE_SPEED = -14;
const STEER_RATE = 12;

const SHIP_HALF_WIDTH = 0.75;
const SHIP_HALF_LENGTH = 1;
const BARRIER_HEIGHT = 0.75;
const SHARD_LOW = 0.9;
const SHARD_HIGH = 2.3;
const SHARD_REACH = 1.1;

// Crash: the craft is thrown up, spins down and the road brakes to a stop.
const CRASH_HOP = 7;
const CRASH_SPIN = 9;
const CRASH_BRAKE = 60;

export class Prop {
  kind = PROP_NONE;
  x = 0;
  y = 0;
  z = 0;
}

export class World {
  props: Prop[] = [];
  lane = 0;
  shipX = 0;
  shipY = 0;
  roll = 0;
  pitch = 0;
  speed = BASE_SPEED;
  distance = 0;
  // Total distance ever travelled: scrolls the ground, never resets.
  odometer = 0;
  shards = 0;
  crashed = false;
  clock = 0;

  private vy = 0;
  private spin = 0;
  private nextRowAt = FIRST_ROW_AT;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) this.props.push(new Prop());
  }

  reset() {
    for (let i = 0; i < POOL_SIZE; i++) {
      if (this.props[i].z > CLEAR_AHEAD_Z) this.props[i].kind = PROP_NONE;
    }
    this.lane = 0;
    this.shipY = 0;
    this.vy = 0;
    this.roll = 0;
    this.pitch = 0;
    this.spin = 0;
    this.speed = BASE_SPEED;
    this.distance = 0;
    this.shards = 0;
    this.crashed = false;
    this.nextRowAt = FIRST_ROW_AT;
  }

  steer(direction: number) {
    if (this.crashed) return;

    this.lane = Math.max(-1, Math.min(1, this.lane + direction));
  }

  jump() {
    if (this.crashed || this.shipY > 0) return;

    this.vy = JUMP_SPEED;
  }

  // Cuts a jump short to land sooner.
  dive() {
    if (this.crashed || this.shipY <= 0) return;

    this.vy = Math.min(this.vy, DIVE_SPEED);
  }

  // Advances the run by dt seconds; returns what the craft hit, if anything.
  step(dt: number): number {
    this.clock += dt;
    if (this.crashed) {
      this.tumble(dt);
      return EVENT_NONE;
    }

    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.distance * SPEED_PER_UNIT);
    const advance = this.speed * dt;
    this.distance += advance;
    this.moveProps(advance);
    this.moveShip(dt);
    if (this.distance >= this.nextRowAt) {
      this.spawnRow();
      this.nextRowAt = this.distance + this.rowGap();
    }

    return this.collide();
  }

  // Attract mode: steer toward the lane whose nearest obstacle is farthest
  // away, and jump walls that cannot be avoided.
  autopilot() {
    if (this.crashed) return;

    const reach = 10 + this.speed * 0.9;
    if (this.nearestObstacle(this.lane) < -reach) return;

    let best = this.lane;
    for (let lane = -1; lane <= 1; lane++) {
      if (this.nearestObstacle(lane) < this.nearestObstacle(best) - 0.5) best = lane;
    }
    this.lane = best;

    const current = this.nearestProp(Math.round(this.shipX / LANE_WIDTH));
    if (current >= 0 && this.props[current].kind === PROP_BARRIER && this.props[current].z > -this.speed * 0.3)
      this.jump();
  }

  // The craft's drawn height: it bobs a little while hovering.
  renderY(): number {
    const hover = this.shipY > 0 || this.crashed ? 0 : Math.sin(this.clock * 3) * 0.05;
    return this.shipY + hover;
  }

  private moveShip(dt: number) {
    const target = this.lane * LANE_WIDTH;
    this.shipX += (target - this.shipX) * Math.min(1, dt * STEER_RATE);
    // Bank into the turn: moving right rolls the right wing down.
    this.roll = (this.shipX - target) * 0.3;

    if (this.shipY > 0 || this.vy > 0) {
      this.vy -= GRAVITY * dt;
      this.shipY += this.vy * dt;
      if (this.shipY <= 0) {
        this.shipY = 0;
        this.vy = 0;
      }
    }
    this.pitch = this.vy * 0.025;
  }

  private moveProps(advance: number) {
    this.odometer += advance;
    for (let i = 0; i < POOL_SIZE; i++) {
      const prop = this.props[i];
      if (prop.kind === PROP_NONE) continue;

      prop.z += advance;
      if (prop.z > DESPAWN_Z) prop.kind = PROP_NONE;
    }
  }

  private tumble(dt: number) {
    this.speed = Math.max(0, this.speed - CRASH_BRAKE * dt);
    const advance = this.speed * dt;
    this.distance += advance;
    this.moveProps(advance);

    this.vy -= GRAVITY * dt;
    this.shipY = Math.max(0, this.shipY + this.vy * dt);
    this.roll += this.spin * dt;
    this.spin *= Math.max(0, 1 - dt * 1.5);
  }

  private collide(): number {
    for (let i = 0; i < POOL_SIZE; i++) {
      const prop = this.props[i];
      if (prop.kind === PROP_NONE) continue;
      if (Math.abs(prop.z) > SHIP_HALF_LENGTH + halfDepth(prop.kind)) continue;
      if (Math.abs(prop.x - this.shipX) > SHIP_HALF_WIDTH + halfWidth(prop.kind)) continue;

      if (prop.kind === PROP_SHARD) {
        if (Math.abs(this.shipY + 0.3 - prop.y) > SHARD_REACH) continue;

        prop.kind = PROP_NONE;
        this.shards++;
        return EVENT_SHARD;
      }

      if (prop.kind === PROP_BARRIER && this.shipY > BARRIER_HEIGHT) continue;

      this.crash();
      return EVENT_CRASH;
    }
    return EVENT_NONE;
  }

  private crash() {
    this.crashed = true;
    this.vy = CRASH_HOP;
    this.spin = this.shipX >= this.lane * LANE_WIDTH ? CRASH_SPIN : -CRASH_SPIN;
  }

  // A row always leaves one lane open; later rows can wall off all three
  // lanes with barriers, which must be jumped.
  private spawnRow() {
    const open = Math.floor(Math.random() * 3) - 1;
    if (this.distance > 150 && Math.random() < 0.2) {
      for (let lane = -1; lane <= 1; lane++) this.add(PROP_BARRIER, lane, 0);
      this.add(PROP_SHARD, open, SHARD_HIGH);
      return;
    }

    const early = this.distance < 150;
    for (let lane = -1; lane <= 1; lane++) {
      if (lane === open || (early && Math.random() < 0.5)) continue;

      const pick = Math.random();
      if (pick < 0.45) this.add(PROP_PYLON, lane, 0);
      else if (pick < 0.8) this.add(PROP_BARRIER, lane, 0);
    }
    if (Math.random() < 0.6) this.add(PROP_SHARD, open, SHARD_LOW);
  }

  private rowGap(): number {
    return Math.max(12, 24 - this.distance * 0.004);
  }

  private add(kind: number, lane: number, y: number) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const prop = this.props[i];
      if (prop.kind !== PROP_NONE) continue;

      prop.kind = kind;
      prop.x = lane * LANE_WIDTH;
      prop.y = y;
      prop.z = SPAWN_Z;
      return;
    }
  }

  // z of the nearest obstacle still ahead in a lane, or far away when clear.
  private nearestObstacle(lane: number): number {
    const index = this.nearestProp(lane);
    return index < 0 ? -1000 : this.props[index].z;
  }

  // Index of the nearest barrier or pylon still ahead in a lane, or -1.
  private nearestProp(lane: number): number {
    let nearest = -1;
    for (let i = 0; i < POOL_SIZE; i++) {
      const prop = this.props[i];
      if (prop.kind === PROP_NONE || prop.kind === PROP_SHARD) continue;
      if (prop.x !== lane * LANE_WIDTH || prop.z > SHIP_HALF_LENGTH) continue;
      if (nearest < 0 || prop.z > this.props[nearest].z) nearest = i;
    }
    return nearest;
  }
}

function halfWidth(kind: number): number {
  if (kind === PROP_BARRIER) return 0.9;
  if (kind === PROP_PYLON) return 0.55;
  return 0.45;
}

function halfDepth(kind: number): number {
  if (kind === PROP_BARRIER) return 0.25;
  if (kind === PROP_PYLON) return 0.55;
  return 0.45;
}
