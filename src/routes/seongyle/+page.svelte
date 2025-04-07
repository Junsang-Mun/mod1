<script>
  import { onMount } from 'svelte'
  import { createShaderModule } from '$lib/shader-module'

  let canvasElement
  let errorMessage = ''
  let device
  let context
  let pipeline
  let animationFrameId
  let timeUniformBuffer
  let configBuffer
  let modelBuffer
  let indexBuffer
  let vertexCount = 0
  let indexCount = 0
  let isLoading = true
  let loadingProgress = 0

  // GUI 설정값
  let rotationSpeed = 1.0
  let modelScale = 1.0
  let rotateX = 0
  let rotateY = 0
  let rotateZ = 0
  let backgroundColor = { r: 0, g: 0, b: 0, a: 1 }
  let wireframe = false

  // 설정값 구조체
  const configBufferSize = 64 // 최소 48바이트 (12개의 float32) 필요, 여유있게 64로 설정

  // OBJ 파일 파싱 함수
  async function loadOBJFile(url) {
    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Failed to load OBJ file: ${response.statusText}`)
      }
      
      // Stream으로 파일 읽기 (대용량 파일 처리)
      const reader = response.body.getReader()
      const contentLength = +response.headers.get('Content-Length')
      
      let receivedLength = 0
      let chunks = []
      
      while(true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }
        
        chunks.push(value)
        receivedLength += value.length
        
        // 진행 상황 업데이트
        loadingProgress = contentLength ? 
          Math.round((receivedLength / contentLength) * 100) : 0
      }
      
      const allChunks = new Uint8Array(receivedLength)
      let position = 0
      
      for (const chunk of chunks) {
        allChunks.set(chunk, position)
        position += chunk.length
      }
      
      const text = new TextDecoder('utf-8').decode(allChunks)
      return parseOBJ(text)
    } catch (error) {
      console.error('Error loading OBJ file:', error)
      errorMessage = `OBJ 파일 로딩 오류: ${error.message}`
      throw error
    }
  }

  // OBJ 파일 파싱
  function parseOBJ(text) {
    const lines = text.split('\n')
    const vertices = []
    const normals = []
    const texcoords = []
    const indices = []
    
    // OBJ 데이터 파싱
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.startsWith('v ')) {
        // 버텍스 파싱
        const parts = line.split(' ').filter(p => p !== '' && p !== 'v')
        vertices.push(
          parseFloat(parts[0]),
          parseFloat(parts[1]),
          parseFloat(parts[2])
        )
      } else if (line.startsWith('vn ')) {
        // 노멀 파싱
        const parts = line.split(' ').filter(p => p !== '' && p !== 'vn')
        normals.push(
          parseFloat(parts[0]),
          parseFloat(parts[1]),
          parseFloat(parts[2])
        )
      } else if (line.startsWith('vt ')) {
        // 텍스쳐 좌표 파싱
        const parts = line.split(' ').filter(p => p !== '' && p !== 'vt')
        texcoords.push(
          parseFloat(parts[0]),
          parseFloat(parts[1])
        )
      } else if (line.startsWith('f ')) {
        // 면(face) 파싱 - 삼각형으로 분할
        const parts = line.split(' ').filter(p => p !== '' && p !== 'f')
        
        // 3개 이상의 정점을 가진 면을 삼각형으로 분할
        for (let j = 1; j < parts.length - 1; j++) {
          const v1 = parts[0].split('/')[0]
          const v2 = parts[j].split('/')[0]
          const v3 = parts[j + 1].split('/')[0]
          
          // OBJ 인덱스는 1부터 시작하므로 0 기반으로 변환
          indices.push(
            parseInt(v1) - 1,
            parseInt(v2) - 1,
            parseInt(v3) - 1
          )
        }
      }
    }
    
    // 중심점을 계산하여 모델의 중심을 원점으로 이동
    const centerX = vertices.filter((_, i) => i % 3 === 0).reduce((sum, v) => sum + v, 0) / (vertices.length / 3)
    const centerY = vertices.filter((_, i) => i % 3 === 1).reduce((sum, v) => sum + v, 0) / (vertices.length / 3)
    const centerZ = vertices.filter((_, i) => i % 3 === 2).reduce((sum, v) => sum + v, 0) / (vertices.length / 3)
    
    // 모델의 크기를 정규화
    let maxDist = 0
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i] - centerX
      const y = vertices[i + 1] - centerY
      const z = vertices[i + 2] - centerZ
      const dist = Math.sqrt(x*x + y*y + z*z)
      maxDist = Math.max(maxDist, dist)
    }
    
    // 정규화된 버텍스 데이터 생성
    const normalizedVertices = new Float32Array(vertices.length)
    for (let i = 0; i < vertices.length; i += 3) {
      normalizedVertices[i] = (vertices[i] - centerX) / maxDist
      normalizedVertices[i + 1] = (vertices[i + 1] - centerY) / maxDist
      normalizedVertices[i + 2] = (vertices[i + 2] - centerZ) / maxDist
    }
    
    return {
      vertices: normalizedVertices,
      indices: new Uint32Array(indices),
      vertexCount: normalizedVertices.length / 3,
      indexCount: indices.length
    }
  }

  async function initWebGPU() {
    if (!navigator.gpu) {
      errorMessage = 'WebGPU를 지원하지 않는 브라우저입니다.'
      return
    }
    
    try {
      const adapter = await navigator.gpu?.requestAdapter()
      if (!adapter) {
        errorMessage = 'WebGPU 어댑터를 찾을 수 없습니다.'
        return
      }
      
      device = await adapter.requestDevice()
      if (!device) {
        errorMessage = 'WebGPU 장치를 찾을 수 없습니다.'
        return
      }
      
      const canvas = canvasElement
      context = canvas.getContext('webgpu')
      if (!context) {
        errorMessage = 'WebGPU 컨텍스트를 찾을 수 없습니다.'
        return
      }
      
      const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
      context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'opaque'
      })

      // 시간 유니폼 버퍼
      timeUniformBuffer = device.createBuffer({
        size: 16, // vec4 size
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })

      // 설정 버퍼
      configBuffer = device.createBuffer({
        size: configBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })

      // OBJ 모델 로딩
      isLoading = true
      const model = await loadOBJFile('/src/lib/cat.obj')
      vertexCount = model.vertexCount
      indexCount = model.indexCount

      // 버텍스 버퍼 생성
      modelBuffer = device.createBuffer({
        size: model.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
      })
      new Float32Array(modelBuffer.getMappedRange()).set(model.vertices)
      modelBuffer.unmap()

      // 인덱스 버퍼 생성
      indexBuffer = device.createBuffer({
        size: model.indices.byteLength,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true
      })
      new Uint32Array(indexBuffer.getMappedRange()).set(model.indices)
      indexBuffer.unmap()

      updateConfigBuffer()
      
      // 셰이더 모듈 생성
      const shaderModule = createShaderModule(device, {
        label: 'Model Renderer',
        code: `
          struct TimeUniform {
            time: f32,
            padding1: f32,
            padding2: f32,
            padding3: f32,
          }
          @group(0) @binding(0) var<uniform> timeUniform: TimeUniform;

          struct Config {
            modelScale: f32,
            rotationSpeed: f32,
            rotateX: f32,
            rotateY: f32,
            rotateZ: f32,
            wireframe: f32,
            padding1: f32,
            padding2: f32,
            padding3: f32,
            padding4: f32,
            padding5: f32,
            padding6: f32,
            padding7: f32,
          }
          @group(0) @binding(1) var<uniform> config: Config;

          struct VertexOutput {
            @builtin(position) position: vec4f,
            @location(0) color: vec4f,
          }

          @vertex fn vs(
            @location(0) position: vec3f,
            @builtin(vertex_index) vertexIndex: u32
          ) -> VertexOutput {
            // 회전 행렬
            let time = timeUniform.time * config.rotationSpeed;
            
            let rx = config.rotateX + time * 0.1;
            let ry = config.rotateY + time;
            let rz = config.rotateZ;
            
            // X축 회전 행렬
            let rotX = mat3x3f(
              1.0, 0.0, 0.0,
              0.0, cos(rx), -sin(rx),
              0.0, sin(rx), cos(rx)
            );
            
            // Y축 회전 행렬
            let rotY = mat3x3f(
              cos(ry), 0.0, sin(ry),
              0.0, 1.0, 0.0,
              -sin(ry), 0.0, cos(ry)
            );
            
            // Z축 회전 행렬
            let rotZ = mat3x3f(
              cos(rz), -sin(rz), 0.0,
              sin(rz), cos(rz), 0.0,
              0.0, 0.0, 1.0
            );
            
            // 회전 적용
            let rotatedPos = rotZ * rotY * rotX * position;
            
            // 스케일 적용
            let scaledPos = rotatedPos * config.modelScale;
            
            // 정점 인덱스에 따라 색상 생성 (그라데이션 효과)
            let vertexId = f32(vertexIndex);
            let r = sin(vertexId * 0.01 + timeUniform.time) * 0.5 + 0.5;
            let g = cos(vertexId * 0.01 + timeUniform.time) * 0.5 + 0.5;
            let b = sin(vertexId * 0.01 + timeUniform.time + 3.14) * 0.5 + 0.5;
            
            var output: VertexOutput;
            output.position = vec4f(scaledPos, 1.0);
            output.color = vec4f(r, g, b, 1.0);
            
            return output;
          }

          @fragment fn fs(
            @location(0) color: vec4f
          ) -> @location(0) vec4f {
            // 와이어프레임 모드이면 단색으로 처리
            if (config.wireframe > 0.5) {
              return vec4f(0.0, 1.0, 0.3, 1.0);
            }
            return color;
          }
        `
      })

      // 파이프라인 생성
      pipeline = device.createRenderPipeline({
        label: '3D Model Pipeline',
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs',
          buffers: [{
            arrayStride: 12, // 3 * float32 (x, y, z)
            attributes: [{
              // 위치
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3'
            }]
          }]
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs',
          targets: [{ format: presentationFormat }]
        },
        primitive: {
          topology: wireframe ? 'line-list' : 'triangle-list',
          cullMode: 'back'
        },
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: 'less',
          format: 'depth24plus'
        }
      })

      isLoading = false
      console.log('WebGPU 초기화 완료')
      return true
    } catch (e) {
      console.error('WebGPU 초기화 오류:', e)
      errorMessage = 'WebGPU 초기화 중 오류가 발생했습니다. 다시 시도해주세요.'
      isLoading = false
      return false
    }
  }

  function updateConfigBuffer() {
    if (!device || !configBuffer) return
    
    const configArray = new Float32Array([
      modelScale,
      rotationSpeed,
      rotateX,
      rotateY,
      rotateZ,
      wireframe ? 1.0 : 0.0,
      0, 0, 0, 0, 0, 0, 0 // padding (7개)
    ])
    
    device.queue.writeBuffer(configBuffer, 0, configArray)
  }

  function render(timestamp = 0) {
    if (!device || !context || !pipeline || !timeUniformBuffer || !configBuffer || isLoading) {
      return
    }

    const time = timestamp * 0.001 // 밀리초를 초로 변환
    device.queue.writeBuffer(timeUniformBuffer, 0, new Float32Array([time, 0, 0, 0]))

    // 깊이 텍스처 생성
    const depthTexture = device.createTexture({
      size: [canvasElement.width, canvasElement.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    })

    const renderPassDescriptor = {
      label: 'Model Render Pass',
      colorAttachments: [{
        clearValue: backgroundColor,
        loadOp: 'clear',
        storeOp: 'store',
        view: context.getCurrentTexture().createView(),
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    }

    const encoder = device.createCommandEncoder({ label: 'command encoder' })
    const pass = encoder.beginRenderPass(renderPassDescriptor)
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: timeUniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: configBuffer },
        },
      ],
    }))
    
    pass.setVertexBuffer(0, modelBuffer)
    pass.setIndexBuffer(indexBuffer, 'uint32')
    pass.drawIndexed(indexCount)
    
    pass.end()
    
    device.queue.submit([encoder.finish()])
    depthTexture.destroy()
    
    animationFrameId = requestAnimationFrame(render)
  }

  function handleConfigChange() {
    if (pipeline && device) {
      // 파이프라인 토폴로지 변경 필요 시 파이프라인 재생성
      if (wireframe !== (pipeline.primitive.topology === 'line-list')) {
        initWebGPU()
      } else {
        updateConfigBuffer()
      }
    }
  }

  function updateCanvasSize() {
    if (canvasElement && context) {
      // 화면 크기에 맞게 캔버스 크기 조정
      const devicePixelRatio = window.devicePixelRatio || 1
      const displayWidth = Math.floor(canvasElement.clientWidth * devicePixelRatio)
      const displayHeight = Math.floor(canvasElement.clientHeight * devicePixelRatio)

      if (canvasElement.width !== displayWidth || canvasElement.height !== displayHeight) {
        canvasElement.width = displayWidth
        canvasElement.height = displayHeight
        context.configure({
          device,
          format: navigator.gpu.getPreferredCanvasFormat(),
          alphaMode: 'opaque'
        })
      }
    }
  }

  onMount(async () => {
    const success = await initWebGPU()
    if (success && device && context) {
      updateCanvasSize()
      updateConfigBuffer()
      render()
      
      // 창 크기 변경 시 캔버스 크기 조정
      window.addEventListener('resize', () => {
        updateCanvasSize()
      })
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      // 이벤트 리스너 제거
      window.removeEventListener('resize', updateCanvasSize)
    }
  })
</script>

<div class="container">
  <h1>WebGPU 3D 모델 렌더러</h1>
  
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
  
  {#if isLoading}
    <div class="loading">
      <p>모델 로딩 중... {loadingProgress}%</p>
      <div class="progress-bar">
        <div class="progress" style="width: {loadingProgress}%"></div>
      </div>
    </div>
  {/if}
  
  <div class="layout">
    <div class="canvas-container">
      <canvas
        bind:this={canvasElement}
        width="800"
        height="600"
      />
    </div>
    
    <div class="controls">
      <h2>모델 설정</h2>
      
      <div class="control-group">
        <label>
          회전 속도:
          <input 
            type="range" 
            min="0" 
            max="5" 
            step="0.1" 
            bind:value={rotationSpeed} 
            on:input={handleConfigChange}
          />
          <span class="value">{rotationSpeed.toFixed(1)}</span>
        </label>
      </div>
      
      <div class="control-group">
        <label>
          모델 크기:
          <input 
            type="range" 
            min="0.1" 
            max="2" 
            step="0.05" 
            bind:value={modelScale} 
            on:input={handleConfigChange}
          />
          <span class="value">{modelScale.toFixed(2)}</span>
        </label>
      </div>
      
      <div class="control-group">
        <h3>회전 각도</h3>
        
        <label>
          X축 회전:
          <input 
            type="range" 
            min="-3.14" 
            max="3.14" 
            step="0.1" 
            bind:value={rotateX} 
            on:input={handleConfigChange}
          />
          <span class="value">{rotateX.toFixed(1)}</span>
        </label>
        
        <label>
          Y축 회전:
          <input 
            type="range" 
            min="-3.14" 
            max="3.14" 
            step="0.1" 
            bind:value={rotateY} 
            on:input={handleConfigChange}
          />
          <span class="value">{rotateY.toFixed(1)}</span>
        </label>
        
        <label>
          Z축 회전:
          <input 
            type="range" 
            min="-3.14" 
            max="3.14" 
            step="0.1" 
            bind:value={rotateZ} 
            on:input={handleConfigChange}
          />
          <span class="value">{rotateZ.toFixed(1)}</span>
        </label>
      </div>
      
      <div class="control-group">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            bind:checked={wireframe} 
            on:change={handleConfigChange}
          />
          와이어프레임 모드
        </label>
      </div>
      
      <div class="control-group">
        <h3>배경색</h3>
        <label>
          Red:
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            bind:value={backgroundColor.r} 
            on:input={handleConfigChange}
          />
          <span class="value">{backgroundColor.r.toFixed(2)}</span>
        </label>
        
        <label>
          Green:
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            bind:value={backgroundColor.g} 
            on:input={handleConfigChange}
          />
          <span class="value">{backgroundColor.g.toFixed(2)}</span>
        </label>
        
        <label>
          Blue:
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            bind:value={backgroundColor.b} 
            on:input={handleConfigChange}
          />
          <span class="value">{backgroundColor.b.toFixed(2)}</span>
        </label>
      </div>
    </div>
  </div>
</div>

<style>
  .container {
    height: 100%;
    width: 100%;
    padding: 20px;
  }

  .layout {
    display: flex;
    flex-direction: row;
    gap: 20px;
    height: calc(80vh - 100px);
  }

  .canvas-container {
    flex: 1;
    min-width: 0;
  }

  canvas {
    border: 1px solid #ccc;
    background-color: #000;
    width: 100%;
    height: 100%;
  }

  .controls {
    width: 300px;
    padding: 15px;
    background-color: #f5f5f5;
    border-radius: 5px;
    max-height: 100%;
    overflow-y: auto;
  }

  .control-group {
    margin-bottom: 20px;
  }

  h2 {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 1.2rem;
  }

  h3 {
    margin-top: 10px;
    margin-bottom: 10px;
    font-size: 1rem;
  }

  label {
    display: block;
    margin-bottom: 10px;
    font-size: 0.9rem;
  }

  input[type="range"] {
    width: 100%;
    margin-top: 5px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  input[type="checkbox"] {
    margin: 0;
  }

  .value {
    display: inline-block;
    min-width: 40px;
    text-align: right;
    margin-left: 10px;
  }

  .error {
    color: red;
    margin: 10px 0;
  }

  .loading {
    margin: 20px 0;
    text-align: center;
  }

  .progress-bar {
    width: 100%;
    height: 10px;
    background-color: #eee;
    border-radius: 5px;
    overflow: hidden;
    margin-top: 10px;
  }

  .progress {
    height: 100%;
    background-color: #4caf50;
    transition: width 0.3s ease;
  }

  @media (max-width: 768px) {
    .layout {
      flex-direction: column;
      height: auto;
    }
    
    .canvas-container {
      height: 50vh;
    }
    
    .controls {
      width: 100%;
    }
  }
</style> 