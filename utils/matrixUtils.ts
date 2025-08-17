import { Matrix4, Vector3 } from '@math.gl/core';
import type { Matrix4x4, Vector3 as Vector3Type } from '../types/index.js';

// Reusable buffers for matrix operations to avoid memory allocation
// Using separate buffers for different operations to avoid conflicts
const MATRIX_BUFFERS = {
  identity: new Float32Array(16),
  multiply: new Float32Array(16),
  translation: new Float32Array(16),
  rotation: new Float32Array(16),
  scaling: new Float32Array(16),
  perspective: new Float32Array(16),
  orthographic: new Float32Array(16),
  lookAt: new Float32Array(16),
  inverse: new Float32Array(16),
  transpose: new Float32Array(16)
};

// Reusable Matrix4 and Vector3 objects to minimize object creation
// These objects are reused across operations to improve performance
const REUSABLE_OBJECTS = {
  matrix1: new Matrix4(),
  matrix2: new Matrix4(),
  matrix3: new Matrix4(),
  vector1: new Vector3(),
  vector2: new Vector3(),
  vector3: new Vector3()
};

// Matrix utility functions using math.gl
export const MatrixUtils = {
  // Create identity matrix
  identity: (): Matrix4x4 => REUSABLE_OBJECTS.matrix1.identity().toArray(MATRIX_BUFFERS.identity),

  // Matrix multiplication (A * B)
  multiply: (a: Matrix4x4, b: Matrix4x4): Matrix4x4 => {
    // Reuse objects to avoid allocation - directly use Float32Array without conversion
    REUSABLE_OBJECTS.matrix1.copy(a);
    REUSABLE_OBJECTS.matrix2.copy(b);
    return REUSABLE_OBJECTS.matrix1.multiplyRight(REUSABLE_OBJECTS.matrix2).toArray(MATRIX_BUFFERS.multiply);
  },

  // Vector normalization
  normalize: (v: Vector3Type): Vector3Type => {
    REUSABLE_OBJECTS.vector1.copy(v);
    REUSABLE_OBJECTS.vector1.normalize();
    return [REUSABLE_OBJECTS.vector1.x, REUSABLE_OBJECTS.vector1.y, REUSABLE_OBJECTS.vector1.z];
  },

  // Vector cross product
  cross: (a: Vector3Type, b: Vector3Type): Vector3Type => {
    REUSABLE_OBJECTS.vector1.copy(a);
    REUSABLE_OBJECTS.vector2.copy(b);
    const result = REUSABLE_OBJECTS.vector1.cross(REUSABLE_OBJECTS.vector2);
    return [result.x, result.y, result.z];
  },

  // Vector dot product
  dot: (a: Vector3Type, b: Vector3Type): number => {
    REUSABLE_OBJECTS.vector1.copy(a);
    REUSABLE_OBJECTS.vector2.copy(b);
    return REUSABLE_OBJECTS.vector1.dot(REUSABLE_OBJECTS.vector2);
  },

  // Create translation matrix
  translation: (x: number, y: number, z: number): Matrix4x4 => {
    return REUSABLE_OBJECTS.matrix1.identity().translate([x, y, z]).toArray(MATRIX_BUFFERS.translation);
  },

  // Create rotation matrix around Y axis
  // Note: Negating angle to match original behavior (clockwise rotation)
  rotationY: (angleInRadians: number): Matrix4x4 => {
    return REUSABLE_OBJECTS.matrix1.identity().rotateY(-angleInRadians).toArray(MATRIX_BUFFERS.rotation);
  },

  // Create scaling matrix
  scaling: (x: number, y: number, z: number): Matrix4x4 => {
    return REUSABLE_OBJECTS.matrix1.identity().scale([x, y, z]).toArray(MATRIX_BUFFERS.scaling);
  },

  // Additional utility methods using math.gl capabilities
  
  // Create rotation matrix around X axis
  // Note: Negating angle to match original clockwise rotation convention
  rotationX: (angleInRadians: number): Matrix4x4 => {
    return REUSABLE_OBJECTS.matrix1.identity().rotateX(-angleInRadians).toArray(MATRIX_BUFFERS.rotation);
  },

  // Create rotation matrix around Z axis
  // Note: Negating angle to match original clockwise rotation convention
  rotationZ: (angleInRadians: number): Matrix4x4 => {
    return REUSABLE_OBJECTS.matrix1.identity().rotateZ(-angleInRadians).toArray(MATRIX_BUFFERS.rotation);
  },

  // Create perspective projection matrix
  perspective: (fovy: number, aspect: number, near: number, far: number): Matrix4x4 => {
    return REUSABLE_OBJECTS.matrix1.identity().perspective({ fovy, aspect, near, far }).toArray(MATRIX_BUFFERS.perspective);
  },

  // Create orthographic projection matrix
  orthographic: (left: number, right: number, bottom: number, top: number, near: number, far: number): Matrix4x4 => {
    return REUSABLE_OBJECTS.matrix1.identity().ortho({ left, right, bottom, top, near, far }).toArray(MATRIX_BUFFERS.orthographic);
  },

  // Create look-at matrix
  lookAt: (eye: Vector3Type, center: Vector3Type, up: Vector3Type): Matrix4x4 => {
    return REUSABLE_OBJECTS.matrix1.identity().lookAt({ eye, center, up }).toArray(MATRIX_BUFFERS.lookAt);
  },

  // Matrix inverse
  inverse: (matrix: Matrix4x4): Matrix4x4 => {
    return REUSABLE_OBJECTS.matrix1.copy(matrix).invert().toArray(MATRIX_BUFFERS.inverse);
  },

  // Matrix transpose
  transpose: (matrix: Matrix4x4): Matrix4x4 => {
    return REUSABLE_OBJECTS.matrix1.copy(matrix).transpose().toArray(MATRIX_BUFFERS.transpose);
  },

  // Vector length/magnitude
  length: (v: Vector3Type): number => {
    return REUSABLE_OBJECTS.vector1.copy(v).len();
  },

  // Vector distance between two points
  distance: (a: Vector3Type, b: Vector3Type): number => {
    REUSABLE_OBJECTS.vector1.copy(a);
    REUSABLE_OBJECTS.vector2.copy(b);
    return REUSABLE_OBJECTS.vector1.distance(REUSABLE_OBJECTS.vector2);
  },

  // Vector addition
  add: (a: Vector3Type, b: Vector3Type): Vector3Type => {
    REUSABLE_OBJECTS.vector1.copy(a);
    REUSABLE_OBJECTS.vector2.copy(b);
    const result = REUSABLE_OBJECTS.vector1.add(REUSABLE_OBJECTS.vector2);
    return [result.x, result.y, result.z];
  },

  // Vector subtraction
  subtract: (a: Vector3Type, b: Vector3Type): Vector3Type => {
    REUSABLE_OBJECTS.vector1.copy(a);
    REUSABLE_OBJECTS.vector2.copy(b);
    const result = REUSABLE_OBJECTS.vector1.subtract(REUSABLE_OBJECTS.vector2);
    return [result.x, result.y, result.z];
  },

  // Vector scalar multiplication
  scale: (v: Vector3Type, scalar: number): Vector3Type => {
    const result = REUSABLE_OBJECTS.vector1.copy(v).scale(scalar);
    return [result.x, result.y, result.z];
  }
}; 