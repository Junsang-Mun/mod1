import { WebGPUModel } from '../WebGPUModel.js'

export class SPHModel {
  constructor() {
    this.device = null
    this.context = null
    this.renderPipeline = null
    this.computePipeline = {
      densityPressure: null,
      force: null,
      integrate: null
    }
    this.canvasWidth = 800
    this.canvasHeight = 600
    this.particleBuffer = null
    this.simParamsBuffer = null
    this.particleCountBuffer = null
    this.bindGroups = {
      compute: null,
      render: null
    }
    this.workgroupSize = 64
    
    // Simulation parameters
    this.simParams = {
      deltaTime: 0.016,
      gravity: 9.8,
      smoothingRadius: 0.1,
      targetDensity: 1.0,
      pressureConstant: 200.0,
      viscosityConstant: 0.1,
      boundaryDamping: 0.9,
      containerWidthHalf: 0.8,
      containerHeightHalf: 0.6,
      particleRadius: 0.01,
      particleColor: [0.0, 0.5, 1.0, 1.0],
      _padding: [0.0, 0.0]
    }
    this.particleCount = 1000
    this.maxParticles = 5000
    
    // Simulation state
    this.isRunning = false
    this.lastFrameTime = 0
  }

  async initialize(canvas, config = {}, shaderCode) {
    const adapter = await navigator.gpu?.requestAdapter()
    this.device = await adapter?.requestDevice()
    
    if (!this.device) {
      throw new Error('WebGPU 장치를 찾을 수 없습니다.')
    }

    this.context = canvas.getContext('webgpu')
    this.canvasWidth = canvas.width
    this.canvasHeight = canvas.height
    
    // Update simulation parameters from config
    if (config.particleCount) this.particleCount = Math.min(config.particleCount, this.maxParticles)
    if (config.gravity) this.simParams.gravity = config.gravity
    if (config.viscosity) this.simParams.viscosityConstant = config.viscosity
    if (config.density) this.simParams.targetDensity = config.density
    if (config.timeScale) this.simParams.deltaTime = 0.016 * config.timeScale
    if (config.particleRadius) this.simParams.particleRadius = config.particleRadius
    
    // Configure the canvas
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
    this.context.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: 'premultiplied'
    })
    
    try {
      // Check if shader code was provided
      if (!shaderCode) {
        throw new Error('Shader code not provided')
      }
      
      // Create a shader module from the provided shader code
      const shaderModule = this.device.createShaderModule({ 
        code: shaderCode 
      })
      
      // Create buffers
      await this.createBuffers()
      
      // Create compute pipelines
      this.createComputePipelines(shaderModule)
      
      // Create render pipeline
      this.createRenderPipeline(shaderModule, presentationFormat)
      
    } catch (error) {
      console.error('Shader loading error:', error)
      throw new Error('셰이더 모듈을 생성하는데 실패했습니다: ' + error.message)
    }
    
    // Initialize particles
    this.initializeParticles()
    
    // Set simulation as running
    this.isRunning = true
    this.lastFrameTime = performance.now()
    
    return true
  }
  
  createBuffers() {
    // Create particle buffer - with enough space for maximum particles
    // Each particle has: position (vec2f), velocity (vec2f), force (vec2f), density (f32), pressure (f32)
    // That's 8 floats per particle = 32 bytes per particle
    const particleBufferSize = this.maxParticles * 8 * 4 // 8 floats per particle * 4 bytes per float
    this.particleBuffer = this.device.createBuffer({
      size: particleBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })
    
    // Create simulation parameters buffer
    const simParamData = new Float32Array([
      this.simParams.deltaTime,
      this.simParams.gravity,
      this.simParams.smoothingRadius,
      this.simParams.targetDensity,
      this.simParams.pressureConstant,
      this.simParams.viscosityConstant,
      this.simParams.boundaryDamping,
      this.simParams.containerWidthHalf,
      this.simParams.containerHeightHalf,
      this.simParams.particleRadius,
      ...this.simParams.particleColor,
      ...this.simParams._padding
    ])
    this.simParamsBuffer = this.device.createBuffer({
      size: simParamData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    this.device.queue.writeBuffer(this.simParamsBuffer, 0, simParamData)
    
    // Create particle count buffer
    this.particleCountBuffer = this.device.createBuffer({
      size: 4, // One u32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    this.device.queue.writeBuffer(this.particleCountBuffer, 0, new Uint32Array([this.particleCount]))
    
    // Create bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        }
      ]
    })
    
    // Create bind groups for compute and render
    this.bindGroups.compute = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.simParamsBuffer } },
        { binding: 2, resource: { buffer: this.particleCountBuffer } }
      ]
    })
    
    // Store the bind group layout for pipeline creation
    this.bindGroupLayout = bindGroupLayout
    
    // The render bind group is the same as compute in this case
    this.bindGroups.render = this.bindGroups.compute
  }
  
  createComputePipelines(shaderModule) {
    // Create a reusable bind group layout for all pipelines
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        }
      ]
    })
    
    // Create a reusable pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    })
    
    // Density pressure pipeline
    this.computePipeline.densityPressure = this.device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: 'computeDensityPressure'
      }
    })
    
    // Force pipeline
    this.computePipeline.force = this.device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: 'computeForces'
      }
    })
    
    // Integration pipeline
    this.computePipeline.integrate = this.device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: 'integrate'
      }
    })
    
    // Store the bind group layout for the render pipeline too
    this.bindGroupLayout = bindGroupLayout
  }
  
  createRenderPipeline(shaderModule, presentationFormat) {
    this.renderPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: presentationFormat }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    })
  }
  
  initializeParticles() {
    const particleData = new Float32Array(this.maxParticles * 8)
    
    // Initialize particles in a grid formation within a rectangle in the upper part of the container
    const particlesPerRow = Math.ceil(Math.sqrt(this.particleCount))
    const spacing = this.simParams.smoothingRadius * 0.5
    const offsetX = -this.simParams.containerWidthHalf * 0.8
    const offsetY = 0.0
    
    for (let i = 0; i < this.particleCount; i++) {
      const x = (i % particlesPerRow) * spacing + offsetX
      const y = Math.floor(i / particlesPerRow) * spacing + offsetY
      
      // position x, y
      particleData[i * 8 + 0] = x
      particleData[i * 8 + 1] = y
      
      // velocity x, y
      particleData[i * 8 + 2] = 0
      particleData[i * 8 + 3] = 0
      
      // force x, y
      particleData[i * 8 + 4] = 0
      particleData[i * 8 + 5] = 0
      
      // density and pressure (initialized to 0)
      particleData[i * 8 + 6] = 0
      particleData[i * 8 + 7] = 0
    }
    
    this.device.queue.writeBuffer(this.particleBuffer, 0, particleData)
    this.device.queue.writeBuffer(this.particleCountBuffer, 0, new Uint32Array([this.particleCount]))
  }
  
  resetParticles(newParticleCount = null) {
    if (newParticleCount !== null) {
      this.particleCount = Math.min(newParticleCount, this.maxParticles)
      this.device.queue.writeBuffer(this.particleCountBuffer, 0, new Uint32Array([this.particleCount]))
    }
    this.initializeParticles()
  }
  
  updateSimulationParams(params) {
    if (params.gravity !== undefined) this.simParams.gravity = params.gravity
    if (params.viscosity !== undefined) this.simParams.viscosityConstant = params.viscosity
    if (params.density !== undefined) this.simParams.targetDensity = params.density
    if (params.timeScale !== undefined) this.simParams.deltaTime = 0.016 * params.timeScale
    if (params.particleRadius !== undefined) this.simParams.particleRadius = params.particleRadius
    
    const simParamData = new Float32Array([
      this.simParams.deltaTime,
      this.simParams.gravity,
      this.simParams.smoothingRadius,
      this.simParams.targetDensity,
      this.simParams.pressureConstant,
      this.simParams.viscosityConstant,
      this.simParams.boundaryDamping,
      this.simParams.containerWidthHalf,
      this.simParams.containerHeightHalf,
      this.simParams.particleRadius,
      ...this.simParams.particleColor,
      ...this.simParams._padding
    ])
    
    this.device.queue.writeBuffer(this.simParamsBuffer, 0, simParamData)
  }
  
  dispatchCompute() {
    const commandEncoder = this.device.createCommandEncoder()
    
    // Calculate dispatch size based on workgroup size
    const dispatchSize = Math.ceil(this.particleCount / this.workgroupSize)
    
    // Density-pressure computation pass
    {
      const passEncoder = commandEncoder.beginComputePass()
      passEncoder.setPipeline(this.computePipeline.densityPressure)
      passEncoder.setBindGroup(0, this.bindGroups.compute)
      passEncoder.dispatchWorkgroups(dispatchSize)
      passEncoder.end()
    }
    
    // Force computation pass
    {
      const passEncoder = commandEncoder.beginComputePass()
      passEncoder.setPipeline(this.computePipeline.force)
      passEncoder.setBindGroup(0, this.bindGroups.compute)
      passEncoder.dispatchWorkgroups(dispatchSize)
      passEncoder.end()
    }
    
    // Integration pass
    {
      const passEncoder = commandEncoder.beginComputePass()
      passEncoder.setPipeline(this.computePipeline.integrate)
      passEncoder.setBindGroup(0, this.bindGroups.compute)
      passEncoder.dispatchWorkgroups(dispatchSize)
      passEncoder.end()
    }
    
    this.device.queue.submit([commandEncoder.finish()])
  }
  
  render() {
    if (!this.isRunning) return
    
    // Dispatch compute first
    this.dispatchCompute()
    
    // Then render the particles
    const commandEncoder = this.device.createCommandEncoder()
    const renderPassDescriptor = {
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    }
    
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
    passEncoder.setPipeline(this.renderPipeline)
    passEncoder.setBindGroup(0, this.bindGroups.render)
    passEncoder.draw(6, this.particleCount, 0, 0)
    passEncoder.end()
    
    this.device.queue.submit([commandEncoder.finish()])
  }

  addInteractionForce(x, y, strength = 0.5) {
    // 정규화된 좌표를 시뮬레이션 좌표로 변환
    const simX = (x * 2 - 1) * this.simParams.containerWidthHalf
    const simY = (y * 2 - 1) * this.simParams.containerHeightHalf
    
    // 상호작용에 사용할 직접적인 힘 방법
    // 이 위치에서 가까운 모든 입자에게 힘을 적용
    const interactionRadius = this.simParams.smoothingRadius * 2.0
    const forceStrength = 10.0 * strength
    
    // 입자 데이터를 읽어와서 수정하기 위한 임시 배열
    const particleData = new Float32Array(this.particleCount * 8)
    
    // 기존 입자 데이터 가져오기
    const readBuffer = this.device.createBuffer({
      size: this.particleCount * 8 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      mappedAtCreation: false
    })
    
    const commandEncoder = this.device.createCommandEncoder()
    commandEncoder.copyBufferToBuffer(this.particleBuffer, 0, readBuffer, 0, this.particleCount * 8 * 4)
    this.device.queue.submit([commandEncoder.finish()])
    
    // 비동기적으로 처리하지 않고 즉시 효과를 보기 위한 코드
    // 참고: 실제 프로덕션 환경에서는 비동기 처리 권장
    readBuffer.mapAsync(GPUMapMode.READ).then(() => {
      const mappedBuffer = readBuffer.getMappedRange()
      const origData = new Float32Array(mappedBuffer)
      
      // 원본 데이터 복사
      particleData.set(origData)
      
      // 입자에 힘 적용
      for (let i = 0; i < this.particleCount; i++) {
        const posOffset = i * 8
        const px = particleData[posOffset]
        const py = particleData[posOffset + 1]
        
        // 마우스 위치와 입자 사이의 거리 계산
        const dx = simX - px
        const dy = simY - py
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        // 상호작용 반경 내에 있는 입자에만 힘 적용
        if (dist < interactionRadius) {
          // 마우스에서 입자로 향하는 방향 벡터 생성 (정규화)
          const factor = forceStrength * (1 - dist / interactionRadius)
          
          // 속도에 힘 추가 (위치 오프셋: 0, 1) (속도 오프셋: 2, 3)
          particleData[posOffset + 2] += dx * factor / 30
          particleData[posOffset + 3] += dy * factor / 30
        }
      }
      
      // 매핑 해제 후 리소스 정리
      readBuffer.unmap()
      
      // 수정된 데이터를 GPU 버퍼에 다시 쓰기
      this.device.queue.writeBuffer(this.particleBuffer, 0, particleData)
    })
  }
} 