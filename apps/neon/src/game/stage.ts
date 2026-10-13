import { GeaRenderer } from "@geastack/gea3d";
import {
  DoubleSide,
  Fog,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  type Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
} from "@geastack/gea3d/three";
import { buildHalo, buildRidges, buildSky, buildStars, buildSun } from "./backdrop";
import { Builder, clamp01, FOG_FAR, FOG_NEAR, HAZE_HEX, mix, type Rgb } from "./geometry";
import {
  buildCrossLines,
  buildDashes,
  buildGlow,
  buildGridLines,
  buildRoad,
  buildRoadEdges,
  GROUND_HORIZON,
  GROUND_NEAR,
  MARK_PERIOD,
} from "./ground";
import { buildBarrier, buildPylon, buildShard, buildShip, buildShipEdges } from "./models";
import { PROP_BARRIER, PROP_PYLON, PROP_SHARD, type World } from "./world";

// The focal length is 250 px on a 480 px wide panel and scales with the
// width, so the road always spans the same share of the screen. The vertical
// FOV follows from the panel height (57 degrees at 480x272, 87 at 480x480).
const REF_FOCAL = 250;
const REF_WIDTH = 480;
const NEAR = 0.1;
const FAR = 1600;
const POOL = 16;

// The ground and everything on it are drawn scaled about the camera by this
// factor: they project to the same pixels but sort behind the craft and the
// props, so the painter's order never lets the ground cover them.
const GROUND_PUSH = 3;
// The scrolling marks are pushed less: in front of the ground but still
// behind whatever stands on them (the scene fog sees them this much farther).
const MARKS_PUSH = 1.5;

// The whole scene in gea3d: a backdrop that follows the camera, the pushed
// ground, the craft and three instanced prop pools. Matrices are written
// directly; nothing is composed from position/rotation per frame.
export class Stage {
  private readonly scene = new Scene();
  private readonly width = window.innerWidth;
  private readonly height = window.innerHeight;
  private readonly focal = (REF_FOCAL * window.innerWidth) / REF_WIDTH;
  private readonly camera = new PerspectiveCamera(
    (2 * Math.atan(window.innerHeight / 2 / ((REF_FOCAL * window.innerWidth) / REF_WIDTH)) * 180) / Math.PI,
    window.innerWidth / window.innerHeight,
    NEAR,
    FAR,
  );
  private readonly renderer = new GeaRenderer();
  private readonly backdrop = new Group();
  private readonly ground = new Group();
  private readonly glow: Mesh;
  private readonly ship: Mesh;
  private readonly barriers: InstancedMesh;
  private readonly pylons: InstancedMesh;
  private readonly shards: InstancedMesh;
  private readonly marks = new Group();
  private eyeX = 0;
  private eyeY = 0;
  private eyeZ = 0;

  constructor() {
    this.renderer.setSize(this.width, this.height);
    this.scene.backgroundColor = 0x080420;
    this.scene.fog = new Fog(HAZE_HEX, FOG_NEAR, FOG_FAR);
    this.camera.matrixAutoUpdate = false;

    const flat = new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide });

    const sky = new Builder();
    buildSky(sky);
    buildHalo(sky);
    buildSun(sky);
    buildRidges(sky);
    const stars = new Builder();
    buildStars(stars);
    this.backdrop.add(new Mesh(sky.geometry(), flat));
    this.backdrop.add(
      new Points(
        stars.geometry(),
        new PointsMaterial({ vertexColors: true, fog: false, size: 1, sizeAttenuation: false }),
      ),
    );
    this.add(this.backdrop);

    const ground = new Builder();
    buildRoad(ground);
    buildRoadEdges(ground);
    const grid = new Builder();
    buildGridLines(grid);
    const glow = new Builder();
    buildGlow(glow);
    this.glow = new Mesh(glow.geometry(), flat);
    this.glow.matrixAutoUpdate = false;
    this.ground.add(new Mesh(ground.geometry(), flat));
    this.ground.add(new LineSegments(grid.geometry(), new LineBasicMaterial({ vertexColors: true, fog: false })));
    const crossLines = new Builder();
    buildCrossLines(crossLines);
    const dashes = new Builder();
    buildDashes(dashes);
    this.marks.add(new LineSegments(crossLines.geometry(), new LineBasicMaterial({ vertexColors: true })));
    this.marks.add(new Mesh(dashes.geometry(), new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })));
    this.add(this.marks);
    this.ground.add(this.glow);
    this.add(this.ground);

    const solid = new MeshBasicMaterial({ vertexColors: true });
    const ship = new Builder();
    buildShip(ship);
    const edges = new Builder();
    buildShipEdges(edges);
    this.ship = new Mesh(ship.geometry(), solid);
    const outline = new LineSegments(edges.geometry(), new LineBasicMaterial({ vertexColors: true }));
    outline.matrixAutoUpdate = false;
    this.ship.add(outline);
    this.add(this.ship);

    this.barriers = this.pool(buildBarrier, solid);
    this.pylons = this.pool(buildPylon, solid);
    this.shards = this.pool(buildShard, solid);
  }

  // The camera at (x, y, z), pitched down by `pitch` radians.
  view(x: number, y: number, z: number, pitch: number) {
    this.eyeX = x;
    this.eyeY = y;
    this.eyeZ = z;
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    // Rx(-pitch): looking down -z, tipped down.
    setMatrix(this.camera.matrix, 1, 0, 0, 0, c, s, 0, -s, c, x, y, z);

    // The ground off the road is the background: a ramp from the horizon's
    // glow down to the near ground colour at the bottom row, anchored to
    // where the horizon is on screen (above the horizon the sky covers it).
    const horizon = this.height / 2 - (this.focal * s) / c;
    const top = -horizon / (this.height - 1 - horizon);
    this.scene.backgroundColor = hexOf(mix(GROUND_HORIZON, GROUND_NEAR, top));
    this.scene.backgroundBottom = hexOf(GROUND_NEAR);

    // At infinity: the backdrop keeps its place relative to the eye.
    setMatrix(this.backdrop.matrix, 1, 0, 0, 0, 1, 0, 0, 0, 1, x, y, z);
    // p -> eye + GROUND_PUSH * (p - eye)
    const k = GROUND_PUSH;
    setMatrix(this.ground.matrix, k, 0, 0, 0, k, 0, 0, 0, k, (1 - k) * x, (1 - k) * y, (1 - k) * z);
  }

  // Poses the craft, its glow and the props, and scrolls the ground marks.
  place(world: World, shipY: number, timeS: number) {
    const cr = Math.cos(world.roll);
    const sr = Math.sin(world.roll);
    const cp = Math.cos(world.pitch);
    const sp = Math.sin(world.pitch);
    // T(x, y, 0) · Rx(pitch) · Rz(roll)
    setMatrix(this.ship.matrix, cr, -sr, 0, cp * sr, cp * cr, -sp, sp * sr, sp * cr, cp, world.shipX, shipY, 0);

    // The glow shrinks as the craft climbs.
    const size = Math.max(0.05, 1 - shipY / 2.5);
    setMatrix(this.glow.matrix, size, 0, 0, 0, 1, 0, 0, 0, size, world.shipX, 0, 0);

    let barriers = 0;
    let pylons = 0;
    let shards = 0;
    for (let i = 0; i < world.props.length; i++) {
      const prop = world.props[i];
      if (prop.kind === PROP_BARRIER) placeAt(this.barriers, barriers++, prop.x, prop.y, prop.z, 0);
      else if (prop.kind === PROP_PYLON) placeAt(this.pylons, pylons++, prop.x, prop.y, prop.z, 0);
      else if (prop.kind === PROP_SHARD) {
        const bob = Math.sin(timeS * 4 + i) * 0.12;
        placeAt(this.shards, shards++, prop.x, prop.y + bob, prop.z, timeS * 2.4 + i * 1.7);
      }
    }
    finishPool(this.barriers, barriers);
    finishPool(this.pylons, pylons);
    finishPool(this.shards, shards);

    // p -> eye + MARKS_PUSH * (p + scroll - eye), scroll along z.
    const m = MARKS_PUSH;
    const scroll = world.odometer % MARK_PERIOD;
    const x = (1 - m) * this.eyeX;
    const y = (1 - m) * this.eyeY;
    const z = (1 - m) * this.eyeZ + m * scroll;
    setMatrix(this.marks.matrix, m, 0, 0, 0, m, 0, 0, 0, m, x, y, z);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  private add(object: Group | Mesh) {
    object.matrixAutoUpdate = false;
    this.scene.add(object);
  }

  private pool(build: (builder: Builder) => void, material: MeshBasicMaterial): InstancedMesh {
    const builder = new Builder();
    build(builder);
    const mesh = new InstancedMesh(builder.geometry(), material, POOL);
    mesh.count = 0;
    this.add(mesh);
    return mesh;
  }
}

// Writes a rotation (row-major r00..r22) and translation into a matrix.
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

// Instance `index` of a pool at (x, y, z), turned by `yaw` about y.
function placeAt(mesh: InstancedMesh, index: number, x: number, y: number, z: number, yaw: number) {
  const a = mesh.instanceMatrix.array;
  const o = index * 16;
  const c = yaw === 0 ? 1 : Math.cos(yaw);
  const s = yaw === 0 ? 0 : Math.sin(yaw);
  a[o] = c;
  a[o + 1] = 0;
  a[o + 2] = -s;
  a[o + 3] = 0;
  a[o + 4] = 0;
  a[o + 5] = 1;
  a[o + 6] = 0;
  a[o + 7] = 0;
  a[o + 8] = s;
  a[o + 9] = 0;
  a[o + 10] = c;
  a[o + 11] = 0;
  a[o + 12] = x;
  a[o + 13] = y;
  a[o + 14] = z;
  a[o + 15] = 1;
}

function hexOf(color: Rgb): number {
  const r = Math.round(clamp01(color.r) * 255);
  const g = Math.round(clamp01(color.g) * 255);
  const b = Math.round(clamp01(color.b) * 255);
  return r * 65536 + g * 256 + b;
}

function finishPool(mesh: InstancedMesh, count: number) {
  mesh.count = count;
  if (count > 0) mesh.instanceMatrix.needsUpdate = true;
}
