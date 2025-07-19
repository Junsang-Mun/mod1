// utils/mod1Parser.ts
function parseMod1Content(content, filename) {
  const lines = content.trim().split(`
`);
  const result = {
    points: [],
    metadata: {
      filename,
      totalPoints: 0
    }
  };
  lines.forEach((line, lineIndex) => {
    const coordinateGroups = line.trim().split(" ");
    coordinateGroups.forEach((group) => {
      const [x, y, z] = group.replace(/[()]/g, "").split(",").map(Number);
      result.points.push({
        x,
        y,
        z,
        lineIndex: lineIndex + 1
      });
    });
  });
  result.metadata.totalPoints = result.points.length;
  return result;
}
function normalizeContent(parsedData) {
  const bounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };
  parsedData.points.forEach((point) => {
    bounds.min.x = Math.min(bounds.min.x, point.x);
    bounds.min.y = Math.min(bounds.min.y, point.y);
    bounds.min.z = Math.min(bounds.min.z, point.z);
    bounds.max.x = Math.max(bounds.max.x, point.x);
    bounds.max.y = Math.max(bounds.max.y, point.y);
    bounds.max.z = Math.max(bounds.max.z, point.z);
  });
  const rangeX = bounds.max.x - bounds.min.x;
  const rangeY = bounds.max.y - bounds.min.y;
  const rangeZ = bounds.max.z - bounds.min.z;
  const maxRange = Math.max(rangeX, rangeY, rangeZ);
  const normalizedPoints = parsedData.points.map((point) => {
    const normalizedX = maxRange === 0 ? 0 : (point.x - bounds.min.x) / maxRange * 2 - 1;
    const normalizedY = maxRange === 0 ? 0 : (point.y - bounds.min.y) / maxRange * 2 - 1;
    const normalizedZ = maxRange === 0 ? 0 : (point.z - bounds.min.z) / maxRange * 2 - 1;
    return {
      x: normalizedX,
      y: normalizedY,
      z: normalizedZ,
      originalX: point.x,
      originalY: point.y,
      originalZ: point.z,
      lineIndex: point.lineIndex
    };
  });
  return {
    points: normalizedPoints,
    metadata: {
      ...parsedData.metadata,
      bounds,
      maxRange
    }
  };
}
function loadMod1ToJson(content, filename) {
  try {
    const parsedData = parseMod1Content(content, filename);
    return normalizeContent(parsedData);
  } catch (error) {
    throw new Error(`Error converting mod1 to JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// utils/matrixUtils.ts
var MatrixUtils = {
  identity: () => new Float32Array([
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
  ]),
  multiply: (a, b) => {
    const result = new Float32Array(16);
    for (let i = 0;i < 4; i++) {
      for (let j = 0;j < 4; j++) {
        result[j * 4 + i] = a[i] * b[j * 4] + a[i + 4] * b[j * 4 + 1] + a[i + 8] * b[j * 4 + 2] + a[i + 12] * b[j * 4 + 3];
      }
    }
    return result;
  },
  normalize: (v) => {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0];
  },
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  translation: (x, y, z) => new Float32Array([
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    x,
    y,
    z,
    1
  ]),
  rotationY: (angleInRadians) => {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return new Float32Array([
      c,
      0,
      s,
      0,
      0,
      1,
      0,
      0,
      -s,
      0,
      c,
      0,
      0,
      0,
      0,
      1
    ]);
  },
  scaling: (x, y, z) => new Float32Array([
    x,
    0,
    0,
    0,
    0,
    y,
    0,
    0,
    0,
    0,
    z,
    0,
    0,
    0,
    0,
    1
  ])
};

// graphics/camera.ts
class Camera {
  position;
  target;
  up;
  rotation;
  zoom;
  baseDistance;
  lastAspectRatio;
  constructor() {
    this.position = { x: 3, y: 3, z: 3 };
    this.target = { x: 0, y: 0, z: 0 };
    this.up = { x: 0, y: 0, z: 1 };
    this.rotation = 0;
    this.zoom = 1;
    this.baseDistance = 5;
    this.lastAspectRatio = 1;
  }
  updatePosition() {
    const angleRad = this.rotation * Math.PI / 180;
    const distance = this.baseDistance / this.zoom;
    const elevation = Math.atan2(this.position.z, Math.sqrt(this.position.x * this.position.x + this.position.y * this.position.y));
    this.position.x = distance * Math.cos(elevation) * Math.cos(angleRad);
    this.position.y = distance * Math.cos(elevation) * Math.sin(angleRad);
    this.position.z = distance * Math.sin(elevation);
  }
  moveRelative(forward, right, up) {
    const forward_vec = MatrixUtils.normalize([
      this.target.x - this.position.x,
      this.target.y - this.position.y,
      this.target.z - this.position.z
    ]);
    const right_vec = MatrixUtils.normalize(MatrixUtils.cross(forward_vec, [this.up.x, this.up.y, this.up.z]));
    const up_vec = MatrixUtils.cross(right_vec, forward_vec);
    this.position.x += right_vec[0] * right + forward_vec[0] * forward + up_vec[0] * up;
    this.position.y += right_vec[1] * right + forward_vec[1] * forward + up_vec[1] * up;
    this.position.z += right_vec[2] * right + forward_vec[2] * forward + up_vec[2] * up;
  }
  createViewMatrix() {
    const eye = [this.position.x, this.position.y, this.position.z];
    const target = [this.target.x, this.target.y, this.target.z];
    const up = [this.up.x, this.up.y, this.up.z];
    const forward = MatrixUtils.normalize([
      target[0] - eye[0],
      target[1] - eye[1],
      target[2] - eye[2]
    ]);
    const right = MatrixUtils.normalize(MatrixUtils.cross(forward, up));
    const newUp = MatrixUtils.cross(right, forward);
    return new Float32Array([
      right[0],
      newUp[0],
      -forward[0],
      0,
      right[1],
      newUp[1],
      -forward[1],
      0,
      right[2],
      newUp[2],
      -forward[2],
      0,
      -MatrixUtils.dot(right, eye),
      -MatrixUtils.dot(newUp, eye),
      MatrixUtils.dot(forward, eye),
      1
    ]);
  }
  createProjectionMatrix(canvas) {
    const aspect = canvas.width / canvas.height;
    this.lastAspectRatio = aspect;
    const size = 1.5 / this.zoom;
    const left = -size * aspect;
    const right = size * aspect;
    const bottom = -size;
    const top = size;
    const near = -10;
    const far = 10;
    return new Float32Array([
      2 / (right - left),
      0,
      0,
      0,
      0,
      2 / (top - bottom),
      0,
      0,
      0,
      0,
      -2 / (far - near),
      0,
      -(right + left) / (right - left),
      -(top + bottom) / (top - bottom),
      -(far + near) / (far - near),
      1
    ]);
  }
}

// graphics/webgpu.ts
class WebGPUSetup {
  device;
  context;
  format;
  canvas;
  constructor() {
    this.device = null;
    this.context = null;
    this.format = null;
    this.canvas = null;
  }
  async initialize(canvas) {
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("Failed to get GPU adapter");
    }
    this.device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("Failed to get WebGPU context");
    }
    this.context = context;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.canvas = canvas;
    this.configureContext();
    return {
      device: this.device,
      context: this.context,
      format: this.format
    };
  }
  configureContext() {
    if (!this.context || !this.device)
      return;
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque"
    });
  }
  async createShaderModule(shaderPath) {
    const shaderSource = await fetch(shaderPath).then((r) => r.text());
    return this.device.createShaderModule({ code: shaderSource });
  }
  createUniformBuffer(size) {
    return this.device.createBuffer({
      size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }
  createStorageBuffer(size, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST) {
    return this.device.createBuffer({
      size,
      usage
    });
  }
  createBindGroupLayout(entries) {
    return this.device.createBindGroupLayout({ entries });
  }
  createBindGroup(layout, entries) {
    return this.device.createBindGroup({
      layout,
      entries
    });
  }
  createVertexBuffer(data) {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
  }
  writeBuffer(buffer, offset, data, dataOffset, size) {
    this.device.queue.writeBuffer(buffer, offset, data, dataOffset, size);
  }
  createCommandEncoder() {
    return this.device.createCommandEncoder();
  }
  submitCommands(commandBuffers) {
    this.device.queue.submit(commandBuffers);
  }
}

// graphics/pipelines.ts
class PipelineFactory {
  device;
  format;
  constructor(device, format) {
    this.device = device;
    this.format = format;
  }
  createVertexBufferLayout() {
    return {
      arrayStride: 12,
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: "float32x3"
        }
      ]
    };
  }
  createDepthStencilState() {
    return {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less"
    };
  }
  createWireframePipeline(shaderModule, bindGroupLayout) {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [this.createVertexBufferLayout()]
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main_wireframe",
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "line-list",
        cullMode: "none"
      },
      depthStencil: this.createDepthStencilState()
    });
  }
  createFacePipeline(shaderModule, bindGroupLayout) {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [this.createVertexBufferLayout()]
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main_face",
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none"
      },
      depthStencil: this.createDepthStencilState()
    });
  }
  createPointPipeline(shaderModule, bindGroupLayout) {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [this.createVertexBufferLayout()]
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main_point",
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back"
      },
      depthStencil: this.createDepthStencilState()
    });
  }
  createAxisPipeline(shaderModule, bindGroupLayout, fragmentEntryPoint) {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [this.createVertexBufferLayout()]
      },
      fragment: {
        module: shaderModule,
        entryPoint: fragmentEntryPoint,
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "line-list",
        cullMode: "none"
      },
      depthStencil: this.createDepthStencilState()
    });
  }
  createTerrainPipeline(shaderModule, bindGroupLayout) {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_terrain",
        buffers: [this.createVertexBufferLayout()]
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_terrain",
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none"
      },
      depthStencil: this.createDepthStencilState()
    });
  }
  createParticlePipeline(shaderModule, bindGroupLayout) {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_particle",
        buffers: [this.createVertexBufferLayout()]
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_particle",
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none"
      },
      depthStencil: this.createDepthStencilState()
    });
  }
  createGPUParticlePipeline(shaderModule, bindGroupLayouts) {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [this.createVertexBufferLayout()]
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none"
      },
      depthStencil: this.createDepthStencilState()
    });
  }
  createAllPipelines(shaderModule, bindGroupLayout) {
    return {
      wireframe: this.createWireframePipeline(shaderModule, bindGroupLayout),
      terrain: this.createTerrainPipeline(shaderModule, bindGroupLayout),
      xAxis: this.createAxisPipeline(shaderModule, bindGroupLayout, "fs_main_x_axis"),
      yAxis: this.createAxisPipeline(shaderModule, bindGroupLayout, "fs_main_y_axis"),
      zAxis: this.createAxisPipeline(shaderModule, bindGroupLayout, "fs_main_z_axis")
    };
  }
}

// geometry/geometryUtils.ts
class GeometryUtils {
  static generateCube(size = 1, center = [0, 0, 0]) {
    const halfSize = size / 2;
    const vertices = [
      [-halfSize, -halfSize, -halfSize],
      [halfSize, -halfSize, -halfSize],
      [halfSize, halfSize, -halfSize],
      [-halfSize, halfSize, -halfSize],
      [-halfSize, -halfSize, halfSize],
      [halfSize, -halfSize, halfSize],
      [halfSize, halfSize, halfSize],
      [-halfSize, halfSize, halfSize]
    ];
    const centeredVertices = vertices.map((v) => [
      v[0] + center[0],
      v[1] + center[1],
      v[2] + center[2]
    ]);
    return centeredVertices;
  }
  static generateCubeEdges(size = 1, center = [0, 0, 0]) {
    const vertices = this.generateCube(size, center);
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7]
    ];
    const wireframeVertices = [];
    for (const edge of edges) {
      for (const i of edge) {
        wireframeVertices.push(...vertices[i]);
      }
    }
    return wireframeVertices;
  }
  static generateCubeBottomFace(size = 1, center = [0, 0, 0]) {
    const vertices = this.generateCube(size, center);
    const bottomFaceVertices = [];
    bottomFaceVertices.push(...vertices[0], ...vertices[1], ...vertices[2]);
    bottomFaceVertices.push(...vertices[0], ...vertices[2], ...vertices[3]);
    return bottomFaceVertices;
  }
  static generateTerrain(points, gridResolution = 50, terrainSize = 2) {
    if (!points || points.length === 0) {
      return [];
    }
    const minX = -1;
    const maxX = 1;
    const minY = -1;
    const maxY = 1;
    const gridVertices = [];
    const stepX = (maxX - minX) / (gridResolution - 1);
    const stepY = (maxY - minY) / (gridResolution - 1);
    for (let i = 0;i < gridResolution; i++) {
      for (let j = 0;j < gridResolution; j++) {
        const x = minX + i * stepX;
        const y = minY + j * stepY;
        const z = -1;
        gridVertices.push({ x, y, z, i, j });
      }
    }
    this.addHeightToTerrain(gridVertices, points);
    const terrainVertices = [];
    for (let i = 0;i < gridResolution - 1; i++) {
      for (let j = 0;j < gridResolution - 1; j++) {
        const v1 = gridVertices[i * gridResolution + j];
        const v2 = gridVertices[(i + 1) * gridResolution + j];
        const v3 = gridVertices[(i + 1) * gridResolution + (j + 1)];
        const v4 = gridVertices[i * gridResolution + (j + 1)];
        terrainVertices.push(v1.x, v1.y, v1.z);
        terrainVertices.push(v2.x, v2.y, v2.z);
        terrainVertices.push(v3.x, v3.y, v3.z);
        terrainVertices.push(v1.x, v1.y, v1.z);
        terrainVertices.push(v3.x, v3.y, v3.z);
        terrainVertices.push(v4.x, v4.y, v4.z);
      }
    }
    return terrainVertices;
  }
  static addHeightToTerrain(gridVertices, points) {
    if (!points || points.length === 0) {
      return;
    }
    const sigma = 0.3;
    const sigmaSquared = sigma * sigma;
    const weightCache = new Map;
    for (let gridVertex of gridVertices) {
      let numerator = 0;
      let denominator = 0;
      const originalZ = gridVertex.z;
      const originalWeight = 1;
      numerator += originalWeight * originalZ;
      denominator += originalWeight;
      for (let point of points) {
        const dx = gridVertex.x - point.x;
        const dy = gridVertex.y - point.y;
        const distanceSquared = dx * dx + dy * dy;
        const weight = Math.exp(-distanceSquared / (sigma * sigma));
        numerator += weight * point.z;
        denominator += weight;
      }
      if (denominator > 0) {
        gridVertex.z = numerator / denominator;
      } else {
        gridVertex.z = originalZ;
      }
    }
  }
  static generateAxes(length = 1.5) {
    return {
      xAxis: [0, 0, 0, length, 0, 0],
      yAxis: [0, 0, 0, 0, length, 0],
      zAxis: [0, 0, 0, 0, 0, length]
    };
  }
  static generateCubeFaces(size = 1, center = [0, 0, 0]) {
    const vertices = this.generateCube(size, center);
    const faceVertices = [];
    const faces = [
      [4, 5, 6],
      [4, 6, 7],
      [1, 0, 3],
      [1, 3, 2],
      [3, 7, 6],
      [3, 6, 2],
      [0, 1, 5],
      [0, 5, 4],
      [1, 2, 6],
      [1, 6, 5],
      [0, 4, 7],
      [0, 7, 3]
    ];
    for (const face of faces) {
      for (const vertexIndex of face) {
        faceVertices.push(...vertices[vertexIndex]);
      }
    }
    return faceVertices;
  }
  static generateSphereFaces(radius = 1, center = [0, 0, 0], latitudeBands = 20, longitudeBands = 20) {
    const faceVertices = [];
    const vertices = [];
    for (let lat = 0;lat <= latitudeBands; lat++) {
      const theta = lat * Math.PI / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let lon = 0;lon <= longitudeBands; lon++) {
        const phi = lon * 2 * Math.PI / longitudeBands;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;
        vertices.push([
          x * radius + center[0],
          y * radius + center[1],
          z * radius + center[2]
        ]);
      }
    }
    for (let lat = 0;lat < latitudeBands; lat++) {
      for (let lon = 0;lon < longitudeBands; lon++) {
        const first = lat * (longitudeBands + 1) + lon;
        const second = first + longitudeBands + 1;
        faceVertices.push(...vertices[first]);
        faceVertices.push(...vertices[second]);
        faceVertices.push(...vertices[first + 1]);
        faceVertices.push(...vertices[second]);
        faceVertices.push(...vertices[second + 1]);
        faceVertices.push(...vertices[first + 1]);
      }
    }
    return faceVertices;
  }
}

// graphics/axes.ts
class AxesManager {
  xAxisVertexBuffer;
  yAxisVertexBuffer;
  zAxisVertexBuffer;
  numAxisVertices;
  constructor() {
    this.xAxisVertexBuffer = null;
    this.yAxisVertexBuffer = null;
    this.zAxisVertexBuffer = null;
    this.numAxisVertices = 2;
  }
  initialize(webgpu) {
    const axes = GeometryUtils.generateAxes();
    this.xAxisVertexBuffer = webgpu.createVertexBuffer(new Float32Array(axes.xAxis));
    this.yAxisVertexBuffer = webgpu.createVertexBuffer(new Float32Array(axes.yAxis));
    this.zAxisVertexBuffer = webgpu.createVertexBuffer(new Float32Array(axes.zAxis));
  }
  getBuffers() {
    return {
      xAxisVertexBuffer: this.xAxisVertexBuffer,
      yAxisVertexBuffer: this.yAxisVertexBuffer,
      zAxisVertexBuffer: this.zAxisVertexBuffer,
      numAxisVertices: this.numAxisVertices
    };
  }
  destroy() {
    if (this.xAxisVertexBuffer) {
      this.xAxisVertexBuffer.destroy();
      this.xAxisVertexBuffer = null;
    }
    if (this.yAxisVertexBuffer) {
      this.yAxisVertexBuffer.destroy();
      this.yAxisVertexBuffer = null;
    }
    if (this.zAxisVertexBuffer) {
      this.zAxisVertexBuffer.destroy();
      this.zAxisVertexBuffer = null;
    }
  }
}

// particleSystem.ts
class GPUParticleSystem {
  device;
  maxParticles;
  numParticles;
  gridSize;
  particleBuffer;
  paramsBuffer;
  spatialGridBuffer;
  terrainHeightBuffer;
  terrainParamsBuffer;
  bindGroupLayout;
  bindGroup;
  clearGridPipeline;
  assignParticlesPipeline;
  updatePhysicsPipeline;
  detectCollisionsPipeline;
  detectParticleCollisionsPipeline;
  constructor(device, maxParticles = 1000) {
    this.device = device;
    this.maxParticles = maxParticles;
    this.numParticles = 0;
    this.gridSize = 32;
    this.clearGridPipeline = null;
    this.assignParticlesPipeline = null;
    this.updatePhysicsPipeline = null;
    this.detectCollisionsPipeline = null;
    this.detectParticleCollisionsPipeline = null;
    console.log("GPU 파티클 시스템 초기화 중...");
    this.setupBuffers();
    this.setupBindGroups();
    this.setupComputePipelines();
    console.log("GPU 파티클 시스템 초기화 완료!");
  }
  setupBuffers() {
    const particleBufferSize = 48 * this.maxParticles;
    this.particleBuffer = this.device.createBuffer({
      size: particleBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    this.paramsBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const cellSize = 136;
    const gridBufferSize = this.gridSize * this.gridSize * this.gridSize * cellSize;
    this.spatialGridBuffer = this.device.createBuffer({
      size: gridBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.terrainHeightBuffer = this.device.createBuffer({
      size: 50 * 50 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.terrainParamsBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }
  setupBindGroups() {
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.paramsBuffer } },
        { binding: 2, resource: { buffer: this.spatialGridBuffer } },
        { binding: 3, resource: { buffer: this.terrainHeightBuffer } },
        { binding: 4, resource: { buffer: this.terrainParamsBuffer } }
      ]
    });
  }
  async setupComputePipelines() {
    try {
      const shaderSource = await fetch("./particlePhysics.wgsl").then((r) => r.text());
      console.log("셰이더 소스 로드됨:", shaderSource.length, "바이트");
      const shaderModule = this.device.createShaderModule({
        code: shaderSource,
        label: "ParticlePhysicsShader"
      });
      const compilationInfo = await shaderModule.getCompilationInfo();
      if (compilationInfo.messages.length > 0) {
        console.error("셰이더 컴파일 에러:", compilationInfo.messages);
        throw new Error("셰이더 컴파일 실패");
      }
      const pipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
        label: "ParticlePhysicsPipelineLayout"
      });
      console.log("clearGrid 파이프라인 생성 중...");
      this.clearGridPipeline = await this.device.createComputePipelineAsync({
        layout: pipelineLayout,
        compute: { module: shaderModule, entryPoint: "clearGrid" },
        label: "ClearGridPipeline"
      });
      console.log("assignParticlesToGrid 파이프라인 생성 중...");
      this.assignParticlesPipeline = await this.device.createComputePipelineAsync({
        layout: pipelineLayout,
        compute: { module: shaderModule, entryPoint: "assignParticlesToGrid" },
        label: "AssignParticlesPipeline"
      });
      console.log("updatePhysics 파이프라인 생성 중...");
      this.updatePhysicsPipeline = await this.device.createComputePipelineAsync({
        layout: pipelineLayout,
        compute: { module: shaderModule, entryPoint: "updatePhysics" },
        label: "UpdatePhysicsPipeline"
      });
      console.log("detectCollisions 파이프라인 생성 중...");
      this.detectCollisionsPipeline = await this.device.createComputePipelineAsync({
        layout: pipelineLayout,
        compute: { module: shaderModule, entryPoint: "detectCollisions" },
        label: "DetectCollisionsPipeline"
      });
      console.log("detectParticleCollisions 파이프라인 생성 중...");
      this.detectParticleCollisionsPipeline = await this.device.createComputePipelineAsync({
        layout: pipelineLayout,
        compute: { module: shaderModule, entryPoint: "detectParticleCollisions" },
        label: "DetectParticleCollisionsPipeline"
      });
      console.log("모든 컴퓨트 파이프라인 생성 완료");
    } catch (error) {
      console.error("컴퓨트 파이프라인 생성 실패:", error);
      console.warn("컴퓨트 파이프라인 없이 계속 진행합니다.");
    }
  }
  addParticle(position, velocity = [0, 0, 0], radius = 0.05, mass = 1) {
    if (this.numParticles >= this.maxParticles) {
      console.warn("최대 파티클 수에 도달했습니다.");
      return;
    }
    const buffer = new ArrayBuffer(48);
    const floatView = new Float32Array(buffer);
    const uint32View = new Uint32Array(buffer);
    floatView[0] = position[0];
    floatView[1] = position[1];
    floatView[2] = position[2];
    floatView[3] = radius;
    floatView[4] = velocity[0];
    floatView[5] = velocity[1];
    floatView[6] = velocity[2];
    floatView[7] = mass;
    floatView[8] = 0;
    floatView[9] = 0;
    floatView[10] = 0;
    const currentIndex = this.numParticles;
    const bufferOffset = currentIndex * 48;
    uint32View[11] = currentIndex;
    this.device.queue.writeBuffer(this.particleBuffer, bufferOffset, buffer);
    this.numParticles++;
    console.log(`파티클 ${currentIndex} 추가: 위치(${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}) 총 ${this.numParticles}개`);
  }
  updateParams(deltaTime, acceleration = [0, 0, -9.8]) {
    const buffer = new ArrayBuffer(64);
    const floatView = new Float32Array(buffer);
    const uintView = new Uint32Array(buffer);
    uintView[0] = this.numParticles;
    floatView[1] = deltaTime;
    floatView[4] = acceleration[0];
    floatView[5] = acceleration[1];
    floatView[6] = acceleration[2];
    floatView[7] = 0.6;
    floatView[8] = 0.8;
    uintView[9] = this.gridSize;
    floatView[10] = 0.2;
    floatView[12] = 1;
    floatView[13] = 1;
    floatView[14] = 1;
    this.device.queue.writeBuffer(this.paramsBuffer, 0, buffer);
  }
  updateTerrain(heightData, gridResolution = 50) {
    const heightArray = new Float32Array(heightData);
    this.device.queue.writeBuffer(this.terrainHeightBuffer, 0, heightArray.buffer);
    const terrainParams = new Float32Array([
      gridResolution,
      -1,
      1,
      0
    ]);
    this.device.queue.writeBuffer(this.terrainParamsBuffer, 0, terrainParams.buffer);
  }
  simulate(commandEncoder) {
    if (this.numParticles === 0)
      return;
    if (!this.clearGridPipeline || !this.assignParticlesPipeline || !this.updatePhysicsPipeline || !this.detectCollisionsPipeline || !this.detectParticleCollisionsPipeline) {
      console.warn("컴퓨트 파이프라인이 초기화되지 않았습니다. 물리 시뮬레이션을 건너뜁니다.");
      return;
    }
    const computePass = commandEncoder.beginComputePass({
      label: "ParticlePhysicsComputePass"
    });
    computePass.setPipeline(this.clearGridPipeline);
    computePass.setBindGroup(0, this.bindGroup);
    const gridWorkgroups = Math.ceil(this.gridSize * this.gridSize * this.gridSize / 32);
    computePass.dispatchWorkgroups(gridWorkgroups);
    computePass.setPipeline(this.assignParticlesPipeline);
    computePass.setBindGroup(0, this.bindGroup);
    const particleWorkgroups = Math.ceil(this.numParticles / 32);
    computePass.dispatchWorkgroups(particleWorkgroups);
    computePass.setPipeline(this.updatePhysicsPipeline);
    computePass.setBindGroup(0, this.bindGroup);
    computePass.dispatchWorkgroups(particleWorkgroups);
    computePass.setPipeline(this.detectParticleCollisionsPipeline);
    computePass.setBindGroup(0, this.bindGroup);
    computePass.dispatchWorkgroups(particleWorkgroups);
    computePass.setPipeline(this.detectCollisionsPipeline);
    computePass.setBindGroup(0, this.bindGroup);
    computePass.dispatchWorkgroups(particleWorkgroups);
    computePass.end();
    if (Math.random() < 0.01) {
      console.log("물리 시뮬레이션 단계 완료:", {
        particles: this.numParticles,
        gridWorkgroups,
        particleWorkgroups,
        gridSize: this.gridSize
      });
    }
  }
  async readParticleData() {
    if (this.numParticles === 0)
      return [];
    const stagingBuffer = this.device.createBuffer({
      size: this.numParticles * 48,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(this.particleBuffer, 0, stagingBuffer, 0, this.numParticles * 48);
    this.device.queue.submit([commandEncoder.finish()]);
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const buffer = stagingBuffer.getMappedRange();
    const particles = [];
    for (let i = 0;i < this.numParticles; i++) {
      const byteOffset = i * 48;
      const floatView = new Float32Array(buffer, byteOffset, 11);
      const uint32View = new Uint32Array(buffer, byteOffset + 44, 1);
      particles.push({
        position: [floatView[0], floatView[1], floatView[2]],
        radius: floatView[3],
        velocity: [floatView[4], floatView[5], floatView[6]],
        mass: floatView[7],
        force: [floatView[8], floatView[9], floatView[10]],
        id: uint32View[0]
      });
    }
    stagingBuffer.unmap();
    stagingBuffer.destroy();
    return particles;
  }
  getParticleVertices() {
    return [];
  }
  destroy() {
    this.particleBuffer?.destroy();
    this.paramsBuffer?.destroy();
    this.spatialGridBuffer?.destroy();
    this.terrainHeightBuffer?.destroy();
    this.terrainParamsBuffer?.destroy();
  }
  get particleCount() {
    return this.numParticles;
  }
  get particleBufferForRendering() {
    return this.particleBuffer;
  }
}

// main.ts
var resizeObserver = null;
var depthTexture = null;
var gpuParticleSystem = null;
var lastFrameTime = typeof performance !== "undefined" ? performance.now() : 0;
var terrainHeightData = [];
if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => console.error("Initialization error:", err));
  });
}
async function init() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    console.warn("Browser environment not available. Skipping initialization.");
    return;
  }
  const canvas = document.getElementById("gpu-canvas");
  const mod1Input = document.getElementById("mod1Input");
  if (!canvas) {
    console.error("Canvas element not found");
    return;
  }
  window.addEventListener("resize", updateCanvasSize);
  window.addEventListener("orientationchange", updateCanvasSize);
  const webgpu = new WebGPUSetup;
  const { device, context, format } = await webgpu.initialize(canvas);
  function updateCanvasSize() {
    setTimeout(() => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== Math.floor(rect.width * devicePixelRatio) || canvas.height !== Math.floor(rect.height * devicePixelRatio)) {
        canvas.width = Math.floor(rect.width * devicePixelRatio);
        canvas.height = Math.floor(rect.height * devicePixelRatio);
        console.log(`Canvas resized to ${canvas.width}x${canvas.height}`);
        context.configure({
          device,
          format,
          alphaMode: "opaque"
        });
        if (depthTexture) {
          depthTexture.destroy();
        }
        depthTexture = device.createTexture({
          size: [canvas.width, canvas.height, 1],
          format: "depth24plus",
          usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        const mvpMatrix2 = computeMVPMatrix();
        webgpu.writeBuffer(mvpBuffer, 0, mvpMatrix2);
      }
    }, 100);
  }
  function initializeCanvasSize() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * devicePixelRatio);
    canvas.height = Math.floor(rect.height * devicePixelRatio);
    console.log(`Canvas initialized to ${canvas.width}x${canvas.height}`);
    context.configure({
      device,
      format,
      alphaMode: "opaque"
    });
    depthTexture = device.createTexture({
      size: [canvas.width, canvas.height, 1],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }
  initializeCanvasSize();
  resizeObserver = new ResizeObserver(updateCanvasSize);
  resizeObserver.observe(canvas.parentElement || document.body);
  const shaderModule = await webgpu.createShaderModule("render.wgsl");
  const bindGroupLayout = webgpu.createBindGroupLayout([
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: "uniform" }
    }
  ]);
  const mvpBuffer = webgpu.createUniformBuffer(64);
  const bindGroup = webgpu.createBindGroup(bindGroupLayout, [
    {
      binding: 0,
      resource: { buffer: mvpBuffer }
    }
  ]);
  const particleUniformBuffer = webgpu.createUniformBuffer(80);
  const pipelineFactory = new PipelineFactory(device, format);
  const pipelines = pipelineFactory.createAllPipelines(shaderModule, bindGroupLayout);
  let gpuParticleRenderPipeline = null;
  let gpuParticleBindGroup = null;
  let particleSphereVertexBuffer = null;
  let particleSphereVertexCount = 0;
  const camera = new Camera;
  const axesManager = new AxesManager;
  gpuParticleSystem = new GPUParticleSystem(device, 1000);
  function createModelMatrix() {
    return MatrixUtils.identity();
  }
  function computeMVPMatrix() {
    const modelMatrix = createModelMatrix();
    const viewMatrix = camera.createViewMatrix();
    const projectionMatrix = camera.createProjectionMatrix(canvas);
    return MatrixUtils.multiply(MatrixUtils.multiply(projectionMatrix, viewMatrix), modelMatrix);
  }
  let terrainVertexBuffer = null;
  let wireframeVertexBuffer = null;
  let numTerrainVertices = 0;
  let numWireframeVertices = 0;
  async function loadMod1File(text, fileName) {
    try {
      const mod1Data = loadMod1ToJson(text, fileName);
      console.log("Mod1 데이터 로드됨:", mod1Data);
      const terrainVertices = GeometryUtils.generateTerrain(mod1Data.points);
      terrainVertexBuffer = webgpu.createVertexBuffer(new Float32Array(terrainVertices));
      numTerrainVertices = terrainVertices.length / 3;
      const wireframeVertices = GeometryUtils.generateCubeEdges(2, [0, 0, 0]);
      wireframeVertexBuffer = webgpu.createVertexBuffer(new Float32Array(wireframeVertices));
      numWireframeVertices = wireframeVertices.length / 3;
      terrainHeightData = generateTerrainHeightData(mod1Data.points);
      if (gpuParticleSystem) {
        gpuParticleSystem.updateTerrain(terrainHeightData);
      }
      console.log("지형 생성 완료:", {
        terrainVertices: numTerrainVertices,
        wireframeVertices: numWireframeVertices,
        points: mod1Data.points.length
      });
    } catch (error) {
      console.error("Mod1 파일 로드 실패:", error);
    }
  }
  function generateTerrainHeightData(points) {
    const gridResolution = 50;
    const heightData = [];
    for (let i = 0;i < gridResolution; i++) {
      for (let j = 0;j < gridResolution; j++) {
        const x = i / (gridResolution - 1) * 2 - 1;
        const y = j / (gridResolution - 1) * 2 - 1;
        let minDistance = Infinity;
        let height = -1;
        for (const point of points) {
          const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
          if (distance < minDistance) {
            minDistance = distance;
            height = point.z;
          }
        }
        heightData.push(height);
      }
    }
    return heightData;
  }
  async function loadDefaultMod1() {
    try {
      const response = await fetch("./assets/demo1.mod1");
      const text = await response.text();
      await loadMod1File(text, "demo1.mod1");
    } catch (error) {
      console.error("기본 Mod1 파일 로드 실패:", error);
    }
  }
  async function setupGPUParticleRendering() {
    const gpuParticleShaderModule = await webgpu.createShaderModule("gpuParticleRender.wgsl");
    const gpuParticleBindGroupLayout0 = webgpu.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" }
      }
    ]);
    const gpuParticleBindGroupLayout1 = webgpu.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" }
      }
    ]);
    gpuParticleRenderPipeline = pipelineFactory.createGPUParticlePipeline(gpuParticleShaderModule, [gpuParticleBindGroupLayout0, gpuParticleBindGroupLayout1]);
    const sphereVertices = GeometryUtils.generateSphereFaces(1, [0, 0, 0]);
    particleSphereVertexCount = sphereVertices.length / 3;
    const sphereData = new Float32Array(sphereVertices);
    particleSphereVertexBuffer = webgpu.createVertexBuffer(sphereData);
    function createGPUParticleBindGroups() {
      if (!gpuParticleSystem) {
        console.warn("GPU 파티클 시스템이 초기화되지 않았습니다.");
        return null;
      }
      return {
        bindGroup0: webgpu.createBindGroup(gpuParticleBindGroupLayout0, [
          {
            binding: 0,
            resource: { buffer: particleUniformBuffer }
          }
        ]),
        bindGroup1: webgpu.createBindGroup(gpuParticleBindGroupLayout1, [
          {
            binding: 0,
            resource: { buffer: gpuParticleSystem.particleBufferForRendering }
          }
        ])
      };
    }
    gpuParticleBindGroup = createGPUParticleBindGroups();
  }
  document.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "p":
      case "P":
        if (gpuParticleSystem) {
          for (let i = 0;i < 10; i++) {
            const x = (Math.random() - 0.5) * 2;
            const y = (Math.random() - 0.5) * 2;
            const z = Math.random() * 2;
            gpuParticleSystem.addParticle([x, y, z]);
          }
          console.log("파티클 추가됨. 총 파티클 수:", gpuParticleSystem.particleCount);
        }
        break;
      case "c":
      case "C":
        if (gpuParticleSystem) {
          gpuParticleSystem = new GPUParticleSystem(device, 1000);
          console.log("파티클 초기화됨");
        }
        break;
    }
  });
  const mvpMatrix = computeMVPMatrix();
  webgpu.writeBuffer(mvpBuffer, 0, mvpMatrix);
  let startTime = typeof performance !== "undefined" ? performance.now() : 0;
  function frame() {
    if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") {
      return;
    }
    if (!wireframeVertexBuffer || !terrainVertexBuffer || !depthTexture) {
      requestAnimationFrame(frame);
      return;
    }
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    const deltaTime = Math.min((now - lastFrameTime) * 0.001, 0.016);
    lastFrameTime = now;
    const encoder = webgpu.createCommandEncoder();
    if (gpuParticleSystem && gpuParticleSystem.particleCount > 0) {
      gpuParticleSystem.updateParams(deltaTime, [0, 0, -9.8]);
      gpuParticleSystem.simulate(encoder);
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store"
        }
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store"
      }
    });
    const time = (now - startTime) * 0.001;
    const acceleration = [
      0,
      0,
      -9.8
    ];
    const mvpMatrix2 = computeMVPMatrix();
    const uniformArray = new Float32Array(20);
    uniformArray.set(mvpMatrix2, 0);
    uniformArray[16] = acceleration[0];
    uniformArray[17] = acceleration[1];
    uniformArray[18] = acceleration[2];
    uniformArray[19] = time;
    webgpu.writeBuffer(particleUniformBuffer, 0, uniformArray);
    const axesBuffers = axesManager.getBuffers();
    pass.setPipeline(pipelines.xAxis);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, axesBuffers.xAxisVertexBuffer);
    pass.draw(axesBuffers.numAxisVertices, 1, 0, 0);
    pass.setPipeline(pipelines.yAxis);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, axesBuffers.yAxisVertexBuffer);
    pass.draw(axesBuffers.numAxisVertices, 1, 0, 0);
    pass.setPipeline(pipelines.zAxis);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, axesBuffers.zAxisVertexBuffer);
    pass.draw(axesBuffers.numAxisVertices, 1, 0, 0);
    pass.setPipeline(pipelines.wireframe);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, wireframeVertexBuffer);
    pass.draw(numWireframeVertices, 1, 0, 0);
    if (terrainVertexBuffer && numTerrainVertices > 0) {
      pass.setPipeline(pipelines.terrain);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, terrainVertexBuffer);
      pass.draw(numTerrainVertices, 1, 0, 0);
    }
    if (gpuParticleRenderPipeline && gpuParticleBindGroup && particleSphereVertexBuffer && gpuParticleSystem && gpuParticleSystem.particleCount > 0) {
      pass.setPipeline(gpuParticleRenderPipeline);
      pass.setBindGroup(0, gpuParticleBindGroup.bindGroup0);
      pass.setBindGroup(1, gpuParticleBindGroup.bindGroup1);
      pass.setVertexBuffer(0, particleSphereVertexBuffer);
      pass.draw(particleSphereVertexCount, gpuParticleSystem.particleCount, 0, 0);
    }
    pass.end();
    webgpu.submitCommands([encoder.finish()]);
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(frame);
    }
  }
  axesManager.initialize(webgpu);
  await loadDefaultMod1();
  const initialMvpMatrix = computeMVPMatrix();
  webgpu.writeBuffer(mvpBuffer, 0, initialMvpMatrix);
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(frame);
  }
  return () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    window.removeEventListener("resize", updateCanvasSize);
    window.removeEventListener("orientationchange", updateCanvasSize);
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (depthTexture) {
      depthTexture.destroy();
    }
  };
}
