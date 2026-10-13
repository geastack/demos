import { Euler, Matrix4, Quaternion, Vector3 } from "@geastack/gea3d/three";
import { SEA_RADIUS } from "./world";

// The clouds: twenty puffs of three to five white blocks, spaced round a
// ring above the sea and turning with it. Each block is one instance of a
// cube, placed once here (the ring itself turns as one).

const CLOUDS = 20;
export const MAX_BLOCKS = CLOUDS * 5;

// Writes every block's matrix (relative to the sea's centre) into `out`,
// 16 floats each, and returns how many there are.
export function placeClouds(out: Float32Array): number {
  const cloud = new Matrix4();
  const block = new Matrix4();
  const both = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const size = new Vector3();
  const euler = new Euler();

  let count = 0;
  for (let c = 0; c < CLOUDS; c++) {
    const angle = (c * Math.PI * 2) / CLOUDS;
    const height = SEA_RADIUS + 150 + Math.random() * 200;
    const scale = 1 + Math.random() * 2;
    position.set(Math.cos(angle) * height, Math.sin(angle) * height, -300 - Math.random() * 500);
    euler.set(0, 0, angle + Math.PI / 2);
    rotation.setFromEuler(euler);
    size.set(scale, scale, scale);
    cloud.compose(position, rotation, size);

    const blocks = 3 + Math.floor(Math.random() * 3);
    for (let b = 0; b < blocks; b++) {
      const s = 0.1 + Math.random() * 0.9;
      position.set(b * 15, Math.random() * 10, Math.random() * 10);
      euler.set(0, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
      rotation.setFromEuler(euler);
      size.set(s, s, s);
      block.compose(position, rotation, size);
      both.multiplyMatrices(cloud, block);
      const e = both.elements;
      for (let i = 0; i < 16; i++) out[count * 16 + i] = e[i];
      count++;
    }
  }
  return count;
}
