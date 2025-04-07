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

  // GUI 설정값
  let rotationSpeed = 1.0
  let triangleSize = 0.5
  let redOffset = 0.0
  let greenOffset = 0.0
  let blueOffset = 0.42
  let backgroundColor = { r: 0, g: 0, b: 0, a: 1 }

  // 설정값 구조체
  const configBufferSize = 64 // 최소 48바이트 (12개의 float32) 필요, 여유있게 64로 설정

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

      timeUniformBuffer = device.createBuffer({
        size: 4, // float32 size
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })

      configBuffer = device.createBuffer({
        size: configBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })

      updateConfigBuffer()
      
      const shaderModule = createShaderModule(device, {
        label: 'draw rotating triangle',
        code: `
          struct TimeUniform {
            time: f32
          }
          @group(0) @binding(0) var<uniform> timeUniform: TimeUniform;

          struct Config {
            triangleSize: f32,
            rotationSpeed: f32,
            redOffset: f32,
            greenOffset: f32,
            blueOffset: f32,
            padding1: f32,
            padding2: f32,
            padding3: f32,
            padding4: f32,
            padding5: f32,
            padding6: f32,
            padding7: f32,
          }
          @group(0) @binding(1) var<uniform> config: Config;

          @vertex fn vs(
            @builtin(vertex_index) vertexIndex : u32
          ) -> @builtin(position) vec4f {
            let angle = timeUniform.time * config.rotationSpeed;
            let size = config.triangleSize;
            let pos = array(
              vec2f(0.0, size),       // top
              vec2f(-size, -size),    // bottom left
              vec2f(size, -size)      // bottom right
            );
            
            // 회전 행렬 적용
            let x = pos[vertexIndex].x;
            let y = pos[vertexIndex].y;
            let rotatedX = x * cos(angle) - y * sin(angle);
            let rotatedY = x * sin(angle) + y * cos(angle);
            
            return vec4f(rotatedX, rotatedY, 0.0, 1.0);
          }

          @fragment fn fs() -> @location(0) vec4f {
            let r = sin(timeUniform.time + config.redOffset);
            let g = cos(timeUniform.time + config.greenOffset);
            let b = sin(timeUniform.time + config.blueOffset);
            // 각 색상 값이 0보다 크도록 조정 (0.2~1.0 범위)
            let adjustedR = r * 0.4 + 0.6; // sin 값을 0.2~1.0 범위로 변환
            let adjustedG = g * 0.4 + 0.6; // cos 값을 0.2~1.0 범위로 변환
            let adjustedB = b * 0.4 + 0.6; // sin 값을 0.2~1.0 범위로 변환
            return vec4f(adjustedR, adjustedG, adjustedB, 1.0);
          }
        `
      })

      pipeline = device.createRenderPipeline({
        label: 'draw rotating triangle',
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs',
          targets: [{ format: presentationFormat }],
        },
      })

      console.log('WebGPU 초기화 완료')
      return true
    } catch (e) {
      console.error('WebGPU 초기화 오류:', e)
      errorMessage = 'WebGPU 초기화 중 오류가 발생했습니다. 다시 시도해주세요.'
      return false
    }
  }

  function updateConfigBuffer() {
    if (!device || !configBuffer) return
    
    const configArray = new Float32Array([
      triangleSize,
      rotationSpeed,
      redOffset,
      greenOffset,
      blueOffset,
      0, 0, 0, 0, 0, 0, 0 // padding (7개)
    ])
    
    device.queue.writeBuffer(configBuffer, 0, configArray)
  }

  function render(timestamp = 0) {
    if (!device || !context || !pipeline || !timeUniformBuffer || !configBuffer) {
      console.error('WebGPU resources not initialized')
      return
    }

    const time = timestamp * 0.001 // 밀리초를 초로 변환
    device.queue.writeBuffer(timeUniformBuffer, 0, new Float32Array([time]))

    const renderPassDescriptor = {
      label: 'canvas render pass',
      colorAttachments: [{
        clearValue: backgroundColor,
        loadOp: 'clear',
        storeOp: 'store',
        view: context.getCurrentTexture().createView(),
      }],
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
    pass.draw(3) // 3개의 정점만 그리도록 수정
    pass.end()

    device.queue.submit([encoder.finish()])
    animationFrameId = requestAnimationFrame(render)
  }

  function handleConfigChange() {
    updateConfigBuffer()
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
  <h1>WebGPU 테스트</h1>
  
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
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
      <h2>WebGPU 설정</h2>
      
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
          삼각형 크기:
          <input 
            type="range" 
            min="0.1" 
            max="1" 
            step="0.05" 
            bind:value={triangleSize} 
            on:input={handleConfigChange}
          />
          <span class="value">{triangleSize.toFixed(2)}</span>
        </label>
      </div>
      
      <div class="control-group">
        <h3>색상 설정</h3>
        
        <label>
          Red 오프셋:
          <input 
            type="range" 
            min="0" 
            max="6.28" 
            step="0.1" 
            bind:value={redOffset} 
            on:input={handleConfigChange}
          />
          <span class="value">{redOffset.toFixed(1)}</span>
        </label>
        
        <label>
          Green 오프셋:
          <input 
            type="range" 
            min="0" 
            max="6.28" 
            step="0.1" 
            bind:value={greenOffset} 
            on:input={handleConfigChange}
          />
          <span class="value">{greenOffset.toFixed(1)}</span>
        </label>
        
        <label>
          Blue 오프셋:
          <input 
            type="range" 
            min="0" 
            max="6.28" 
            step="0.1" 
            bind:value={blueOffset} 
            on:input={handleConfigChange}
          />
          <span class="value">{blueOffset.toFixed(1)}</span>
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
    height: calc(80vh - 50px);
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