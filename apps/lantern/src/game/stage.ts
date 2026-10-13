import { GeaRenderer } from "@geastack/gea3d";
import {
  AdditiveBlending,
  AmbientLight,
  type BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Object3D,
  PerspectiveCamera,
  Scene,
} from "@geastack/gea3d/three";
import type { RiverCamera } from "./camera";
import { Foam } from "./foam";
import { Builder, clamp, fastCos, fastSin, hex, mix, Rgb } from "./geometry";
import {
  buildBoat,
  buildBridge,
  buildGlow,
  buildLantern,
  buildLog,
  buildReeds,
  buildRock,
  buildStoneLantern,
  buildTorii,
  buildWhirl,
} from "./models";
import {
  DUSK_AMBIENT,
  DUSK_HAZE,
  DUSK_MOON,
  DUSK_SKY,
  LIT_AMBIENT,
  LIT_HAZE,
  LIT_MOON,
  LIT_SKY,
  WARM_LIGHT,
} from "./palette";
import { HALF_WIDTH } from "./river";
import { ASPECT, FOCAL, FOV, HEIGHT, WIDTH } from "./screen";
import { Backdrop, direction, LANTERN_DISTANCE, MOON_AZIMUTH, MOON_ELEVATION, slotDirection } from "./sky";
import { bankHeight, Terrain, waveAt } from "./terrain";
import {
  FLIGHT_FALL_S,
  FLIGHT_RISE_S,
  FLIGHTS,
  KIND_BRIDGE,
  KIND_LANTERN,
  KIND_LOG,
  KIND_REEDS,
  KIND_ROCK,
  KIND_STONE,
  KIND_TORII,
  KIND_TORO,
  KIND_WHIRL,
  MAX_SKY,
  PROPS,
  RIPPLES,
  type World,
} from "./world";

const NEAR = 0.2;
const FAR = 1000;
const FOG_NEAR = 24;
const FOG_FAR = 84;

// Painter's layers (renderOrder): the sky, then the land and water, then
// everything standing on them.
const LAYER_SKY = -2;
const LAYER_GROUND = -1;

// Pool sizes.
const LANTERN_POOL = 20;
const WORLD_GLOW_POOL = 28;
const ROCK_POOL = 24;
const LOG_POOL = 6;
const WHIRL_POOL = 3;
const REED_POOL = 26;
const TORO_POOL = 6;
const GATE_POOL = 2;

// Glows: radius in pixels of a sky lantern, of the moon's halo; world radius
// of a lantern's pool of light on the water and a stone lantern's halo.
const SKY_GLOW_PX = 7;
const HALO_RADIUS = 0.2;
const WATER_GLOW = 1.4;
const TORO_GLOW = 0.9;
const GLOW_FADE_NEAR = 34;
const GLOW_FADE_FAR = 78;

const TWINKLES_PER_FRAME = 10;
// The scene recolours when the light has moved this far.
const LIGHT_STEP = 0.015;
const SKY_LANTERN = new Rgb(1, 0.7, 0.32);
const CHAIN = new Rgb(0.32, 0.18, 0.07);

// The whole scene in gea3d. Static geometry is built once; each frame
// writes matrices (directly, nothing is composed), the water's waves, and
// the few colours that change.
export class Stage {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
  private readonly renderer = new GeaRenderer();
  private readonly ambient = new AmbientLight(0xffffff, 1);
  private readonly moonLight = new DirectionalLight(0xffffff, 1);
  private readonly warmLight = new DirectionalLight(0xffffff, 0);
  private readonly sky = new Group();
  private readonly backdrop = new Backdrop();
  private readonly skyGlows: InstancedMesh;
  private readonly chain: LineSegments;
  private readonly terrain = new Terrain();
  private readonly boat: Mesh;
  private readonly lanterns: InstancedMesh;
  private readonly worldGlows: InstancedMesh;
  private readonly rocks: InstancedMesh;
  private readonly logs: InstancedMesh;
  private readonly whirls: InstancedMesh;
  private readonly foam = new Foam(RIPPLES, WHIRL_POOL);
  private readonly reeds: InstancedMesh;
  private readonly toros: InstancedMesh;
  private readonly toriis: InstancedMesh;
  private readonly bridges: InstancedMesh;

  // Per-frame scratch (no allocation in the frame loop).
  private readonly dir = new Float32Array(3);
  private camX = 0;
  private camY = 0;
  private camZ = 0;
  // The camera's right and up vectors, for glows that face it.
  private readonly right = new Float32Array(3);
  private readonly up = new Float32Array(3);
  private skyShown = -1;
  private light = -1;
  private glowCount = 0;
  private lanternCount = 0;
  private twinkle = 0;
  private layout = -1;
  private whirlCount = 0;

  constructor() {
    this.renderer.setSize(WIDTH, HEIGHT);
    this.camera.matrixAutoUpdate = false;
    this.scene.fog = new Fog(DUSK_HAZE, FOG_NEAR, FOG_FAR);

    // Lights: the moon from the front right, the lanterns' warmth from
    // above and behind, and a cool ambient; they never move.
    this.moonLight.position.set(3, 7, -6);
    this.warmLight.position.set(2, 8, 6);
    this.addStatic(this.ambient);
    this.addStatic(this.moonLight);
    this.addStatic(this.warmLight);

    const lit = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const litBoth = new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });
    const unlit = new MeshBasicMaterial({ vertexColors: true });
    const glow = new MeshBasicMaterial({
      vertexColors: true,
      fog: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });

    this.sky.matrixAutoUpdate = false;
    this.scene.add(this.sky);
    const backdrop = new Mesh(
      this.backdrop.geometry,
      new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide }),
    );
    this.addTo(this.sky, backdrop, LAYER_SKY);
    this.skyGlows = withTints(this.pool(this.sky, glowGeometry(), glow, MAX_SKY + 1, 0));
    this.chain = new LineSegments(
      chainGeometry(),
      new LineBasicMaterial({ vertexColors: true, fog: false, blending: AdditiveBlending }),
    );
    this.addTo(this.sky, this.chain, 0);
    this.placeMoonHalo();

    this.addTo(this.scene, new Mesh(this.terrain.geometry, litBoth), LAYER_GROUND);

    this.boat = new Mesh(build(buildBoat), lit);
    this.addTo(this.scene, this.boat, 0);
    this.lanterns = this.pool(this.scene, build(buildLantern), unlit, LANTERN_POOL, 0);
    this.worldGlows = withTints(this.pool(this.scene, glowGeometry(), glow, WORLD_GLOW_POOL, 0));
    this.rocks = this.pool(this.scene, build(buildRock), lit, ROCK_POOL, 0);
    this.logs = this.pool(this.scene, build(buildLog), lit, LOG_POOL, 0);
    this.whirls = this.pool(this.scene, build(buildWhirl), litBoth, WHIRL_POOL, 0);
    const foam = new LineBasicMaterial({ vertexColors: true, fog: false, blending: AdditiveBlending });
    this.addTo(this.scene, new LineSegments(this.foam.geometry, foam), 0);
    this.reeds = this.pool(this.scene, build(buildReeds), litBoth, REED_POOL, 0);
    this.toros = this.pool(this.scene, build(buildStoneLantern), lit, TORO_POOL, 0);
    this.toriis = this.pool(this.scene, build(buildTorii), lit, GATE_POOL, 0);
    this.bridges = this.pool(this.scene, build(buildBridge), lit, GATE_POOL, 0);
  }

  // Warms the whole scene from dusk (0) to lantern-lit (1).
  setLight(light: number) {
    if (Math.abs(light - this.light) < LIGHT_STEP) return;

    this.light = light;
    this.backdrop.recolor(light);
    this.scene.backgroundColor = hexOf(mix(hex(DUSK_SKY[0]), hex(LIT_SKY[0]), light));
    const haze = mix(hex(DUSK_HAZE), hex(LIT_HAZE), light);
    this.scene.fog.color.setRGB(haze.r, haze.g, haze.b);
    this.ambient.color.setRGB(
      blend(DUSK_AMBIENT[0], LIT_AMBIENT[0], light),
      blend(DUSK_AMBIENT[1], LIT_AMBIENT[1], light),
      blend(DUSK_AMBIENT[2], LIT_AMBIENT[2], light),
    );
    this.moonLight.color.setRGB(
      blend(DUSK_MOON[0], LIT_MOON[0], light),
      blend(DUSK_MOON[1], LIT_MOON[1], light),
      blend(DUSK_MOON[2], LIT_MOON[2], light),
    );
    this.warmLight.color.setRGB(WARM_LIGHT[0], WARM_LIGHT[1], WARM_LIGHT[2]);
    this.warmLight.intensity = 0.12 + 0.6 * light;
  }

  update(world: World, camera: RiverCamera, timeS: number) {
    this.view(camera);
    const river = world.river;
    this.terrain.update(river);
    this.terrain.waves(river, world.clock);

    this.placeBoat(world);
    this.glowCount = 0;
    this.lanternCount = 0;
    this.placeProps(world, timeS);
    this.placeFlights(world);
    finish(this.lanterns, this.lanternCount);
    finish(this.worldGlows, this.glowCount);
    this.placeRipples(world);
    this.placeSky(world, timeS);
  }

  draw() {
    this.renderer.render(this.scene, this.camera);
  }

  private view(camera: RiverCamera) {
    const c = Math.cos(camera.yaw);
    const s = Math.sin(camera.yaw);
    const cp = Math.cos(camera.pitch);
    const sp = Math.sin(camera.pitch);
    // Ry(-yaw) · Rx(-pitch): looking along the heading, tipped down.
    writeMatrix(
      this.camera.matrix.elements,
      0,
      c,
      s * sp,
      -s * cp,
      0,
      cp,
      sp,
      s,
      -c * sp,
      c * cp,
      camera.x,
      camera.y,
      camera.z,
    );
    this.camX = camera.x;
    this.camY = camera.y;
    this.camZ = camera.z;
    this.right[0] = c;
    this.right[1] = 0;
    this.right[2] = s;
    this.up[0] = s * sp;
    this.up[1] = cp;
    this.up[2] = -c * sp;
    writeMatrix(this.sky.matrix.elements, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, camera.x, camera.y, camera.z);
  }

  private placeBoat(world: World) {
    const e = this.boat.matrix.elements;
    posed(e, 0, -world.heading, world.pitch, world.roll, 1, 1, 1, world.boatX, world.boatY, world.boatZ);
  }

  // Lanterns, logs and whirlpools move every frame; the rest only change
  // when props come and go (the world's layout version).
  private placeProps(world: World, timeS: number) {
    if (world.layout !== this.layout) {
      this.placeStatic(world);
      this.layout = world.layout;
    }

    let logs = 0;
    let whirls = 0;
    for (let i = 0; i < PROPS; i++) {
      const prop = world.props[i];
      const kind = prop.kind;
      if (kind === KIND_LANTERN) {
        if (this.lanternCount >= LANTERN_POOL) continue;

        const y = waveAt(prop.s, prop.u, world.clock, prop.rapids) + 0.04 * fastSin(timeS * 2 + prop.phase);
        yawed(
          this.lanterns.instanceMatrix.array,
          this.lanternCount * 16,
          prop.yaw + timeS * 0.3,
          1,
          1,
          1,
          prop.x,
          y,
          prop.z,
        );
        this.lanternCount++;
        this.flatGlow(prop.x, 0.18, prop.z, WATER_GLOW, 0.5, 0.3, 0.1);
      } else if (kind === KIND_LOG && logs < LOG_POOL) {
        const y = 0.04 + 0.04 * fastSin(timeS * 1.4 + prop.phase);
        const yaw = -prop.heading + (prop.phase - Math.PI) * 0.1;
        yawed(this.logs.instanceMatrix.array, logs++ * 16, yaw, prop.size, 1, 1, prop.x, y, prop.z);
      } else if (kind === KIND_WHIRL && whirls < WHIRL_POOL) {
        yawed(this.whirls.instanceMatrix.array, whirls * 16, prop.phase - timeS * 1.2, 1, 1, 1, prop.x, 0.03, prop.z);
        this.foam.spiral(whirls, prop.x, prop.z, prop.phase - timeS * 2.6);
        whirls++;
      } else if (kind === KIND_TORO) {
        this.facingGlow(prop.x, this.toroY(prop.u) + 1.02, prop.z, TORO_GLOW, 0.5, 0.28, 0.08);
      }
    }
    finish(this.logs, logs);
    finish(this.whirls, whirls);
    this.whirlCount = whirls;
  }

  private placeStatic(world: World) {
    let rocks = 0;
    let reeds = 0;
    let toros = 0;
    let gates = 0;
    let bridges = 0;
    for (let i = 0; i < PROPS; i++) {
      const prop = world.props[i];
      const kind = prop.kind;
      const x = prop.x;
      const z = prop.z;
      if (kind === KIND_ROCK && rocks < ROCK_POOL) {
        yawed(
          this.rocks.instanceMatrix.array,
          rocks++ * 16,
          prop.yaw,
          prop.size,
          prop.size * 0.85,
          prop.size,
          x,
          -0.04,
          z,
        );
      } else if (kind === KIND_STONE && rocks < ROCK_POOL) {
        const y = bankHeight(Math.abs(prop.u) - HALF_WIDTH) - 0.06;
        yawed(this.rocks.instanceMatrix.array, rocks++ * 16, prop.yaw, prop.size, prop.size * 0.7, prop.size, x, y, z);
      } else if (kind === KIND_REEDS && reeds < REED_POOL) {
        yawed(this.reeds.instanceMatrix.array, reeds++ * 16, prop.yaw, prop.size, prop.size, prop.size, x, 0, z);
      } else if (kind === KIND_TORO && toros < TORO_POOL) {
        yawed(this.toros.instanceMatrix.array, toros++ * 16, -prop.heading, 1, 1, 1, x, this.toroY(prop.u), z);
      } else if (kind === KIND_TORII && gates < GATE_POOL) {
        yawed(this.toriis.instanceMatrix.array, gates++ * 16, -prop.heading, 1, 1, 1, x, 0, z);
      } else if (kind === KIND_BRIDGE && bridges < GATE_POOL) {
        yawed(this.bridges.instanceMatrix.array, bridges++ * 16, -prop.heading, 1, 1, 1, x, 0, z);
      }
    }
    finish(this.rocks, rocks);
    finish(this.reeds, reeds);
    finish(this.toros, toros);
    finish(this.toriis, gates);
    finish(this.bridges, bridges);
  }

  // A stone lantern's base height on the bank at `u`.
  private toroY(u: number): number {
    return bankHeight(Math.abs(u) - HALF_WIDTH) - 0.08;
  }

  // Lanterns in flight: they shrink into their glow on the way up (and
  // grow out of it on the way down), moving from the water toward their
  // sky slot along the view (direction eased, distance growing
  // exponentially), so the trip reads smoothly on screen.
  private placeFlights(world: World) {
    const dir = this.dir;
    for (let i = 0; i < FLIGHTS; i++) {
      const flight = world.flights[i];
      if (!flight.active) continue;

      const u = flight.rising ? flight.t / FLIGHT_RISE_S : 1 - flight.t / FLIGHT_FALL_S;
      const e = flight.rising ? u * u * (3 - 2 * u) : u * u;
      const dx = flight.x - this.camX;
      const dy = flight.y - this.camY;
      const dz = flight.z - this.camZ;
      const near = Math.sqrt(dx * dx + dy * dy + dz * dz);
      slotDirection(flight.slot, dir);
      const mx = (dx / near) * (1 - e) + dir[0] * e;
      const my = (dy / near) * (1 - e) + dir[1] * e;
      const mz = (dz / near) * (1 - e) + dir[2] * e;
      const length = Math.sqrt(mx * mx + my * my + mz * mz);
      const distance = near * (LANTERN_DISTANCE / near) ** e;
      const x = this.camX + (mx / length) * distance;
      const y = this.camY + (my / length) * distance;
      const z = this.camZ + (mz / length) * distance;

      const body = 1 - clamp((e - 0.08) / 0.3, 0, 1);
      if (body > 0 && this.lanternCount < LANTERN_POOL) {
        const scaleBody = body * (distance / near);
        yawed(
          this.lanterns.instanceMatrix.array,
          this.lanternCount * 16,
          e * 4,
          scaleBody,
          scaleBody,
          scaleBody,
          x,
          y - 0.3 * scaleBody,
          z,
        );
        this.lanternCount++;
      }
      const px = 22 + (SKY_GLOW_PX - 22) * e;
      const fade = flight.rising ? 1 : Math.min(1, u * 3);
      this.facingGlow(
        x,
        y,
        z,
        (distance * px) / FOCAL,
        SKY_LANTERN.r * fade,
        SKY_LANTERN.g * fade,
        SKY_LANTERN.b * fade,
      );
    }
  }

  private placeRipples(world: World) {
    let rings = 0;
    for (let i = 0; i < RIPPLES; i++) {
      const ripple = world.ripples[i];
      if (!ripple.active) continue;

      const t = ripple.t / ripple.duration;
      const radius = ripple.radius * (0.35 + 0.65 * Math.sqrt(t));
      this.foam.ring(rings++, ripple.x, ripple.z, radius, ripple.strength * (1 - t) * (1 - t));
    }
    this.foam.finish(rings, this.whirlCount);
  }

  // The sky lanterns: their glows (static once placed, twinkling through
  // their colours) and the chain between them.
  private placeSky(world: World, timeS: number) {
    const count = world.skyCount;
    if (count !== this.skyShown) {
      this.placeChain(count);
      this.skyShown = count;
    }
    if (count === 0) return;

    // A few lanterns a frame take their next twinkle.
    const tints = this.skyGlows.instanceColor.array;
    for (let n = 0; n < TWINKLES_PER_FRAME; n++) {
      this.twinkle = (this.twinkle % count) + 1;
      const i = this.twinkle;
      const twinkle = 0.78 + 0.22 * fastSin(timeS * 1.9 + i * 2.3);
      tints[i * 3] = SKY_LANTERN.r * twinkle;
      tints[i * 3 + 1] = SKY_LANTERN.g * twinkle;
      tints[i * 3 + 2] = SKY_LANTERN.b * twinkle;
    }
    this.skyGlows.instanceColor.needsUpdate = true;
  }

  private placeChain(count: number) {
    const dir = this.dir;
    const radius = (LANTERN_DISTANCE * SKY_GLOW_PX) / FOCAL;
    for (let i = 0; i < count; i++) {
      slotDirection(i, dir);
      facing(this.skyGlows.instanceMatrix.array, (i + 1) * 16, dir, radius, LANTERN_DISTANCE);
    }
    finish(this.skyGlows, count + 1);

    const positions = this.chain.geometry.attributes.position;
    const p = positions.array;
    for (let i = 0; i < MAX_SKY; i++) {
      const o = i * 6;
      if (i === 0 || i >= count) {
        // Parked behind the camera.
        for (let k = 0; k < 6; k++) p[o + k] = k % 3 === 2 ? 50 : 0;
        continue;
      }

      slotDirection(i - 1, dir);
      p[o] = dir[0] * LANTERN_DISTANCE;
      p[o + 1] = dir[1] * LANTERN_DISTANCE;
      p[o + 2] = dir[2] * LANTERN_DISTANCE;
      slotDirection(i, dir);
      p[o + 3] = dir[0] * LANTERN_DISTANCE;
      p[o + 4] = dir[1] * LANTERN_DISTANCE;
      p[o + 5] = dir[2] * LANTERN_DISTANCE;
    }
    positions.needsUpdate = true;
  }

  private placeMoonHalo() {
    direction(MOON_AZIMUTH, MOON_ELEVATION, this.dir);
    const distance = 905;
    facing(this.skyGlows.instanceMatrix.array, 0, this.dir, HALO_RADIUS * distance, distance);
    const tints = this.skyGlows.instanceColor.array;
    for (let i = 0; i <= MAX_SKY; i++) {
      const moon = i === 0;
      tints[i * 3] = moon ? 0.16 : SKY_LANTERN.r;
      tints[i * 3 + 1] = moon ? 0.16 : SKY_LANTERN.g;
      tints[i * 3 + 2] = moon ? 0.22 : SKY_LANTERN.b;
    }
    finish(this.skyGlows, 1);
  }

  // A glow lying on the water, faded out with distance.
  private flatGlow(x: number, y: number, z: number, radius: number, r: number, g: number, b: number) {
    const fade = this.distanceFade(x, z);
    if (fade <= 0 || this.glowCount >= WORLD_GLOW_POOL) return;

    const o = this.glowCount * 16;
    // The glow's xy plane turned flat onto the water.
    writeMatrix(this.worldGlows.instanceMatrix.array, o, radius, 0, 0, 0, 0, 1, 0, radius, 0, x, y, z);
    this.tint(r * fade, g * fade, b * fade);
  }

  // A glow facing the camera.
  private facingGlow(x: number, y: number, z: number, radius: number, r: number, g: number, b: number) {
    if (this.glowCount >= WORLD_GLOW_POOL) return;

    const a = this.worldGlows.instanceMatrix.array;
    const o = this.glowCount * 16;
    const right = this.right;
    const up = this.up;
    a[o] = right[0] * radius;
    a[o + 1] = right[1] * radius;
    a[o + 2] = right[2] * radius;
    a[o + 3] = 0;
    a[o + 4] = up[0] * radius;
    a[o + 5] = up[1] * radius;
    a[o + 6] = up[2] * radius;
    a[o + 7] = 0;
    a[o + 8] = 0;
    a[o + 9] = 0;
    a[o + 10] = 0;
    a[o + 11] = 0;
    a[o + 12] = x;
    a[o + 13] = y;
    a[o + 14] = z;
    a[o + 15] = 1;
    this.tint(r, g, b);
  }

  private tint(r: number, g: number, b: number) {
    const tints = this.worldGlows.instanceColor.array;
    const o = this.glowCount * 3;
    tints[o] = r;
    tints[o + 1] = g;
    tints[o + 2] = b;
    this.glowCount++;
  }

  private distanceFade(x: number, z: number): number {
    const dx = x - this.camX;
    const dz = z - this.camZ;
    const d = Math.sqrt(dx * dx + dz * dz);
    return clamp((GLOW_FADE_FAR - d) / (GLOW_FADE_FAR - GLOW_FADE_NEAR), 0, 1);
  }

  private addStatic(object: Object3D) {
    object.updateMatrixWorld(true);
    object.matrixAutoUpdate = false;
    this.scene.add(object);
  }

  private addTo(parent: Object3D, object: Object3D, layer: number) {
    object.matrixAutoUpdate = false;
    object.renderOrder = layer;
    parent.add(object);
  }

  private pool(parent: Object3D, geometry: BufferGeometry, material: Material, size: number, layer: number) {
    const mesh = new InstancedMesh(geometry, material, size);
    mesh.count = 0;
    this.addTo(parent, mesh, layer);
    return mesh;
  }
}

function build(maker: (builder: Builder) => void): BufferGeometry {
  const builder = new Builder();
  maker(builder);
  return builder.geometry();
}

function glowGeometry(): BufferGeometry {
  const builder = new Builder();
  buildGlow(builder, new Rgb(1, 1, 1));
  return builder.geometry();
}

// MAX_SKY segments, placed as the chain grows.
function chainGeometry(): BufferGeometry {
  const builder = new Builder();
  for (let i = 0; i < MAX_SKY; i++) {
    const a = builder.vertex(0, 0, 50, CHAIN);
    builder.vertex(0, 0, 50, CHAIN);
    builder.segment(a, a + 1);
  }
  return builder.geometry();
}

// Instance tints start white; glows set theirs every frame.
function withTints(mesh: InstancedMesh): InstancedMesh {
  mesh.setColorAt(0, new Color(1, 1, 1));
  return mesh;
}

function finish(mesh: InstancedMesh, count: number) {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
}

// Writes a rotation (row-major r00..r22) and a translation at `o`.
function writeMatrix(
  e: Float32Array,
  o: number,
  r00: number,
  r01: number,
  r02: number,
  r10: number,
  r11: number,
  r12: number,
  r20: number,
  r21: number,
  r22: number,
  x: number,
  y: number,
  z: number,
) {
  e[o] = r00;
  e[o + 1] = r10;
  e[o + 2] = r20;
  e[o + 3] = 0;
  e[o + 4] = r01;
  e[o + 5] = r11;
  e[o + 6] = r21;
  e[o + 7] = 0;
  e[o + 8] = r02;
  e[o + 9] = r12;
  e[o + 10] = r22;
  e[o + 11] = 0;
  e[o + 12] = x;
  e[o + 13] = y;
  e[o + 14] = z;
  e[o + 15] = 1;
}

// T · Ry(yaw) · S at `o`.
function yawed(
  e: Float32Array,
  o: number,
  yaw: number,
  sx: number,
  sy: number,
  sz: number,
  x: number,
  y: number,
  z: number,
) {
  const c = fastCos(yaw);
  const s = fastSin(yaw);
  writeMatrix(e, o, c * sx, 0, s * sz, 0, sy, 0, -s * sx, 0, c * sz, x, y, z);
}

// T · Ry(yaw) · Rx(pitch) · Rz(roll) · S at `o`.
function posed(
  e: Float32Array,
  o: number,
  yaw: number,
  pitch: number,
  roll: number,
  sx: number,
  sy: number,
  sz: number,
  x: number,
  y: number,
  z: number,
) {
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const cb = Math.cos(pitch);
  const sb = Math.sin(pitch);
  const cc = Math.cos(roll);
  const sc = Math.sin(roll);
  writeMatrix(
    e,
    o,
    (ca * cc + sa * sb * sc) * sx,
    (-ca * sc + sa * sb * cc) * sy,
    sa * cb * sz,
    cb * sc * sx,
    cb * cc * sy,
    -sb * sz,
    (-sa * cc + ca * sb * sc) * sx,
    (sa * sc + ca * sb * cc) * sy,
    ca * cb * sz,
    x,
    y,
    z,
  );
}

// A glow at `distance` along `dir`, facing back toward the origin.
function facing(e: Float32Array, o: number, dir: Float32Array, radius: number, distance: number) {
  const bx = -dir[0];
  const by = -dir[1];
  const bz = -dir[2];
  const length = Math.sqrt(bz * bz + bx * bx);
  const rx = bz / length;
  const rz = -bx / length;
  const ux = by * rz;
  const uy = bz * rx - bx * rz;
  const uz = -by * rx;
  writeMatrix(
    e,
    o,
    rx * radius,
    ux * radius,
    bx * radius,
    0,
    uy * radius,
    by * radius,
    rz * radius,
    uz * radius,
    bz * radius,
    dir[0] * distance,
    dir[1] * distance,
    dir[2] * distance,
  );
}

function blend(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function hexOf(color: Rgb): number {
  const r = Math.round(clamp(color.r, 0, 1) * 255);
  const g = Math.round(clamp(color.g, 0, 1) * 255);
  const b = Math.round(clamp(color.b, 0, 1) * 255);
  return r * 65536 + g * 256 + b;
}
