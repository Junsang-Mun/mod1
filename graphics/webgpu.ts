import type { WebGPUContext, BindGroupLayoutEntry, BindGroupEntry, BufferConfig } from "../types/index.js";

// WebGPU initialization and setup utilities
export class WebGPUSetup {
  private device: GPUDevice | null;
  private context: GPUCanvasContext | null;
  private format: GPUTextureFormat | null;
  private canvas: HTMLCanvasElement | null;

  constructor() {
    this.device = null;
    this.context = null;
    this.format = null;
    this.canvas = null;
  }

  // Initialize WebGPU
  async initialize(canvas: HTMLCanvasElement): Promise<WebGPUContext> {
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
      format: this.format!,
    };
  }

  // Configure context (can be called separately when canvas size changes)
  configureContext(): void {
    if (!this.context || !this.device) return;

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
    });
  }

  // Create shader module
  async createShaderModule(shaderPath: string): Promise<GPUShaderModule> {
    const shaderSource = await fetch(shaderPath).then((r) => r.text());
    return this.device!.createShaderModule({ code: shaderSource });
  }

  // Create uniform buffer
  createUniformBuffer(size: number): GPUBuffer {
    return this.device!.createBuffer({
      size: size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  // Create storage buffer
  createStorageBuffer(size: number, usage: GPUBufferUsageFlags = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST): GPUBuffer {
    return this.device!.createBuffer({
      size: size,
      usage: usage,
    });
  }

  // Create bind group layout
  createBindGroupLayout(entries: BindGroupLayoutEntry[]): GPUBindGroupLayout {
    return this.device!.createBindGroupLayout({ entries });
  }

  // Create bind group
  createBindGroup(layout: GPUBindGroupLayout, entries: BindGroupEntry[]): GPUBindGroup {
    return this.device!.createBindGroup({
      layout: layout,
      entries: entries,
    });
  }

  // Create vertex buffer
  createVertexBuffer(data: Float32Array): GPUBuffer {
    const buffer = this.device!.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
  }

  // Write data to buffer
  writeBuffer(buffer: GPUBuffer, offset: number, data: BufferSource, dataOffset?: number, size?: number): void {
    this.device!.queue.writeBuffer(buffer, offset, data, dataOffset, size);
  }

  // Create command encoder
  createCommandEncoder(): GPUCommandEncoder {
    return this.device!.createCommandEncoder();
  }

  // Submit commands
  submitCommands(commandBuffers: GPUCommandBuffer[]): void {
    this.device!.queue.submit(commandBuffers);
  }
} 