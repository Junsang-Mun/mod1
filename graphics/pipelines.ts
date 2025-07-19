import type { PipelineSet } from "../types/index.js";

// Rendering pipeline creation utilities
export class PipelineFactory {
  private device: GPUDevice;
  private format: GPUTextureFormat | null;

  constructor(device: GPUDevice, format: GPUTextureFormat | null) {
    this.device = device;
    this.format = format;
  }

  // Create vertex buffer layout
  createVertexBufferLayout(): GPUVertexBufferLayout {
    return {
      arrayStride: 12,
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: "float32x3",
        },
      ],
    };
  }

  // Create depth stencil state
  createDepthStencilState(): GPUDepthStencilState {
    return {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    };
  }

  // Create wireframe render pipeline
  createWireframePipeline(shaderModule: GPUShaderModule, bindGroupLayout: GPUBindGroupLayout): GPURenderPipeline {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [this.createVertexBufferLayout()],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main_wireframe",
        targets: [{ format: this.format! }],
      },
      primitive: {
        topology: "line-list",
        cullMode: "none",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // Create face render pipeline
  createFacePipeline(shaderModule: GPUShaderModule, bindGroupLayout: GPUBindGroupLayout): GPURenderPipeline {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [this.createVertexBufferLayout()],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main_face",
        targets: [{ format: this.format! }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // Create point render pipeline (small cubes)
  createPointPipeline(shaderModule: GPUShaderModule, bindGroupLayout: GPUBindGroupLayout): GPURenderPipeline {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [this.createVertexBufferLayout()],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main_point",
        targets: [{ format: this.format! }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // Create axis render pipeline
  createAxisPipeline(shaderModule: GPUShaderModule, bindGroupLayout: GPUBindGroupLayout, fragmentEntryPoint: string): GPURenderPipeline {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [this.createVertexBufferLayout()],
      },
      fragment: {
        module: shaderModule,
        entryPoint: fragmentEntryPoint,
        targets: [{ format: this.format! }],
      },
      primitive: {
        topology: "line-list",
        cullMode: "none",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // Create terrain render pipeline with height-based coloring
  createTerrainPipeline(shaderModule: GPUShaderModule, bindGroupLayout: GPUBindGroupLayout): GPURenderPipeline {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_terrain",
        buffers: [this.createVertexBufferLayout()],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_terrain",
        targets: [{ format: this.format! }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  createParticlePipeline(shaderModule: GPUShaderModule, bindGroupLayout: GPUBindGroupLayout): GPURenderPipeline {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_particle",
        buffers: [this.createVertexBufferLayout()],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_particle",
        targets: [{ format: this.format! }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // GPU 파티클 인스턴싱 파이프라인
  createGPUParticlePipeline(shaderModule: GPUShaderModule, bindGroupLayouts: GPUBindGroupLayout[]): GPURenderPipeline {
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: bindGroupLayouts,
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [this.createVertexBufferLayout()],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format: this.format! }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none", // 구체가 온전히 보이도록 culling 비활성화
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // Create all pipelines at once
  createAllPipelines(shaderModule: GPUShaderModule, bindGroupLayout: GPUBindGroupLayout): PipelineSet {
    return {
      wireframe: this.createWireframePipeline(shaderModule, bindGroupLayout),
      terrain: this.createTerrainPipeline(shaderModule, bindGroupLayout),
      xAxis: this.createAxisPipeline(shaderModule, bindGroupLayout, "fs_main_x_axis"),
      yAxis: this.createAxisPipeline(shaderModule, bindGroupLayout, "fs_main_y_axis"),
      zAxis: this.createAxisPipeline(shaderModule, bindGroupLayout, "fs_main_z_axis"),
    };
  }
} 