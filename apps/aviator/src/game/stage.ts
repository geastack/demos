import { GeaRenderer } from "@geastack/gea3d";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  type Matrix4,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
} from "@geastack/gea3d/three";
import { Builder } from "./builder";
import {
  buildCloudBlock,
  buildHair,
  buildPlane,
  buildPropeller,
  HAIR_COUNT,
  hairX,
  hairY,
  hairZ,
  PROPELLER_X,
} from "./models";
import { FOG, RED, SKY_BOTTOM, SKY_TOP, TEAL } from "./palette";
import { ASPECT, FOV_BASE, HEIGHT, WIDTH } from "./screen";
import { Sea } from "./sea";
import { MAX_BLOCKS, placeClouds } from "./sky";
import { CAMERA_Y, CAMERA_Z, FOG_FAR, FOG_NEAR } from "./view";
import { SEA_RADIUS, type World } from "./world";

const NEAR = 1;
const FAR = 2000;
// Vertical field of view (from the screen's shape): wider as the plane speeds up.
const FOV = FOV_BASE;
const FOV_SWING = 6;
const CAMERA_MIN_Y = 40;
const CLOUD_GLOW = 1.35;

// The original's models, sized up for the small screen.
const PLANE_SCALE = 0.55;
export const FLYER_SCALE = 1.3;
const COIN_SIZE = 5 * FLYER_SCALE;
const ENEMY_SIZE = 8 * FLYER_SCALE;
const SPARK_SIZE = 3 * FLYER_SCALE;

// Coins and sparks share one pool of tetrahedra, tinted per instance.
const TETRA_POOL = 96;
const ENEMY_POOL = 32;

// The whole scene in gea3d. Every matrix is written directly each frame;
// nothing is composed from position/rotation.
export class Stage {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
  private readonly renderer = new GeaRenderer();
  private readonly ambient = new AmbientLight(0xdc8874, 0.5);
  private readonly plane = new Group();
  private readonly propeller: Mesh;
  private readonly hair: InstancedMesh;
  private readonly sea = new Sea();
  private readonly seaMesh: Mesh;
  private readonly clouds: InstancedMesh;
  private readonly tetras: InstancedMesh;
  private readonly enemies: InstancedMesh;
  private cameraY = CAMERA_Y;
  private fov = FOV;

  constructor() {
    this.renderer.setSize(WIDTH, HEIGHT);
    this.scene.backgroundColor = SKY_TOP;
    this.scene.backgroundBottom = SKY_BOTTOM;
    this.scene.fog = new Fog(FOG, FOG_NEAR, FOG_FAR);
    this.camera.matrixAutoUpdate = false;

    // The original's lights, a little softer: at full strength most faces
    // saturate to one colour on this 16-bit panel.
    this.scene.add(new HemisphereLight(0xaaaaaa, 0x000000, 0.6));
    this.scene.add(this.ambient);
    const sun = new DirectionalLight(0xffffff, 0.55);
    sun.position.set(150, 350, 350);
    this.scene.add(sun);

    const painted = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const body = new Builder();
    buildPlane(body);
    this.plane.add(new Mesh(body.geometry(), painted));
    const propeller = new Builder();
    buildPropeller(propeller);
    this.propeller = new Mesh(propeller.geometry(), painted);
    this.plane.add(this.propeller);
    const hair = new Builder();
    buildHair(hair);
    this.hair = new InstancedMesh(hair.geometry(), painted, HAIR_COUNT);
    for (let i = 0; i < HAIR_COUNT; i++)
      instance(this.hair.instanceMatrix.array, i, hairX(i), hairY(), hairZ(i), 0, 0, 1, 1);
    this.plane.add(this.hair);
    this.add(this.plane);

    const sea = new MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
    this.seaMesh = new Mesh(this.sea.geometry, sea);
    turnAboutSea(this.seaMesh.matrix, 0);
    this.add(this.seaMesh);

    const block = new Builder();
    buildCloudBlock(block);
    this.clouds = new InstancedMesh(block.geometry(), painted, MAX_BLOCKS);
    this.clouds.count = placeClouds(this.clouds.instanceMatrix.array);
    // Tinted brighter than white, so the far, fogged clouds still read as
    // white puffs rather than tan blocks.
    const glow = new Color(CLOUD_GLOW, CLOUD_GLOW, CLOUD_GLOW);
    for (let i = 0; i < this.clouds.count; i++) this.clouds.setColorAt(i, glow);
    this.add(this.clouds);

    const tetra = new Builder();
    tetra.tetrahedron(1, 0, 0xffffff);
    this.tetras = new InstancedMesh(tetra.geometry(), painted, TETRA_POOL);
    this.tetras.setColorAt(0, new Color(TEAL));
    this.tetras.count = 0;
    this.add(this.tetras);

    const enemy = new Builder();
    enemy.tetrahedron(1, 2, RED);
    this.enemies = new InstancedMesh(enemy.geometry(), painted, ENEMY_POOL);
    this.enemies.count = 0;
    this.add(this.enemies);

    // The lights never move.
    this.scene.updateMatrixWorld(true);
    this.scene.matrixAutoUpdate = false;
  }

  // The camera trails the plane's height; the view widens with its speed.
  follow(world: World, dt: number) {
    // It stops short of following a falling plane into the sea.
    const height = Math.max(CAMERA_MIN_Y, world.planeY);
    this.cameraY += (height - this.cameraY) * Math.min(1, dt * 0.002);
    setMatrix(this.camera.matrix, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, this.cameraY, CAMERA_Z);

    const fov = FOV + world.aimX * FOV_SWING;
    this.fov += (fov - this.fov) * Math.min(1, dt * 0.004);
    if (Math.abs(this.fov - this.camera.fov) < 0.05) return;

    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  place(world: World, dt: number) {
    this.ambient.intensity = world.ambient;
    this.placePlane(world);
    this.sea.move(dt, world.seaAngle);
    turnAboutSea(this.clouds.matrix, world.seaAngle);
    this.placeFlyers(world);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  private placePlane(world: World) {
    // T · Rx(roll) · Rz(pitch) · S
    const cx = Math.cos(world.roll);
    const sx = Math.sin(world.roll);
    const cz = Math.cos(world.pitch);
    const sz = Math.sin(world.pitch);
    const s = PLANE_SCALE;
    const x = world.planeX;
    const y = world.planeY;
    setMatrix(
      this.plane.matrix,
      cz * s,
      -sz * s,
      0,
      cx * sz * s,
      cx * cz * s,
      -sx * s,
      sx * sz * s,
      sx * cz * s,
      cx * s,
      x,
      y,
      0,
    );

    // The propeller turns about the plane's x axis.
    const c = Math.cos(world.propeller);
    const p = Math.sin(world.propeller);
    setMatrix(this.propeller.matrix, 1, 0, 0, 0, c, -p, 0, p, c, PROPELLER_X, 0, 0);

    // The hair tufts stretch and settle in a ripple running across the head
    // (only their height changes).
    const hair = this.hair.instanceMatrix.array;
    for (let i = 0; i < HAIR_COUNT; i++) hair[i * 16 + 5] = 0.75 + Math.cos(world.hair + i / 3) * 0.25;
    this.hair.instanceMatrix.needsUpdate = true;
  }

  private placeFlyers(world: World) {
    const tetras = this.tetras.instanceMatrix.array;
    const tints = this.tetras.instanceColor.array;
    let count = 0;
    for (let i = 0; i < world.coins.length; i++) {
      const coin = world.coins[i];
      if (!coin.alive || !coin.inView) continue;

      instance(tetras, count, coin.x, coin.y, 0, coin.spinY, coin.spinZ, COIN_SIZE, COIN_SIZE);
      tint(tints, count, TEAL);
      count++;
    }

    for (let i = 0; i < world.particles.length; i++) {
      const spark = world.particles[i];
      if (!spark.alive || count >= TETRA_POOL) continue;

      const u = spark.t / spark.duration;
      const turn = 1 - (1 - u) * (1 - u);
      const moved = Math.max(0, (spark.t - spark.delay) / (spark.duration - spark.delay));
      const glide = 1 - (1 - moved) * (1 - moved) * (1 - moved);
      const x = spark.fromX + (spark.toX - spark.fromX) * glide;
      const y = spark.fromY + (spark.toY - spark.fromY) * glide;
      const size = SPARK_SIZE * (spark.size + (0.1 - spark.size) * turn);
      instance(tetras, count, x, y, 0, spark.turnY * turn, spark.turnZ * turn, size, size);
      tint(tints, count, spark.color);
      count++;
    }
    finish(this.tetras, count);
    if (count > 0) this.tetras.instanceColor.needsUpdate = true;

    const enemies = this.enemies.instanceMatrix.array;
    count = 0;
    for (let i = 0; i < world.enemies.length; i++) {
      const enemy = world.enemies[i];
      if (!enemy.alive || !enemy.inView || count >= ENEMY_POOL) continue;

      instance(enemies, count, enemy.x, enemy.y, 0, enemy.spinY, enemy.spinZ, ENEMY_SIZE, ENEMY_SIZE);
      count++;
    }
    finish(this.enemies, count);
  }

  private add(object: Group | Mesh) {
    object.matrixAutoUpdate = false;
    this.scene.add(object);
  }
}

// Writes a rotation (row-major r00..r22) and a translation into a matrix.
function setMatrix(
  m: Matrix4,
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
  const e = m.elements;
  e[0] = r00;
  e[1] = r10;
  e[2] = r20;
  e[3] = 0;
  e[4] = r01;
  e[5] = r11;
  e[6] = r21;
  e[7] = 0;
  e[8] = r02;
  e[9] = r12;
  e[10] = r22;
  e[11] = 0;
  e[12] = x;
  e[13] = y;
  e[14] = z;
  e[15] = 1;
}

// The sea's (and the cloud ring's) pose: turned by `angle` about its axis,
// which runs along z through (0, -SEA_RADIUS).
function turnAboutSea(m: Matrix4, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  setMatrix(m, c, -s, 0, s, c, 0, 0, 0, 1, 0, -SEA_RADIUS, 0);
}

// Instance `index` at (x, y, z), turned Ry(yaw) · Rz(roll) and scaled by
// `size` (y by `height`).
function instance(
  out: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
  yaw: number,
  roll: number,
  size: number,
  height: number,
) {
  const cy = yaw === 0 ? 1 : Math.cos(yaw);
  const sy = yaw === 0 ? 0 : Math.sin(yaw);
  const cz = roll === 0 ? 1 : Math.cos(roll);
  const sz = roll === 0 ? 0 : Math.sin(roll);
  const o = index * 16;
  out[o] = cy * cz * size;
  out[o + 1] = sz * size;
  out[o + 2] = -sy * cz * size;
  out[o + 3] = 0;
  out[o + 4] = -cy * sz * height;
  out[o + 5] = cz * height;
  out[o + 6] = sy * sz * height;
  out[o + 7] = 0;
  out[o + 8] = sy * size;
  out[o + 9] = 0;
  out[o + 10] = cy * size;
  out[o + 11] = 0;
  out[o + 12] = x;
  out[o + 13] = y;
  out[o + 14] = z;
  out[o + 15] = 1;
}

function tint(out: Float32Array, index: number, color: number) {
  out[index * 3] = ((color >> 16) & 255) / 255;
  out[index * 3 + 1] = ((color >> 8) & 255) / 255;
  out[index * 3 + 2] = (color & 255) / 255;
}

function finish(mesh: InstancedMesh, count: number) {
  mesh.count = count;
  if (count > 0) mesh.instanceMatrix.needsUpdate = true;
}
