// Rendering pipeline creation utilities
export class PipelineFactory {
  constructor(device, format) {
    this.device = device;
    this.format = format;
  }

  // Create vertex buffer layout
  createVertexBufferLayout() {
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
  createDepthStencilState() {
    return {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    };
  }

  // Create wireframe render pipeline
  createWireframePipeline(shaderModule, bindGroupLayout) {
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
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "line-list",
        cullMode: "none",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // Create face render pipeline
  createFacePipeline(shaderModule, bindGroupLayout) {
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
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // Create point render pipeline (small cubes)
  createPointPipeline(shaderModule, bindGroupLayout) {
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
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // Create axis render pipeline
  createAxisPipeline(shaderModule, bindGroupLayout, fragmentEntryPoint) {
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
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "line-list",
        cullMode: "none",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // Create terrain render pipeline with height-based coloring
  createTerrainPipeline(shaderModule, bindGroupLayout) {
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
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  createParticlePipeline(shaderModule, bindGroupLayout) {
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
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: this.createDepthStencilState(),
    });
  }

  // Create all pipelines at once
  createAllPipelines(shaderModule, bindGroupLayout) {
    return {
      wireframe: this.createWireframePipeline(shaderModule, bindGroupLayout),
      face: this.createFacePipeline(shaderModule, bindGroupLayout),
      point: this.createPointPipeline(shaderModule, bindGroupLayout),
      terrain: this.createTerrainPipeline(shaderModule, bindGroupLayout),
      particle: this.createParticlePipeline(shaderModule, bindGroupLayout),
      xAxis: this.createAxisPipeline(shaderModule, bindGroupLayout, "fs_main_x_axis"),
      yAxis: this.createAxisPipeline(shaderModule, bindGroupLayout, "fs_main_y_axis"),
      zAxis: this.createAxisPipeline(shaderModule, bindGroupLayout, "fs_main_z_axis"),
    };
  }
} 