import { RED, TEAL } from "./palette";

// The flight itself, in the original game's units and tuning: a sea of
// radius 600 turning under the plane, which flies 100 above it, and coins
// and enemies travelling round the same circle towards it. Times are in ms.

export const SEA_RADIUS = 600;
const DEFAULT_HEIGHT = 100;
const HEIGHT_RANGE = 80;
// The plane sits left of centre and drifts a little sideways with the touch.
const PLANE_X = -60;
const SIDE_RANGE = 22;

// The models are drawn this much larger than the original's (which targets
// a big browser window), so their reach grows with them.
export const MODEL_SCALE = 1.8;
const COIN_REACH = 15 * MODEL_SCALE;
const ENEMY_REACH = 10 * MODEL_SCALE;

const INIT_SPEED = 0.00035;
const SPEED_STEP = 0.0000025 * 16;
const LEVEL_SPEED_STEP = 0.000005;
const DISTANCE_PER_SPEED_STEP = 100;
const DISTANCE_PER_LEVEL = 1000;
const DISTANCE_PER_COINS = 100;
const DISTANCE_PER_ENEMIES = 50;
const DISTANCE_RATIO = 50;
const ENERGY_RATIO = 3;
const MIN_PLANE_SPEED = 1.2;
const MAX_PLANE_SPEED = 1.6;
const MOVE_RATE = 0.005;
const PITCH_RATE = 0.0008;
const ROLL_RATE = 0.0004;
const COIN_SPEED = 0.5;
const ENEMY_SPEED = 0.6;
const COIN_ENERGY = 3;
const ENEMY_DAMAGE = 10;
const KNOCKBACK = 100;
const FLASH = 1.2;
const AMBIENT = 0.5;

// Below this the plane is down in the sea.
const SUNK_Y = -200;

export const FLYING = 0;
export const FALLING = 1;
export const DOWN = 2;

export const EVENT_NONE = 0;
export const EVENT_COIN = 1;
export const EVENT_HIT = 2;
export const EVENT_DOWN = 3;

const COIN_POOL = 40;
const ENEMY_POOL = 32;
const PARTICLE_POOL = 48;

// Flyers are only placed (and drawn and tested) this close to the top of
// their circle, in radians: farther round they are out of view.
const VIEW_ANGLE = 0.4;

// A coin or an enemy: its place on the circle round the sea's centre, and
// its tumble.
export class Flyer {
  alive = false;
  inView = false;
  angle = 0;
  distance = 0;
  x = 0;
  y = 0;
  spinY = 0;
  spinZ = 0;
  spinRateY = 0;
  spinRateZ = 0;

  launch(angle: number, distance: number) {
    this.alive = true;
    this.angle = angle;
    this.distance = distance;
    this.spinRateY = 0.002 + Math.random() * 0.002;
    this.spinRateZ = 0.002 + Math.random() * 0.002;
    this.place();
  }

  // Moves along the circle by `turn` radians and tumbles for dt ms; gone
  // once past the far horizon.
  advance(turn: number, dt: number) {
    this.angle += turn;
    this.spinY += this.spinRateY * dt;
    this.spinZ += this.spinRateZ * dt;
    this.place();
    if (this.angle > Math.PI) this.alive = false;
  }

  private place() {
    this.inView = Math.abs(this.angle - Math.PI / 2) < VIEW_ANGLE;
    if (!this.inView) return;

    this.x = Math.cos(this.angle) * this.distance;
    this.y = -SEA_RADIUS + Math.sin(this.angle) * this.distance;
  }
}

// A spark of a burst: flies out, tumbles and shrinks away.
export class Particle {
  alive = false;
  color = 0;
  t = 0;
  duration = 0;
  delay = 0;
  fromX = 0;
  fromY = 0;
  toX = 0;
  toY = 0;
  size = 0;
  turnY = 0;
  turnZ = 0;
}

export class World {
  status = FLYING;
  planeX = PLANE_X;
  planeY = DEFAULT_HEIGHT;
  pitch = 0;
  roll = 0;
  propeller = 0;
  hair = 0;
  seaAngle = 0;
  ambient = AMBIENT;
  speed = 0;
  planeSpeed = MIN_PLANE_SPEED;
  distance = 0;
  level = 1;
  energy = 100;
  // The aim: -1..1 across and up the screen.
  aimX = 0;
  aimY = 0;

  readonly coins: Flyer[] = [];
  readonly enemies: Flyer[] = [];
  readonly particles: Particle[] = [];

  private baseSpeed = INIT_SPEED;
  private targetBaseSpeed = INIT_SPEED;
  private nextSpeedStep = DISTANCE_PER_SPEED_STEP;
  private nextLevel = DISTANCE_PER_LEVEL;
  private nextCoins = DISTANCE_PER_COINS;
  private nextEnemies = DISTANCE_PER_ENEMIES;
  private knockX = 0;
  private knockY = 0;
  private knockSpeedX = 0;
  private knockSpeedY = 0;
  private fallSpeed = 0.001;

  constructor() {
    for (let i = 0; i < COIN_POOL; i++) this.coins.push(new Flyer());
    for (let i = 0; i < ENEMY_POOL; i++) this.enemies.push(new Flyer());
    for (let i = 0; i < PARTICLE_POOL; i++) this.particles.push(new Particle());
    this.speed = INIT_SPEED * MIN_PLANE_SPEED;
  }

  // A new flight from wherever the plane is now.
  reset() {
    this.status = FLYING;
    this.baseSpeed = INIT_SPEED;
    this.targetBaseSpeed = INIT_SPEED;
    this.distance = 0;
    this.level = 1;
    this.energy = 100;
    this.nextSpeedStep = DISTANCE_PER_SPEED_STEP;
    this.nextLevel = DISTANCE_PER_LEVEL;
    this.nextCoins = DISTANCE_PER_COINS;
    this.nextEnemies = DISTANCE_PER_ENEMIES;
    this.fallSpeed = 0.001;
    this.knockX = 0;
    this.knockY = 0;
    this.knockSpeedX = 0;
    this.knockSpeedY = 0;
  }

  // Share of the way to the next level, 0..1.
  levelProgress(): number {
    return (this.distance % DISTANCE_PER_LEVEL) / DISTANCE_PER_LEVEL;
  }

  // Advances everything by dt ms. `playing` = false is the attract mode:
  // the plane flies, but nothing spawns, collides or spends energy.
  step(dt: number, playing: boolean): number {
    this.seaAngle += this.speed * dt;
    if (this.seaAngle > Math.PI * 2) this.seaAngle -= Math.PI * 2;
    this.hair += this.speed * dt * 40;
    this.ambient += (AMBIENT - this.ambient) * Math.min(1, dt * 0.005);
    this.stepParticles(dt);

    if (this.status !== FLYING) return this.fall(dt);

    this.fly(dt);
    if (playing) this.progress(dt);
    const event = this.moveFlyers(dt, playing);
    if (this.energy < 1) this.status = FALLING;
    return event;
  }

  private fly(dt: number) {
    this.planeSpeed = clamp(MIN_PLANE_SPEED + (this.aimX + 0.5) * (MAX_PLANE_SPEED - MIN_PLANE_SPEED), 1.2, 1.6);
    this.baseSpeed += (this.targetBaseSpeed - this.baseSpeed) * Math.min(1, dt * 0.02);
    this.speed = this.baseSpeed * this.planeSpeed;

    // Knocked back by a hit: the push fades, then the plane settles back.
    this.knockX += this.knockSpeedX;
    this.knockY += this.knockSpeedY;
    this.knockSpeedX -= this.knockSpeedX * Math.min(1, dt * 0.03);
    this.knockSpeedY -= this.knockSpeedY * Math.min(1, dt * 0.03);
    this.knockX -= this.knockX * Math.min(1, dt * 0.01);
    this.knockY -= this.knockY * Math.min(1, dt * 0.01);

    const targetX = PLANE_X + this.aimX * SIDE_RANGE + this.knockX;
    const targetY = DEFAULT_HEIGHT + this.aimY * HEIGHT_RANGE + this.knockY;
    const rate = Math.min(1, dt * MOVE_RATE);
    this.planeY += (targetY - this.planeY) * rate;
    this.planeX += (targetX - this.planeX) * rate;
    // Nose up while climbing, banked while it catches up.
    this.pitch = (targetY - this.planeY) * dt * PITCH_RATE;
    this.roll = (this.planeY - targetY) * dt * ROLL_RATE;
    this.propeller += 0.2 + this.planeSpeed * dt * 0.005;
  }

  // Out of energy: the plane noses over and drops into the sea.
  private fall(dt: number): number {
    this.speed *= 0.99;
    this.moveFlyers(dt, false);
    // Down: the plane waits under the sea for the replay.
    if (this.status === DOWN) return EVENT_NONE;

    this.pitch += (-Math.PI / 2 - this.pitch) * 0.0002 * dt;
    this.roll += 0.0003 * dt;
    this.fallSpeed *= 1.05;
    this.planeY -= this.fallSpeed * dt;
    this.propeller += 0.1;
    if (this.planeY > SUNK_Y) return EVENT_NONE;

    this.planeY = SUNK_Y;
    this.status = DOWN;
    return EVENT_DOWN;
  }

  // Distance, speed-ups, levels, energy use and the next waves.
  private progress(dt: number) {
    this.distance += this.speed * dt * DISTANCE_RATIO;
    this.energy = Math.max(0, this.energy - this.speed * dt * ENERGY_RATIO);

    if (this.distance >= this.nextSpeedStep) {
      this.nextSpeedStep += DISTANCE_PER_SPEED_STEP;
      this.targetBaseSpeed += SPEED_STEP;
    }
    if (this.distance >= this.nextLevel) {
      this.nextLevel += DISTANCE_PER_LEVEL;
      this.level++;
      this.targetBaseSpeed = INIT_SPEED + LEVEL_SPEED_STEP * this.level;
    }
    if (this.distance >= this.nextCoins) {
      this.nextCoins += DISTANCE_PER_COINS;
      this.spawnCoins();
    }
    if (this.distance >= this.nextEnemies) {
      this.nextEnemies += DISTANCE_PER_ENEMIES;
      this.spawnEnemies();
    }
  }

  // A wavy chain of up to ten coins at one height.
  private spawnCoins() {
    const count = 1 + Math.floor(Math.random() * 10);
    const distance = SEA_RADIUS + DEFAULT_HEIGHT + (Math.random() * 2 - 1) * (HEIGHT_RANGE - 20);
    const amplitude = 10 + Math.round(Math.random() * 10);
    let slot = 0;
    for (let i = 0; i < count; i++) {
      slot = freeSlot(this.coins, slot);
      if (slot < 0) return;

      this.coins[slot].launch(-i * 0.02, distance + Math.cos(i * 0.5) * amplitude);
    }
  }

  // One enemy per level, strung out in a line.
  private spawnEnemies() {
    let slot = 0;
    for (let i = 0; i < this.level; i++) {
      slot = freeSlot(this.enemies, slot);
      if (slot < 0) return;

      const distance = SEA_RADIUS + DEFAULT_HEIGHT + (Math.random() * 2 - 1) * (HEIGHT_RANGE - 20);
      this.enemies[slot].launch(-i * 0.1, distance);
    }
  }

  // Moves the coins and enemies; with `collide`, the plane picks up or hits
  // what it reaches.
  private moveFlyers(dt: number, collide: boolean): number {
    let event = EVENT_NONE;
    for (let i = 0; i < COIN_POOL; i++) {
      const coin = this.coins[i];
      if (!coin.alive) continue;

      coin.advance(this.speed * dt * COIN_SPEED, dt);
      if (collide && this.reaches(coin, COIN_REACH)) {
        coin.alive = false;
        this.burst(coin.x, coin.y, 5, TEAL, 0.8);
        this.energy = Math.min(100, this.energy + COIN_ENERGY);
        event = EVENT_COIN;
      }
    }

    for (let i = 0; i < ENEMY_POOL; i++) {
      const enemy = this.enemies[i];
      if (!enemy.alive) continue;

      enemy.advance(this.speed * dt * ENEMY_SPEED, dt);
      if (collide && this.reaches(enemy, ENEMY_REACH)) {
        enemy.alive = false;
        this.burst(enemy.x, enemy.y, 15, RED, 3);
        this.hit(enemy);
        event = EVENT_HIT;
      }
    }
    return event;
  }

  private reaches(flyer: Flyer, reach: number): boolean {
    if (!flyer.inView) return false;

    const dx = this.planeX - flyer.x;
    const dy = this.planeY - flyer.y;
    return dx * dx + dy * dy < reach * reach;
  }

  // An enemy hit: the plane is pushed away from it, the light flares and
  // energy drops.
  private hit(enemy: Flyer) {
    const dx = this.planeX - enemy.x;
    const dy = this.planeY - enemy.y;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    this.knockSpeedX = (KNOCKBACK * dx) / distance;
    this.knockSpeedY = (KNOCKBACK * dy) / distance;
    this.ambient = FLASH;
    this.energy = Math.max(0, this.energy - ENEMY_DAMAGE);
  }

  private burst(x: number, y: number, count: number, color: number, size: number) {
    let slot = 0;
    for (let i = 0; i < count; i++) {
      slot = freeParticle(this.particles, slot);
      if (slot < 0) return;

      const particle = this.particles[slot];
      particle.alive = true;
      particle.color = color;
      particle.t = 0;
      particle.duration = 600 + Math.random() * 200;
      particle.delay = Math.random() * 100;
      particle.fromX = x;
      particle.fromY = y;
      particle.toX = x + (Math.random() * 2 - 1) * 50 * MODEL_SCALE;
      particle.toY = y + (Math.random() * 2 - 1) * 50 * MODEL_SCALE;
      particle.size = size;
      particle.turnY = Math.random() * 12;
      particle.turnZ = Math.random() * 12;
    }
  }

  private stepParticles(dt: number) {
    for (let i = 0; i < PARTICLE_POOL; i++) {
      const particle = this.particles[i];
      if (!particle.alive) continue;

      particle.t += dt;
      if (particle.t >= particle.duration) particle.alive = false;
    }
  }
}

// The first free flyer from `from` on, or -1.
function freeSlot(pool: Flyer[], from: number): number {
  for (let i = from; i < pool.length; i++) {
    if (!pool[i].alive) return i;
  }
  return -1;
}

function freeParticle(pool: Particle[], from: number): number {
  for (let i = from; i < pool.length; i++) {
    if (!pool[i].alive) return i;
  }
  return -1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
