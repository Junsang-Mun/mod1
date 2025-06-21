import { MatrixUtils } from '../utils/matrixUtils.js';

// Camera class for handling 3D camera operations
export class Camera {
  constructor() {
    this.position = { x: 3, y: 3, z: 3 };
    this.target = { x: 0, y: 0, z: 0 };
    this.up = { x: 0, y: 0, z: 1 };
    this.rotation = 0; // Y-axis rotation in degrees
    this.zoom = 1.0;
    this.baseDistance = 5.0; // Base distance from target
  }

  // Update camera position based on rotation
  updatePosition() {
    const angleRad = (this.rotation * Math.PI) / 180;
    const distance = this.baseDistance / this.zoom;
    
    // Calculate position in spherical coordinates
    const elevation = Math.atan2(this.position.z, Math.sqrt(this.position.x * this.position.x + this.position.y * this.position.y));
    
    this.position.x = distance * Math.cos(elevation) * Math.cos(angleRad);
    this.position.y = distance * Math.cos(elevation) * Math.sin(angleRad);
    this.position.z = distance * Math.sin(elevation);
  }

  // Move camera relative to its orientation
  moveRelative(forward, right, up) {
    // Calculate camera's local coordinate system
    const forward_vec = MatrixUtils.normalize([
      this.target.x - this.position.x,
      this.target.y - this.position.y,
      this.target.z - this.position.z
    ]);
    
    const right_vec = MatrixUtils.normalize(MatrixUtils.cross(forward_vec, [this.up.x, this.up.y, this.up.z]));
    const up_vec = MatrixUtils.cross(right_vec, forward_vec);

    // Apply movement
    this.position.x += right_vec[0] * right + forward_vec[0] * forward + up_vec[0] * up;
    this.position.y += right_vec[1] * right + forward_vec[1] * forward + up_vec[1] * up;
    this.position.z += right_vec[2] * right + forward_vec[2] * forward + up_vec[2] * up;
  }

  // Create view matrix
  createViewMatrix() {
    const eye = [this.position.x, this.position.y, this.position.z];
    const target = [this.target.x, this.target.y, this.target.z];
    const up = [this.up.x, this.up.y, this.up.z];

    // Calculate forward vector (target - eye)
    const forward = MatrixUtils.normalize([
      target[0] - eye[0],
      target[1] - eye[1],
      target[2] - eye[2]
    ]);

    // Calculate right vector (forward × up)
    const right = MatrixUtils.normalize(MatrixUtils.cross(forward, up));

    // Calculate new up vector (right × forward)
    const newUp = MatrixUtils.cross(right, forward);

    // Create view matrix
    return new Float32Array([
      right[0], newUp[0], -forward[0], 0,
      right[1], newUp[1], -forward[1], 0,
      right[2], newUp[2], -forward[2], 0,
      -MatrixUtils.dot(right, eye),
      -MatrixUtils.dot(newUp, eye),
      MatrixUtils.dot(forward, eye),
      1
    ]);
  }

  // Create orthographic projection matrix
  createProjectionMatrix(canvas) {
    const aspect = canvas.width / canvas.height;
    const size = 1.5 / this.zoom;
    const left = -size * aspect;
    const right = size * aspect;
    const bottom = -size;
    const top = size;
    const near = -10;
    const far = 10;

    return new Float32Array([
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, -2 / (far - near), 0,
      -(right + left) / (right - left),
      -(top + bottom) / (top - bottom),
      -(far + near) / (far - near),
      1
    ]);
  }
} 