export class WebGPUModel {
  constructor() {
    this.device = null
    this.context = null
    this.pipeline = null
    this.sampler = null
    this.imageTexture = null
    this.msaaTexture = null
    this.bindGroup = null
    this.timeBuffer = null
    this.mouseBuffer = null
    this.startTime = performance.now()
    this.canvasWidth = 768
    this.canvasHeight = 1024
    this.mouseX = 0
    this.mouseY = 0
  }

  async initialize(canvas, shaderCode, imageUrl = null) {
    const adapter = await navigator.gpu?.requestAdapter()
    this.device = await adapter?.requestDevice()
    
    if (!this.device) {
      throw new Error('WebGPU 장치를 찾을 수 없습니다.')
    }

    this.context = canvas.getContext('webgpu')
    const format = navigator.gpu.getPreferredCanvasFormat()
    
    this.context.configure({
      device: this.device,
      format,
      alphaMode: 'opaque',
    })

    // Create textures based on whether an image is provided
    if (imageUrl) {
      // Load image and create textures
      const bitmap = await this.loadImageBitmap(imageUrl)
      this.canvasWidth = bitmap.width
      this.canvasHeight = bitmap.height

      // 1. Image texture (sampleCount: 1)
      this.imageTexture = this.device.createTexture({
        size: [bitmap.width, bitmap.height],
        format: format,
        sampleCount: 1,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      })

      // Copy image to texture
      this.device.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture: this.imageTexture },
        [bitmap.width, bitmap.height],
      )
    } else {
      // Create an empty texture with default dimensions
      this.imageTexture = this.device.createTexture({
        size: [this.canvasWidth, this.canvasHeight],
        format: format,
        sampleCount: 1,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      })

      // Initialize with a solid color (black)
      const data = new Uint8Array(this.canvasWidth * this.canvasHeight * 4)
      this.device.queue.writeTexture(
        { texture: this.imageTexture },
        data,
        { bytesPerRow: this.canvasWidth * 4 },
        [this.canvasWidth, this.canvasHeight]
      )
    }

    // 2. MSAA texture for rendering (sampleCount: 4)
    this.msaaTexture = this.device.createTexture({
      size: [this.canvasWidth, this.canvasHeight],
      format: format,
      sampleCount: 4,
      usage: 
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST
    })

    // Create sampler
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    })

    // Shader module
    const shaderModule = this.device.createShaderModule({ code: shaderCode })

    // Create bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float', viewDimension: '2d', multisampled: false }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 3,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        }
      ]
    })

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    })

    // Create render pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format }],
      },
      multisample: {
        count: 4,
      },
    })

    // Create time buffer
    this.timeBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Create mouse buffer
    this.mouseBuffer = this.device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Initialize buffers
    this.device.queue.writeBuffer(this.timeBuffer, 0, new Float32Array([0.0]))
    this.device.queue.writeBuffer(this.mouseBuffer, 0, new Float32Array([0.0, 0.0]))

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.imageTexture.createView() },
        { binding: 2, resource: { buffer: this.timeBuffer } },
        { binding: 3, resource: { buffer: this.mouseBuffer } },
      ],
    })
  }

  async loadImageBitmap(src) {
    const img = new Image()
    img.src = src
    img.crossOrigin = 'anonymous'
    await img.decode()
    return await createImageBitmap(img)
  }

  updateMousePosition(x, y) {
    this.mouseX = x
    this.mouseY = y
    this.device.queue.writeBuffer(this.mouseBuffer, 0, new Float32Array([x, y]))
  }

  render() {
    const elapsed = (performance.now() - this.startTime) / 1000
    this.device.queue.writeBuffer(this.timeBuffer, 0, new Float32Array([elapsed]))

    const encoder = this.device.createCommandEncoder()
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.msaaTexture.createView(),
          resolveTarget: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })

    renderPass.setPipeline(this.pipeline)
    renderPass.setBindGroup(0, this.bindGroup)
    renderPass.draw(6)
    renderPass.end()

    this.device.queue.submit([encoder.finish()])
  }
} 