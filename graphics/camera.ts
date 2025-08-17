import { Vector3 as MathVector3 } from '@math.gl/core';
import { MatrixUtils } from "../utils/matrixUtils.js";
import type { Matrix4x4, Vector3, CameraPosition, CameraTarget, CameraUp } from "../types/index.js";

// Camera class for handling 3D camera operations
export class Camera {
  public position: CameraPosition;
  public target: CameraTarget;
  public up: CameraUp;
  public rotation: number; // Y-axis rotation in degrees
  public zoom: number;
  public baseDistance: number; // Base distance from target
  public lastAspectRatio: number; // Track aspect ratio changes

  constructor() {
    this.position = { x: 3, y: 3, z: 3 };
    this.target = { x: 0, y: 0, z: 0 };
    this.up = { x: 0, y: 0, z: 1 };
    this.rotation = 0; // Y-axis rotation in degrees
    this.zoom = 1.0;
    this.baseDistance = 5.0; // Base distance from target
    this.lastAspectRatio = 1.0; // Track aspect ratio changes
  }

  // Update camera position based on rotation
  updatePosition(): void {
    const angleRad = (this.rotation * Math.PI) / 180;
    const distance = this.baseDistance / this.zoom;

    // Use math.gl Vector3 for position calculations
    const currentPos = new MathVector3([this.position.x, this.position.y, this.position.z]);
    
    // Calculate position in spherical coordinates
    const horizontalDistance = Math.sqrt(currentPos.x * currentPos.x + currentPos.y * currentPos.y);
    const elevation = Math.atan2(currentPos.z, horizontalDistance);

    // Calculate new position using spherical coordinates
    const newPosition = new MathVector3([
      distance * Math.cos(elevation) * Math.cos(angleRad),
      distance * Math.cos(elevation) * Math.sin(angleRad),
      distance * Math.sin(elevation)
    ]);

    this.position.x = newPosition.x;
    this.position.y = newPosition.y;
    this.position.z = newPosition.z;
  }

  // Move camera relative to its orientation
  moveRelative(forward: number, right: number, up: number): void {
    // Use math.gl Vector3 for camera's local coordinate system calculations
    const position = new MathVector3([this.position.x, this.position.y, this.position.z]);
    const target = new MathVector3([this.target.x, this.target.y, this.target.z]);
    const upVector = new MathVector3([this.up.x, this.up.y, this.up.z]);

    // Calculate forward vector (target - position) and normalize
    const forward_vec = new MathVector3(target).subtract(position).normalize();
    
    // Calculate right vector (forward × up) and normalize
    const right_vec = new MathVector3(forward_vec).cross(upVector).normalize();
    
    // Calculate up vector (right × forward)
    const up_vec = new MathVector3(right_vec).cross(forward_vec);

    // Create movement vector
    const movement = new MathVector3()
      .add(new MathVector3(right_vec).scale(right))
      .add(new MathVector3(forward_vec).scale(forward))
      .add(new MathVector3(up_vec).scale(up));

    // Apply movement to position
    const newPosition = new MathVector3(position).add(movement);
    this.position.x = newPosition.x;
    this.position.y = newPosition.y;
    this.position.z = newPosition.z;
  }

  // Create view matrix using math.gl lookAt function
  createViewMatrix(): Matrix4x4 {
    const eye: Vector3 = [this.position.x, this.position.y, this.position.z];
    const center: Vector3 = [this.target.x, this.target.y, this.target.z];
    const up: Vector3 = [this.up.x, this.up.y, this.up.z];

    // Use MatrixUtils.lookAt which internally uses math.gl Matrix4.lookAt
    return MatrixUtils.lookAt(eye, center, up);
  }

  // Create orthographic projection matrix using math.gl
  createProjectionMatrix(canvas: HTMLCanvasElement): Matrix4x4 {
    // Calculate aspect ratio from actual canvas dimensions
    const aspect = canvas.width / canvas.height;
    this.lastAspectRatio = aspect;

    // Adjust size based on zoom level
    const size = 1.5 / this.zoom;

    // Create orthographic projection with proper aspect ratio
    const left = -size * aspect;
    const right = size * aspect;
    const bottom = -size;
    const top = size;
    const near = -10;
    const far = 10;

    // Use MatrixUtils.orthographic which internally uses math.gl Matrix4.ortho
    return MatrixUtils.orthographic(left, right, bottom, top, near, far);
  }
} 