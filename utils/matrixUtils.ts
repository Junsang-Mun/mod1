import type { Matrix4x4, Vector3 } from '../types/index.js';

// Matrix utility functions
export const MatrixUtils = {
  // Create identity matrix
  identity: (): Matrix4x4 => new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]),

  // Matrix multiplication (A * B)
  multiply: (a: Matrix4x4, b: Matrix4x4): Matrix4x4 => {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[j * 4 + i] = 
          a[i] * b[j * 4] +
          a[i + 4] * b[j * 4 + 1] +
          a[i + 8] * b[j * 4 + 2] +
          a[i + 12] * b[j * 4 + 3];
      }
    }
    return result;
  },

  // Vector normalization
  normalize: (v: Vector3): Vector3 => {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0];
  },

  // Vector cross product
  cross: (a: Vector3, b: Vector3): Vector3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ],

  // Vector dot product
  dot: (a: Vector3, b: Vector3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],

  // Create translation matrix
  translation: (x: number, y: number, z: number): Matrix4x4 => new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ]),

  // Create rotation matrix around Y axis
  rotationY: (angleInRadians: number): Matrix4x4 => {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return new Float32Array([
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1
    ]);
  },

  // Create scaling matrix
  scaling: (x: number, y: number, z: number): Matrix4x4 => new Float32Array([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1
  ])
}; 