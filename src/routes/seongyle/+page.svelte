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

  async function initWebGPU() {
    const adapter = await navigator.gpu?.requestAdapter()
    device = await adapter?.requestDevice()
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
    })

    timeUniformBuffer = device.createBuffer({
      size: 4, // float32 size
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const shaderModule = createShaderModule(device, {
      label: 'draw rotating triangle',
      code: `
        struct TimeUniform {
          time: f32
        }
        @group(0) @binding(0) var<uniform> timeUniform: TimeUniform;

        @vertex fn vs(
          @builtin(vertex_index) vertexIndex : u32
        ) -> @builtin(position) vec4f {
          let angle = timeUniform.time;
          let pos = array(
            vec2f(0.0, 0.5),    // top
            vec2f(-0.5, -0.5),  // bottom left
            vec2f(0.5, -0.5)    // bottom right
          );
          
          // 회전 행렬 적용
          let x = pos[vertexIndex].x;
          let y = pos[vertexIndex].y;
          let rotatedX = x * cos(angle) - y * sin(angle);
          let rotatedY = x * sin(angle) + y * cos(angle);
          
          return vec4f(rotatedX, rotatedY, 0.0, 1.0);
        }

        @fragment fn fs() -> @location(0) vec4f {
          let r = sin(timeUniform.time);
          let g = cos(timeUniform.time);
          let b = sin(timeUniform.time + 0.42);
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
  }

  function render(timestamp = 0) {
    const time = timestamp * 0.001 // 밀리초를 초로 변환
    device.queue.writeBuffer(timeUniformBuffer, 0, new Float32Array([time]))

    const renderPassDescriptor = {
      label: 'canvas render pass',
      colorAttachments: [{
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
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
      ],
    }))
    pass.draw(3) // 3개의 정점만 그리도록 수정
    pass.end()

    device.queue.submit([encoder.finish()])
    animationFrameId = requestAnimationFrame(render)
  }

  onMount(async () => {
    await initWebGPU()
    render()
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  })
</script>

<div class="container">
  <h1>WebGPU 테스트</h1>
  
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
  
  <canvas
    bind:this={canvasElement}
  />
</div>

<style>
  .container {
    height: 80vh; /* 뷰포트 높이의 80%로 설정 */
    width: 100%;
    justify-content: center;
    align-items: center;
  }

  canvas {
    border: 1px solid #ccc;
    background-color: #000;
    width: 100%;
    height: 100%;
  }

  .error {
    color: red;
    margin: 10px 0;
  }
</style> 