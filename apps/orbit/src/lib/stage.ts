import { GeaRenderer } from "@geastack/gea3d";
import {
  AmbientLight,
  DirectionalLight,
  type Material,
  type Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
} from "@geastack/gea3d/three";
import { BACKGROUND, paletteColor } from "./palette";
import { floorShape, gemReflectionShape, gemShape, orbitShape } from "./pieces";
import type { Shape } from "./shape";

// Meshes, in build order: the gem alone makes the first frame, one more is
// added per frame after it.
export const GEM = 0;
const FLOOR = 1;
const REFLECTION = 2;
export const ORBIT_A = 3;
export const ORBIT_B = 4;
const MESH_COUNT = 5;

// Vertical FOV at the reference 480x272 landscape. Narrower screens keep the
// same horizontal span (so the gem and orbits keep their width) and widen the
// vertical FOV instead.
const FOV = 36;
const REF_ASPECT = 480 / 272;
const NEAR = 0.1;
const FAR = 160;
const LOOK_Y = 0.75;
// The floor is drawn scaled about the camera by this factor: it projects to
// the same pixels but sorts behind everything, so the painter's algorithm
// always lays it down first and the reflection lands on top of it.
const FLOOR_PUSH = 4;

// Every mesh's matrix is written here directly; nothing is composed from
// position/rotation per frame.
export class Stage {
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly renderer: GeaRenderer;
  private readonly lit: MeshLambertMaterial;
  private readonly flat: MeshBasicMaterial;
  private readonly shapes: Shape[] = [];
  private readonly meshes: Mesh[] = [];
  private theme = 0;

  constructor() {
    this.scene = new Scene();
    this.scene.backgroundColor = paletteColor(0, BACKGROUND);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const fov = aspect >= REF_ASPECT ? FOV : fovFor(aspect);
    this.camera = new PerspectiveCamera(fov, aspect, NEAR, FAR);
    this.renderer = new GeaRenderer();
    this.renderer.setSize(width, height);
    this.lit = new MeshLambertMaterial({ vertexColors: true });
    this.flat = new MeshBasicMaterial({ vertexColors: true });

    // Cool fill, warm key from the front left, cool rim from behind, and a
    // soft bounce from the glowing floor that lights the pavilion.
    this.scene.add(new AmbientLight(0x8890c0, 0.3));
    this.addLight(0xfff0e0, 1, -3, 5, 4);
    this.addLight(0x90b0ff, 0.65, 4, 2, -5);
    this.addLight(0xb0b8ff, 0.45, 0, -4, 2);

    // Lights never move: freeze the whole graph (meshes join frozen too).
    this.scene.updateMatrixWorld(true);
    this.scene.matrixAutoUpdate = false;
    const children = this.scene.children;
    for (let i = 0; i < children.length; i++) children[i].matrixAutoUpdate = false;

    this.addMesh(gemShape(), this.lit, false);
  }

  // Adds the next mesh, if any are left to build.
  buildNext(): void {
    const next = this.meshes.length;
    if (next === FLOOR) this.addMesh(floorShape(), this.flat, false);
    else if (next === REFLECTION) this.addMesh(gemReflectionShape(), this.flat, true);
    else if (next === ORBIT_A) this.addMesh(orbitShape(2.05, 2, 0.15), this.lit, false);
    else if (next === ORBIT_B) this.addMesh(orbitShape(2.45, 1, 0.2), this.lit, false);
  }

  complete(): boolean {
    return this.meshes.length === MESH_COUNT;
  }

  // Re-bakes every mesh's colours; the geometry itself is kept.
  setTheme(theme: number): void {
    this.theme = theme;
    this.scene.backgroundColor = paletteColor(theme, BACKGROUND);
    for (let i = 0; i < this.meshes.length; i++) this.shapes[i].recolor(this.meshes[i].geometry, theme);
  }

  // Poses a piece (the gem also moves its reflection, mirrored through the
  // floor plane). Pieces not built yet are skipped.
  place(piece: number, heading: number, tilt: number, spin: number, scale: number, y: number): void {
    if (piece >= this.meshes.length) return;

    const mesh = this.meshes[piece];
    orient(mesh.matrix, heading, tilt, spin, Math.max(0.001, scale), 0, y, 0);
    mesh.matrixWorldNeedsUpdate = true;
    if (piece !== GEM || REFLECTION >= this.meshes.length) return;

    const reflection = this.meshes[REFLECTION];
    mirror(mesh.matrix, reflection.matrix);
    reflection.matrixWorldNeedsUpdate = true;
  }

  // Places the camera on a sphere around the look-at point.
  view(azimuth: number, elevation: number, distance: number): void {
    const ground = distance * Math.cos(elevation);
    const x = ground * Math.sin(azimuth);
    const y = LOOK_Y + distance * Math.sin(elevation);
    const z = ground * Math.cos(azimuth);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, LOOK_Y, 0);
    if (FLOOR >= this.meshes.length) return;

    const floor = this.meshes[FLOOR];
    const shift = 1 - FLOOR_PUSH;
    orient(floor.matrix, 0, 0, 0, FLOOR_PUSH, shift * x, shift * y, shift * z);
    floor.matrixWorldNeedsUpdate = true;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private addLight(color: number, intensity: number, x: number, y: number, z: number): void {
    const light = new DirectionalLight(color, intensity);
    light.position.set(x, y, z);
    this.scene.add(light);
  }

  private addMesh(shape: Shape, material: Material, mirrored: boolean): void {
    const mesh = new Mesh(shape.geometry(this.theme, mirrored), material);
    mesh.matrixAutoUpdate = false;
    this.scene.add(mesh);
    this.shapes.push(shape);
    this.meshes.push(mesh);
  }
}

// Vertical FOV (degrees) giving the reference horizontal span at `aspect`.
function fovFor(aspect: number): number {
  const halfWidth = Math.tan((FOV * Math.PI) / 360) * REF_ASPECT;
  return (2 * Math.atan(halfWidth / aspect) * 180) / Math.PI;
}

// m = T(x, y, z) · Ry(heading) · Rx(tilt) · Ry(spin) · S(scale): a spin about
// the local Y axis, tipped by `tilt` towards `heading`.
function orient(
  m: Matrix4,
  heading: number,
  tilt: number,
  spin: number,
  scale: number,
  x: number,
  y: number,
  z: number,
) {
  const ch = Math.cos(heading);
  const sh = Math.sin(heading);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const cs = Math.cos(spin);
  const ss = Math.sin(spin);

  // Rx(tilt) · Ry(spin), row by row.
  const b00 = cs;
  const b02 = ss;
  const b10 = st * ss;
  const b11 = ct;
  const b12 = -st * cs;
  const b20 = -ct * ss;
  const b21 = st;
  const b22 = ct * cs;

  // Column-major: e[column * 4 + row].
  const e = m.elements;
  e[0] = (ch * b00 + sh * b20) * scale;
  e[1] = b10 * scale;
  e[2] = (-sh * b00 + ch * b20) * scale;
  e[3] = 0;
  e[4] = sh * b21 * scale;
  e[5] = b11 * scale;
  e[6] = ch * b21 * scale;
  e[7] = 0;
  e[8] = (ch * b02 + sh * b22) * scale;
  e[9] = b12 * scale;
  e[10] = (-sh * b02 + ch * b22) * scale;
  e[11] = 0;
  e[12] = x;
  e[13] = y;
  e[14] = z;
  e[15] = 1;
}

// to = flipY · from: the reflection through the floor plane y = 0 (the Y row,
// elements 1, 5, 9 and 13, negated).
function mirror(from: Matrix4, to: Matrix4) {
  to.copy(from);
  const e = to.elements;
  e[1] = -e[1];
  e[5] = -e[5];
  e[9] = -e[9];
  e[13] = -e[13];
}
