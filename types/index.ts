// WebGPU Types
export interface WebGPUContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat | null;
}

export interface BindGroupLayoutEntry {
  binding: number;
  visibility: GPUShaderStageFlags;
  buffer?: GPUBufferBindingLayout;
  texture?: GPUTextureBindingLayout;
  sampler?: GPUSamplerBindingLayout;
  storageTexture?: GPUStorageTextureBindingLayout;
}

export interface BindGroupEntry {
  binding: number;
  resource: GPUBindingResource;
}

// Matrix and Vector Types
export type Matrix4x4 = Float32Array;
export type Vector3 = [number, number, number];
export type Vector4 = [number, number, number, number];

// Camera Types
export interface CameraPosition {
  x: number;
  y: number;
  z: number;
}

export interface CameraTarget {
  x: number;
  y: number;
  z: number;
}

export interface CameraUp {
  x: number;
  y: number;
  z: number;
}

// Particle System Types
export interface ParticleData {
  position: Vector3;
  radius: number;
  velocity: Vector3;
  mass: number;
  force: Vector3;
  id: number;
}

export interface ParticleUniforms {
  mvpMatrix: Matrix4x4;
  acceleration: Vector3;
  time: number;
}

export interface TerrainParams {
  gridResolution: number;
  cellSize: number;
  heightScale: number;
  padding: number;
}

// Geometry Types
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Triangle {
  v1: Point3D;
  v2: Point3D;
  v3: Point3D;
}

export interface SphereParams {
  radius: number;
  center: Point3D;
  segments: number;
  rings: number;
}

// Pipeline Types
export interface PipelineSet {
  wireframe: GPURenderPipeline;
  terrain: GPURenderPipeline;
  xAxis: GPURenderPipeline;
  yAxis: GPURenderPipeline;
  zAxis: GPURenderPipeline;
}

export interface GPUParticleBindGroups {
  bindGroup0: GPUBindGroup;
  bindGroup1: GPUBindGroup;
}

// Axes Types
export interface AxesBuffers {
  xAxisVertexBuffer: GPUBuffer;
  yAxisVertexBuffer: GPUBuffer;
  zAxisVertexBuffer: GPUBuffer;
  numAxisVertices: number;
}

// Mod1 Parser Types
export interface Mod1Point {
  x: number;
  y: number;
  z: number;
}

export interface Mod1Data {
  points: Mod1Point[];
  triangles: Triangle[];
  metadata?: {
    name?: string;
    description?: string;
    version?: string;
  };
}

// Canvas and Rendering Types
export interface CanvasSize {
  width: number;
  height: number;
}

export interface RenderPassDescriptor {
  colorAttachments: GPURenderPassColorAttachment[];
  depthStencilAttachment?: GPURenderPassDepthStencilAttachment;
}

// Physics Types
export interface PhysicsParams {
  deltaTime: number;
  acceleration: Vector3;
  gravity: Vector3;
  damping: number;
}

export interface CollisionData {
  particleId: number;
  collisionType: 'terrain' | 'particle' | 'boundary';
  normal: Vector3;
  depth: number;
}

// Grid Types
export interface GridCell {
  count: number;
  padding: number;
  indices: number[];
}

export interface SpatialGrid {
  size: number;
  cellSize: number;
  cells: GridCell[];
}

// Event Types
export interface ResizeEvent {
  width: number;
  height: number;
  devicePixelRatio: number;
}

// Error Types
export interface WebGPUError extends Error {
  code?: string;
  details?: any;
}

// Animation Types
export interface AnimationFrame {
  timestamp: number;
  deltaTime: number;
  frameCount: number;
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// WebGPU Buffer Types
export interface BufferConfig {
  size: number;
  usage: GPUBufferUsageFlags;
  mappedAtCreation?: boolean;
  label?: string;
}

export interface TextureConfig {
  size: GPUExtent3D;
  format: GPUTextureFormat;
  usage: GPUTextureUsageFlags;
  label?: string;
}

// Shader Types
export interface ShaderModuleConfig {
  code: string;
  label?: string;
}

// Pipeline Types
export interface RenderPipelineConfig {
  vertex: GPUVertexState;
  fragment?: GPUFragmentState;
  primitive?: GPUPrimitiveState;
  depthStencil?: GPUDepthStencilState;
  multisample?: GPUMultisampleState;
  layout?: GPUPipelineLayout;
  label?: string;
}

export interface ComputePipelineConfig {
  compute: GPUProgrammableStage;
  layout?: GPUPipelineLayout;
  label?: string;
} 