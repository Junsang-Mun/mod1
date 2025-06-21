// WebGPU initialization and setup utilities
export class WebGPUSetup {
  constructor() {
    this.device = null;
    this.context = null;
    this.format = null;
    this.canvas = null;
  }

  // Initialize WebGPU
  async initialize(canvas) {
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("Failed to get GPU adapter");
    }
    this.device = await adapter.requestDevice();
    this.context = canvas.getContext("webgpu");
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.canvas = canvas;

    this.configureContext();

    return {
      device: this.device,
      context: this.context,
      format: this.format,
    };
  }

  // Configure context (can be called separately when canvas size changes)
  configureContext() {
    if (!this.context || !this.device) return;

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
    });
  }

  // Create shader module
  async createShaderModule(shaderPath) {
    const shaderSource = await fetch(shaderPath).then((r) => r.text());
    return this.device.createShaderModule({ code: shaderSource });
  }

  // Create uniform buffer
  createUniformBuffer(size) {
    return this.device.createBuffer({
      size: size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  // Create bind group layout
  createBindGroupLayout(entries) {
    return this.device.createBindGroupLayout({ entries });
  }

  // Create bind group
  createBindGroup(layout, entries) {
    return this.device.createBindGroup({
      layout: layout,
      entries: entries,
    });
  }

  // Create vertex buffer
  createVertexBuffer(data) {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
  }

  // Write data to buffer
  writeBuffer(buffer, offset, data) {
    this.device.queue.writeBuffer(buffer, offset, data);
  }

  // Create command encoder
  createCommandEncoder() {
    return this.device.createCommandEncoder();
  }

  // Submit commands
  submitCommands(commandBuffers) {
    this.device.queue.submit(commandBuffers);
  }
}
