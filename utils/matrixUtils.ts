import { Matrix4, Vector3 } from '@math.gl/core';
import type { Matrix4x4, Vector3 as Vector3Type } from '../types/index.js';

// Matrix utility functions using math.gl
export const MatrixUtils = {
  // Create identity matrix
  identity: (): Matrix4x4 => new Matrix4().toFloat32Array(),

  // Matrix multiplication (A * B)
  multiply: (a: Matrix4x4, b: Matrix4x4): Matrix4x4 => {
    // Convert Float32Array to regular array for Matrix4 constructor
    const arrayA = Array.from(a);
    const arrayB = Array.from(b);
    const matrixA = new Matrix4(arrayA);
    const matrixB = new Matrix4(arrayB);
    // Create a copy to avoid modifying the original matrix
    return new Matrix4(matrixA).multiplyRight(matrixB).toFloat32Array();
  },

  // Vector normalization
  normalize: (v: Vector3Type): Vector3Type => {
    const vector = new Vector3(v);
    vector.normalize();
    return [vector.x, vector.y, vector.z];
  },

  // Vector cross product
  cross: (a: Vector3Type, b: Vector3Type): Vector3Type => {
    const vectorA = new Vector3(a);
    const vectorB = new Vector3(b);
    const result = vectorA.cross(vectorB);
    return [result.x, result.y, result.z];
  },

  // Vector dot product
  dot: (a: Vector3Type, b: Vector3Type): number => {
    const vectorA = new Vector3(a);
    const vectorB = new Vector3(b);
    return vectorA.dot(vectorB);
  },

  // Create translation matrix
  translation: (x: number, y: number, z: number): Matrix4x4 => {
    return new Matrix4().translate([x, y, z]).toFloat32Array();
  },

  // Create rotation matrix around Y axis
  // Note: Negating angle to match original behavior (clockwise rotation)
  rotationY: (angleInRadians: number): Matrix4x4 => {
    return new Matrix4().rotateY(-angleInRadians).toFloat32Array();
  },

  // Create scaling matrix
  scaling: (x: number, y: number, z: number): Matrix4x4 => {
    return new Matrix4().scale([x, y, z]).toFloat32Array();
  },

  // Additional utility methods using math.gl capabilities
  
  // Create rotation matrix around X axis
  // Note: Negating angle to match original clockwise rotation convention
  rotationX: (angleInRadians: number): Matrix4x4 => {
    return new Matrix4().rotateX(-angleInRadians).toFloat32Array();
  },

  // Create rotation matrix around Z axis
  // Note: Negating angle to match original clockwise rotation convention
  rotationZ: (angleInRadians: number): Matrix4x4 => {
    return new Matrix4().rotateZ(-angleInRadians).toFloat32Array();
  },

  // Create perspective projection matrix
  perspective: (fovy: number, aspect: number, near: number, far: number): Matrix4x4 => {
    return new Matrix4().perspective({ fovy, aspect, near, far }).toFloat32Array();
  },

  // Create orthographic projection matrix
  orthographic: (left: number, right: number, bottom: number, top: number, near: number, far: number): Matrix4x4 => {
    return new Matrix4().ortho({ left, right, bottom, top, near, far }).toFloat32Array();
  },

  // Create look-at matrix
  lookAt: (eye: Vector3Type, center: Vector3Type, up: Vector3Type): Matrix4x4 => {
    return new Matrix4().lookAt({ eye, center, up }).toFloat32Array();
  },

  // Matrix inverse
  inverse: (matrix: Matrix4x4): Matrix4x4 => {
    return new Matrix4(matrix).invert().toFloat32Array();
  },

  // Matrix transpose
  transpose: (matrix: Matrix4x4): Matrix4x4 => {
    return new Matrix4(matrix).transpose().toFloat32Array();
  },

  // Vector length/magnitude
  length: (v: Vector3Type): number => {
    return new Vector3(v).len();
  },

  // Vector distance between two points
  distance: (a: Vector3Type, b: Vector3Type): number => {
    const vectorA = new Vector3(a);
    const vectorB = new Vector3(b);
    return vectorA.distance(vectorB);
  },

  // Vector addition
  add: (a: Vector3Type, b: Vector3Type): Vector3Type => {
    const vectorA = new Vector3(a);
    const vectorB = new Vector3(b);
    const result = vectorA.add(vectorB);
    return [result.x, result.y, result.z];
  },

  // Vector subtraction
  subtract: (a: Vector3Type, b: Vector3Type): Vector3Type => {
    const vectorA = new Vector3(a);
    const vectorB = new Vector3(b);
    const result = vectorA.subtract(vectorB);
    return [result.x, result.y, result.z];
  },

  // Vector scalar multiplication
  scale: (v: Vector3Type, scalar: number): Vector3Type => {
    const vector = new Vector3(v);
    const result = vector.scale(scalar);
    return [result.x, result.y, result.z];
  }
}; 